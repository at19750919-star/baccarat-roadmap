from pathlib import Path
import json
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width':1920,'height':1080}, reduced_motion='no-preference')
    errors=[]
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.route('https://**', lambda r: r.fulfill(body=''))
    page.goto((root/'tv.html').as_uri())
    page.evaluate('localStorage.clear()')
    page.reload()
    # 6 / 66 / 666 = 幸運6、小老虎、大老虎；連按閒贏鍵 2～6 次 = 幸運7（2、3 次 l7，4～6 次 s7）。
    for seq in [('6','6','Enter'),('6','6','6','Enter'),('2','2','Enter'),('2','2','2','Enter'),('2','2','2','2','Enter'),('2','2','2','2','2','Enter'),('2','2','2','2','2','2','Enter'),('6','Enter')]:
        for key in seq: page.keyboard.press(key)
    actual=page.evaluate('''() => ({ rounds:state.rounds, count:document.querySelectorAll('#beadBoard .bead').length,
      streams:[...document.querySelectorAll('#beadBoard .bead')].map(b=>!!b.querySelector('.bead-orbit')),
      whites:[...document.querySelectorAll('.seven-cards')].map(n=>getComputedStyle(n).color),
      animations:[...document.querySelectorAll('.bead-orbit')].map(n=>{const s=getComputedStyle(n);return [s.animationDuration,s.animationTimingFunction,s.animationIterationCount]}),
      counts:[document.querySelector('#cntST').textContent, document.querySelector('#cntBT').textContent]
    })''')
    assert actual['count']==8, actual
    assert actual['streams']==[False,True,False,False,False,False,True,False], actual
    assert actual['whites']==['rgb(255, 255, 255)']*5, actual
    assert actual['animations']==[['8s','linear','infinite']]*2, actual
    assert actual['counts']==['1','1'], actual
    # Actual playback, followed by deterministic phase checks across a whole revolution.
    page.wait_for_timeout(400)
    a=page.locator('.bead-orbit').first.evaluate('(e)=>e.getAnimations()[0].currentTime')
    page.wait_for_timeout(450)
    b=page.locator('.bead-orbit').first.evaluate('(e)=>e.getAnimations()[0].currentTime')
    assert b-a>250, (a,b)
    phases=page.locator('.bead-orbit').first.evaluate('''e=>{let a=e.getAnimations()[0];a.pause();return [0,2000,4000,8000].map(t=>{a.currentTime=t;return getComputedStyle(e).transform})}''')
    assert phases[0]!=phases[1] and phases[1]!=phases[2] and phases[0]==phases[3], phases
    stored=page.evaluate('JSON.stringify(state.rounds)')
    page.reload()
    assert page.evaluate('JSON.stringify(state.rounds)')==stored
    assert page.locator('.bead-orbit').count()==2
    # Invalid category / side combinations never light up.
    page.evaluate("state.rounds=[{r:'B',s7:6},{r:'P',tiger:'big'},{r:'B',l6:true},{r:'B',tiger:'big',totalCards:5},{r:'B',tiger:'big',totalCards:6}];renderAll()")
    assert page.locator('.bead-orbit').count()==2
    page.keyboard.press('Backspace')
    assert page.locator('.bead-orbit').count()==1
    page.evaluate('state.rounds=[];renderAll()')
    for key in ['1','4','5','Enter','2','Enter','3','Enter']:
        page.keyboard.press(key)
    assert page.evaluate('state.rounds.map(r=>r.r)')==['B','P','T']
    assert page.evaluate('state.rounds[0].bp && state.rounds[0].pp')
    # Enter/escape switching must not leave an old ordinary bet pending.
    for key in ['1','t','Escape','Enter']:
        page.keyboard.press(key)
    assert page.evaluate('state.rounds.length')==3
    # Preview uses an independent key and never overwrites live rounds.
    live=page.evaluate("localStorage.getItem('baccarat_road_rounds_v1')")
    page.goto((root/'tv.html').as_uri()+'?preview=beads')
    assert page.evaluate('state.rounds.length')==8
    assert page.evaluate("localStorage.getItem('baccarat_road_rounds_v1')")==live
    assert page.locator('.bead-orbit').count()==2
    # Ensure every referenced asset actually decodes.
    assets=page.evaluate('''async()=>Promise.all(['cat','tiger','blue-seven','purple-seven'].map(name=>new Promise(resolve=>{const i=new Image();i.onload=()=>resolve([name,i.naturalWidth]);i.onerror=()=>resolve([name,0]);i.src=`assets/beads/${name}.png`})))''')
    assert all(v[1]>0 for v in assets), assets
    page.locator('.bottom-row').screenshot(path=str(root/'.preview/beads-bottom.png'))
    page.locator('#beadBoard').screenshot(path=str(root/'.preview/beads-board.png'))
    assert not errors, errors
    print(json.dumps({'passed':True,'cases':'keyboard, category gating, all big tigers, s7 six only, white digits, live 8s linear orbit, persistence, undo, ordinary rounds/pairs, cancel, isolated preview, asset decode','animations':actual['animations'],'assets':assets,'errors':errors},ensure_ascii=False))
    browser.close()
