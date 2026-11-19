const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto'),path=require('path');
const code=fs.readFileSync(path.join(__dirname,'../backend/road_onedrive.gs'),'utf8');
function env(mode='ok'){
 const config={clientId:'app-id',clientSecret:'secret',refreshToken:'refresh',rootId:'root'};if(mode.startsWith('full'))config.scope='Files.ReadWrite';if(mode==='unknownScope')config.scope='Files.ReadWrite.All';const props=new Map([['road_inbox_v1_onedrive_config',JSON.stringify(config)]]);
 const calls=[],names=[],uploads=[],sleeps=[];let posts=0,deleted=0;
 const blob=(b,type)=>({type,getBytes:()=>Array.from(Buffer.isBuffer(b)?b:typeof b==='string'?Buffer.from(b):Buffer.from(b))});
 const ctx={ROAD_KEY:'road_inbox_v1_',console:{log(){},error(){}},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k),setProperty:(k,v)=>props.set(k,v)})},
  Utilities:{newBlob:blob,sleep:n=>sleeps.push(n),DigestAlgorithm:{SHA_1:'sha1'},computeDigest:(a,b)=>Array.from(crypto.createHash(a).update(Buffer.from(b)).digest())},
  roadFail_:s=>{throw Error('ROAD:'+s)},UrlFetchApp:{fetch(url,o){
   calls.push({url,method:o.method||'get'});let status=200,data;
   if(url.includes('/oauth2/')){assert.equal(o.payload.scope,(config.scope||'Files.ReadWrite.AppFolder')+' offline_access');data={access_token:'access',scope:mode==='full'?'Files.ReadWrite Files.ReadWrite.AppFolder':mode==='fullExcess'?'Files.ReadWrite Files.ReadWrite.All':mode==='legacyExcess'?'Files.ReadWrite Files.ReadWrite.AppFolder':'Files.ReadWrite.AppFolder',refresh_token:'rotated'};}
   else {
    assert(url.startsWith('https://graph.microsoft.com/v1.0/me/drive/'));assert.equal(o.followRedirects,false);assert.equal(o.headers.Authorization,'Bearer access');
    if(url.endsWith('/permissions'))data={value:mode==='shared'?[{roles:['read'],link:{scope:'anonymous'}}]:[{roles:['owner']}]};
    else if(o.method==='post'){
     posts++;const p=JSON.parse(o.payload);names.push(p.name);assert.equal(p['@microsoft.graph.conflictBehavior'],'fail');assert.equal(new Set(names).size,1);
     if(['once','lost','nonempty','wrongParent','missingParent','persistent'].includes(mode)&&(posts===1||mode==='persistent')){status=404;data={error:{code:'itemNotFound'}};}
     else if(/^http/.test(mode)){status=Number(mode.slice(4));data={error:{code:'otherError'}};}else data={id:'submission',folder:{}};
    } else if(url.endsWith('/items/root')){status=mode==='missingParent'?404:200;data=status===200?{id:'root',folder:{}}:{error:{code:'itemNotFound'}};}
    else if(url.includes('/items/root:/')){
     if(['lost','nonempty','wrongParent'].includes(mode))data={id:'submission',name:names[0],folder:{childCount:mode==='nonempty'?1:0},parentReference:{id:mode==='wrongParent'?'elsewhere':'root'}};
     else {status=404;data={error:{code:'itemNotFound'}};}
    } else if(o.method==='put'){
     const b=Buffer.from(o.payload.getBytes());uploads.push({type:o.contentType,bytes:b});data={id:'file',size:b.length,file:{hashes:{sha1Hash:crypto.createHash('sha1').update(b).digest('hex')}}};
     if(mode==='badSize')data.size++;if(mode==='badHash')data.file.hashes.sha1Hash='0'.repeat(40);
     if(mode==='partial'&&uploads.length===2){status=503;data={error:{code:'serverError'}};}
    }else if(o.method==='delete'){deleted++;status=204;data=null;}else throw Error('unexpected request');
   }
   return{getResponseCode:()=>status,getContentText:()=>data===null?'':JSON.stringify(data)};
  }}};
 vm.createContext(ctx);vm.runInContext(code,ctx);
 return{ctx,props,calls,names,uploads,sleeps,get posts(){return posts;},get deleted(){return deleted;}};
}
const data={receipt:'a'.repeat(64),roadmap:{name:'測試路單'}},json=JSON.stringify({rounds:[{r:'B'}]}),png=Array.from(Buffer.from('synthetic PNG bytes'));
let groups=0;function test(name,f){f();groups++;console.log('PASS '+name);}
const save=e=>e.ctx.roadOneDrivePair_(data,json,png);
test('Paired exact bytes, least privilege token and refresh rotation',()=>{const e=env();save(e);assert.equal(e.uploads.length,2);assert(e.uploads[0].bytes.equals(Buffer.from(json)));assert(e.uploads[1].bytes.equals(Buffer.from(png)));assert.equal(JSON.parse(e.props.get('road_inbox_v1_onedrive_config')).refreshToken,'rotated');});
test('Observed create-folder 404 recovers with one fixed name',()=>{const e=env('once');save(e);assert.equal(e.posts,2);assert.deepEqual(e.sleeps,[400]);assert.equal(e.uploads.length,2);});
test('Lost create response reconciles existing empty folder without another POST',()=>{const e=env('lost');save(e);assert.equal(e.posts,1);assert.equal(e.uploads.length,2);});
test('Persistent error bounded; missing/wrong/nonempty parent data fail closed',()=>{for(const mode of ['persistent','missingParent','wrongParent','nonempty']){const e=env(mode);assert.throws(()=>save(e));assert.equal(e.posts,mode==='persistent'?3:1);assert.equal(e.uploads.length,0);assert.equal(e.deleted,0);}});
test('Unrelated HTTP errors and public sharing do not retry',()=>{for(const mode of ['http401','http403','http429','http503','shared']){const e=env(mode);assert.throws(()=>save(e));assert.equal(e.posts,mode==='shared'?0:1);assert.equal(e.uploads.length,0);assert.equal(e.sleeps.length,0);}});
test('Partial write, mismatched size and hash fail and recycle only new folder',()=>{for(const mode of ['partial','badSize','badHash']){const e=env(mode);assert.throws(()=>save(e));assert.equal(e.deleted,1);}});
test('Owner-consented Files.ReadWrite works; legacy scope stays narrow and unexpected scopes fail',()=>{const full=env('full');save(full);assert.equal(full.uploads.length,2);assert.equal(JSON.parse(full.props.get('road_inbox_v1_onedrive_config')).scope,'Files.ReadWrite');for(const mode of ['fullMissing','fullExcess','legacyExcess','unknownScope']){const e=env(mode);assert.throws(()=>save(e));assert.equal(e.uploads.length,0);assert.equal(e.posts,0);}});
test('v18 JSON-only: one file, exact bytes, no png; failure cleans up folder; json+png path unchanged',()=>{
 const e=env();e.ctx.roadOneDrivePair_(data,json,null);assert.equal(e.uploads.length,1);assert(e.uploads[0].bytes.equals(Buffer.from(json)));assert.equal(e.uploads[0].type,'application/json');
 assert(!e.calls.some(c=>/\.png/.test(decodeURIComponent(c.url))));
 const e2=env();e2.ctx.roadOneDrivePair_(data,json,undefined);assert.equal(e2.uploads.length,1);
 for(const mode of ['badSize','badHash']){const f=env(mode);assert.throws(()=>f.ctx.roadOneDrivePair_(data,json,null));assert.equal(f.deleted,1);assert.equal(f.uploads.length,1);}
 const g=env('http503');assert.throws(()=>g.ctx.roadOneDrivePair_(data,json,null));assert.equal(g.uploads.length,0);
});
// ---- Full v18 receiver (roadReceive_) with mocked Apps Script services ----
function receiver(provider){
 const code=fs.readFileSync(path.join(__dirname,'../backend/程式碼-v18-只收JSON.gs'),'utf8');
 const props=new Map([['road_inbox_v1_provider',provider]]),pairs=[],files=[];
 const blob=(b,type,name)=>({type,name,getBytes:()=>Array.from(typeof b==='string'?Buffer.from(b):Buffer.from(b))});
 const folder={createFolder:()=>folder,createFile:b=>files.push({name:b.name,type:b.type}),setTrashed(){}};
 const ctx={console:{log(){},error(){}},
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k)??null,setProperty:(k,v)=>props.set(k,v),getProperties:()=>Object.fromEntries(props),deleteProperty:k=>props.delete(k)})},
  LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},
  Utilities:{newBlob:blob,formatDate:()=>'2026-11-19',DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(a,b)=>Array.from(crypto.createHash(a).update(Buffer.from(b)).digest()),base64Decode:b=>Array.from(Buffer.from(b,'base64'))},
  DriveApp:{}};
 vm.createContext(ctx);vm.runInContext(code,ctx);
 ctx.roadRoot_=()=>folder;ctx.roadPng_=s=>Array.from(Buffer.from(s,'base64'));
 ctx.roadOneDrivePair_=(d,j,img)=>pairs.push({json:j,image:img});
 return{ctx,props,pairs,files};
}
const road=()=>({id:'road-1',name:'v18測試',createdAt:'2026-11-19T01:02:03.000Z',counts:{banker:1,player:1,tie:0,total:2},outcomes:['莊','閒'],nonTieOutcomes:['莊','閒'],rounds:[{r:'B',bp:false,pp:false,l6:false,l7:2},{r:'P',bp:false,pp:false,l6:false,tiger:'big'}]});
const submit=(rc,o)=>rc.ctx.roadReceive_({action:'roadSubmit',receipt:'b'.repeat(64),roadmap:road(),...o});
test('v18 roadReceive_ OneDrive: JSON-only is complete (1 file); with PNG still pairs; v17 optional fields accepted',()=>{
 const a=receiver('onedrive'),r=submit(a);assert.deepEqual({s:r.success,st:r.state,p:r.provider},{s:true,st:'complete',p:'onedrive'});
 assert.equal(a.pairs.length,1);assert.equal(a.pairs[0].image,null);assert.equal(JSON.parse(a.props.get('road_inbox_v1_r_'+'b'.repeat(64))).files,1);
 const again=submit(a);assert.equal(again.success,true);assert.equal(a.pairs.length,1);
 const st=a.ctx.roadStatus_('b'.repeat(64));assert.equal(st.state,'complete');
 const b=receiver('onedrive'),r2=submit(b,{pngBase64:Buffer.from('png-bytes').toString('base64')});assert.equal(r2.state,'complete');assert.equal(b.pairs[0].image.length,9);assert.equal(JSON.parse(b.props.get('road_inbox_v1_r_'+'b'.repeat(64))).files,2);
});
test('v18 roadReceive_ Google Drive: JSON-only creates only .json; with PNG creates .json and .png',()=>{
 const a=receiver('gdrive');assert.equal(submit(a).success,true);assert.deepEqual(a.files.map(f=>f.name),['v18測試.json']);
 const b=receiver('gdrive');assert.equal(submit(b,{pngBase64:Buffer.from('x').toString('base64')}).success,true);assert.deepEqual(b.files.map(f=>f.name),['v18測試.json','v18測試.png']);
});
test('v18 roadReceive_ rejects bad input and failed upload is recorded failed',()=>{
 const a=receiver('onedrive');assert.equal(submit(a,{extra:1}).error,'invalid_schema');
 assert.equal(submit(a,{pngBase64:null}).error,'invalid_png');assert.equal(submit(a,{pngBase64:123}).error,'invalid_png');
 const bad=road();bad.counts.banker=5;assert.equal(submit(a,{roadmap:bad}).error,'invalid_counts');
 const f=receiver('onedrive');f.ctx.roadOneDrivePair_=()=>{throw Error('ROAD:storage_unavailable')};const r=submit(f);assert.equal(r.success,false);assert.equal(r.state,'failed');assert.equal(JSON.parse(f.props.get('road_inbox_v1_r_'+'b'.repeat(64))).state,'failed');
 f.ctx.roadOneDrivePair_=(d,j,i)=>{};assert.equal(submit(f).success,true);
});
console.log('OneDrive adapter '+groups+' regression groups passed (mocked cloud).');
