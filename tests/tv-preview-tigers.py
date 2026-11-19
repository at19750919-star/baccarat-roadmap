from pathlib import Path
from playwright.sync_api import sync_playwright,expect
import json
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    page=browser.new_page(viewport={'width':1920,'height':1080})
    page.route('https://**',lambda r:r.fulfill(body=''))
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto((root/'tv.html').as_uri()+'?preview=beads',wait_until='domcontentloaded')
    page.evaluate('speech.enabled=false;addRound("P",{s7:5})')
    records=page.evaluate('JSON.stringify(state.rounds)')
    def open_editor():
        page.locator('#tvSettingsButton').click();page.locator('#tvTabSymbols').click();page.locator('[data-symbol-scope="result"]').click()
    open_editor()
    expect(page.locator('#tvSymbolSample option')).to_have_text(['幸運7','超級幸運7','小老虎','大老虎'])
    preview=page.locator('#tvSymbolResultPreview')
    assert preview.evaluate('(e)=>getComputedStyle(e).backgroundColor')=='rgb(255, 255, 255)'
    shade=page.locator('#resultAnnouncement').evaluate('(e)=>getComputedStyle(e).backgroundColor')
    assert preview.evaluate('(e)=>getComputedStyle(e,"::before").backgroundColor')==shade
    expect(preview.locator('.result-ribbon')).to_be_visible()
    assert preview.locator('.result-ribbon').evaluate('(e)=>getComputedStyle(e).backgroundImage')==page.locator('#resultAnnouncement .result-ribbon').evaluate('(e)=>getComputedStyle(e).backgroundImage')
    for kind in ['lucky','super','small-tiger','big-tiger']:
        page.locator('#tvSymbolSample').select_option(kind)
        expect(preview).to_have_attribute('data-kind',kind)
        assert preview.locator('img').evaluate('(e)=>e.decode().then(()=>e.naturalWidth>0)')
        if kind.endswith('tiger'):
            expect(preview.locator('.result-card-count')).not_to_be_visible()
            expect(page.locator('#tvSymbolTarget option[value="number"]')).to_have_attribute('disabled','')
            asset=page.evaluate('k=>BaccaratAnimalArt[k.split("-")[0]].src',kind)
            assert preview.locator('img').get_attribute('src')==asset
            page.locator('#tvSymbolTarget').select_option('title')
            page.locator('#tvCaptionText').fill('自訂'+kind)
        else:
            expect(preview.locator('.result-card-count')).to_be_visible()
    assert page.evaluate('JSON.stringify(state.rounds)')==records
    page.locator('#tvSettings button[type="submit"]').click()
    page.reload(wait_until='domcontentloaded')
    for animal in ['small','big']:
        page.evaluate('t=>{speech.enabled=false;addRound("B",{tiger:t,l6:true})}',animal)
        expect(page.locator('#resultAnnouncement .result-title')).to_have_text('自訂'+animal+'-tiger')
    open_editor()
    for width,height in [(1280,720),(1920,1080)]:
        page.set_viewport_size({'width':width,'height':height})
        assert page.locator('#tvSymbolsPanel').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1')
    assert not errors,errors
    print(json.dumps({'passed':True,'checks':['four categories','white road base and shared production shade/halo','matching tiger artwork','no animal card count','animal caption save/reload and actual result','editing preserves rounds','2 screen sizes'],'errors':errors}))
    browser.close()
