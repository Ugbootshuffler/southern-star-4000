"""Headless test: load the app, step through each screen, save screenshots.
usage: python3 tools/shoot.py [base_url] [outdir] [extra_query]"""
import sys, time, json
from playwright.sync_api import sync_playwright
base = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8091/'
out = sys.argv[2] if len(sys.argv) > 2 else '/tmp/shots'
extra = sys.argv[3] if len(sys.argv) > 3 else ''
import os; os.makedirs(out, exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 1000, 'height': 1200})
    logs = []
    pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}'))
    pg.on('pageerror', lambda e: logs.append(f'PAGEERROR: {e}'))
    pg.on('response', lambda r: logs.append(f'HTTP {r.status}: {r.url[:200]}') if r.status >= 400 else None)
    pg.on('requestfailed', lambda r: logs.append(f'REQFAIL: {r.url} {r.failure}'))
    pg.goto(base + extra)
    time.sleep(12)
    pg.screenshot(path=f'{out}/page.png', full_page=True)
    # pause and step
    pg.evaluate("document.querySelector('#NavigateMenu').click()")
    time.sleep(1)
    pg.locator('#container').screenshot(path=f'{out}/00-progress.png')
    for i in range(1, int(os.environ.get("STEPS","34"))):
        pg.evaluate("document.querySelector('#NavigateNext').click()")
        time.sleep(1.5)
        active = pg.evaluate("[...document.querySelectorAll('.weather-display.show')].map(e=>e.id).join('_') || 'none'")
        pg.locator('#container').screenshot(path=f'{out}/{i:02d}-{active}.png')
        print(i, active)
    print('\n'.join(l for l in logs if not l.startswith('debug'))[:6000])
    b.close()
