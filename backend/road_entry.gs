// TV-compatible validator and v18 receiver used by the existing Apps Script project.
// v18: pngBase64 is optional in roadReceive_ (JSON-only submissions are complete). Replace roadEntry_/roadRound_/roadReceive_ with these; do not change tokens.
function roadRound_(r) {
  const required = ['r', 'bp', 'pp', 'l6'], optional = ['l7', 's7', 'tiger'];
  if (!r || typeof r !== 'object' || Array.isArray(r) ||
      required.some(k => !Object.prototype.hasOwnProperty.call(r, k)) ||
      Object.keys(r).some(k => !required.includes(k) && !optional.includes(k))) roadFail_('invalid_schema');
  if (!['B', 'P', 'T'].includes(r.r) || ['bp', 'pp', 'l6'].some(k => typeof r[k] !== 'boolean') ||
      (r.l7 != null && ![2, 3].includes(r.l7)) ||
      (r.s7 != null && ![4, 5, 6].includes(r.s7)) ||
      (r.tiger != null && !['small', 'big'].includes(r.tiger))) roadFail_('invalid_rounds');
}
function roadEntry_(o) {
  roadKeys_(o, ['id', 'name', 'createdAt', 'counts', 'outcomes', 'nonTieOutcomes', 'rounds']);
  if (typeof o.id !== 'string' || o.id.length > 128 || !/^road-[a-zA-Z0-9-]+$/.test(o.id) ||
      typeof o.name !== 'string' || !o.name.trim() || o.name.length > 100 || /[\x00-\x1f]/.test(o.name) ||
      typeof o.createdAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(o.createdAt) ||
      !Number.isFinite(Date.parse(o.createdAt))) roadFail_('invalid_schema');
  if (!Array.isArray(o.rounds) || !o.rounds.length || o.rounds.length > ROAD_LIMIT.rounds) roadFail_('invalid_rounds');
  const c = {banker: 0, player: 0, tie: 0, total: o.rounds.length}, out = [], non = [];
  o.rounds.forEach(r => {
    roadRound_(r);
    const s = r.r === 'B' ? '莊' : r.r === 'P' ? '閒' : '和';
    c[r.r === 'B' ? 'banker' : r.r === 'P' ? 'player' : 'tie']++; out.push(s);
    if (r.r !== 'T') non.push(s);
  });
  roadKeys_(o.counts, ['banker', 'player', 'tie', 'total']);
  if (Object.keys(c).some(k => o.counts[k] !== c[k]) || JSON.stringify(out) !== JSON.stringify(o.outcomes) ||
      JSON.stringify(non) !== JSON.stringify(o.nonTieOutcomes)) roadFail_('invalid_counts');
  const json = JSON.stringify(o, null, 2);
  if (Utilities.newBlob(json).getBytes().length > ROAD_LIMIT.json) roadFail_('json_too_large');
  return json;
}
function roadReceive_(data){
  const lock=LockService.getScriptLock();if(!lock.tryLock(1000))return {success:false,error:'busy'};
  try{const hasPng=data&&typeof data==='object'&&Object.prototype.hasOwnProperty.call(data,'pngBase64');roadKeys_(data,hasPng?['action','receipt','roadmap','pngBase64']:['action','receipt','roadmap']);const props=PropertiesService.getScriptProperties(),key=roadReceipt_(data.receipt),now=Date.now(),old=props.getProperty(key);
    if(hasPng&&(typeof data.pngBase64!=='string'||data.pngBase64.length>8388608))roadFail_('invalid_png');
    const digest=roadHash_(JSON.stringify(data.roadmap)+'\n'+(hasPng?data.pngBase64:''));
    if(old){const r=JSON.parse(old);if(r.digest!==digest)roadFail_('receipt_conflict');if(r.state!=='failed')return {success:r.state==='complete',state:r.state,receipt:data.receipt,provider:r.provider||'gdrive',error:r.state==='complete'?undefined:'submission_incomplete'};}
    const day=Utilities.formatDate(new Date(now),'UTC','yyyy-MM-dd'),minute=Math.floor(now/60000),q=JSON.parse(props.getProperty(ROAD_KEY+'quota')||'{}');
    const quota={day,minute,count:q.day===day?q.count||0:0,bytes:q.day===day?q.bytes||0:0,minuteCount:q.minute===minute?q.minuteCount||0:0};if(quota.count>=ROAD_LIMIT.day||quota.minuteCount>=ROAD_LIMIT.minute)roadFail_('rate_limit');quota.count++;quota.minuteCount++;props.setProperty(ROAD_KEY+'quota',JSON.stringify(quota));
    const json=roadEntry_(data.roadmap),image=hasPng?roadPng_(data.pngBase64):null,size=Utilities.newBlob(json).getBytes().length+(image?image.length:0);if(quota.bytes+size>ROAD_LIMIT.bytes)roadFail_('daily_size_limit');quota.bytes+=size;props.setProperty(ROAD_KEY+'quota',JSON.stringify(quota));
    const all=props.getProperties();Object.keys(all).filter(k=>k.startsWith(ROAD_KEY+'r_')).forEach(k=>{try{if(now-JSON.parse(all[k]).time>7*86400000)props.deleteProperty(k);}catch(_){}});
    const record={state:'pending',digest,files:image?2:1,time:now,provider:props.getProperty(ROAD_KEY+'provider')||'gdrive'};props.setProperty(key,JSON.stringify(record));let folder;
    try{if(record.provider==='onedrive'){roadOneDrivePair_(data,json,image);record.state='complete';props.setProperty(key,JSON.stringify(record));return {success:true,state:'complete',receipt:data.receipt,provider:'onedrive'};}folder=roadRoot_().createFolder(new Date(now).toISOString().replace(/[:.]/g,'-')+'_'+data.receipt.slice(0,12));const name=data.roadmap.name.replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').replace(/[. ]+$/,'').slice(0,100)||'路單';folder.createFile(Utilities.newBlob(json,'application/json',name+'.json'));if(image)folder.createFile(Utilities.newBlob(image,'image/png',name+'.png'));record.state='complete';props.setProperty(key,JSON.stringify(record));return {success:true,state:'complete',receipt:data.receipt};}
    catch(e){console.error('Road receive failure: '+String(e));record.state='failed';record.diagnostic=e.roadDiagnostic||{reason:'unclassified',type:String(e.name||'Error')};try{props.setProperty(key,JSON.stringify(record));}catch(_){}if(folder)try{folder.setTrashed(true);}catch(_){}return {success:false,state:'failed',receipt:data.receipt,error:roadError_(e).error};}
  }catch(e){return roadError_(e);}finally{lock.releaseLock();}
}
