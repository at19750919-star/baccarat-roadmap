(function(root){
  'use strict';
  const ENDPOINT='https://script.google.com/macros/s/AKfycbypt3_PnEL5TgdDPaBwg1M5bWAjQMR9dD5Jslicn3eZCtuNSTtqO35RafhQpuX-l9_m/exec';
  let busy=false,urls=[],pending=null;
  const el=id=>document.getElementById(id);
  const safeName=name=>(String(name).replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').replace(/[. ]+$/,'').slice(0,100)||'路單');
  function status(text){el('backupNotice').hidden=false;el('backupStatus').textContent=text;}
  function buttons(){el('saveBtn').disabled=busy;el('backupRetryBtn').disabled=busy;}
  function links(pack){
    urls.forEach(URL.revokeObjectURL);urls=[];
    for(const [id,blob,ext]of [['backupJsonLink',pack.json,'json'],['backupPngLink',pack.png,'png']]){
      const a=el(id);a.hidden=!blob;if(blob){a.href=URL.createObjectURL(blob);urls.push(a.href);a.download=pack.name+'.'+ext;}
    }
  }
  async function png(entry){
    if(typeof html2canvas!=='function')throw Error('截圖套件未載入，JSON仍可下載；請恢復網路後重試儲存。');
    // Capture the complete board layout, then redraw its roads from the saved snapshot.
    const rounds=entry.rounds,big=buildBigRoad(rounds),source=document.querySelector('.app');
    const host=document.createElement('div'),view=source.cloneNode(true),boards=[];
    host.className='road-export-host';host.style.cssText='position:absolute;left:0;top:0;z-index:-2147483647;pointer-events:none';
    host.setAttribute('aria-hidden','true');host.inert=true;view.classList.add('road-export-frame');host.append(view);
    const inputs=source.querySelectorAll('input');view.querySelectorAll('input').forEach((n,i)=>{n.value=inputs[i].value;n.setAttribute('value',n.value);});
    view.querySelectorAll('[id]').forEach(n=>{n.dataset.exportId=n.id;n.removeAttribute('id');});
    const target=id=>view.querySelector('[data-export-id="'+id+'"]');
    const board=(id,title,cols,size)=>{
      const grid=target(id);grid.style.cssText=`grid-template-columns:repeat(${cols},${size}px);grid-template-rows:repeat(6,${size}px);width:${cols*size}px;height:${6*size}px;flex-shrink:0`;
      boards.push({title,cols,size});return grid;
    };
    const bigCols=Math.max(39,big.cols);renderBigRoad(big,{target:board('bigRoad','大路',bigCols,48),rounds,cols:bigCols});
    let derivedCols=29;
    for(const [id,label,offset,shape]of [['bigEye','大眼仔',1,'hollow'],['smallRoad','小路',2,'solid'],['cockroachRoad','蟑螂路',3,'slash']]){
      const marks=buildDerivedRoad(big.grid,offset,big.cols,big.rows),laid=layoutDerivedMarks(marks,6),cols=Math.max(29,laid.cols);
      derivedCols=Math.max(derivedCols,cols);renderDerived('',marks,shape,{target:board(id,label,cols,32),cols});
    }
    const beadCols=Math.max(24,Math.ceil(rounds.length/6));renderBead(rounds,board('beadBoard','珠子路',beadCols,40),beadCols);
    for(const [id,count]of [['totalCount',rounds.length],['cntB',rounds.filter(r=>r.r==='B').length],['cntP',rounds.filter(r=>r.r==='P').length],['cntT',rounds.filter(r=>r.r==='T').length],['cntBP',rounds.filter(r=>r.bp).length],['cntPP',rounds.filter(r=>r.pp).length],['cntL6',rounds.filter(r=>r.l6).length]])target(id).textContent=count;
    // Grow horizontally for long histories without clipping any of the five roads.
    const width=Math.max(1920,bigCols*48+24,2*(derivedCols*32+18)+28,beadCols*40+960);
    view.style.cssText=`position:relative;left:0;top:0;transform:none;width:${width}px;height:1080px`;
    view.querySelector('.mid-row').style.gridTemplateColumns='minmax(0,1fr) minmax(0,1fr)';
    view.querySelectorAll('.mid-col').forEach(n=>n.style.gridTemplateRows='minmax(0,1fr) minmax(0,1fr)');
    view.querySelector('.bottom-row').style.gridTemplateColumns='300px minmax(0,1fr) 162px 436px';
    document.body.append(host);
    try{
      await document.fonts?.ready;
      const w=view.offsetWidth,h=view.offsetHeight,scale=Math.min(1.5,11998/w,11998/h,Math.sqrt(23900000/(w*h)));
      if(scale<.3)throw Error('路單過長，圖片超出安全尺寸；JSON已保留，請分段儲存。');
      const canvas=await html2canvas(view,{backgroundColor:getComputedStyle(view).backgroundColor,scale,useCORS:true,logging:false,width:w,height:h,windowWidth:Math.max(w,1920),windowHeight:Math.max(h,1080),onclone:doc=>{
        doc.body.style.overflow='visible';doc.body.style.height='auto';
      }});
      const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('PNG產生失敗，未傳送雲端備份。')),'image/png'));
      return {blob,width:canvas.width,height:canvas.height,boards:boards.map(({title,cols})=>({title,cols}))};
    }finally{host.remove();}
  }

  const messages={rate_limit:'收件暫時繁忙，請稍後再試。',daily_size_limit:'今天收件容量已滿，請保留下載檔案。',busy:'收件服務忙碌，請稍後重試。',invalid_png:'PNG 格式或尺寸不符合收件限制。',invalid_rounds:'路單局數超出收件限制（最多1000局）。',invalid_schema:'路單格式不符合收件要求。',invalid_counts:'路單統計與內容不一致。',json_too_large:'JSON 超出收件大小限制。',receipt_conflict:'提交識別碼衝突，未覆寫既有備份。',submission_incomplete:'上次收件未完成，請保留下載檔案。',storage_unavailable:'雲端收件未完成，請稍後再試。'};
  Object.assign(messages,{onedrive_not_configured:'OneDrive 收件尚未啟用，請通知業主。',onedrive_authorization_required:'OneDrive 授權已失效，請通知業主重新授權。',folder_not_private:'收件資料夾的私人設定已改變，為保護資料已停止上傳；請通知業主。'});
  function receipt(){if(!root.crypto?.getRandomValues)throw Error('此瀏覽器無法建立安全收件碼，請保留下載檔案。');return Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');}
  async function request(url,options={},ms=40000){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),ms);
    try{const response=await fetch(url,{...options,signal:controller.signal,credentials:'omit',redirect:'follow'});if(!response.ok)throw Error('HTTP '+response.status);const data=await response.json();if(!data||typeof data.success!=='boolean')throw Error('invalid response');return data;}finally{clearTimeout(timer);}
  }
  async function body(pack){
    if(pack.payload)return pack.payload;
    if(pack.png.size>6291456||pack.json.size>262144)throw Error('備份檔案過大（PNG限6MB／JSON限256KB），請使用下載檔案。');
    const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=()=>reject(Error('PNG讀取失敗'));r.readAsDataURL(pack.png);});
    pack.payload=JSON.stringify({action:'roadSubmit',receipt:pack.receipt,roadmap:pack.snapshot,pngBase64:data});return pack.payload;
  }
  async function send(pack){
    const payload=await body(pack);let response;
    try{response=await request(ENDPOINT,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:payload});}
    catch(_){
      // A timeout can occur after storage. Query the unguessable receipt rather than
      // reporting success or automatically sending a second submission.
      try{const check=await request(ENDPOINT+'?action=roadStatus&receipt='+pack.receipt,{},12000);if(check.success&&check.receipt===pack.receipt&&check.state==='complete')return check;if(check.state==='failed')throw Error('雲端收件失敗；請保留 JSON／PNG 下載檔案。');}catch(_){}
      throw Error('尚無法確認雲端是否收齊；本機檔案已保留，可按重試查核同一筆提交。');
    }
    if(response.receipt===pack.receipt&&response.success&&response.state==='complete')return response;
    throw Error(messages[response.error]||'雲端尚未確認兩個檔案均已儲存，請保留下載檔案。');
  }
  async function upload(pack,note){
    try{const received=await send(pack);pending=null;el('backupRetryBtn').hidden=true;const provider=received.provider==='onedrive'?'OneDrive':'Google Drive';status(note+' '+provider+' 已收齊 JSON＋完整路單 PNG。');return {ok:true,pack};}
    catch(error){pending={pack,note};el('backupRetryBtn').hidden=false;status(note+' '+error.message+' 可下載 JSON／PNG。');return {ok:false,error:error.message,pack};}
  }
  async function save(entry,{listSaved=true}={}){
    if(busy)return {ok:false,error:'saving'};busy=true;buttons();el('backupRetryBtn').hidden=true;
    const snapshot=JSON.parse(JSON.stringify(entry)),pack={snapshot,name:safeName(snapshot.name),json:new Blob([JSON.stringify(snapshot,null,2)],{type:'application/json;charset=utf-8'})},note=listSaved?'本機清單已儲存。':'本機清單寫入失敗。';pending=null;links(pack);status(note+' 正在產生完整路單 PNG…');
    try{pack.receipt=receipt();const image=await png(snapshot);pack.png=image.blob;pack.image=image;links(pack);status(note+' 正在送出雲端備份…');return await upload(pack,note);}
    catch(error){status(note+' '+error.message+' JSON仍可下載；未確認雲端備份。');return {ok:false,error:error.message,pack};}
    finally{busy=false;buttons();}
  }
  async function retry(){if(busy||!pending)return;busy=true;buttons();const item=pending;status(item.note+' 正在重試同一筆雲端備份…');try{return await upload(item.pack,item.note);}finally{busy=false;buttons();}}
  root.RoadBackup={save,png,send,retry,get busy(){return busy;}};
  document.addEventListener('DOMContentLoaded',()=>{el('backupCloseBtn').addEventListener('click',()=>{el('backupNotice').hidden=true;});el('backupRetryBtn').addEventListener('click',retry);});
})(window);
