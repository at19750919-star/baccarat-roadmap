from pathlib import Path
from playwright.sync_api import sync_playwright,expect
import json,sys
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    page=browser.new_page(viewport={'width':1920,'height':1080})
    page.route('https://**',lambda r:r.fulfill(body=''))
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(sys.argv[1] if len(sys.argv)>1 else (root/'tv.html').as_uri()+'?preview=beads',wait_until='domcontentloaded')
    page.evaluate('speech.enabled=false')
    records=page.evaluate('JSON.stringify(state.rounds)')
    def settled():page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
    def size(selector):return page.locator(selector).evaluate('(e)=>parseFloat(getComputedStyle(e).fontSize)')
    short='.tv-stats .stat-banker .k';long='.tv-stats .tv-super-lucky7 .k'
    page.wait_for_function('parseFloat(getComputedStyle(document.querySelector(".tv-stats .stat-banker .k")).fontSize)>parseFloat(getComputedStyle(document.querySelector(".tv-stats .tv-super-lucky7 .k")).fontSize)+1',timeout=2500)
    expect(page.locator('.tv-stats .tv-stat-seven-line')).to_have_count(3)
    lucky=page.locator('.tv-stats .stat-lucky6 .tv-stat-main').evaluate_all('es=>es.map(e=>e.textContent)')
    assert lucky==['幸運6','小老虎','大老虎'],lucky
    tigers=page.locator('.tv-stats .stat-lucky6').evaluate_all('''es=>es.filter(e=>['小老虎','大老虎'].includes((e.querySelector('.tv-stat-main')||{}).textContent)).map(e=>e.querySelector('.k').textContent)''')
    assert tigers==['小老虎','大老虎'],tigers
    sevens=page.locator('.tv-stats .k.tv-stat-seven').evaluate_all('''es=>es.map(e=>({top:!!e.querySelector(':scope > .tv-stat-seven-top'),prefix:(e.querySelector('.tv-stat-prefix')||{}).textContent||'',mult:(e.querySelector('.tv-stat-mult')||{}).textContent||'',main:(e.querySelector(':scope > .tv-stat-main')||{}).textContent||''}))''')
    assert [s['prefix'] for s in sevens]==['超級','','超級','','超級'] and all(s['top'] and s['main']=='幸運7' and '×' in s['mult'] for s in sevens),sevens
    short_main='.tv-stats .stat-banker .tv-stat-main'
    original_name=page.locator(short_main).inner_text();original_size=size(short)
    page.locator(short_main).evaluate('(e)=>e.textContent="莊家勝出"');settled()
    assert size(short)<original_size-1,'A longer name must get a smaller font'
    shrunk=size(short)
    page.locator(short_main).evaluate('(e,t)=>e.textContent=t',original_name)
    page.wait_for_function('''(small)=>parseFloat(getComputedStyle(document.querySelector(".tv-stats .stat-banker .k")).fontSize)>small+1''',arg=shrunk)
    before_count=size('#cntB')
    page.locator('.tv-stats .stats-list li > b').evaluate_all('(es)=>es.forEach(e=>e.textContent="999")');settled()
    assert size('#cntB')<before_count-1,'More count digits must shrink the shared count'
    cases=[]
    for width,height,columns in [(1920,1080,46),(1985,804,46),(1280,720,46),(1920,1080,48),(1920,1080,38)]:
        page.set_viewport_size({'width':width,'height':height})
        page.evaluate('''(columns)=>{document.querySelector("#tvSettingsButton").click();const input=document.querySelector("#tvBigColumns");input.value=String(columns);document.querySelector("#tvSettings button[type=submit]").click()}''',columns);settled()
        for digits in ['8','12','999']:
            page.locator('.tv-stats .stats-list li > b').evaluate_all('(es,t)=>es.forEach(e=>e.textContent=t)',digits);settled()
            bad=page.locator('.tv-stats .stats-list li:not(.tv-stat-empty)').evaluate_all('''es=>es.flatMap(e=>{const label=e.querySelector('.k'),number=e.querySelector('b').getBoundingClientRect(),box=e.getBoundingClientRect(),w=document.createTreeWalker(label,NodeFilter.SHOW_TEXT);let t,issues=[];while(t=w.nextNode()){if(!t.textContent.trim())continue;const r=document.createRange();r.selectNodeContents(t);for(const a of r.getClientRects())if(a.left<box.left-1||a.right>number.left-1||a.top<box.top-1||a.bottom>box.bottom+1)issues.push(t.textContent)}return issues})''')
            assert not bad,(width,height,columns,digits,bad)
        cases.append([width,height,columns])
    page.evaluate('renderAll()');settled()
    assert page.evaluate('JSON.stringify(state.rounds)')==records
    fitted=page.locator('.tv-stats .stats-list .k').evaluate_all('es=>es.map(e=>({size:parseFloat(getComputedStyle(e).fontSize),height:e.clientHeight}))')
    assert all(18<=item['size']<=item['height']*0.94+0.05 for item in fitted),fitted
    page.evaluate('''()=>{localStorage.removeItem("baccarat_tv_settings_v1");localStorage.removeItem("baccarat_key_bindings_v1")}''')
    assert not errors,errors
    print(json.dumps({'passed':True,'checks':['short names larger than long names','longer visible name shrinks and restore grows back','more count digits shrink the shared count','five layouts and 1/2/3 digit counts fit','tiger cells have no lucky-six text','seven labels keep the two-row structure','font stays inside the label box','rounds unchanged'],'cases':cases,'labelSizes':[item['size'] for item in fitted],'errors':errors},ensure_ascii=False))
    browser.close()
