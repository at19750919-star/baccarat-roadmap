"""用法：python 看面板.py 設定面板-XXX.css [輸出前綴]
開 tv.html，把 tv-settings-casino.css 換成指定檔，打開路單設定，三個分頁各截一張圖，並檢查捲軸、錯誤、圓角、字型、材質數。"""
import sys, os, json, subprocess, time
from pathlib import Path
from playwright.sync_api import sync_playwright
here = Path(__file__).resolve().parent; root = here.parent
css = Path(sys.argv[1]).resolve(); pre = sys.argv[2] if len(sys.argv) > 2 else css.stem
port = 18460 + (abs(hash(css.name)) % 30)
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(port), '--bind', '127.0.0.1'], cwd=root, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(channel='chrome'); pg = b.new_page(viewport={'width': 1920, 'height': 1080}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.route('**/tv-settings-casino.css*', lambda r: r.fulfill(path=str(css), content_type='text/css'))
        pg.goto(f'http://127.0.0.1:{port}/tv.html'); pg.wait_for_timeout(1500)
        pg.click('#tvSettingsButton'); pg.wait_for_timeout(700); pg.evaluate('document.fonts.ready')
        res = {}
        for t in ['Basic', 'Keys', 'Save']:
            pg.click(f'#tvTab{t}'); pg.wait_for_timeout(400)
            box = pg.locator('#tvSettings').bounding_box()
            pg.screenshot(path=str(here / f'{pre}-{t}.png'), clip=box, scale='css')
            res[t] = pg.evaluate('''()=>{const d=document.getElementById('tvSettings'),c=d.querySelector('.tv-settings-content');
              const els=[...d.querySelectorAll('*')].filter(e=>e.offsetParent);
              const rad=new Set(),font=new Set();els.forEach(e=>{const s=getComputedStyle(e);const r=s.borderTopLeftRadius;if(r!=='0px')rad.add(r);font.add(s.fontFamily)});
              return {scroll:[c.scrollHeight,c.clientHeight],size:[Math.round(d.offsetWidth),Math.round(d.offsetHeight)],radius:[...rad],fonts:[...font]}}''')
        res['errors'] = errs
        print(json.dumps(res, ensure_ascii=False, indent=1))
        b.close()
finally:
    srv.terminate()
