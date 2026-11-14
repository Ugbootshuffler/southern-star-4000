"""Capture the first frame of each display into screenshots/.
usage: python3 tools/capture.py BASE_URL PREFIX [query]"""
import sys, time, os
from playwright.sync_api import sync_playwright
base, prefix = sys.argv[1], sys.argv[2]
query = sys.argv[3] if len(sys.argv) > 3 else ''
out = os.path.join(os.path.dirname(__file__), '..', 'screenshots')
os.makedirs(out, exist_ok=True)
seen = set()
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1000, 'height': 1100})
    errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto(base + query); time.sleep(12)
    pg.evaluate("document.querySelector('#NavigateMenu').click()"); time.sleep(1)
    pg.locator('#container').screenshot(path=f'{out}/{prefix}-00-progress.png')
    for i in range(60):
        pg.evaluate("document.querySelector('#NavigateNext').click()"); time.sleep(1.6)
        active = pg.evaluate("[...document.querySelectorAll('.weather-display.show')].map(e=>e.id.replace('-html','')).join('_') || 'none'")
        if active in seen:
            if active == 'current-weather': break
            continue
        seen.add(active)
        if active == 'radar': time.sleep(3)
        pg.locator('#container').screenshot(path=f'{out}/{prefix}-{len(seen):02d}-{active}.png')
    pg.screenshot(path=f'{out}/{prefix}-page.png', full_page=True)
    print(prefix, sorted(seen), [e for e in errors if 'Wake Lock' not in e])
    b.close()
