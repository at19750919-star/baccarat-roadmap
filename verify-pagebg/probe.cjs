const { chromium } = require(process.env.TEMP + '/pwtool/node_modules/playwright-core');
const fs=require('fs'),os=require('os'),path=require('path');
(async()=>{
 const ctx=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(),'pgbg-')),{channel:'chrome',headless:true});
 const page=ctx.pages()[0];
 await page.goto('file:///'+process.cwd().replace(/\\/g,'/')+'/tv.html'); await page.waitForTimeout(1000);
 console.log(JSON.stringify(await page.evaluate(()=>{const out=[];for(const sh of document.styleSheets){try{for(const r of sh.cssRules){if(r.selectorText&&document.body.matches(r.selectorText)&&/background/.test(r.style.cssText))out.push((sh.href||'inline').split('/').pop()+' | '+r.selectorText+' | '+r.style.background+r.style.backgroundColor)}}catch(e){}}return{bg:getComputedStyle(document.body).backgroundColor,htmlCls:document.documentElement.className,htmlStyle:document.documentElement.getAttribute('style'),bodyStyle:document.body.getAttribute('style'),bodyCls:document.body.className,ls:Object.keys(localStorage),out}}),null,1));
 await ctx.close();})();
