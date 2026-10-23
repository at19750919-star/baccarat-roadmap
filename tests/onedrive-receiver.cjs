const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto'),path=require('path');
const code=fs.readFileSync(path.join(__dirname,'../backend/road_onedrive.gs'),'utf8');
function env(mode='ok'){
 const config={clientId:'app-id',clientSecret:'secret',refreshToken:'refresh',rootId:'root'},props=new Map([['road_inbox_v1_onedrive_config',JSON.stringify(config)]]);
 const calls=[],names=[],uploads=[],sleeps=[];let posts=0,deleted=0;
 const blob=(b,type)=>({type,getBytes:()=>Array.from(Buffer.isBuffer(b)?b:typeof b==='string'?Buffer.from(b):Buffer.from(b))});
 const ctx={ROAD_KEY:'road_inbox_v1_',console:{log(){},error(){}},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k),setProperty:(k,v)=>props.set(k,v)})},
  Utilities:{newBlob:blob,sleep:n=>sleeps.push(n),DigestAlgorithm:{SHA_1:'sha1'},computeDigest:(a,b)=>Array.from(crypto.createHash(a).update(Buffer.from(b)).digest())},
  roadFail_:s=>{throw Error('ROAD:'+s)},UrlFetchApp:{fetch(url,o){
   calls.push({url,method:o.method||'get'});let status=200,data;
   if(url.includes('/oauth2/')){assert.equal(o.payload.scope,'Files.ReadWrite.AppFolder offline_access');data={access_token:'access',scope:'Files.ReadWrite.AppFolder',refresh_token:'rotated'};}
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
console.log('OneDrive adapter '+groups+' regression groups passed (mocked cloud).');
