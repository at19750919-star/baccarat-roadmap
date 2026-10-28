from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright,expect
import mimetypes
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    for deployed in [False,True]:
        page=browser.new_page(viewport={'width':1920,'height':1080})
        page.route('https://**',lambda r:r.fulfill(body=''))
        if deployed:
            def site(r):
                name=urlparse(r.request.url).path.removeprefix('/baccarat-roadmap/')
                f=(ROOT/name).resolve()
                if ROOT in f.parents and f.is_file():r.fulfill(path=str(f),content_type=mimetypes.guess_type(f)[0] or 'application/octet-stream')
                else:r.fulfill(status=404,body='')
            page.route('https://at19750919-star.github.io/**',site)
        origin='https://at19750919-star.github.io/baccarat-roadmap/' if deployed else 'http://127.0.0.1:8082/roadmap/'
        page.goto(origin+'tv.html?settings=statsFont',wait_until='domcontentloaded')
        if deployed:expect(page.locator('#tvSettings')).not_to_be_visible()
        else:expect(page.locator('#tvStatsFontPanel')).to_be_visible();page.locator('#tvSettingsCancel').click()
        page.locator('#tvSettingsButton').click()
        tabs=page.locator('[data-settings-tab]:visible')
        assert tabs.count()==(2 if deployed else 7)
        assert tabs.all_text_contents()[:2]==['基本設定','按鍵設定']
        page.locator('#tvTabBasic').focus();page.keyboard.press('ArrowRight');expect(page.locator('#tvTabKeys')).to_be_focused()
        page.keyboard.press('ArrowRight');expect(page.locator('#tvTabBasic' if deployed else '#tvTabScreen')).to_be_focused()
        if deployed:
            page.locator('#tvTabKeys').click();expect(page.locator('#tvKeysPanel')).to_be_visible()
            for name in ['tvColorPanel','tvStatsFontPanel','tvSymbolsPanel']:expect(page.locator('#'+name)).not_to_be_visible()
        page.locator('#tvSettingsCancel').click()
        print('PASS '+('deployed: basic/keys only; hidden panels and deep link blocked; keyboard skips hidden tabs' if deployed else 'local: all seven settings remain available'))
        page.close()
    browser.close()
