from pathlib import Path
from playwright.sync_api import sync_playwright,expect
import json
import sys
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    page=browser.new_page(viewport={'width':1920,'height':1080})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('https://**',lambda r:r.fulfill(body=''))
    page.goto(sys.argv[1] if len(sys.argv)>1 else (root/'tv.html').as_uri()+'?preview=beads',wait_until='domcontentloaded')
    page.evaluate('speech.enabled=false;addRound("P",{s7:5,bp:true,pp:true})')
    records=page.evaluate('JSON.stringify(state.rounds)')
    def open_editor():
        page.locator('#tvSettingsButton').click();page.locator('#tvTabSymbols').click()
    def target(name):page.locator('#tvSymbolTarget').select_option(name)
    def change(x,y):
        page.locator('#tvSymbolXValue').fill(str(x));page.locator('#tvSymbolYValue').fill(str(y))
    def distance(x,y):
        expect(page.locator('#tvSymbolXValue')).to_have_value(str(x));expect(page.locator('#tvSymbolYValue')).to_have_value(str(y))
    def mirrored(scope):
        if scope=='bead':
            return page.locator('#beadBoard .bead.pair-bp.pair-pp').last.evaluate('e=>{const a=getComputedStyle(e,"::before"),b=getComputedStyle(e,"::after");return a.left===b.right&&a.top===b.bottom&&a.width===b.width&&a.height===b.height}')
        return page.locator('#tvSymbolResultPreview').evaluate('''e=>{const p=e.querySelector('.result-medallion').getBoundingClientRect(),a=e.querySelector('.result-pair-marker-bp').getBoundingClientRect(),b=e.querySelector('.result-pair-marker-pp').getBoundingClientRect();return Math.abs((a.left-p.left)-(p.right-b.right))<.1&&Math.abs((a.top-p.top)-(p.bottom-b.bottom))<.1&&Math.abs(a.width-b.width)<.1&&Math.abs(a.height-b.height)<.1}''')
    open_editor()
    expect(page.locator('#tvSymbolTarget option[value="banker"]')).to_have_text('莊閒對圓點')
    expect(page.locator('#tvSymbolTarget option[value="player"]')).to_have_count(0)
    target('banker');change(12,16.5);page.locator('#tvSymbolSizeValue').fill('22');distance(12,16.5)
    page.locator('#tvSymbolX').focus();page.keyboard.press('ArrowRight');target('banker');distance(12.5,16.5);target('banker')
    change(-5,3);target('banker');distance(-5,3);assert mirrored('bead')
    page.locator('[data-symbol-scope="result"]').click();target('banker');distance(9,9)
    change(11,15);page.locator('#tvSymbolSizeValue').fill('17');distance(11,15);assert mirrored('result')
    page.locator('#tvSymbolSample').select_option('big-tiger');distance(11,15);assert mirrored('result')
    page.locator('#tvSettings button[type="submit"]').click();page.reload(wait_until='domcontentloaded')
    saved=page.evaluate('JSON.parse(localStorage.getItem("baccarat_tv_settings_v1")).symbols')
    for scope,xy in [('bead',(-5,3)),('result',(11,15))]:
        assert all((saved[scope][k]['x'],saved[scope][k]['y'])==xy for k in ['banker','player']),saved
        assert saved[scope]['banker']['size']==saved[scope]['player']['size']==(22 if scope=='bead' else 17)
    open_editor();target('banker');change(8,9);page.locator('#tvSettingsCancel').click()
    open_editor();target('banker');distance(-5,3);target('banker');distance(-5,3)
    page.locator('#tvSettingsReset').click();distance(-4,-4);target('banker');distance(-4,-4)
    page.keyboard.press('Escape');open_editor();target('banker');distance(-5,3)
    page.locator('[data-symbol-scope="result"]').click();target('banker');distance(11,15)
    page.locator('#tvSettingsCancel').click()
    page.evaluate('''() => {const v=JSON.parse(localStorage.getItem('baccarat_tv_settings_v1'));v.symbols.bead.banker.x=2;v.symbols.bead.banker.y=4;v.symbols.bead.player.x=8;v.symbols.bead.player.y=10;v.symbols.bead.banker.size=24;v.symbols.bead.player.size=11;localStorage.setItem('baccarat_tv_settings_v1',JSON.stringify(v))}''')
    page.reload(wait_until='domcontentloaded');open_editor();target('banker');distance(2,4);expect(page.locator('#tvSymbolSizeValue')).to_have_value('24');assert mirrored('bead')
    page.locator('#tvSettings button[type="submit"]').click()
    assert page.evaluate('JSON.stringify(state.rounds)')==records
    assert not errors,errors
    print(json.dumps({'passed':True,'checks':['one combined pair control','matched sizes and mirrored distances','both axes and negative distances','visible mirror symmetry','independent bead and result scopes','tiger preview','save and reload','cancel reset and Escape','old asymmetric settings normalized','rounds unchanged'],'errors':errors}))
    browser.close()
