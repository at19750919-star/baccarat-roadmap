"""Exercise the actual TV keyboard and result artwork in an isolated browser."""
from pathlib import Path
import json
import sys
from playwright.sync_api import sync_playwright, expect

root = Path(sys.argv[1]).resolve()
out = root / '.preview' / 'result-prompts'
out.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 1920, 'height': 1080})
    page = context.new_page()
    page.set_default_timeout(5000)
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.route('https://**', lambda r: r.fulfill(body=''))
    url = (root / 'tv.html').as_uri()
    page.goto(url, wait_until='domcontentloaded')
    page.evaluate('speech.enabled = false')
    panel = page.locator('#resultAnnouncement')
    expect(panel).to_be_hidden()

    def press(*keys):
        for key in keys:
            page.keyboard.press(key)

    press('1')
    expect(panel).to_be_hidden()
    press('Enter')
    expect(panel).to_be_visible()
    expect(panel).to_have_attribute('data-kind', 'banker')
    expect(panel.locator('.result-symbol')).to_have_text('莊')
    expect(panel.locator('.result-pair-marker-bp')).to_be_hidden()
    expect(panel.locator('.result-pair-marker-pp')).to_be_hidden()
    press('2', 'Enter')
    expect(panel).to_have_attribute('data-kind', 'player')
    press('3', 'Enter')
    expect(panel).to_have_attribute('data-kind', 'tie')
    press('1', '4', '5', 'Enter')
    expect(panel.locator('.result-pair')).to_have_count(2)
    expect(panel.locator('.result-pair')).to_have_text(['莊對', '閒對'])
    expect(panel.locator('.result-pair-marker-bp')).to_be_visible()
    expect(panel.locator('.result-pair-marker-pp')).to_be_visible()
    # Pair circles sit on opposite corners of the medal, as in the reference.
    medal = panel.locator('.result-medallion').bounding_box()
    bp = panel.locator('.result-pair-marker-bp').bounding_box()
    pp = panel.locator('.result-pair-marker-pp').bounding_box()
    assert bp['x'] < medal['x'] + medal['width'] / 2 < pp['x']
    assert bp['y'] < medal['y'] + medal['height'] / 2 < pp['y']
    press('Backspace')
    expect(panel).to_be_hidden()
    page.evaluate('renderAll()')
    expect(panel).to_be_hidden()

    press('4', '5', '2', '2', 'Enter')
    expect(panel).to_have_attribute('data-kind', 'lucky')
    expect(panel.locator('.result-pair-marker-bp')).to_be_visible()
    expect(panel.locator('.result-pair-marker-pp')).to_be_visible()
    count = panel.locator('.result-card-count').bounding_box()
    pp = panel.locator('.result-pair-marker-pp').bounding_box()
    assert count['y'] + count['height'] < pp['y'], (count, pp)
    press('Backspace')

    for cards in range(2, 7):
        press(*(['2'] * cards), 'Enter')
        expect(panel).to_be_visible()
        expect(panel).to_have_attribute('data-kind', 'lucky' if cards < 4 else 'super')
        expect(panel.locator('.result-pair-marker-bp')).to_be_hidden()
        expect(panel.locator('.result-pair-marker-pp')).to_be_hidden()
        expect(panel.locator('.result-card-count')).to_have_text(str(cards))
        asset = 'blue-seven' if cards < 4 else 'purple-seven'
        assert panel.locator('.result-art').get_attribute('src') == f'assets/beads/{asset}.png'
        assert page.locator('#beadBoard .bead-art').last.get_attribute('src').endswith(f'{asset}.png')
        assert panel.locator('.result-art').evaluate('(i) => i.decode().then(() => i.naturalWidth > 0)')
        expected_mod = 'l7' if cards < 4 else 's7'
        assert page.evaluate(f'state.rounds.at(-1).{expected_mod}') == cards
        if cards in (2, 6):
            page.wait_for_timeout(650)
            page.screenshot(path=str(out / f'{asset}-result.png'), animations='disabled',
                            clip={'x': 0, 'y': 200, 'width': 1920, 'height': 650})

    # A new result replaces the old timer, and restores the road without input.
    page.wait_for_timeout(1000)
    press('1', 'Enter')
    page.wait_for_timeout(1700)
    expect(panel).to_be_visible()
    expect(panel).to_have_attribute('data-kind', 'banker')
    page.wait_for_timeout(1800)
    expect(panel).to_be_hidden()

    # Voice and announcement use the same animal as the recorded bead.
    page.evaluate('window.animalSpeechChecks=[];window.originalAnimalSpeak=speak;speak=function(text){animalSpeechChecks.push(text);return originalAnimalSpeak(text)}')
    press('c', 'Enter')
    expect(panel).to_have_attribute('data-kind', 'small-tiger')
    expect(panel.locator('.result-title')).to_have_text('小老虎')
    expect(panel.locator('.result-art')).to_have_attribute('src', 'assets/beads/cat-v2.png')
    assert page.locator('#beadBoard .bead-art').last.get_attribute('src').endswith('/cat-v2.png')
    assert '小老虎' in page.evaluate('animalSpeechChecks.at(-1)')
    expect(panel.locator('.result-card-count')).to_be_hidden()
    press('t', '4', '5', 'Enter')
    expect(panel).to_have_attribute('data-kind', 'big-tiger')
    expect(panel.locator('.result-title')).to_have_text('大老虎')
    expect(panel.locator('.result-art')).to_have_attribute('src', 'assets/beads/tiger-v4.png')
    assert page.locator('#beadBoard .bead-art').last.get_attribute('src') == panel.locator('.result-art').get_attribute('src')
    assert '大老虎' in page.evaluate('animalSpeechChecks.at(-1)')
    expect(panel.locator('.result-card-count')).to_be_hidden()
    expect(panel.locator('.result-pair-marker-bp')).to_be_visible()
    expect(panel.locator('.result-pair-marker-pp')).to_be_visible()
    assert panel.locator('.result-art').evaluate('(i)=>i.decode().then(()=>i.naturalWidth>0)')
    press('1', 'Enter')
    expect(panel).to_have_attribute('data-kind', 'banker')
    expect(panel.locator('.result-art')).to_have_count(0)
    page.evaluate("addRound('P',{tiger:'big'})")
    expect(panel).to_have_attribute('data-kind', 'player')
    expect(panel.locator('.result-art')).to_have_count(0)
    press('Backspace')
    expect(panel).to_be_hidden()
    saved = page.evaluate('JSON.stringify(state.rounds)')
    page.reload(wait_until='domcontentloaded')
    page.evaluate('speech.enabled = false')
    expect(panel).to_be_hidden()
    assert page.evaluate('JSON.stringify(state.rounds)') == saved

    # The result appears first. Existing dragon playback starts after it closes.
    page.evaluate("state.rounds = []; renderAll(); document.querySelector('.tv-app').dataset.dragonThreshold = 2")
    press('1', 'Enter', '1', 'Enter', '1', 'Enter')
    expect(panel).to_be_visible()
    assert not page.locator('#dragonOverlay').evaluate('(e) => e.classList.contains("active")')
    expect(panel).to_be_hidden(timeout=4500)
    expect(page.locator('#dragonOverlay')).to_have_class(__import__('re').compile(r'\bactive\b'))
    press('Backspace')
    expect(panel).to_be_hidden()

    # One confirm means exactly one result/round; no scroll or clipping at TV sizes.
    press('3', 'Enter')
    for width, height in [(1920, 1080), (1366, 768), (1280, 720)]:
        page.set_viewport_size({'width': width, 'height': height})
        bounds = panel.locator('.result-content').bounding_box()
        assert 0 <= bounds['x'] and bounds['x'] + bounds['width'] <= width + 1, bounds
        assert 0 <= bounds['y'] and bounds['y'] + bounds['height'] <= height + 1, bounds
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.set_viewport_size({'width': 1920, 'height': 1080})
    page.wait_for_timeout(450)
    page.screenshot(path=str(out / 'tie-result.png'), animations='disabled',
                    clip={'x': 0, 'y': 200, 'width': 1920, 'height': 650})
    press('Backspace')
    expect(panel).to_be_hidden()

    # Clearing the road also removes both result and pending dragon state.
    page.once('dialog', lambda dialog: dialog.accept())
    press('1', 'Enter')
    page.evaluate('clearAll()')
    expect(panel).to_be_hidden()
    assert page.evaluate('state.rounds.length') == 0
    assert page.locator('#dragonCornerBadge').is_hidden()

    # Boss key must never leave a result over the hidden road.
    press('2', 'Enter', 'Numpad8', 'Numpad8')
    expect(page.locator('#bossScreen')).to_have_class(__import__('re').compile(r'\bactive\b'))
    expect(panel).to_be_hidden()
    assert not errors, errors
    print(json.dumps({'passed': True, 'checks': ['confirm only', 'bank/player/tie', 'pairs', 'seven 2–6 and existing assets', 'automatic close and replacement timer', 'undo and redraw', 'reload persistence', 'shared animal artwork in beads and voice announcements', 'animal voice/category matches', 'no stale animal on ordinary results', 'dragon sequencing', '3 screen sizes', 'boss key'], 'errors': errors}, ensure_ascii=True))
    browser.close()
