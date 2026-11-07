const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
(async () => {
  const browser = await chromium.launch({headless:true, channel:'chrome'});
  try {
    const page = await browser.newPage({viewport:{width:1580,height:884}});
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(path.join(__dirname,'../tv.html')).href);
    await page.evaluate(() => document.fonts.ready);
    await page.click('#tvSettingsButton');
    const geometry = () => page.locator('#tvSettings').evaluate(e => {
      const r=e.getBoundingClientRect(), f=e.querySelector('footer').getBoundingClientRect();
      const content=e.querySelector('.tv-settings-content'), style=getComputedStyle(e);
      return {x:r.x,y:r.y,w:r.width,h:r.height,fw:f.width,fy:f.y,
        designWidth:e.offsetWidth,designHeight:e.offsetHeight,background:style.backgroundColor,
        backgroundImage:style.backgroundImage,opacity:style.opacity,
        inside:r.x>=0&&r.y>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,
        footerInside:f.bottom<=r.bottom,contentHeight:content.clientHeight,contentScroll:content.scrollHeight};
    });
    for (const viewport of [{width:1580,height:884},{width:1920,height:1080},{width:1280,height:720}]) {
      await page.setViewportSize(viewport); await page.waitForTimeout(100);
      const baseline=await geometry();
      assert.equal(baseline.designWidth,720); assert.equal(baseline.designHeight,800);
      assert.equal(baseline.background,'rgba(122, 11, 11, 0.92)');
      assert.equal(baseline.backgroundImage,'none'); assert.equal(baseline.opacity,'1');
      for (const tab of ['Basic','Keys','Screen','Road','StatsFont','Stats','Symbols']) {
        await page.click('#tvTab'+tab); await page.waitForTimeout(80);
        const actual=await geometry();
        for (const key of ['x','y','w','h','fw','fy']) assert.ok(Math.abs(actual[key]-baseline[key])<1, tab+' '+key+': '+JSON.stringify(actual));
        assert.ok(actual.inside&&actual.footerInside);
      }
    }
    await page.locator('.tv-symbol-scopes button').filter({hasText:'開獎提示'}).click();
    const before=await geometry();
    await page.locator('.tv-settings-content').evaluate(e => {e.scrollTop=e.scrollHeight;});
    assert.equal((await geometry()).fy,before.fy,'Only the inner tab content scrolls');
    assert.ok(before.contentScroll>before.contentHeight,'Long symbol controls remain reachable by scrolling');
    await page.setViewportSize({width:1580,height:884});
    const head=await page.locator('.tv-settings-header').boundingBox();
    await page.mouse.move(head.x+80,head.y+12);await page.mouse.down();await page.mouse.move(head.x+20,head.y+32);await page.mouse.up();
    const moved=await geometry();await page.click('#tvTabBasic');await page.waitForTimeout(70);
    assert.ok(Math.abs((await geometry()).x-moved.x)<1,'Changing tabs preserves a dragged panel position');
    await page.click('#tvSettingsSizeToggle'); const expanded=await geometry();
    assert.equal(expanded.designWidth,840);assert.equal(expanded.designHeight,960);
    await page.click('#tvTabRoad');await page.waitForTimeout(70);assert.equal((await geometry()).designWidth,840);
    await page.click('#tvSettingsSizeToggle');assert.equal((await geometry()).designWidth,720);
    await page.click('#tvTabBasic');await page.waitForTimeout(70);
    await page.screenshot({path:path.join(__dirname,'output/tv-settings-fixed-red-page.png')});
    await page.locator('#tvSettings').screenshot({path:path.join(__dirname,'output/tv-settings-fixed-red.png')});
    assert.deepEqual(errors,[]);
    console.log('PASS: seven tabs keep 720x800 and the same footer position at three viewports; translucent page red; internal scrolling; drag; shared expanded size.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
