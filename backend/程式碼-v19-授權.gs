// v19: 在 v18（只收 JSON）上加上客人授權檢查。
// 授權規則在檔尾，與 backend/授權檢查.gs 相同。私鑰不在這個檔案裡。
// v18: 儲存路單只收 JSON（pngBase64 可選；有送 PNG 時維持 JSON＋PNG，向下相容舊前端與 Windows 版）。
// 本檔已合併原本分開的 road_onedrive 檔；若 Apps Script 專案另有 road_onedrive 檔案，貼上後請刪除該檔以免重複。
const FOLDER_NAME = '百家樂語音';
const FOLDER_ID = '1sw7ANyAL-yaosq9nKOlMeMtv_R4c29It'; // 若想指定固定資料夾，填入 ID；留空就用名稱
const READ_STATUS_KEY = 'read_status_v1';

function doGet(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};
    if (params.action === 'roadStatus') return jsonOutput_(roadStatus_(params.receipt));
    if (params.fileId) {
      const file = DriveApp.getFileById(params.fileId);
      roadLegacyFile_(file);
      const base64 = Utilities.base64Encode(file.getBlob().getBytes());
      return textOutput_(base64);
    }

    if (params.action) {
      return jsonOutput_(handleAction_(params));
    }

    // 支援指定資料夾 ID 來列出檔案
    if (params.folderId) {
      return jsonOutput_({ success: true, files: listFiles_(params.folderId) });
    }

    return jsonOutput_({ success: true, files: listFiles_() });
  } catch (err) {
    return jsonOutput_({ success: false, error: err.message || String(err) });
  }
}

function doPost(e) {
  try {
    const body = e && e.postData && e.postData.contents || '{}';
    if (body.length > 9000000) throw new Error('上傳過大');
    const data = JSON.parse(body);
    if (data.action === 'roadSubmit') return jsonOutput_(roadReceive_(data));
    if (data.action === 'licenseCheck') return jsonOutput_(licenseHandle_(data));
    if (data.action) throw new Error('未知 action');
    const filename = data.filename;
    const base64Data = data.base64Data;

    if (!filename || !base64Data) {
      throw new Error('缺少 filename 或 base64Data');
    }

    const bytes = Utilities.base64Decode(base64Data);
    const blob = Utilities.newBlob(
      bytes,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename
    );

    const folder = data.folderId ? DriveApp.getFolderById(data.folderId) : getTargetFolder_();
    roadLegacyFolder_(folder);
    const file = folder.createFile(blob);
    return jsonOutput_({
      success: true,
      fileName: file.getName(),
      fileId: file.getId(),
      fileUrl: file.getUrl()
    });
  } catch (err) {
    return jsonOutput_({ success: false, error: err.message || String(err) });
  }
}

function handleAction_(params) {
  const action = params.action;
  const fileName = params.fileName ? String(params.fileName) : '';

  if (action === 'markRead') {
    setReadStatus_(fileName, true);
    return { success: true };
  }
  if (action === 'unmarkRead') {
    setReadStatus_(fileName, false);
    return { success: true };
  }
  if (action === 'listFolders') {
    return { success: true, folders: listSubFolders_() };
  }
  return { success: false, error: '未知 action' };
}

function listSubFolders_() {
  const root = getTargetFolder_();
  const folders = [];
  const it = root.getFolders();
  while (it.hasNext()) {
    const f = it.next();
    if (roadProtected_(f)) continue;
    folders.push({
      id: f.getId(),
      name: f.getName()
    });
  }
  folders.sort((a, b) => a.name.localeCompare(b.name));
  return folders;
}

function listFiles_(folderId) {
  const folder = folderId ? DriveApp.getFolderById(folderId) : getTargetFolder_();
  roadLegacyFolder_(folder);
  const readMap = getReadMap_();
  const files = [];

  const it = folder.getFiles();
  while (it.hasNext()) {
    const file = it.next();
    roadLegacyFile_(file);
    const name = file.getName();
    if (!name.toLowerCase().endsWith('.xlsx')) continue;

    const baseName = name.replace(/\.xlsx$/i, '');
    files.push({
      id: file.getId(),
      name: name,
      lastModified: file.getLastUpdated().getTime(),
      isRead: !!readMap[baseName]
    });
  }

  files.sort((a, b) => b.lastModified - a.lastModified);
  return files;
}

function getTargetFolder_() {
  if (FOLDER_ID) {
    return DriveApp.getFolderById(FOLDER_ID);
  }

  const folders = DriveApp.getFoldersByName(FOLDER_NAME);
  if (!folders.hasNext()) {
    throw new Error('找不到資料夾：' + FOLDER_NAME);
  }
  const folder = folders.next();
  return folder;
}

function getReadMap_() {
  const raw = PropertiesService.getScriptProperties().getProperty(READ_STATUS_KEY) || '{}';
  try {
    return JSON.parse(raw);
  } catch (err) {
    return {};
  }
}

function setReadStatus_(fileName, isRead) {
  if (!fileName) return;
  const map = getReadMap_();
  if (isRead) {
    map[fileName] = Date.now();
  } else {
    delete map[fileName];
  }
  PropertiesService.getScriptProperties().setProperty(READ_STATUS_KEY, JSON.stringify(map));
}

function jsonOutput_(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function textOutput_(text) {
  return ContentService.createTextOutput(String(text))
    .setMimeType(ContentService.MimeType.TEXT);
}

function testDriveAccess() {
  try {
    const folder = DriveApp.getFolderById('1sw7ANyAL-yaosq9nKOlMeMtv_R4c29It');
    console.log('✓ 資料夾名稱:', folder.getName());

    const blob = Utilities.newBlob('test', 'text/plain', '_test.txt');
    const file = folder.createFile(blob);
    console.log('✓ 建立成功，檔案 ID:', file.getId());

    file.setTrashed(true);
    console.log('✓ 測試檔已丟到垃圾桶');
  } catch (err) {
    console.error('✗ 失敗:', err.message);
    console.error(err.stack);
  }
}

function renameAllToSequential() {
  const folder = DriveApp.getFolderById('1sw7ANyAL-yaosq9nKOlMeMtv_R4c29It');
  const files = [];
  const it = folder.getFiles();
  while (it.hasNext()) {
    const f = it.next();
    if (f.getName().toLowerCase().endsWith('.xlsx')) files.push(f);
  }
  files.sort((a, b) => a.getDateCreated() - b.getDateCreated());
  console.log(`找到 ${files.length} 個 .xlsx 檔案`);

  // 第一階段：暫名（避免改名衝突）
  let stage1Ok = 0;
  files.forEach((f, i) => {
    try {
      f.setName(`__tmp_${i}__.xlsx`);
      stage1Ok++;
    } catch (err) {
      console.log(`✗ 暫名 #${i} 失敗：${err.message}`);
    }
    Utilities.sleep(300);
  });
  console.log(`暫名階段：${stage1Ok}/${files.length} 成功`);

  // 第二階段：正式編號 F01, F02, ...
  let stage2Ok = 0;
  files.forEach((f, i) => {
    try {
      const newName = `F${String(i + 1).padStart(2, '0')}.xlsx`;
      f.setName(newName);
      console.log(`✓ ${i + 1}/${files.length}: ${newName}`);
      stage2Ok++;
    } catch (err) {
      console.log(`✗ ${i + 1}/${files.length} 失敗：${err.message}`);
    }
    Utilities.sleep(300);
  });

  console.log(`✅ 完成：${stage2Ok}/${files.length} 個檔案成功重命名`);
}


// Anonymous, bounded, write-only receiver; uses the existing Drive authorization.
const ROAD_KEY = 'road_inbox_v1_';
const ROAD_LIMIT = {png:6291456,json:262144,pixels:24000000,dimension:12000,rounds:1000,minute:6,day:100,bytes:209715200};
function roadFail_(code){throw new Error('ROAD:'+code);}
function roadError_(e){const m=String(e&&e.message||'');return {success:false,error:m.startsWith('ROAD:')?m.slice(5):'storage_unavailable'};}
function roadKeys_(o,keys){if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).sort().join('|')!==keys.sort().join('|'))roadFail_('invalid_schema');}
function roadReceipt_(s){if(typeof s!=='string'||!/^[a-f0-9]{64}$/.test(s))roadFail_('invalid_receipt');return ROAD_KEY+'r_'+s;}
function roadStatus_(receipt){try{const raw=PropertiesService.getScriptProperties().getProperty(roadReceipt_(receipt));return {success:true,state:raw?JSON.parse(raw).state:'unknown',provider:raw?JSON.parse(raw).provider||'gdrive':undefined,receipt:receipt};}catch(e){return roadError_(e);}}
function roadHash_(s){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,s,Utilities.Charset.UTF_8).map(b=>('0'+(b&255).toString(16)).slice(-2)).join('');}
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
function roadU32_(b,i){return (b[i]*16777216+(b[i+1]<<16)+(b[i+2]<<8)+b[i+3])>>>0;}
function roadCrc_(b,a,z){let c=-1;for(let i=a;i<z;i++){c^=b[i];for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^-1)>>>0;}
// Streaming DEFLATE validation: bounded output, Adler32, and every PNG row filter.
function roadInflate_(src,expected,stride){
  if(src.length<6||(src[0]&15)!==8||(src[0]>>>4)>7||((src[0]<<8)+src[1])%31||(src[1]&32))roadFail_('invalid_png');
  let bit=16,count=0,s1=1,s2=0,last=0;const end=(src.length-4)*8,win=new Uint8Array(32768);
  const read=n=>{if(bit+n>end)roadFail_('invalid_png');let v=0;for(let i=0;i<n;i++,bit++)v|=((src[bit>>>3]>>>(bit&7))&1)<<i;return v;};
  const emit=v=>{if(count>=expected||(count%stride===0&&v>4))roadFail_('invalid_png');win[count++&32767]=v;s1=(s1+v)%65521;s2=(s2+s1)%65521;};
  const tree=ls=>{const cnt=new Array(16).fill(0),next=new Array(16).fill(0),map=Array.from({length:16},()=>Object.create(null));ls.forEach(n=>{if(n<0||n>15)roadFail_('invalid_png');if(n)cnt[n]++;});let code=0,left=1;for(let n=1;n<=15;n++){left=left*2-cnt[n];if(left<0)roadFail_('invalid_png');code=(code+cnt[n-1])<<1;next[n]=code;}ls.forEach((n,s)=>{if(n){let x=next[n]++,rev=0;for(let j=0;j<n;j++){rev=(rev<<1)|(x&1);x>>>=1;}map[n][rev]=s;}});return map;};
  const sym=t=>{let c=0;for(let n=1;n<=15;n++){c|=read(1)<<(n-1);if(t[n][c]!==undefined)return t[n][c];}roadFail_('invalid_png');};
  const lb=[3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258],le=[0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0],db=[1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577],de=[0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];
  do{last=read(1);const type=read(2);if(type===0){bit=(bit+7)&~7;const n=read(16),inv=read(16);if((n^65535)!==inv)roadFail_('invalid_png');for(let i=0;i<n;i++)emit(read(8));continue;}if(type===3)roadFail_('invalid_png');let lit,dist;
    if(type===1){lit=tree(Array.from({length:288},(_,i)=>i<144?8:i<256?9:i<280?7:8));dist=tree(new Array(32).fill(5));}
    else{const nl=read(5)+257,nd=read(5)+1,nc=read(4)+4,cl=new Array(19).fill(0),order=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];if(nl>286)roadFail_('invalid_png');for(let i=0;i<nc;i++)cl[order[i]]=read(3);const ct=tree(cl),ls=[];while(ls.length<nl+nd){const v=sym(ct);if(v<16)ls.push(v);else{let n,x=0;if(v===16){if(!ls.length)roadFail_('invalid_png');n=read(2)+3;x=ls[ls.length-1];}else n=v===17?read(3)+3:read(7)+11;if(ls.length+n>nl+nd)roadFail_('invalid_png');while(n--)ls.push(x);}}if(!ls[256])roadFail_('invalid_png');lit=tree(ls.slice(0,nl));dist=tree(ls.slice(nl));}
    while(true){const v=sym(lit);if(v<256){emit(v);continue;}if(v===256)break;if(v>285)roadFail_('invalid_png');const n=lb[v-257]+read(le[v-257]),d=sym(dist);if(d>29)roadFail_('invalid_png');const distance=db[d]+read(de[d]);if(distance>count||distance>32768)roadFail_('invalid_png');for(let i=0;i<n;i++)emit(win[(count-distance)&32767]);}
  }while(!last);
  if(count!==expected||((bit+7)>>>3)!==src.length-4||(((s2<<16)|s1)>>>0)!==roadU32_(src,src.length-4))roadFail_('invalid_png');
}
function roadPng_(s){
  if(typeof s!=='string'||s.length>Math.ceil(ROAD_LIMIT.png/3)*4||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(s))roadFail_('invalid_png');
  const raw=Utilities.base64Decode(s),b=Uint8Array.from(raw,x=>x&255);if(b.length>ROAD_LIMIT.png||b.length<57||[137,80,78,71,13,10,26,10].some((v,i)=>b[i]!==v))roadFail_('invalid_png');
  let p=8,w=0,h=0,ch=0,ended=false,idatEnded=false,size=0;const parts=[];
  while(p<b.length){if(p+12>b.length)roadFail_('invalid_png');const n=roadU32_(b,p),t=String.fromCharCode(...b.slice(p+4,p+8));if(n>b.length-p-12||!/^[A-Za-z]{4}$/.test(t)||roadCrc_(b,p+4,p+8+n)!==roadU32_(b,p+8+n))roadFail_('invalid_png');
    if(!w){if(t!=='IHDR'||n!==13)roadFail_('invalid_png');w=roadU32_(b,p+8);h=roadU32_(b,p+12);ch=b[p+17]===6?4:b[p+17]===2?3:0;if(!w||!h||w>ROAD_LIMIT.dimension||h>ROAD_LIMIT.dimension||w*h>ROAD_LIMIT.pixels||b[p+16]!==8||!ch||b[p+18]||b[p+19]||b[p+20])roadFail_('invalid_png');}
    else if(t==='IDAT'){if(idatEnded)roadFail_('invalid_png');parts.push(b.slice(p+8,p+8+n));size+=n;}
    else if(t==='IEND'){if(n||!size||p+12!==b.length)roadFail_('invalid_png');ended=true;}
    else{if(t==='IHDR'||t==='PLTE'||t.charCodeAt(0)<97)roadFail_('invalid_png');if(size)idatEnded=true;}p+=n+12;
  }
  if(!ended)roadFail_('invalid_png');const zip=new Uint8Array(size);let at=0;parts.forEach(x=>{zip.set(x,at);at+=x.length;});roadInflate_(zip,h*(w*ch+1),w*ch+1);return raw;
}
function roadProtected_(folder){
  const id=PropertiesService.getScriptProperties().getProperty(ROAD_KEY+'folder');if(!id)return false;const seen={},q=[folder];let n=0;
  while(q.length){const f=q.shift(),key=f.getId();if(key===id)return true;if(seen[key])continue;seen[key]=true;if(++n>50)throw new Error('無法驗證資料夾');const parents=f.getParents();while(parents.hasNext())q.push(parents.next());}return false;
}
function roadLegacyFolder_(folder){if(roadProtected_(folder))throw new Error('不允許存取此資料夾');}
function roadLegacyFile_(file){const parents=file.getParents();while(parents.hasNext())roadLegacyFolder_(parents.next());}
function roadRoot_(){const p=PropertiesService.getScriptProperties(),key=ROAD_KEY+'folder',id=p.getProperty(key);if(id){const existing=DriveApp.getFolderById(id);if(existing.getSharingAccess()!==DriveApp.Access.PRIVATE)roadFail_("folder_not_private");return existing;}const f=DriveApp.createFolder('路單收件');if(f.getSharingAccess()!==DriveApp.Access.PRIVATE)roadFail_('folder_not_private');p.setProperty(key,f.getId());return f;}
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

// ===== road_onedrive（OneDrive 收件，原 road_onedrive.gs）=====
// Owner credentials live only in Script Properties, never in client responses.
function roadOneDriveOwnerCheck() {
  const config = roadOneDriveConfig_();
  roadOneDrivePrivate_(roadOneDriveToken_(config), config);
  console.log('OneDrive owner authorization and private inbox verified.');
}

function roadOneDriveConfig_() {
  const raw = PropertiesService.getScriptProperties().getProperty(ROAD_KEY + 'onedrive_config');
  if (!raw) roadFail_('onedrive_not_configured');
  const config = JSON.parse(raw);
  if (!config.clientId || !config.clientSecret || !config.refreshToken || !config.rootId) roadFail_('onedrive_not_configured');
  return config;
}

function roadOneDriveToken_(config) {
  // Broader access is opt-in only after owner consent; legacy app-folder configs remain valid.
  const requestedScope=config.scope || 'Files.ReadWrite.AppFolder';
  if (!['Files.ReadWrite.AppFolder','Files.ReadWrite'].includes(requestedScope)) roadFail_('onedrive_not_configured');
  const response = UrlFetchApp.fetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/token', {
    method: 'post', muteHttpExceptions: true, followRedirects: false,
    payload: {client_id: config.clientId, client_secret: config.clientSecret,
      refresh_token: config.refreshToken, grant_type: 'refresh_token',
      scope: requestedScope + ' offline_access'}
  });
  if (response.getResponseCode() !== 200) roadFail_('onedrive_authorization_required');
  const token = JSON.parse(response.getContentText());
  const scopes = String(token.scope || '').toLowerCase().split(' ');
  const requiredScope=requestedScope.toLowerCase();
  const allowedFileScopes=requiredScope==='files.readwrite'?['files.readwrite','files.readwrite.appfolder']:['files.readwrite.appfolder'];
  if (!token.access_token || !scopes.includes(requiredScope) ||
      scopes.some(scope => /^files\./.test(scope) && !allowedFileScopes.includes(scope))) roadFail_('onedrive_authorization_required');
  if (token.refresh_token) {
    config.refreshToken = token.refresh_token;
    PropertiesService.getScriptProperties().setProperty(ROAD_KEY + 'onedrive_config', JSON.stringify(config));
  }
  return token.access_token;
}

function roadOneDriveRequest_(token, path, method, payload, contentType) {
  const options = {method: method || 'get', muteHttpExceptions: true,
    followRedirects: false, headers: {Authorization: 'Bearer ' + token}};
  if (payload !== undefined) { options.payload = payload; options.contentType = contentType || 'application/json'; }
  const response = UrlFetchApp.fetch('https://graph.microsoft.com/v1.0/me/drive' + path, options);
  const code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    // Do not log tokens, file content, signed download URLs, or Graph responses.
    console.error('OneDrive receiver HTTP ' + code);
    let reason = 'unknown';
    try { const parsed = JSON.parse(response.getContentText()); const value = parsed.error && parsed.error.code;
      if (typeof value === 'string' && /^[A-Za-z0-9_.-]{1,80}$/.test(value)) reason = value;
    } catch (_) {}
    const error = new Error('ROAD:' + (code === 401 ? 'onedrive_authorization_required' : code === 429 ? 'rate_limit' : 'storage_unavailable'));
    error.roadDiagnostic = {http: code, reason: reason, stage: method === 'put' ? 'upload' : method === 'post' ? 'create_folder' : method === 'delete' ? 'cleanup' : 'permissions'};
    throw error;
  }
  const text = response.getContentText();
  return text ? JSON.parse(text) : null;
}

function roadOneDrivePrivate_(token, config) {
  const result = roadOneDriveRequest_(token, '/items/' + encodeURIComponent(config.rootId) + '/permissions');
  if (!Array.isArray(result.value) || !result.value.length) roadFail_('folder_not_private');
  for (const permission of result.value) {
    if (permission.invitation || permission.link && permission.link.scope) roadFail_('folder_not_private');
    if (permission.roles && permission.roles.includes('owner')) continue;
    const user = permission.grantedTo && permission.grantedTo.user;
    const app = user && user.id === '00000000-0000-0000-0000-000000000000' &&
      String(user.displayName || '').toLowerCase().startsWith('i:0i.t|ms.sp.ext|' + config.clientId.toLowerCase() + '@');
    if (!app || !permission.roles || permission.roles.join(',') !== 'write') roadFail_('folder_not_private');
  }
}

// A folder-create 404 has occurred while this private parent still exists.
// Keep one name across attempts, reconcile an unknown outcome, and fail closed
// if the parent is missing or the service keeps failing. Never use "rename".
function roadOneDriveCreateFolder_(token, config, receipt) {
  const parentPath='/items/'+encodeURIComponent(config.rootId);
  const name=new Date().toISOString().replace(/[:.]/g,'-')+'_'+receipt;
  const payload=JSON.stringify({name:name,folder:{},'@microsoft.graph.conflictBehavior':'fail'});
  for(let attempt=0;attempt<3;attempt++) {
    try {return roadOneDriveRequest_(token,parentPath+'/children','post',payload);}
    catch(error) {
      const d=error.roadDiagnostic;
      if(!d || d.http!==404 || d.reason!=='itemNotFound') throw error;
      d.attempts=attempt+1;
      const parent=roadOneDriveRequest_(token,parentPath);
      if(!parent || parent.id!==config.rootId || !parent.folder) throw error;
      let existing;
      try {existing=roadOneDriveRequest_(token,parentPath+':/'+encodeURIComponent(name));}
      catch(lookupError) {
        const ld=lookupError.roadDiagnostic;
        if(!ld || ld.http!==404 || ld.reason!=='itemNotFound') throw lookupError;
      }
      if(existing) {
        if(!existing.id || existing.name!==name || !existing.folder || existing.folder.childCount!==0 ||
           !existing.parentReference || existing.parentReference.id!==config.rootId) throw error;
        console.log('OneDrive folder creation reconciled after 404.');return existing;
      }
      if(attempt===2) throw error;
      console.log('Retrying OneDrive folder creation after verified-parent 404.');
      Utilities.sleep(attempt===0?400:1200);
    }
  }
}

function roadOneDrivePair_(data, json, image) {
  const config = roadOneDriveConfig_(), token = roadOneDriveToken_(config);
  roadOneDrivePrivate_(token, config);
  let folder;
  try {
    folder = roadOneDriveCreateFolder_(token, config, data.receipt);
    if (!folder || !folder.id) roadFail_('storage_unavailable');
    let name = data.roadmap.name.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/[. ]+$/, '').slice(0, 100) || '路單';
    if (/^(CON|PRN|AUX|NUL|COM\d|LPT\d)(\.|$)/i.test(name) || name.startsWith('~')) name = '_' + name;
    // v18: PNG is optional. Without it only the .json is stored (one file = complete).
    const files = [{name: name + '.json', bytes: Utilities.newBlob(json).getBytes(), type: 'application/json'}];
    if (image) files.push({name: name + '.png', bytes: image, type: 'image/png'});
    for (const file of files) {
      const stored = roadOneDriveRequest_(token, '/items/' + encodeURIComponent(folder.id) + ':/' + encodeURIComponent(file.name) + ':/content',
        'put', Utilities.newBlob(file.bytes, file.type, file.name), file.type);
      if (!stored || !stored.id || stored.size !== file.bytes.length || !stored.file) roadFail_('storage_unavailable');
      const sha1 = stored.file.hashes && stored.file.hashes.sha1Hash;
      if (sha1) {
        const expected = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_1, file.bytes).map(b => ('0' + (b & 255).toString(16)).slice(-2)).join('');
        if (sha1.toLowerCase() !== expected) roadFail_('storage_unavailable');
      }
    }
    // A complete receipt is written by the caller only after every file in the list validates.
  } catch (error) {
    if (folder && folder.id) {
      try { roadOneDriveRequest_(token, '/items/' + encodeURIComponent(folder.id), 'delete'); }
      catch (_) { console.error('OneDrive partial submission retained for owner inspection'); }
    }
    throw error;
  }
}

// 客人付費授權檢查。可單獨加進 Apps Script，或併在「程式碼-v19-授權.gs」裡。
// 私鑰只放 Script Properties 的 LICENSE_SIGNING_KEY，不要寫進這個檔案。
// 試算表 ID 放 LICENSE_SHEET_ID。欄位順序見更新步驟-v19-授權.md。

// ===== license-pure-start =====
// 下面這段不碰試算表，電腦上的測試會直接跑這一段。
function licenseNormalizeCode_(code) {
  return String(code || '').trim().toUpperCase().replace(/\s+/g, '');
}

function licenseCodeOk_(code) {
  var normalized = licenseNormalizeCode_(code);
  return normalized.length >= 4 && normalized.length <= 64 && /^[A-Z0-9-]+$/.test(normalized);
}

function licenseMachineOk_(machineId) {
  return typeof machineId === 'string' && /^[A-Za-z0-9-]{8,80}$/.test(machineId);
}

function licenseNormalizeStatus_(status) {
  var text = String(status || '').replace(/\s+/g, '');
  if (text === '啟用' || text.toLowerCase() === 'active') return 'active';
  if (text === '停用' || text.toLowerCase() === 'disabled') return 'disabled';
  return 'unknown';
}

function licenseClean_(value, max) {
  return String(value || '').replace(/[\r\n]/g, ' ').slice(0, max);
}

function licenseDecide_(row, machineId, today) {
  if (!row) return { result: 'not_found' };
  if (row.status !== 'active') return { result: 'disabled' };
  if (!row.expires || !/^\d{4}-\d{2}-\d{2}$/.test(row.expires) || row.expires < today) return { result: 'expired' };
  if (!row.machine) return { result: 'bind' };
  if (row.machine !== machineId) return { result: 'other_machine' };
  return { result: 'ok' };
}

function licenseApply_(row, machineId, today, nowText) {
  var decision = licenseDecide_(row, machineId, today);
  if (!row) return { decision: decision, row: null, changed: false };
  var next = {
    name: row.name,
    code: row.code,
    status: row.status,
    expires: row.expires,
    machine: row.machine,
    activated: row.activated,
    lastSeen: row.lastSeen,
    note: row.note
  };
  var changed = false;
  if (decision.result === 'bind') {
    next.machine = machineId;
    if (!next.activated) next.activated = today;
    next.lastSeen = nowText;
    decision = { result: 'ok' };
    changed = true;
  } else if (decision.result === 'ok' || decision.result === 'disabled' || decision.result === 'expired' || decision.result === 'other_machine') {
    if (next.lastSeen !== nowText) {
      next.lastSeen = nowText;
      changed = true;
    }
  }
  return { decision: decision, row: next, changed: changed };
}

function licenseCanonical_(fields) {
  return [
    'jiujiu-license-v1',
    licenseClean_(fields.result, 40),
    licenseClean_(fields.machineId, 80),
    licenseClean_(fields.expires, 10),
    licenseClean_(fields.name, 40),
    licenseClean_(fields.serverTime, 40),
    licenseClean_(fields.codeHash, 64)
  ].join('\n');
}
// ===== license-pure-end =====

function licenseHash_(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text), Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); })
    .join('');
}

function licenseCellDate_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, 'Asia/Taipei', 'yyyy-MM-dd');
  }
  var text = String(value || '').trim();
  var match = text.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if (!match) return '';
  return match[1] + '-' + ('0' + match[2]).slice(-2) + '-' + ('0' + match[3]).slice(-2);
}

function licenseHeaderOk_(head) {
  var need = ['客人名稱', '授權碼', '狀態', '到期日', '綁定的電腦識別碼', '啟用日期', '最後連線時間', '備註'];
  if (!head) return false;
  for (var i = 0; i < need.length; i++) {
    if (String(head[i] || '').trim() !== need[i]) return false;
  }
  return true;
}

function licenseFindRow_(values, code) {
  var want = licenseNormalizeCode_(code);
  for (var row = 1; row < values.length; row++) {
    if (licenseNormalizeCode_(values[row][1]) === want) return row;
  }
  return -1;
}

function licenseRowFromValues_(cells) {
  return {
    name: licenseClean_(cells[0], 40),
    code: licenseNormalizeCode_(cells[1]),
    status: licenseNormalizeStatus_(cells[2]),
    expires: licenseCellDate_(cells[3]),
    machine: String(cells[4] || '').trim(),
    activated: licenseCellDate_(cells[5]),
    lastSeen: String(cells[6] || '').trim(),
    note: String(cells[7] || '').trim()
  };
}

function licenseNowTaipei_() {
  var now = new Date();
  return {
    today: Utilities.formatDate(now, 'Asia/Taipei', 'yyyy-MM-dd'),
    clock: Utilities.formatDate(now, 'Asia/Taipei', "yyyy-MM-dd'T'HH:mm:ss") + '+08:00'
  };
}

function licensePrivateKey_() {
  var key = PropertiesService.getScriptProperties().getProperty('LICENSE_SIGNING_KEY') || '';
  key = String(key).replace(/\\n/g, '\n').trim();
  if (key.indexOf('BEGIN PRIVATE KEY') === -1) return '';
  return key;
}

function licenseReply_(result, extras) {
  var payload = licenseCanonical_({
    result: result,
    machineId: extras.machineId || '',
    expires: extras.expires || '',
    name: extras.name || '',
    serverTime: extras.serverTime || '',
    codeHash: extras.codeHash || ''
  });
  var key = licensePrivateKey_();
  if (!key) return { success: false, error: 'license_unconfigured' };
  var bytes = Utilities.computeRsaSha256Signature(payload, key, Utilities.Charset.UTF_8);
  return { success: true, payload: payload, signature: Utilities.base64Encode(bytes) };
}

function licenseWriteBack_(sheet, rowNumber, row) {
  sheet.getRange(rowNumber, 5, 1, 3).setValues([[row.machine, row.activated, row.lastSeen]]);
}

// 由 doPost 在 action 為 licenseCheck 時呼叫。回覆一定要有簽章，私鑰不在程式碼裡。
function licenseHandle_(data) {
  var rawMachine = String(data && data.machineId || '').trim();
  var code = licenseNormalizeCode_(data && data.code);
  var clock = licenseNowTaipei_();
  var machineId = licenseMachineOk_(rawMachine) ? rawMachine : '';
  var codeHash = licenseCodeOk_(code) ? licenseHash_(code) : '';
  var base = { machineId: machineId, codeHash: codeHash, serverTime: clock.clock, expires: '', name: '' };
  if (!licenseCodeOk_(code) || !machineId) return licenseReply_('bad_request', base);
  if (!licensePrivateKey_()) return { success: false, error: 'license_unconfigured' };
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    var sheetId = PropertiesService.getScriptProperties().getProperty('LICENSE_SHEET_ID');
    if (!sheetId) return licenseReply_('unavailable', base);
    var sheet = SpreadsheetApp.openById(sheetId).getSheets()[0];
    var values = sheet.getDataRange().getValues();
    if (!values.length || !licenseHeaderOk_(values[0])) return licenseReply_('unavailable', base);
    var index = licenseFindRow_(values, code);
    if (index < 0) return licenseReply_('not_found', base);
    var row = licenseRowFromValues_(values[index]);
    var applied = licenseApply_(row, machineId, clock.today, clock.clock);
    if (applied.changed) licenseWriteBack_(sheet, index + 1, applied.row);
    return licenseReply_(applied.decision.result, {
      machineId: machineId,
      codeHash: codeHash,
      serverTime: clock.clock,
      expires: applied.row.expires || '',
      name: applied.row.name || ''
    });
  } catch (err) {
    try { return licenseReply_('unavailable', base); }
    catch (err2) { return { success: false, error: 'license_unavailable' }; }
  } finally {
    try { lock.releaseLock(); } catch (err3) {}
  }
}
