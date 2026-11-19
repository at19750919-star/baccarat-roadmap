const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
let chromium;
try { ({chromium} = require('playwright')); }
catch { ({chromium} = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))); }
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1920,height:1080}});
  const fillColor=async(key,value)=>{await page.locator('[name="color-'+key+'"]').evaluate((input,value)=>{input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));},value);};
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://**',r=>r.fulfill({body:''}));
  await page.goto(pathToFileURL(path.join(__dirname,'../tv.html')).href);
  await page.evaluate(()=>localStorage.clear());await page.reload();
  await page.click('#tvSettingsButton');
  assert.ok(await page.locator('#tvColorSettings .tv-color-value').count() >= 20, 'Color controls cover the full display');
  await page.fill('#tvDragonThreshold','8');
  const selected={page:'#123456',grid:'#faf0dd',gridLine:'#789abc',text:'#eeddcc',red:'#ab12cd',blue:'#12abcd',green:'#17a355',statBanker:'#572c91'};
  for(const [key,value] of Object.entries(selected)) await fillColor(key,value);
  await page.click('#tvSettings button[type=submit]');
  await page.reload();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('baccarat_tv_settings_v1')));
  assert.equal(saved.dragonThreshold,8);assert.deepEqual(saved.colors,selected);
  await page.evaluate(()=>{state.rounds=Array.from({length:7},()=>({r:'B',bp:false,pp:false,l6:false}));renderAll();});
  assert.equal(await page.locator('#bigRoad .dragon').count(),0);
  assert.equal(await page.locator('#dragonCornerBadge').isVisible(),false);
  await page.evaluate(()=>{state.rounds.push({r:'B'});renderAll();});
  assert.equal(await page.locator('#bigRoad .dragon').count(),8);
  assert.equal(await page.locator('#dragonCornerBadge').isVisible(),true);
  assert.equal(await page.locator('#dragonOverlay').evaluate(el=>el.classList.contains('active')),false);
  await page.evaluate(()=>{state.rounds.push({r:'T'});renderAll();});
  assert.equal(await page.locator('#bigRoad .dragon').count(),8,'Ties do not add to the streak');
  await page.evaluate(()=>{state.rounds.push({r:'B'});renderAll();});
  assert.equal(await page.locator('#dragonOverlay').evaluate(el=>el.classList.contains('active')),true);
  await page.evaluate(()=>DragonFx.fadeOut());
  const actual=await page.evaluate(()=>({
   page:getComputedStyle(document.body).backgroundColor,
   grid:getComputedStyle(document.querySelector('#bigRoad')).backgroundColor,
   line:getComputedStyle(document.querySelector('#bigRoad')).backgroundImage,
   red:getComputedStyle(document.querySelector('#bigRoad .big-circle.B')).borderTopColor,
   tie:getComputedStyle(document.querySelector('#bigRoad .tie-mark'),'::before').backgroundColor,
   stat:getComputedStyle(document.querySelector('.stat-banker')).backgroundColor
  }));
  assert.equal(actual.page,'rgb(18, 52, 86)');assert.equal(actual.grid,'rgb(250, 240, 221)');
  assert.ok(actual.line.includes('rgb(120, 154, 188)'));assert.equal(actual.red,'rgb(171, 18, 205)');
  assert.equal(actual.tie,'rgb(23, 163, 85)');assert.equal(actual.stat,'rgb(87, 44, 145)');
  await page.click('#tvSettingsButton');
  await fillColor('page','#000000');await page.fill('#tvDragonThreshold','3');
  await page.click('#tvSettingsCancel');
  assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgb(18, 52, 86)');
  await page.click('#tvSettingsButton');assert.equal(await page.inputValue('#tvDragonThreshold'),'8');
  for(const bad of ['1','101','2.5','']) {await page.fill('#tvDragonThreshold',bad);await page.click('#tvSettings button[type=submit]');assert.equal(await page.locator('#tvSettings').evaluate(el=>el.open),true);}
  await page.click('#tvSettingsReset');await page.click('#tvSettings button[type=submit]');
  assert.equal(await page.evaluate(()=>getDragonThreshold()),6);
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('baccarat_tv_settings_v1')).colors),{});
  assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgb(122, 11, 11)');
  await page.evaluate(()=>{localStorage.setItem('baccarat_tv_settings_v1',JSON.stringify({columns:40,bigStroke:10,colors:{page:'invalid',unknown:'#ffffff'}}));});
  await page.reload();await page.click('#tvSettingsButton');
  assert.equal(await page.inputValue('#tvDragonThreshold'),'6');assert.equal(await page.inputValue('#tvBigStroke'),'10');
  for(const viewport of [{width:1920,height:1080},{width:1280,height:720}]) {
   await page.setViewportSize(viewport);
   await page.waitForFunction(()=>Math.abs(Number(getComputedStyle(document.documentElement).getPropertyValue('--app-scale'))-Math.min(innerWidth/1920,innerHeight/1080))<0.00001);
   const fit=await page.locator('#tvSettings').evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight+1&&r.left>=0&&r.right<=innerWidth+1&&el.scrollWidth<=el.clientWidth;});
   assert.equal(fit,true,'Expanded settings fit the viewport: '+JSON.stringify(await page.locator('#tvSettings').evaluate(el=>({rect:el.getBoundingClientRect().toJSON(),scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,innerWidth,innerHeight}))));
   await page.locator('#tvSettings button[type=submit]').scrollIntoViewIfNeeded();
  }
  await page.setViewportSize({width:1920,height:1080});
  await page.waitForFunction(()=>Math.abs(Number(getComputedStyle(document.documentElement).getPropertyValue('--app-scale'))-1)<0.00001);
  await page.click('#tvSettingsCancel');
  await page.selectOption('#themeSelect','black-gold',{force:true});
  await page.click('#tvSettingsButton');
  await page.locator('#tvColorSettings .tv-color-value').evaluateAll(inputs=>inputs.forEach(input=>{input.value='#345678';input.dispatchEvent(new Event('input',{bubbles:true}));}));
  await page.click('#tvSettings button[type=submit]');
  await page.evaluate(()=>{state.rounds=Array.from({length:70},(_,i)=>({r:i%11===0?'T':i%7<3?'B':'P',bp:true,pp:true}));renderAll();});
  const checks=[
   ['body','backgroundColor'],['.tv-app .panel','backgroundColor'],['.tv-app .panel','borderTopColor'],
   ['#bigRoad','backgroundColor'],['#bigRoad','borderTopColor'],['#bigRoad','color','::before'],
   ['.key-legend','color'],['.key-legend b','color'],['.predict-title','color'],
   ['.tv-limit-key-high','color'],['.tv-limit-key-low','color'],['#tvSettings','backgroundColor'],
   ['#tvSettingsReset','backgroundColor'],['#bigRoad .big-circle.B','borderTopColor'],
   ['#bigRoad .big-circle.P','borderTopColor'],
['#bigRoad .mark-bp','backgroundColor'],['#bigRoad .mark-pp','backgroundColor'],
   ...['stat-banker','stat-player','stat-tie','stat-lucky6','stat-banker-pair','stat-player-pair','tv-lucky7','tv-super-lucky7','tv-stat-empty','tv-stat-head'].map(c=>['.tv-stats .'+c,'backgroundColor']),
   ['.tv-stats .k','color'],['#pBE_B','borderTopColor'],['#pBE_P','borderTopColor'],['#pSR_B','backgroundColor'],['#pCR_P','backgroundColor','::before'],
   ['#starRoad .B','borderTopColor'],['#starRoad .P','borderTopColor']
  ];
  for(const [selector,property,pseudo] of checks) assert.equal(await page.locator(selector).first().evaluate((el,[property,pseudo])=>getComputedStyle(el,pseudo)[property],[property,pseudo]),'rgb(52, 86, 120)',selector+' '+property);
  // 莊／閒／和珠改成圓牌漸層，自選色帶進漸層裡，所以檢查 backgroundImage。
  // 莊／閒／和珠改用固定圖檔（與幸運7 同風格），自選色不再套到這三種珠子。
  for(const [selector,file] of [['#beadBoard .bead.B:not(.l6)','banker.png'],['#beadBoard .bead.P','player.png'],['#beadBoard .bead.T','tie.png']]) assert.ok((await page.locator(selector+' img.bead-art').first().getAttribute('src')).endsWith(file),selector+' art');
  for(const selector of ['#smallRoad .shape-solid','#cockroachRoad .shape-slash']) {
   assert.ok((await page.locator(selector).first().evaluate(el=>getComputedStyle(el,el.classList.contains('shape-slash')?'::before':null).backgroundImage)).includes('52, 86, 120'));
  }
  await page.click('#tvSettingsButton');await page.click('#tvTabScreen');await page.click('#tvColorsReset');await page.click('#tvSettings button[type=submit]');
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('baccarat_tv_settings_v1')).colors),{});
  assert.equal(await page.evaluate(()=>document.documentElement.className.includes('tv-color-')),false);
  await page.selectOption('#themeSelect','classic',{force:true});
  await page.click('#tvSettingsButton');
  await page.setViewportSize({width:1920,height:1080});
  await page.locator('#tvSettings').evaluate(el=>el.scrollTop=0);
  await page.locator('#tvSettings').screenshot({path:path.join(__dirname,'../.preview/tv-color-settings.png')});
  assert.deepEqual(errors,[]);
  await page.goto(pathToFileURL(path.join(__dirname,'../index.html')).href);
  assert.equal(await page.evaluate(()=>getDragonThreshold()),6,'Original page retains its default threshold');
  assert.deepEqual(errors,[]);
  console.log('PASS: full-display colors, apply/reload/cancel/reset, compatibility, invalid values, dragon boundaries/ties/showcase, settings viewport fit');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
