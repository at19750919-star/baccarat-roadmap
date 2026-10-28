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
    original_name=page.locator(short).inner_text();original_size=size(short)
    page.locator(short).evaluate('(e)=>e.textContent="莊家勝出"');settled()
    assert size(short)<original_size-1,'A longer name must get a smaller font'
    page.locator(short).evaluate('(e,t)=>e.textContent=t',original_name);settled()
    before=size(long+' >> nth=0')
    page.locator('.tv-stats .stats-list li > b').evaluate_all('(es)=>es.forEach(e=>e.textContent="999")');settled()
    assert size(long+' >> nth=0')<before,'More count digits must leave less label space'
    cases=[]
    for width,height,columns in [(1920,1080,46),(1985,804,46),(1280,720,46),(1920,1080,48),(1920,1080,38)]:
        page.set_viewport_size({'width':width,'height':height})
        page.locator('#tvSettingsButton').click();page.locator('#tvBigColumns').fill(str(columns));page.locator('#tvSettings button[type=submit]').click()
        for digits in ['8','12','999']:
            page.locator('.tv-stats .stats-list li > b').evaluate_all('(es,t)=>es.forEach(e=>e.textContent=t)',digits);settled()
            bad=page.locator('.tv-stats .stats-list li:not(.tv-stat-empty)').evaluate_all('''es=>es.flatMap(e=>{const label=e.querySelector('.k'),number=e.querySelector('b').getBoundingClientRect(),box=e.getBoundingClientRect(),w=document.createTreeWalker(label,NodeFilter.SHOW_TEXT);let t,issues=[];while(t=w.nextNode()){if(!t.textContent.trim())continue;const r=document.createRange();r.selectNodeContents(t);for(const a of r.getClientRects())if(a.left<box.left-1||a.right>number.left-1||a.top<box.top-1||a.bottom>box.bottom+1)issues.push(t.textContent)}return issues})''')
            assert not bad,(width,height,columns,digits,bad)
        cases.append([width,height,columns])
    page.evaluate('renderAll()');settled()
    assert page.evaluate('JSON.stringify(state.rounds)')==records
    labels=page.locator('.tv-stats .stats-list .k').evaluate_all('es=>es.map(e=>parseFloat(getComputedStyle(e).fontSize))')
    assert min(labels)>=18 and max(labels)<=32,labels
    assert not errors,errors
    print(json.dumps({'passed':True,'checks':['short names larger than long names','fits again when name length changes','font adjusts when count grows','five layouts and 1/2/3 digit counts fit','preserved four-column labels and counters','rounds unchanged'],'cases':cases,'labelSizes':labels,'errors':errors}))
    browser.close()
