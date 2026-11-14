import time, sys
from playwright.sync_api import sync_playwright
base = sys.argv[1]
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1000, 'height': 1000})
    pg.goto(base); time.sleep(6)
    for q in ['Kiama', 'Perth', '2529']:
        pg.fill('#txtAddress', ''); pg.click('#txtAddress'); pg.type('#txtAddress', q, delay=80); time.sleep(2.5)
        sugg = pg.evaluate("[...document.querySelectorAll('.autocomplete-suggestion')].map(e=>e.textContent).slice(0,5)")
        print(q, '->', sugg)
        pg.keyboard.press('Enter'); time.sleep(7)
        print('  location:', pg.inner_text('#divInfo').replace('\n', ' | '), '| stored:', pg.evaluate("localStorage.getItem('latLonQuery')+' '+localStorage.getItem('latLon')"))
        pg.evaluate("document.querySelector('#NavigateMenu').click()"); time.sleep(0.5)
        pg.evaluate("document.querySelector('#NavigateNext').click()"); time.sleep(1.5)
        pg.locator('#container').screenshot(path=f'/tmp/search-{q}.png')
    b.close()
