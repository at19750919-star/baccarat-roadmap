const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{pathToFileURL}=require('url');
let chromium;
try{({chromium}=require('playwright'));}catch(_){({chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')));}
const output=process.env.EXPORT_TEST_OUTPUT||path.join(__dirname,'output');fs.mkdirSync(output,{recursive:true});
async function main(){
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({body:''}));await page.route('https://fonts.gstatic.com/**',r=>r.abort());
  const fixture=process.env.HTML2CANVAS_TEST_FILE;
  if(fixture)await page.route('https://cdn.jsdelivr.net/npm/html2canvas@*/dist/html2canvas.min.js',r=>r.fulfill({path:fixture,contentType:'text/javascript'}));
  await page.goto(process.env.ROADMAP_TEST_URL||pathToFileURL(path.join(__dirname,'../index.html')).href);
  await page.waitForFunction(()=>window.RoadBackup&&typeof html2canvas==='function');
  if(process.env.ROADMAP_TEST_THEME)await page.selectOption('#themeSelect',process.env.ROADMAP_TEST_THEME);
  const cases=[{name:'whole-20',rounds:['B','B','B','B','B','B','P','P','P','P','P','P','B','B','B','B','B','B','B','B']},
    {name:'whole-long',rounds:Array.from({length:184},(_,i)=>i%13===0?'T':i%2?'P':'B')}];
  for(const sample of cases){
   const result=await page.evaluate(async sample=>{
    state.rounds=sample.rounds.map((r,i)=>({r,bp:i%9===0,pp:i%11===0,l6:false}));renderAll();
    const rounds=JSON.parse(JSON.stringify(state.rounds)),counts={banker:rounds.filter(x=>x.r==='B').length,player:rounds.filter(x=>x.r==='P').length,tie:rounds.filter(x=>x.r==='T').length,total:rounds.length};
    const entry={id:'road-layout-test',name:sample.name,createdAt:'2026-10-24T00:00:00.000Z',counts,rounds};
    const original=html2canvas;let layout;
    window.html2canvas=async(view,options)=>{
      const box=n=>{if(!n)return null;const b=n.getBoundingClientRect(),v=view.getBoundingClientRect();return{x:b.x-v.x,y:b.y-v.y,width:b.width,height:b.height};};
      layout={background:options.backgroundColor,wholeApp:view.classList.contains('app'),header:box(view.querySelector('.title-bar')),big:box(view.querySelector('.big-road')),
       middle:box(view.querySelector('.mid-row')),bottom:box(view.querySelector('.bottom-row')),
       stats:box(view.querySelector('.stats-panel')),limits:box(view.querySelector('.limit-panel')),predict:box(view.querySelector('.predict-panel')),
       beads:view.querySelectorAll('.bead').length,total:view.querySelector('[data-export-id="totalCount"]')?.textContent,
       panels:[...view.querySelectorAll('.grid-board')].map(n=>{const b=box(n),p=box(n.parentElement);return{label:n.dataset.label,width:b.width,parentWidth:p.width};}),
       duplicateIds:view.querySelectorAll('[id]').length,notice:!!view.querySelector('#backupNotice'),w:view.offsetWidth,h:view.offsetHeight};
      return original(view,options);
    };
    const job=RoadBackup.png(entry);addRound('P');const image=await job;window.html2canvas=original;
    const data=await new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.readAsDataURL(image.blob);});
    return{layout,width:image.width,height:image.height,bytes:image.blob.size,data,current:state.rounds.length};
   },sample);
   fs.writeFileSync(path.join(output,sample.name+'.png'),Buffer.from(result.data.split(',')[1],'base64'));delete result.data;
   assert(result.layout.wholeApp,'Export should preserve the complete app layout');
   assert.equal(result.layout.background,process.env.ROADMAP_TEST_THEME==='black-gold'?'rgb(7, 9, 11)':'rgb(122, 11, 11)');
   assert(result.layout.header&&result.layout.stats&&result.layout.limits&&result.layout.predict,'Complete header and bottom panels required');
   assert(result.layout.big.y<result.layout.middle.y&&result.layout.middle.y<result.layout.bottom.y);
   assert.equal(result.layout.beads,sample.rounds.length);assert.equal(Number(result.layout.total),sample.rounds.length);assert.equal(result.current,sample.rounds.length+1);
   assert.equal(result.layout.duplicateIds,0);assert.equal(result.layout.notice,false);
   assert(result.layout.panels.every(p=>p.width<=p.parentWidth+1),'All road columns must fit their panels');
   assert(result.width<=12000&&result.height<=12000&&result.width*result.height<=24000000);assert(result.bytes<=6291456);
   if(sample.rounds.length===20){assert.equal(result.width,2880);assert.equal(result.height,1620);}
   console.log('PASS '+sample.name+' '+JSON.stringify(result));
  }
  assert.equal(await page.locator('.road-export-host').count(),0);console.log('PASS export temporary DOM cleaned; visible app and local state preserved');
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1});
