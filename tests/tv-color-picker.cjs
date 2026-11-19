const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')));}
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const chooseColor=async key=>{await page.click('#tvColorTarget');await page.locator('[data-color-option="'+key+'"]').click();};
  await page.route('https://**',r=>r.fulfill({body:''}));
  await page.goto(pathToFileURL(path.join(__dirname,'../tv.html')).href);
  await page.evaluate(()=>{localStorage.clear();localStorage.setItem('baccarat_road_rounds_v1',JSON.stringify(Array.from({length:80},(_,i)=>({r:i%11===0?'T':i%7<3?'B':'P',bp:i%9===0,pp:i%13===0}))));});await page.reload();
  const records=await page.evaluate(()=>JSON.stringify(state.rounds));
  await page.click('#tvSettingsButton');
  const checkFit=async()=>{
   const d=await page.locator('#tvSettings').evaluate(el=>{const r=el.getBoundingClientRect(),f=el.querySelector('footer').getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height,inside:r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,footer:f.bottom<=r.bottom&&f.top>=r.top,scroll:el.scrollWidth>el.clientWidth,shadow:getComputedStyle(el).boxShadow,parent:el.parentElement.tagName,modal:el.matches(':modal')};});
   assert.ok(d.inside&&d.footer&&!d.scroll,JSON.stringify(d));assert.ok(d.width<=420);assert.equal(d.parent,'BODY');assert.equal(d.modal,false);assert.ok(!d.shadow.includes('9999'));return d;
  };
  await checkFit();
  assert.equal(await page.evaluate(()=>document.elementFromPoint(80,350).closest('#tvSettings')!==null),false,'Road remains uncovered and interactive outside the panel');
  await page.fill('#tvBigStroke','10');
  assert.equal(await page.locator('#bigRoad .big-circle').first().evaluate(el=>getComputedStyle(el).borderTopWidth),'10px','Stroke previews immediately');
  await page.fill('#tvBigColumns','40');
  assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('.tv-app')).getPropertyValue('--cols-big').trim()),'40');
  await page.fill('#tvDragonThreshold','8');assert.equal(await page.evaluate(()=>getDragonThreshold()),8);
  assert.equal(await page.evaluate(()=>localStorage.getItem('baccarat_tv_settings_v1')),null,'Preview must not save');
  await page.click('#tvTabRoad');await chooseColor('red');await page.fill('#tvColorHex','#ff8a00');
  assert.equal(await page.locator('#bigRoad .big-circle.B').first().evaluate(el=>getComputedStyle(el).borderTopColor),'rgb(255, 138, 0)');
  const mark=await page.locator('#bigRoad .big-circle.B').first().elementHandle();
  await page.fill('#tvColorHex','#ff8800');assert.equal(await mark.evaluate(el=>el.isConnected),true,'Color preview must not rebuild the road');
  await page.locator('#tvColorEditor [data-color="#1e5ec9"]').click();
  const spectrum=await page.locator('#tvColorSpectrum').boundingBox();await page.mouse.click(spectrum.x+spectrum.width*.7,spectrum.y+spectrum.height*.2);
  assert.notEqual(await page.inputValue('#tvColorHex'),'#1e5ec9');
  await page.locator('#tvColorHue').focus();await page.keyboard.press('Home');
  const h=await page.locator('.tv-settings-header').boundingBox();const before=await checkFit();
  await page.mouse.move(h.x+70,h.y+15);await page.mouse.down();await page.mouse.move(90,90,{steps:6});await page.mouse.up();
  const moved=await checkFit();assert.ok(moved.left<before.left-200,'Header drag moves the panel');
  await page.setViewportSize({width:1024,height:576});await page.waitForFunction(()=>document.getElementById('tvSettings').getBoundingClientRect().bottom<=innerHeight);await checkFit();
  await page.click('#tvSettingsCancel');
  assert.equal(await page.locator('#bigRoad .big-circle.B').first().evaluate(el=>getComputedStyle(el).borderTopColor),'rgb(214, 33, 33)');
  assert.equal(await page.locator('#bigRoad .big-circle').first().evaluate(el=>getComputedStyle(el).borderTopWidth),'4px');assert.equal(await page.evaluate(()=>getDragonThreshold()),6);
  assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('.tv-app')).getPropertyValue('--cols-big').trim()),'46');
  assert.equal(await page.evaluate(()=>localStorage.getItem('baccarat_tv_settings_v1')),null);
  await page.setViewportSize({width:1440,height:900});await page.click('#tvSettingsButton');await page.fill('#tvBigStroke','10');await page.click('#tvTabRoad');await chooseColor('red');await page.fill('#tvColorHex','#ff8800');
  await page.click('#tvSettings button[type=submit]');await page.reload();
  assert.equal(await page.locator('#bigRoad .big-circle.B').first().evaluate(el=>getComputedStyle(el).borderTopColor),'rgb(255, 136, 0)');assert.equal(await page.locator('#bigRoad .big-circle').first().evaluate(el=>getComputedStyle(el).borderTopWidth),'10px');
  await page.click('#tvSettingsButton');await page.click('#tvTabRoad');await chooseColor('blue');await page.fill('#tvColorHex','#123456');await page.click('#tvSettings button[type=submit]');
  const saved=await page.evaluate(()=>localStorage.getItem('baccarat_tv_settings_v1'));
  await page.click('#tvSettingsButton');await page.click('#tvTabRoad');await chooseColor('red');await page.click('#tvColorReset');
  assert.equal(await page.locator('#bigRoad .B').first().evaluate(el=>getComputedStyle(el).borderTopColor),'rgb(214, 33, 33)','Only selected red resets');
  assert.equal(await page.locator('#bigRoad .P').first().evaluate(el=>getComputedStyle(el).borderTopColor),'rgb(18, 52, 86)','Blue stays custom');
  assert.equal(await page.evaluate(()=>localStorage.getItem('baccarat_tv_settings_v1')),saved,'Reset is only a preview');
  await page.click('#tvSettingsCancel');
  assert.equal(await page.locator('#bigRoad .B').first().evaluate(el=>getComputedStyle(el).borderTopColor),'rgb(255, 136, 0)','Cancel restores individually reset color');
  await page.click('#tvSettingsButton');await page.click('#tvTabRoad');await chooseColor('red');await page.click('#tvColorReset');await page.click('#tvSettings button[type=submit]');await page.reload();
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('baccarat_tv_settings_v1')).colors),{blue:'#123456'},'Save removes only selected color override');
  await page.click('#tvSettingsButton');await page.click('#tvTabRoad');await chooseColor('red');await page.fill('#tvColorHex','#ff8800');await page.click('#tvSettings button[type=submit]');

  await page.click('#tvSettingsButton');await page.click('#tvTabRoad');await chooseColor('red');await page.fill('#tvColorHex','#123456');await page.click('#tvSettingsClose');
  assert.equal(await page.locator('#bigRoad .big-circle.B').first().evaluate(el=>getComputedStyle(el).borderTopColor),'rgb(255, 136, 0)');assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('baccarat_tv_settings_v1'))),JSON.parse(saved));
  await page.click('#tvSettingsButton');await page.click('#tvTabRoad');await chooseColor('red');await page.fill('#tvColorHex','#abcdef');await page.keyboard.press('Escape');assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('baccarat_tv_settings_v1'))),JSON.parse(saved));assert.equal(await page.locator('#bigRoad .big-circle.B').first().evaluate(el=>getComputedStyle(el).borderTopColor),'rgb(255, 136, 0)');
  await page.click('#tvSettingsButton');await page.click('#tvSettingsReset');assert.equal(await page.locator('#bigRoad .big-circle').first().evaluate(el=>getComputedStyle(el).borderTopWidth),'4px');await page.click('#tvSettingsCancel');assert.equal(await page.locator('#bigRoad .big-circle').first().evaluate(el=>getComputedStyle(el).borderTopWidth),'10px');
  await page.click('#tvSettingsButton');await page.click('#tvTabScreen');
  let count=0;
  for(const tab of ['#tvTabScreen','#tvTabRoad','#tvTabStats']){
   await page.click(tab);const options=await page.locator('#tvColorOptions [data-color-option]').evaluateAll(els=>els.map(el=>el.dataset.colorOption));
   for(const key of options){await chooseColor(key);assert.equal(await page.locator('#tvColorHex').isVisible(),true);await checkFit();count++;}
  }
  assert.equal(count,30);await page.click('#tvColorsReset');assert.equal(await page.locator('#bigRoad .P').first().evaluate(el=>getComputedStyle(el).borderTopColor),'rgb(30, 94, 201)');await page.click('#tvTabRoad');await chooseColor('red');await page.fill('#tvColorHex','#ff8800');
  await page.screenshot({path:path.join(__dirname,'../.preview/settings-floating.png')});
  assert.equal(await page.evaluate(()=>JSON.stringify(state.rounds)),records,'Appearance edits never alter game records');
  assert.deepEqual(errors,[]);console.log('PASS: floating panel, unobscured road, drag/resize bounds, live color/stroke/columns/threshold preview, no premature save, cancel/X/Escape rollback, reset preview, save/reload, all 30 colors and unchanged records');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
