from pathlib import Path
import json, sys
from playwright.sync_api import sync_playwright
root=Path(sys.argv[1])
import faulthandler
faulthandler.dump_traceback_later(12, exit=True)
print('starting Playwright driver', flush=True)
with sync_playwright() as p:
    print('driver started; launching Chromium', flush=True)
    browser=p.chromium.launch(headless=True, timeout=8000)
    context=browser.new_context(viewport={'width':1920,'height':1080})
    page=context.new_page()
    page.set_default_timeout(8000)
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('https://**',lambda r:r.fulfill(body=''))
    page.goto((root/'tv.html').as_uri(),wait_until='domcontentloaded')
    page.evaluate('speech.enabled=false')
    faulthandler.cancel_dump_traceback_later()
    print('isolated page loaded',flush=True)
    def press(*keys):
        for key in keys: page.keyboard.press(key)
    def rounds():return page.evaluate('state.rounds')
    press('6','Enter')
    assert len(rounds())==1 and rounds()[0]['l6'] and rounds()[0]['tiger'] is None and rounds()[0]['r']=='B'
    press('6','6','Enter')
    assert rounds()[-1]['tiger']=='small' and rounds()[-1]['r']=='B' and rounds()[-1]['l6']
    press('6','6','6','Enter')
    assert rounds()[-1]['tiger']=='big' and rounds()[-1]['r']=='B'
    press('Enter')
    assert len(rounds())==3
    # 2 是閒贏鍵，不再是小老虎分類。6 然後 2 必須記成閒，不能記成小老虎。
    press('6','2','Enter')
    assert rounds()[-1]['r']=='P' and rounds()[-1]['tiger'] is None and not rounds()[-1]['l6']
    press('Numpad6','NumpadEnter')
    assert rounds()[-1]['tiger'] is None and rounds()[-1]['l6'] and rounds()[-1]['r']=='B'
    press('Numpad6','Numpad6','NumpadEnter')
    assert rounds()[-1]['tiger']=='small' and rounds()[-1]['r']=='B'
    press('Numpad6','Numpad6','Numpad6','NumpadEnter')
    assert rounds()[-1]['tiger']=='big' and rounds()[-1]['r']=='B'
    print('top row and numpad six/small/big passed',flush=True)
    for starter in ('6','Numpad6'):
        before=len(rounds())
        press('1',starter,'2','Escape','Enter')
        assert len(rounds())==before
        press('2','Enter')
        assert rounds()[-1]['r']=='P' and not rounds()[-1]['l6']
    before=len(rounds())
    press('Backspace')
    assert len(rounds())==before-1
    press('Enter')
    assert len(rounds())==before-1
    press('6','4','5','Enter')
    assert rounds()[-1]['l6'] and rounds()[-1]['bp'] and rounds()[-1]['pp'] and rounds()[-1]['tiger'] is None
    for key, enter in (('2','Enter'),('Numpad2','NumpadEnter')):
        for n in (2,3,4,5,6):
            before=len(rounds())
            press(*([key]*n+[enter]))
            assert len(rounds())==before+1
            last=rounds()[-1]
            assert last['r']=='P' and last['tiger'] is None
            if n<=3: assert last['l7']==n and not last['s7']
            else: assert last['s7']==n and not last['l7']
    print('cancel, undo, pairs, lucky seven passed',flush=True)
    # 對子鍵在連按 6 之前或中間按下，送出小老虎／大老虎時都要留著。
    for six, four, five, enter in [('6','4','5','Enter'),('Numpad6','Numpad4','Numpad5','NumpadEnter')]:
        for extra in (0,1,2):
            press(*([four,five,six]+[six]*extra+[enter]))
            last=rounds()[-1]
            assert last['bp'] and last['pp'] and last['r']=='B' and last['l6']
            assert last['tiger']==(None if extra==0 else 'small' if extra==1 else 'big')
        press(six,four,five,six,enter)
        assert rounds()[-1]['bp'] and rounds()[-1]['pp'] and rounds()[-1]['tiger']=='small'
        press(four,five,six,'Escape')
        press(six,enter)
        assert not rounds()[-1]['bp'] and not rounds()[-1]['pp'] and rounds()[-1]['tiger'] is None and rounds()[-1]['l6']
    stored=rounds()
    page.reload(wait_until='domcontentloaded')
    assert rounds()==stored
    # Save JSON/local entry through real code, with remote backup intentionally stubbed.
    page.evaluate("window.RoadBackup={save:async()=>{}}")
    page.on('dialog',lambda d:d.accept('six-prefix-test') if d.type=='prompt' else d.accept())
    with page.expect_download() as event:
        page.evaluate('saveRoadmap()')
    download=event.value
    data=json.loads(Path(download.path()).read_text(encoding='utf-8'))
    assert data['rounds']==stored
    assert page.evaluate("JSON.parse(localStorage.getItem(SAVED_ROADS_KEY))[0].rounds")==stored
    expected=sum(r.get('tiger')=='big' and r['r']=='B' or r.get('s7')==6 and r['r']=='P' for r in stored)
    assert page.locator('.bead-orbit').count()==expected
    assert page.locator('.bead-orbit').evaluate_all("(es)=>es.every(e=>{let s=getComputedStyle(e);return s.animationDuration==='8s'&&s.animationTimingFunction==='linear'})")
    assert page.locator('.seven-cards').evaluate_all("(es)=>es.every(e=>getComputedStyle(e).color==='rgb(255, 255, 255)')")
    assert not errors,errors
    print(json.dumps({'passed':True,'rounds':len(stored),'checks':['top-row 6/66/666','6 then 2 stays player','numpad 6/66/666','Esc and pending cancellation','Backspace undo','ordinary pairs','seven repeated 2 through 6','pairs survive repeated sixes','reload persistence','download JSON and saved entry','unchanged orbit and white digits'],'runtimeErrors':errors},ensure_ascii=False),flush=True)
    browser.close()


