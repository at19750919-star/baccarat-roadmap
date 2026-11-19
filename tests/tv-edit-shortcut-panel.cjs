const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try {
  const page=await browser.newPage({viewport:{width:1580,height:884}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.join(__dirname,'../tv.html')).href);
  const before=await page.evaluate(()=>({rounds:JSON.stringify(state.rounds),settings:localStorage.getItem('tv-edit-mode:settings')}));
  await page.keyboard.press('KeyX');
  await page.waitForTimeout(80);
  assert.equal(await page.locator('#tvEditPanel').isVisible(),true,'X must immediately display the editor, without an extra target click');
  const field=page.locator('.tv-limit [data-k=bpMax]');
  const box=await field.boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
  assert.equal(await field.evaluate(e=>e.classList.contains('tv-edit-selected')),true,'Edit mode must allow selecting the actual limit field');
  assert.equal(await field.evaluate(e=>e.readOnly),true,'Selection must not make the limit directly editable');
  const selection=await page.locator('#tvEditSelection').textContent();assert.match(selection,/莊.*閒.*最高/);
  await page.locator('#tvEditPanel').waitFor({state:'visible'});
  await page.keyboard.press('KeyX');assert.equal(await page.locator('#tvEditPanel').isVisible(),false);
  assert.deepEqual(await page.evaluate(()=>({rounds:JSON.stringify(state.rounds),settings:localStorage.getItem('tv-edit-mode:settings')})),before,'Opening, selecting and closing must not save style changes');
  assert.deepEqual(errors,[]);
  console.log('PASS: X opens and closes the editor; actual banker/player high field can be selected; value remains readonly; no saved style or road changes.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
