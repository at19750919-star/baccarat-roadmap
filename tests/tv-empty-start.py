"""Hosted TV starts empty; local TV retains rounds and both retain preferences."""
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect
import json, mimetypes, sys

ROOT=Path(__file__).resolve().parents[1]
LIVE=sys.argv[1] if len(sys.argv)>1 else None
ROUNDS=[{'r':'B','bp':True,'pp':False,'l6':False}, {'r':'P','bp':False,'pp':False,'l6':False,'l7':2}]
PREFS={'columns':44,'statsNameSize':24,'statsNumberSize':36,'statsHeaderSize':24}
KEYS={'keyB':'1','keyP':'2','keyT':'3','keyConfirm':'Enter','keyUndo':'Backspace'}
SAVED=[{'id':'saved-fixture','name':'保留的路單','rounds':ROUNDS}]

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    for hosted in ([True] if LIVE else [False,True]):
        page=browser.new_page(viewport={'width':1920,'height':1080})
        page.route('https://fonts.googleapis.com/**',lambda r:r.fulfill(body=''))
        page.route('https://fonts.gstatic.com/**',lambda r:r.abort())
        page.route('https://cdn.jsdelivr.net/**',lambda r:r.fulfill(body=''))
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        if hosted and not LIVE:
            def site(r):
                name=urlparse(r.request.url).path.removeprefix('/baccarat-roadmap/')
                f=(ROOT/name).resolve()
                if ROOT in f.parents and f.is_file():r.fulfill(path=str(f),content_type=mimetypes.guess_type(f)[0] or 'application/octet-stream')
                else:r.fulfill(status=404,body='')
            page.route('https://at19750919-star.github.io/**',site)
        url=LIVE or ('https://at19750919-star.github.io/baccarat-roadmap/tv.html' if hosted else 'http://127.0.0.1:8082/roadmap/tv.html')
        response=page.goto(url,wait_until='domcontentloaded')
        assert response.status==200
        page.evaluate('''v=>{
            localStorage.setItem('baccarat_road_rounds_v1',JSON.stringify(v.rounds));
            localStorage.setItem('baccarat_beads_preview_v1',JSON.stringify(v.rounds));
            localStorage.setItem('baccarat_tv_settings_v1',JSON.stringify(v.prefs));
            localStorage.setItem('baccarat_key_bindings_v1',JSON.stringify(v.keys));
            localStorage.setItem('at_baccarat_saved_roads_v1',JSON.stringify(v.saved));
        }''',{'rounds':ROUNDS,'prefs':PREFS,'keys':KEYS,'saved':SAVED})
        page.reload(wait_until='domcontentloaded')
        assert page.evaluate('state.rounds.length')==(0 if hosted else 2)
        expect(page.locator('#totalCount')).to_have_text('0' if hosted else '2')
        if hosted:
            expect(page.locator('.grid-board .big-circle,.grid-board .bead,.grid-board .tv-star-mark')).to_have_count(0)
            for name in ['cntB','cntP','cntT','cntBP','cntPP','cntL6','cntL72','cntL73','cntS74','cntS75','cntS76','cntST','cntBT']:
                expect(page.locator('#'+name)).to_have_text('0')
        page.evaluate('speech.enabled=false;document.activeElement.blur()')
        before=page.evaluate('state.rounds.length')
        page.keyboard.press('1');page.keyboard.press('Enter')
        assert page.evaluate('state.rounds.length')==before+1
        page.reload(wait_until='domcontentloaded')
        assert page.evaluate('state.rounds.length')==(0 if hosted else 3)
        for key,value in [('baccarat_tv_settings_v1',PREFS),('baccarat_key_bindings_v1',KEYS),('at_baccarat_saved_roads_v1',SAVED)]:
            assert page.evaluate('key=>JSON.parse(localStorage.getItem(key))',key)==value
        if hosted:
            page.locator('#tvSettingsButton').click()
            assert page.locator('[data-settings-tab]:visible').all_text_contents()==['基本設定','按鍵設定']
            expect(page.locator('#tvBigColumns')).to_have_value('44')
            page.locator('#tvSettingsCancel').click()
            page.goto(url+('&' if '?' in url else '?')+'preview=beads',wait_until='domcontentloaded')
            assert page.evaluate('state.rounds.length')==0,'Hosted preview parameter must not seed samples'
        else:
            page.goto(url+'?preview=beads',wait_until='domcontentloaded')
            assert page.evaluate('state.rounds.length')==2,'Local preview storage stays separate'
        assert not errors,errors
        print('PASS '+('hosted TV: old rounds ignored, zero roads/counts, entry works, reload empty, preferences and saved roads retained, no sample URL bypass' if hosted else 'local TV: old rounds and new entries survive reload, independent preview preserved'))
        page.close()
    browser.close()
