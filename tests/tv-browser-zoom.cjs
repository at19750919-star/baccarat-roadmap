const assert=require('node:assert/strict');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const {pathToFileURL}=require('node:url');
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')));}
(async()=>{
 const extension=fs.mkdtempSync(path.join(os.tmpdir(),'tv-zoom-test-'));
 fs.writeFileSync(path.join(extension,'manifest.json'),JSON.stringify({manifest_version:3,name:'Local zoom regression fixture',version:'1.0',permissions:['tabs'],background:{service_worker:'background.js'}}));
 fs.writeFileSync(path.join(extension,'background.js'),'chrome.runtime.onInstalled.addListener(() => {});');
 let context;
 try{
  context=await chromium.launchPersistentContext('',{channel:'chromium',headless:true,args:['--disable-extensions-except='+extension,'--load-extension='+extension],viewport:{width:1900,height:930}});
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const chooseColor=async key=>{await page.click('#tvColorTarget');await page.locator('[data-color-option="'+key+'"]').click();};
  await page.route('https://**',r=>r.fulfill({body:''}));
  await page.goto(pathToFileURL(path.join(__dirname,'../tv.html')).href);
  await page.evaluate(()=>{localStorage.clear();localStorage.setItem('baccarat_road_rounds_v1',JSON.stringify(Array.from({length:60},(_,i)=>({r:i%8<3?'B':'P',bp:false,pp:false}))));});await page.reload();
  const target=await worker.evaluate(async()=>{const tabs=await chrome.tabs.query({});return tabs.find(t=>t.url.endsWith('/tv.html')).id;});
  const widths=[];
  await page.click('#tvSettingsButton');
  for(const zoom of [.5,1,1.25,2,5]){
   await worker.evaluate(async({id,zoom})=>chrome.tabs.setZoom(id,zoom),{id:target,zoom});
   await page.waitForFunction(z=>Math.abs(innerWidth-1900/z)<1&&Math.abs(Number(getComputedStyle(document.documentElement).getPropertyValue('--app-scale'))-Math.min(innerWidth/1920,innerHeight/1080))<.00001,zoom);
   const state=await page.locator('#tvSettings').evaluate(el=>{
    const r=el.getBoundingClientRect(),footer=el.querySelector('footer').getBoundingClientRect();
    const overflowing=[...el.querySelectorAll('input,button,select')].filter(node=>node.getClientRects().length).filter(node=>{const b=node.getBoundingClientRect();return b.left<r.left-.1||b.top<r.top-.1||b.right>r.right+.1||b.bottom>r.bottom+.1;}).map(node=>node.id);
    return{rect:r.toJSON(),width:innerWidth,height:innerHeight,footer:footer.bottom<=r.bottom,overflowing};
   });
   assert.ok(state.rect.left>=0&&state.rect.top>=0&&state.rect.right<=state.width+.1&&state.rect.bottom<=state.height+.1,JSON.stringify({zoom,state}));
   assert.deepEqual(state.overflowing,[]);assert.ok(state.footer);widths.push(state.rect.width*zoom);
   await page.click('#tvTabScreen');await page.click('#tvColorTarget');
   const menu=await page.locator('#tvColorOptions').evaluate(el=>{const r=el.getBoundingClientRect(),p=document.getElementById('tvSettings').getBoundingClientRect();return {width:r.width,height:r.height,left:r.left,right:r.right,top:r.top,bottom:r.bottom,p:p.toJSON()};});
   assert.ok(menu.left>=menu.p.left&&menu.right<=menu.p.right+.1&&menu.bottom<=menu.p.bottom+.1,JSON.stringify(menu));
   assert.ok(menu.width*zoom<320&&menu.height*zoom<230,'Expanded menu remains compact at '+zoom);
   if(zoom===5)await page.screenshot({path:path.join(__dirname,'../.preview/settings-dropdown-500.png')});
   await page.keyboard.press('Escape');assert.equal(await page.locator('#tvSettings').evaluate(el=>el.open),true);
   await page.click('#tvTabRoad');await chooseColor('red');await page.fill('#tvColorHex','#ff8800');
   assert.equal(await page.locator('#bigRoad .B').first().evaluate(el=>getComputedStyle(el).borderTopColor),'rgb(255, 136, 0)');
   await page.click('#tvTabBasic');
  }
  assert.ok(Math.max(...widths)-Math.min(...widths)<2,JSON.stringify(widths));
  // 520px panel, then the height-limited app scale at this 1900×930 viewport. A wider or narrower panel fails.
  const designed=520*Math.min(1900/1920,930/1080);
  assert.ok(widths.every(w=>Math.abs(w-designed)<2),JSON.stringify({widths,designed}));
  const head=await page.locator('.tv-settings-header').boundingBox();
  await page.mouse.move(head.x+head.width*.25,head.y+head.height*.5);await page.mouse.down();await page.mouse.move(20,20,{steps:5});await page.mouse.up();
  const moved=await page.locator('#tvSettings').boundingBox();assert.ok(moved.x<50&&moved.y>=0,'Drag works at actual 500% browser zoom');
  await page.click('#tvTabRoad');
  await page.locator('#tvColorTarget').click();await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');assert.equal(await page.locator('#tvColorTarget').evaluate(el=>el.value),'blue');
  await chooseColor('red');
  await page.screenshot({path:path.join(__dirname,'../.preview/settings-zoom-500.png')});
  await page.click('#tvSettingsCancel');assert.equal(await page.locator('#bigRoad .B').first().evaluate(el=>getComputedStyle(el).borderTopColor),'rgb(214, 33, 33)');
  assert.equal(await page.evaluate(()=>localStorage.getItem('baccarat_tv_settings_v1')),null);
  // At 500% the unscaled edit button covers the scaled logo. The logo still has to stay inside the viewport.
  const settingsVisible=await page.locator('#tvSettingsButton').evaluate(el=>{const r=el.getBoundingClientRect();return r.width>8&&r.top>=-1&&r.left>=-1&&r.bottom<=innerHeight+1&&r.right<=innerWidth+1;});
  assert.equal(settingsVisible,true,'Settings button stays inside the zoomed viewport');
  await page.locator('#tvSettingsButton').evaluate(el=>el.click());await page.fill('#tvBigStroke','10');await page.click('#tvSettings button[type=submit]');await page.reload();
  assert.equal(await page.locator('#bigRoad .big-circle').first().evaluate(el=>getComputedStyle(el).borderTopWidth),'10px');
  assert.deepEqual(errors,[]);console.log('PASS actual Chromium tab zoom 50/100/125/200/500%; stable panel width '+widths.map(w=>w.toFixed(1)).join('/')+' px; bounded controls, live preview, real expanded menu geometry at every zoom, drag/dropdown, cancel and persistence at 500%');
 }finally{
  if(context)await context.close();
  fs.unlinkSync(path.join(extension,'manifest.json'));fs.unlinkSync(path.join(extension,'background.js'));fs.rmdirSync(extension);
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
