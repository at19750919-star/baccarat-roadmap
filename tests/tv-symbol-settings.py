from pathlib import Path
from playwright.sync_api import sync_playwright, expect
import json
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    page=browser.new_page(viewport={'width':1920,'height':1080})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('https://**',lambda r:r.fulfill(body=''))
    page.goto((ROOT/'tv.html').as_uri()+'?preview=beads',wait_until='domcontentloaded')
    page.evaluate('localStorage.setItem("baccarat_tv_settings_v1",JSON.stringify({columns:46,bigStroke:6,eyeStroke:2,cockroachStroke:3,starStroke:3,dragonThreshold:6,colors:{blue:"#2468ab"}}))')
    page.reload(wait_until='domcontentloaded')
    page.evaluate('speech.enabled=false;addRound("P",{s7:5,bp:true,pp:true})')
    records=page.evaluate('JSON.stringify(state.rounds)')
    def styles():
        return page.evaluate('''() => {
          const b=[...document.querySelectorAll('#beadBoard .seven-cards')].at(-1),r=document.querySelector('.result-card-count');
          const read=e=>{const s=getComputedStyle(e);return {size:s.fontSize,right:s.right,top:s.top,color:s.color,shadow:s.textShadow}};
          return {bead:read(b),result:read(r),pair:getComputedStyle(b.parentElement,'::before').width};
        }''')
    def open_symbols():
        page.locator('#tvSettingsButton').click()
        page.locator('[data-settings-tab="symbols"]').click(timeout=1500)
        expect(page.locator('#tvSymbolsPanel')).to_be_visible()
    def change(key,value):
        page.locator('#tvSymbol'+key+'Value').fill(str(value))
    original=styles()
    open_symbols()
    assert page.locator('#tvSettings').evaluate('(e)=>getComputedStyle(e).fontSize')=='18px'
    assert page.locator('#tvTabSymbols').evaluate('(e)=>getComputedStyle(e).fontSize')=='16px'
    change('Size',999)
    page.locator('#tvSettings button[type="submit"]').click()
    expect(page.locator('#tvSettings')).to_be_visible()
    assert styles()==original,'Invalid sizes must not preview or save'
    change('Size',55)
    change('X',13)
    change('Halo',28)
    changed=styles()
    assert changed['bead']['size']!=original['bead']['size']
    assert changed['result']==original['result'],'Bead adjustments must not change result styles'
    assert changed['bead']['color']=='rgb(255, 255, 255)'
    page.locator('[data-symbol-scope="result"]').click()
    change('Size',110)
    assert styles()['result']['size']=='110px'
    assert styles()['bead']==changed['bead']
    page.locator('#tvSettingsCancel').click()
    assert styles()==original,'Cancel must roll back both scopes'
    open_symbols()
    change('Size',51)
    page.locator('#tvSymbolTarget').select_option('banker')
    change('Size',25)
    changed=styles()
    assert changed['pair']!=original['pair']
    page.locator('#tvSettings button[type="submit"]').click()
    expect(page.locator('#tvSettings')).not_to_be_visible()
    page.reload(wait_until='domcontentloaded')
    saved=page.evaluate('JSON.parse(localStorage.getItem("baccarat_tv_settings_v1"))')
    assert saved['bigStroke']==6 and saved['colors']=={'blue':'#2468ab'},'Existing settings must be preserved'
    assert styles()['bead']['size']==changed['bead']['size']
    assert styles()['pair']==changed['pair']
    assert page.evaluate('JSON.stringify(state.rounds)')==records
    open_symbols()
    page.locator('[data-symbol-scope="result"]').click()
    change('Size',120)
    page.locator('#tvSettings button[type="submit"]').click()
    open_symbols()
    page.locator('[data-symbol-scope="bead"]').click()
    page.locator('#tvSettingsReset').click()
    assert styles()['bead']==original['bead']
    assert styles()['result']['size']=='120px','Reset should only affect the selected scope'
    page.keyboard.press('Escape')
    assert styles()['bead']['size']==changed['bead']['size']
    open_symbols()
    page.locator('[data-symbol-scope="bead"]').click()
    page.locator('#tvSymbolTarget').select_option('number')
    page.locator('#tvSymbolSize').focus()
    old=page.locator('#tvSymbolSize').input_value()
    page.keyboard.press('ArrowRight')
    assert page.locator('#tvSymbolSize').input_value()!=old
    assert page.evaluate('JSON.stringify(state.rounds)')==records
    for width,height in [(1366,768),(1280,720),(1920,1080)]:
        page.set_viewport_size({'width':width,'height':height})
        assert page.locator('#tvSymbolsPanel').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1')
        assert page.locator('.tv-settings-tabs').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1')
    page.locator('#tvSettingsCancel').click()
    open_symbols()
    change('Size',47)
    page.evaluate('''() => {const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='baccarat_tv_settings_v1')throw new Error('blocked');return original.call(this,k,v)}}''')
    page.locator('#tvSettings button[type="submit"]').click()
    expect(page.locator('#tvSettingsStatus')).to_be_visible()
    expect(page.locator('#tvSettings')).to_be_visible()
    page.locator('#tvSettingsCancel').click()
    assert styles()['bead']['size']==changed['bead']['size']
    page.reload(wait_until='domcontentloaded')
    page.evaluate('''() => {const v=JSON.parse(localStorage.getItem('baccarat_tv_settings_v1'));v.symbols={bead:{number:{x:10000,size:'oops',halo:null}}};localStorage.setItem('baccarat_tv_settings_v1',JSON.stringify(v))}''')
    page.reload(wait_until='domcontentloaded')
    open_symbols()
    assert page.locator('#tvSymbolXValue').input_value()=='60'
    assert page.locator('#tvSymbolSizeValue').input_value()=='38'
    assert page.locator('#tvSymbolHaloValue').input_value()=='18'
    page.locator('#tvSettingsCancel').click()
    assert not errors,errors
    print(json.dumps({'passed':True,'checks':['legacy settings preserved','invalid input blocked','malformed settings normalized','larger overlay text','live preview','independent bead/result settings','white digits','pair size','save and reload','cancel and escape rollback','scope reset','keyboard slider','3 viewport sizes','rounds unchanged','storage failure recoverable'],'errors':errors}))
    browser.close()
