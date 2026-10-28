from pathlib import Path
from playwright.sync_api import sync_playwright,expect
import json,sys
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    page=browser.new_page(viewport={'width':1920,'height':1080})
    page.route('https://**',lambda r:r.fulfill(body=''));errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(sys.argv[1] if len(sys.argv)>1 else (root/'tv.html').as_uri()+'?preview=beads',wait_until='domcontentloaded')
    page.evaluate('speech.enabled=false;state.rounds=[{r:"B",bp:true},{r:"P",l7:2},{r:"T"},{r:"B",l6:true,tiger:"small"},{r:"B",l6:true,tiger:"big"},{r:"P",s7:5}];renderAll();localStorage.setItem(LS_KEY,JSON.stringify(state.rounds))')
    records=page.evaluate('JSON.stringify(state.rounds)')
    baseline=page.evaluate('localStorage.getItem("baccarat_tv_settings_v1")')
    source='.bottom-row > .tv-stats'
    def settle():page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
    def font(selector):return page.locator(selector).first.evaluate('(e)=>getComputedStyle(e).fontSize')
    def open_editor():
        page.locator('#tvSettingsButton').click();page.locator('#tvTabStatsFont').click(timeout=2000);expect(page.locator('#tvStatsFontPanel')).to_be_visible();settle()
    def change(name,value):page.locator('#tvStats'+name+'SizeValue').fill(str(value));settle()
    original_name=font(source+' .stat-banker .k');original_count=font('#cntB')
    open_editor()
    expect(page.locator('#tvStatsFontPreview .tv-stats')).to_be_visible()
    expect(page.locator('#tvStatsFontPreview [id]')).to_have_count(0)
    expect(page.locator('#tvStatsFontPreview .tv-stat-head').nth(1).locator('b')).to_have_text('6')
    expect(page.locator('#tvStatsFontPreview .stat-banker b')).to_have_text('3')
    page.locator('#tvStatsNameSize').focus();page.keyboard.press('Home');settle()
    expect(page.locator('#tvStatsNameSizeValue')).to_have_value('16')
    assert float(font(source+' .stat-banker .k')[:-2])<=16.1
    change('Number',40);assert font('#cntB')=='40px'
    change('Header',28);assert font(source+' .tv-stat-head')=='28px'
    assert font('#tvStatsFontPreview .stat-banker .k')==font(source+' .stat-banker .k')
    assert font('#tvStatsFontPreview .stat-banker b')=='40px'
    assert page.evaluate('localStorage.getItem("baccarat_tv_settings_v1")')==baseline
    assert page.evaluate('JSON.stringify(state.rounds)')==records
    page.locator('#tvSettingsCancel').click();settle();assert font(source+' .stat-banker .k')==original_name and font('#cntB')==original_count
    open_editor();change('Name',26);change('Number',36);change('Header',24)
    page.locator('#tvSettings button[type=submit]').click();page.reload(wait_until='domcontentloaded');settle()
    saved=page.evaluate('JSON.parse(localStorage.getItem("baccarat_tv_settings_v1"))')
    assert [saved[k] for k in ['statsNameSize','statsNumberSize','statsHeaderSize']]==[26,36,24]
    assert font('#cntB')=='36px' and font(source+' .tv-stat-head')=='24px'
    open_editor();expect(page.locator('#tvStatsNameSizeValue')).to_have_value('26')
    page.locator('#tvTabBasic').click();page.locator('#tvSettingsReset').click();settle();assert font('#cntB')=='36px','Basic reset must preserve stat font preferences'
    page.locator('#tvSettingsCancel').click();open_editor()
    page.locator('#tvSettingsReset').click();settle();assert font('#cntB')=='32px' and font(source+' .tv-stat-head')=='22px'
    page.keyboard.press('Escape');settle();assert font('#cntB')=='36px'
    open_editor();change('Number',999);page.locator('#tvSettings button[type=submit]').click();expect(page.locator('#tvSettings')).to_be_visible()
    change('Number',40);change('Name',48);settle()
    for width,height in [(1280,720),(1920,1080)]:
        page.set_viewport_size({'width':width,'height':height});settle()
        assert page.locator('#tvStatsFontPanel').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1')
        assert page.locator('.tv-settings-tabs').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1')
    page.locator('#tvSettingsCancel').click();settle()
    assert page.evaluate('JSON.stringify(state.rounds)')==records
    assert not errors,errors
    print(json.dumps({'passed':True,'checks':['dedicated stat font settings and live preview','range and numeric controls','separate label/count/header sizes','preview matches real stats and existing data survives reload','save reload and no premature save','cancel Escape and scope reset','invalid values blocked','2 viewports','no changed game records'],'errors':errors}))
    browser.close()
