from pathlib import Path
from playwright.sync_api import sync_playwright,expect
import json
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    page=browser.new_page(viewport={'width':1920,'height':1080})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('https://**',lambda r:r.fulfill(body=''))
    page.goto((root/'tv.html').as_uri()+'?preview=beads',wait_until='domcontentloaded')
    page.evaluate('speech.enabled=false;addRound("P",{s7:4})')
    original_records=page.evaluate('JSON.stringify(state.rounds)')
    def editor():
        page.locator('#tvSettingsButton').click()
        page.locator('#tvTabSymbols').click()
        page.locator('[data-symbol-scope="result"]').click()
    def saved_content():
        return page.evaluate('JSON.parse(localStorage.getItem("baccarat_tv_settings_v1"))?.symbols?.captions')
    editor()
    expect(page.locator('#tvSymbolSample option')).to_have_count(4)
    assert page.locator('#tvSymbolSample option').all_text_contents()==['幸運7','超級幸運7','小老虎','大老虎']
    page.locator('#tvSymbolTarget').select_option('title')
    page.locator('#tvCaptionText').fill('超級七測試')
    page.locator('#tvCaptionFont').select_option('sans')
    page.locator('#tvCaptionSizeValue').fill('48')
    page.locator('#tvCaptionColor').fill('#33aadd')
    page.locator('#tvCaptionEffect').select_option('glow')
    expect(page.locator('#tvSymbolResultPreview .result-title')).to_have_text('超級七測試')
    expect(page.locator('#resultAnnouncement .result-title')).to_have_text('超級七測試')
    style=page.locator('#tvSymbolResultPreview .result-title').evaluate('(e)=>{const s=getComputedStyle(e);return {size:s.fontSize,color:s.color,font:s.fontFamily,shadow:s.textShadow}}')
    assert style['size']=='48px' and style['color']=='rgb(51, 170, 221)' and 'JhengHei' in style['font'] and style['shadow']!='none',style
    page.locator('#tvSymbolTarget').select_option('english')
    page.locator('#tvCaptionText').fill('MY SUPER SEVEN')
    page.locator('#tvCaptionEffect').select_option('emboss')
    page.locator('#tvSymbolSample').select_option('lucky')
    expect(page.locator('#tvCaptionText')).to_have_value('LUCKY')
    page.locator('#tvCaptionText').fill('MY LUCKY')
    page.locator('#tvSymbolTarget').select_option('title')
    page.locator('#tvCaptionText').fill('幸運七測試')
    expect(page.locator('#tvSymbolResultPreview .result-card-count')).to_have_text('3')
    page.locator('#tvSymbolSample').select_option('super')
    expect(page.locator('#tvCaptionText')).to_have_value('超級七測試')
    expect(page.locator('#tvSymbolResultPreview .result-card-count')).to_have_text('5')
    assert page.evaluate('JSON.stringify(state.rounds)')==original_records
    assert saved_content() is None,'Preview must not save early'
    page.locator('#tvSettings button[type="submit"]').click()
    expect(page.locator('#tvSettings')).not_to_be_visible()
    page.reload(wait_until='domcontentloaded')
    for n in [4,5,6]:
        page.evaluate('n=>addRound("P",{s7:n})',n)
        expect(page.locator('#resultAnnouncement .result-title')).to_have_text('超級七測試')
        expect(page.locator('#resultAnnouncement .result-english')).to_have_text('MY SUPER SEVEN')
        assert page.locator('#resultAnnouncement .result-title').evaluate('(e)=>getComputedStyle(e).fontSize')=='48px'
    for n in [2,3]:
        page.evaluate('n=>addRound("P",{l7:n})',n)
        expect(page.locator('#resultAnnouncement .result-title')).to_have_text('幸運七測試')
        expect(page.locator('#resultAnnouncement .result-english')).to_have_text('MY LUCKY')
    page.evaluate('addRound("B")')
    expect(page.locator('#resultAnnouncement .result-english')).to_have_text('BANK')
    assert page.locator('#resultAnnouncement .result-english').evaluate('(e)=>e.style.fontSize')=='','Custom seven styles must not leak to ordinary results'
    editor()
    page.locator('#tvSymbolSample').select_option('super')
    page.locator('#tvSymbolTarget').select_option('title')
    literal='<img src=x onerror="alert(1)">'
    page.locator('#tvCaptionText').fill(literal)
    expect(page.locator('#tvSymbolResultPreview .result-title')).to_have_text(literal)
    expect(page.locator('#tvSymbolResultPreview .result-title img')).to_have_count(0)
    page.locator('#tvSettingsCancel').click()
    editor()
    page.locator('#tvSymbolSample').select_option('super')
    page.locator('#tvSymbolTarget').select_option('title')
    expect(page.locator('#tvCaptionText')).to_have_value('超級七測試')
    page.locator('#tvSettingsReset').click()
    expect(page.locator('#tvCaptionText')).to_have_value('超級幸運 7')
    page.keyboard.press('Escape')
    assert saved_content()['super']['title']['text']=='超級七測試'
    editor()
    page.locator('#tvSymbolTarget').select_option('english')
    page.locator('#tvCaptionText').fill('')
    expect(page.locator('#tvSymbolResultPreview .result-english')).not_to_be_visible()
    page.locator('[data-symbol-scope="bead"]').click()
    assert page.locator('#tvSymbolTarget').input_value()=='number'
    expect(page.locator('#tvSymbolBeadPreview .bead')).to_have_count(2)
    page.locator('[data-symbol-scope="result"]').click()
    page.locator('#tvSymbolTarget').select_option('title')
    for width,height in [(1280,720),(1920,1080)]:
        page.set_viewport_size({'width':width,'height':height})
        assert page.locator('#tvSymbolsPanel').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1')
    assert not errors,errors
    print(json.dumps({'passed':True,'checks':['seven groups and two tigers','live caption preview','text and font/color/size/effects','separate lucky/super and title/English','all real 2-6 rounds','save reload','cancel escape and reset','safe literal text','ordinary results unaffected','no premature save or changed rounds','2 viewport sizes'],'errors':errors}))
    browser.close()
