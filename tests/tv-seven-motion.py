"""Check the real six-card seven entrance, gated sweep and stable white count."""
from pathlib import Path
import hashlib
import io
import json
import sys
from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright, expect

root = Path(sys.argv[1]).resolve()
out = root / '.preview/result-prompts/seven-motion'
out.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1920, 'height': 1080})
    page.set_default_timeout(5000)
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.route('https://**', lambda r: r.fulfill(body=''))
    page.goto((root / 'tv.html').as_uri() + '?preview=beads', wait_until='domcontentloaded')
    page.evaluate("speech.enabled=false;state.rounds=[{r:'P',l7:2},{r:'P',l7:3},{r:'P',s7:4},{r:'P',s7:5},{r:'P',s7:6},{r:'B',s7:6}];renderAll()")
    expect(page.locator('#beadBoard .bead-seven-sweep')).to_have_count(1)
    expect(page.locator('#beadBoard .bead-seven-enter')).to_have_count(0)
    for _ in range(6):
        page.keyboard.press('2')
    expect(page.locator('#beadBoard .bead-seven-enter')).to_have_count(0)
    page.keyboard.press('Enter')
    expect(page.locator('#beadBoard .bead-seven-enter')).to_have_count(1)
    latest = page.locator('#beadBoard .bead').last
    assert latest.locator('.seven-cards').evaluate('(e)=>getComputedStyle(e).color') == 'rgb(255, 255, 255)'
    assert latest.locator('.seven-cards').evaluate('(e)=>e.getAnimations().length') == 0
    assert latest.locator('.bead-art').evaluate('(e)=>e.getAnimations()[0].effect.getTiming().iterations') == 1

    # Pause the real entrance at two phases: art moves, count bounds do not.
    latest.evaluate('(e)=>e.getAnimations({subtree:true}).forEach(a=>a.pause())')
    sizes = []
    for ms in [0, 230, 720]:
        latest.locator('.bead-art').evaluate('(e,t)=>e.getAnimations()[0].currentTime=t', ms)
        sizes.append((latest.locator('.bead-art').bounding_box()['width'], latest.locator('.seven-cards').bounding_box()))
    assert sizes[1][0] > sizes[0][0] * 1.04, sizes
    assert abs(sizes[2][0] - sizes[0][0]) < .1, sizes
    assert sizes[0][1] == sizes[1][1] == sizes[2][1], sizes
    page.evaluate('renderAll()')
    expect(page.locator('#beadBoard .bead-seven-enter')).to_have_count(0)
    stored = page.evaluate('JSON.stringify(state.rounds)')
    page.reload(wait_until='domcontentloaded')
    expect(page.locator('#beadBoard .bead-seven-enter')).to_have_count(0)
    assert page.evaluate('JSON.stringify(state.rounds)') == stored
    page.keyboard.press('Backspace')
    expect(page.locator('#beadBoard .bead-seven-enter')).to_have_count(0)
    expect(page.locator('#beadBoard .bead-seven-sweep')).to_have_count(1)

    # Actual 61px render: only the gold seven catches the moving reflection.
    page.evaluate('''() => {
      const f=document.createElement('div'); f.id='sevenFixture'; f.className='tv-app';
      f.style.cssText='display:block;position:fixed;left:0;top:0;width:61px;height:61px;background:white;--cell-bead:61px;transform:none;z-index:99999';
      const bead=document.querySelector('#beadBoard .bead-effect-seven').cloneNode(true);
      bead.style.cssText='width:61px;height:61px;margin:0';f.appendChild(bead);document.body.appendChild(f);
    }''')
    bead = page.locator('#sevenFixture .bead')
    bead.locator('img').evaluate_all('(imgs)=>Promise.all(imgs.map(i=>i.decode()))')
    bead.evaluate('(e)=>e.getAnimations({subtree:true}).forEach(a=>{a.pause();a.currentTime=0})')
    sweep = bead.locator('.bead-seven-sweep')
    timing = sweep.evaluate('(e)=>e.getAnimations({subtree:true})[0].effect.getTiming()')
    assert timing['duration'] == 5000 and timing['iterations'] == float('inf'), timing
    frames = []
    for ms in [0, 3600]:
        sweep.evaluate('(e,t)=>e.getAnimations({subtree:true})[0].currentTime=t', ms)
        frames.append(Image.open(io.BytesIO(bead.screenshot())).convert('RGB'))
    diff = ImageChops.difference(*frames)
    changed = sum(max(diff.getpixel((x,y))) > 8 for y in range(61) for x in range(61))
    digit_changes = sum(max(diff.getpixel((x,y))) > 2 for y in range(43,61) for x in range(43,61))
    assert changed > 6 and digit_changes == 0, (changed, digit_changes)
    for label, frame in zip(['sweep-off', 'sweep-on'], frames): frame.save(out / f'{label}.png')

    # Big tiger gets its own sweep and a one-shot entrance; the small cat stays still.
    page.evaluate("state.rounds.push({r:'B',l6:true,tiger:'big'});renderAll()")
    expect(page.locator('#beadBoard .bead-tiger-sweep')).to_have_count(1)
    expect(page.locator('#beadBoard .bead-tiger-enter')).to_have_count(0)
    page.keyboard.press('t')
    page.keyboard.press('Enter')
    expect(page.locator('#beadBoard .bead-tiger-enter')).to_have_count(1)
    tiger = page.locator('#beadBoard .bead').last
    assert tiger.locator('.bead-art').get_attribute('src').endswith('/tiger-v4.png')
    assert tiger.locator('.bead-art').evaluate('(e)=>e.getAnimations()[0].effect.getTiming().iterations') == 1
    page.keyboard.press('c')
    page.keyboard.press('Enter')
    expect(page.locator('#beadBoard .bead-tiger-enter')).to_have_count(0)
    assert page.locator('#beadBoard .bead').last.locator('.bead-art').get_attribute('src').endswith('/cat-v2.png')
    expect(page.locator('#beadBoard .bead').last.locator('.bead-tiger-sweep')).to_have_count(0)
    page.evaluate('''() => {
      const f=document.getElementById('sevenFixture');
      const t=document.querySelector('#beadBoard .bead-effect-tiger').cloneNode(true);
      t.style.cssText='width:61px;height:61px;margin:0';f.replaceChildren(t);
    }''')
    tiger = page.locator('#sevenFixture .bead')
    tiger.locator('img').evaluate_all('(imgs)=>Promise.all(imgs.map(i=>i.decode()))')
    tiger.evaluate('(e)=>e.getAnimations({subtree:true}).forEach(a=>{a.pause();a.currentTime=0})')
    tiger_frames = []
    for ms in [0, 3600]:
        tiger.locator('.bead-tiger-sweep').evaluate('(e,t)=>e.getAnimations({subtree:true})[0].currentTime=t', ms)
        tiger_frames.append(Image.open(io.BytesIO(tiger.screenshot())).convert('RGB'))
    td = ImageChops.difference(*tiger_frames)
    tiger_changed = sum(max(td.getpixel((x,y))) > 8 for y in range(61) for x in range(61))
    rim_changed = sum(max(td.getpixel((x,y))) > 2 for y in range(61) for x in range(61) if ((x-30)**2+(y-30)**2)**.5 > 27)
    assert tiger_changed > 20 and rim_changed == 0, (tiger_changed, rim_changed)
    for label, frame in zip(['tiger-sweep-off', 'tiger-sweep-on'], tiger_frames): frame.save(out / f'{label}.png')
    page.reload(wait_until='domcontentloaded')
    expect(page.locator('#beadBoard .bead-tiger-enter')).to_have_count(0)
    hashes = json.loads((out/'art-hashes.json').read_text())
    assert all(hashlib.sha256((root/'assets/beads'/name).read_bytes()).hexdigest() == digest for name,digest in hashes.items())
    assert not errors, errors
    print(json.dumps({'passed':True,'onlySixCardSuperSeven':True,'bigTigerSweep':True,'smallCatStill':True,'entranceOnlyOnNewRound':True,'noReplayOnRedrawReloadUndo':True,'whiteDigitStationary':True,'sweepPeriodMs':5000,'sweepChangedPixels':changed,'whiteDigitChangedPixels':digit_changes,'tigerChangedPixels':tiger_changed,'tigerRimChangedPixels':rim_changed,'artworkUnchanged':True,'errors':errors}), flush=True)
    browser.close()
