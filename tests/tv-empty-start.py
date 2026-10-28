"""A hosted TV tab starts empty and survives refresh; local persistence is unchanged."""
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect
import mimetypes, sys

ROOT=Path(__file__).resolve().parents[1]
LIVE=sys.argv[1] if len(sys.argv)>1 else None
ROUNDS=[{'r':'B','bp':True,'pp':False,'l6':False}, {'r':'P','bp':False,'pp':False,'l6':False,'l7':2}]
PREFS={'columns':44,'statsNameSize':24,'statsNumberSize':36,'statsHeaderSize':24}
KEYS={'keyB':'1','keyP':'2','keyT':'3','keyConfirm':'Enter','keyUndo':'Backspace'}
SAVED=[{'id':'saved-fixture','name':'保留的路單','rounds':ROUNDS}]

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    for hosted in ([True] if LIVE else [False,True]):
        context=browser.new_context(viewport={'width':1920,'height':1080})
        context.route('https://fonts.googleapis.com/**',lambda r:r.fulfill(body=''))
        context.route('https://fonts.gstatic.com/**',lambda r:r.abort())
        context.route('https://cdn.jsdelivr.net/**',lambda r:r.fulfill(body=''))
        errors=[]
        if hosted and not LIVE:
            def site(r):
                name=urlparse(r.request.url).path.removeprefix('/baccarat-roadmap/')
                f=(ROOT/name).resolve()
                if ROOT in f.parents and f.is_file():r.fulfill(path=str(f),content_type=mimetypes.guess_type(f)[0] or 'application/octet-stream')
                else:r.fulfill(status=404,body='')
            context.route('https://at19750919-star.github.io/**',site)
        url=LIVE or ('https://at19750919-star.github.io/baccarat-roadmap/tv.html' if hosted else 'http://127.0.0.1:8082/roadmap/tv.html')
        def open_tab(target=url):
            tab=context.new_page();tab.on('pageerror',lambda e:errors.append(str(e)))
            assert tab.goto(target,wait_until='domcontentloaded').status==200
            return tab
        # Seed legacy browser data and preferences before opening a fresh tab.
        seed=open_tab()
        seed.evaluate("""v=>{
            localStorage.setItem('baccarat_road_rounds_v1',JSON.stringify(v.rounds));
            localStorage.setItem('baccarat_beads_preview_v1',JSON.stringify(v.rounds));
            localStorage.setItem('baccarat_tv_settings_v1',JSON.stringify(v.prefs));
            localStorage.setItem('baccarat_key_bindings_v1',JSON.stringify(v.keys));
            localStorage.setItem('at_baccarat_saved_roads_v1',JSON.stringify(v.saved));
        }""",{'rounds':ROUNDS,'prefs':PREFS,'keys':KEYS,'saved':SAVED})
        seed.close();page=open_tab()
        initial=0 if hosted else 2
        assert page.evaluate('state.rounds.length')==initial
        expect(page.locator('#totalCount')).to_have_text(str(initial))
        if hosted:
            expect(page.locator('.grid-board .big-circle,.grid-board .bead,.grid-board .tv-star-mark')).to_have_count(0)
            for name in ['cntB','cntP','cntT','cntBP','cntPP','cntL6','cntL72','cntL73','cntS74','cntS75','cntS76','cntST','cntBT']:
                expect(page.locator('#'+name)).to_have_text('0')
        page.evaluate('speech.enabled=false;document.activeElement.blur()')
        page.keyboard.press('1');page.keyboard.press('Enter')
        entered=page.evaluate('JSON.stringify(state.rounds)')
        assert page.evaluate('state.rounds.length')==initial+1
        page.reload(wait_until='domcontentloaded')
        assert page.evaluate('JSON.stringify(state.rounds)')==entered,'Refresh must retain the complete road'
        expect(page.locator('#totalCount')).to_have_text(str(initial+1))
        if hosted:
            other=open_tab();assert other.evaluate('state.rounds.length')==0,'New tabs start empty'
            other.close();page.reload(wait_until='domcontentloaded')
            assert page.evaluate('JSON.stringify(state.rounds)')==entered,'Another tab must not erase the existing tab'
            preview=url+('&' if '?' in url else '?')+'preview=beads'
            page.goto(preview,wait_until='domcontentloaded')
            assert page.evaluate('JSON.stringify(state.rounds)')==entered,'Same tab keeps rounds across URL variants'
            other=open_tab(preview);assert other.evaluate('state.rounds.length')==0;other.close()
            # Upgrade safety: a v10 tab has working rounds in legacy localStorage.
            # Its first refresh after updating must migrate those rounds, not lose them.
            page.evaluate("""rounds=>{sessionStorage.clear();localStorage.setItem('baccarat_road_rounds_v1',JSON.stringify(rounds));}""",ROUNDS)
            page.reload(wait_until='domcontentloaded')
            assert page.evaluate('state.rounds')==ROUNDS,'Upgrade refresh must recover the current v10 road'
            page.reload(wait_until='domcontentloaded');assert page.evaluate('state.rounds')==ROUNDS
            page.locator('#tvSettingsButton').click()
            assert page.locator('[data-settings-tab]:visible').all_text_contents()==['基本設定','按鍵設定']
            expect(page.locator('#tvBigColumns')).to_have_value('44')
            page.locator('#tvSettingsCancel').click()
            page.on('dialog',lambda d:d.accept())
            page.evaluate('clearAll()');page.reload(wait_until='domcontentloaded')
            assert page.evaluate('state.rounds.length')==0,'An intentionally cleared tab must stay empty on refresh'
        else:
            page.goto(url+'?preview=beads',wait_until='domcontentloaded')
            assert page.evaluate('state.rounds')==ROUNDS,'Local preview storage stays separate'
        for key,value in [('baccarat_tv_settings_v1',PREFS),('baccarat_key_bindings_v1',KEYS),('at_baccarat_saved_roads_v1',SAVED)]:
            assert page.evaluate('key=>JSON.parse(localStorage.getItem(key))',key)==value
        assert not errors,errors
        print('PASS '+('hosted TV: new tab empty, refresh retains full rounds, independent tabs, no samples, v10 upgrade refresh migrates records, clear remains empty, settings and saved roads retained' if hosted else 'local TV: old rounds and new entries survive reload, independent preview preserved'))
        context.close()
    browser.close()
