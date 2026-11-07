const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
(async () => {
 const browser = await chromium.launch({headless:true,channel:'chrome'});
 try {
  const page = await browser.newPage({viewport:{width:1920,height:1080}});
  page.setDefaultTimeout(5000);const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.join(__dirname,'../tv.html')).href);
  await page.waitForTimeout(150);
  const seed = async () => {await page.evaluate(()=>{state.rounds=[];addRound('B',{});addRound('P',{});addRound('T',{});});await page.locator('body').click({position:{x:2,y:2}});};
  const count = () => page.evaluate(()=>state.rounds.length);
  for (const key of ['Digit7','Numpad7']) {
   await seed();await page.keyboard.press(key);await page.waitForTimeout(330);
   assert.equal(await count(),2,key+' must undo one round');
   await page.keyboard.press('Backspace');assert.equal(await count(),1,'Backspace remains undo');
   await seed();await page.keyboard.press(key);await page.waitForTimeout(60);await page.keyboard.press(key);
   await page.waitForTimeout(330);assert.equal(await page.locator('#tvSettings').evaluate(e=>e.open),true,'77 opens settings');
   assert.equal(await count(),3,'77 must not undo');
   await page.keyboard.press('Digit7');await page.keyboard.press('Digit8');await page.keyboard.press('Digit9');await page.keyboard.press('Digit9');
   assert.equal(await count(),3,'Settings blocks game shortcuts');await page.click('#tvSettingsCancel');
  }
  for (const key of ['Digit8','Numpad8']) {
   await seed();let savedDialog;page.once('dialog',async d=>{savedDialog={type:d.type(),message:d.message()};await d.dismiss();});await page.keyboard.press(key);
   assert.equal(savedDialog.type,'prompt','8 opens the existing save workflow');assert.match(savedDialog.message,/路單名稱/);
   assert.equal(await count(),3,'Saving does not change rounds');assert.notEqual(await page.locator('.app').evaluate(e=>e.style.display),'none');
  }
  await seed();await page.keyboard.press('Digit9');await page.waitForTimeout(300);assert.equal(await count(),3,'Single 9 does not clear');
  let clearType;page.once('dialog',async d=>{clearType=d.type();await d.dismiss();});await page.keyboard.press('Digit9');await page.keyboard.press('Digit9');assert.equal(clearType,'confirm');assert.equal(await count(),3,'Cancel clear preserves rounds');
  page.once('dialog',async d=>{await d.accept();});await page.keyboard.press('Numpad9');await page.keyboard.press('Numpad9');assert.equal(await count(),0,'99 confirms new road');
  await seed();await page.keyboard.press('Digit1');await page.keyboard.press('Digit7');await page.waitForTimeout(500);assert.equal(await count(),2,'Undo cancels pending automatic round');
  await seed();await page.keyboard.press('Digit7');await page.keyboard.press('Digit1');await page.keyboard.press('Enter');await page.waitForTimeout(350);assert.deepEqual(await page.evaluate(()=>state.rounds.map(r=>r.r)),['B','P','B'],'Undo precedes next entry');
  await seed();await page.keyboard.press('Control+Digit7');await page.keyboard.press('Control+Digit8');await page.waitForTimeout(350);assert.equal(await count(),3,'Modified keys do not change rounds');
  await page.click('#tvSettingsButton');await page.click('#tvTabBasic');await page.locator('#tvDragonThreshold').fill('7');await page.keyboard.press('Digit8');assert.equal(await count(),3,'Input typing does not trigger save');await page.click('#tvSettingsCancel');
  await seed();await page.keyboard.down('Digit7');await page.evaluate(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'7',code:'Digit7',repeat:true,bubbles:true})));await page.keyboard.up('Digit7');await page.waitForTimeout(330);assert.equal(await count(),2,'Held key only undoes once');
  assert.deepEqual(errors,[],'No JavaScript errors');console.log('PASS: main/numpad 7, 77, 8, 99; Backspace; pending inputs; dialog isolation; modifiers; repeat.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
