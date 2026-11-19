const { chromium } = require(process.env.TEMP + '/pwtool/node_modules/playwright-core');
const fs=require('fs'),os=require('os'),path=require('path');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pgbg-'));
 const ctx=await chromium.launchPersistentContext(dir,{channel:'chrome',headless:true,viewport:{width:2560,height:1440}});
 const page=ctx.pages()[0]||await ctx.newPage(); const errs=[];
 page.on('console',m=>{if(m.type()==='error')errs.push(m.text())}); page.on('pageerror',e=>errs.push(String(e)));
 const base='file:///'+process.cwd().replace(/\\/g,'/')+'/tv.html';
 await page.goto(base); await page.waitForTimeout(800);
 const before=await page.evaluate(()=>{const r=JSON.parse(localStorage.getItem('baccarat_tv_settings_v1')||'{}');r.colors=Object.assign({},r.colors,{page:'#151716',banker:'#123456'});r.__probe='keep';localStorage.setItem('baccarat_tv_settings_v1',JSON.stringify(r));localStorage.setItem('other_key','x');return r;});
 await page.reload(); await page.waitForTimeout(800);
 const pre=await page.evaluate(()=>getComputedStyle(document.body).backgroundColor);
 errs.length=0;
 await page.goto(base+'?tvEditReset=page-bg'); await page.waitForTimeout(1500);
 const r=await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('baccarat_tv_settings_v1'));const bk=Object.keys(localStorage).filter(k=>k.startsWith('tv-edit-mode-backup:'));return{bg:getComputedStyle(document.body).backgroundColor,url:location.href,hasPage:'page' in (s.colors||{}),banker:s.colors.banker,probe:s.__probe,other:localStorage.getItem('other_key'),backups:bk,backupHasPage:bk.some(k=>localStorage.getItem(k).includes('#151716'))}});
 await page.screenshot({path:'verify-pagebg/playwright-2560.png'});
 console.log(JSON.stringify({pre,...r,errs},null,1)); await ctx.close();
})().catch(e=>{console.error(e);process.exit(1)});
