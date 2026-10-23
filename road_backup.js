// No cloud API or fixed path: only a directory explicitly selected by the user.
(function(root){
  'use strict';
  let directory=null,busy=false,choosing=false,urls=[];
  const el=id=>document.getElementById(id),status=text=>{el('backupStatus').textContent=text;};
  const store=(mode,value)=>new Promise((resolve,reject)=>{
    const open=indexedDB.open('baccarat-road-backup',1);
    open.onupgradeneeded=()=>open.result.createObjectStore('handles');
    open.onerror=()=>reject(open.error);open.onsuccess=()=>{
      const db=open.result;try{const tx=db.transaction('handles',mode),s=tx.objectStore('handles');
      const request=mode==='readonly'?s.get('directory'):s.put(value,'directory');let result;
      request.onsuccess=()=>result=request.result;tx.oncomplete=()=>{db.close();resolve(result);};
      tx.onerror=()=>{db.close();reject(tx.error);};tx.onabort=()=>{db.close();reject(tx.error);};
      }catch(error){db.close();reject(error);}
    };
  });
  const safeName=name=>(String(name).replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').replace(/[. ]+$/,'').slice(0,100)||'路單').replace(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?=\.|$)/i,'_$1');
  function links(pack){
    urls.forEach(URL.revokeObjectURL);urls=[];
    for(const [id,blob,ext]of [['backupJsonLink',pack.json,'json'],['backupPngLink',pack.png,'png']]){
      const a=el(id);a.hidden=!blob;if(blob){a.href=URL.createObjectURL(blob);urls.push(a.href);a.download=pack.name+'.'+ext;}
    }
  }
  async function png(entry){
    if(typeof html2canvas!=='function')throw Error('截圖套件未載入，JSON仍可下載；請恢復網路後重試儲存。');
    const rounds=entry.rounds,big=buildBigRoad(rounds),host=document.createElement('div'),view=document.createElement('section');
    host.style.cssText='position:absolute;left:0;top:0;z-index:-2147483647;pointer-events:none';host.setAttribute('aria-hidden','true');
    view.className='road-export';host.append(view);
    const heading=document.createElement('h2');heading.textContent=entry.name;view.append(heading);
    const info=document.createElement('p');info.textContent=`${entry.createdAt}　共 ${rounds.length} 局｜莊 ${entry.counts.banker}／閒 ${entry.counts.player}／和 ${entry.counts.tie}`;view.append(info);
    const boards=[];
    const board=(title,cls,cols,size)=>{
      const h=document.createElement('h3');h.textContent=title;view.append(h);
      const grid=document.createElement('div');grid.className='grid-board '+cls;grid.dataset.label=title;
      grid.style.cssText=`grid-template-columns:repeat(${cols},${size}px);grid-template-rows:repeat(6,${size}px);width:${cols*size}px;height:${6*size}px`;
      grid.style.setProperty('--cell-big',size+'px');grid.style.setProperty('--cell-bead',size+'px');grid.style.setProperty('--cell-derived',size+'px');
      view.append(grid);boards.push({title,cols,size,grid});return grid;
    };
    renderBigRoad(big,{target:board('大路','big-road',Math.max(big.cols,1),48),rounds,cols:Math.max(big.cols,1)});
    for(const [label,offset,shape]of [['大眼仔',1,'hollow'],['小路',2,'solid'],['蟑螂路',3,'slash']]){
      const marks=buildDerivedRoad(big.grid,offset,big.cols,big.rows),laid=layoutDerivedMarks(marks,6),cols=Math.max(laid.cols,1);
      renderDerived('',marks,shape,{target:board(label,'derived-road',cols,32),cols});
    }
    const beadCols=Math.max(1,Math.ceil(rounds.length/6));renderBead(rounds,board('珠盤路','bead-board',beadCols,40),beadCols);
    const width=Math.max(640,...boards.map(b=>b.cols*b.size));view.style.width=width+'px';document.body.append(host);
    try{
      await document.fonts?.ready;
      const w=view.offsetWidth,h=view.offsetHeight,scale=Math.min(1.5,12000/w,Math.sqrt(24000000/(w*h)));
      if(scale<.3)throw Error('路單過長，圖片超出安全尺寸；JSON已保留，請分段儲存。');
      const canvas=await html2canvas(view,{backgroundColor:'#7a0b0b',scale,useCORS:true,logging:false,width:w,height:h,windowWidth:Math.max(w,1920),windowHeight:Math.max(h,1080),onclone:doc=>{
        doc.body.style.overflow='visible';doc.body.style.height='auto';
      }});
      const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('PNG產生失敗，未寫入備份資料夾。')),'image/png'));
      return {blob,width:canvas.width,height:canvas.height,boards:boards.map(({title,cols})=>({title,cols}))};
    }finally{host.remove();}
  }
  async function writePair(dir,pack){
    const files=[];
    try{
      if(await dir.queryPermission({mode:'readwrite'})!=='granted')throw Error('資料夾權限失效，請按「選擇備份資料夾」重新授權。');
      const exists=async name=>{try{await dir.getFileHandle(name);return true;}catch(e){if(e.name==='NotFoundError')return false;throw e;}};
      let base;for(let i=0;i<1000;i++){const candidate=pack.name+(i?`-${i+1}`:'');if(!await exists(candidate+'.json')&&!await exists(candidate+'.png')){base=candidate;break;}}
      if(!base)throw Error('同名備份過多，請修改路單名稱。');
      for(const [ext,blob]of [['json',pack.json],['png',pack.png]]){
        const item={name:base+'.'+ext,status:'writing'};files.push(item);
        const handle=await dir.getFileHandle(item.name,{create:true}),writer=await handle.createWritable();
        try{await writer.write(blob);await writer.close();item.status='saved';}catch(e){try{await writer.abort();}catch(_){}throw e;}
      }
      return {ok:true,files,cloudConfirmed:false};
    }catch(error){if(files.at(-1)?.status==='writing')files.at(-1).status='failed';return {ok:false,files,error:error.message,cloudConfirmed:false};}
  }
  async function choose(){
    if(busy||choosing)return;
    if(!root.showDirectoryPicker){status('此瀏覽器不能直接選資料夾；儲存後請使用 JSON／PNG 下載連結，再放入同步資料夾。');return;}
    choosing=true;el('saveBtn').disabled=true;el('backupFolderBtn').disabled=true;
    try{
      // Invoke the picker directly in this click; no preceding asynchronous work.
      const next=await root.showDirectoryPicker({id:'baccarat-road-backup',mode:'readwrite'});directory=next;
      try{await store('readwrite',next);status(`已選擇：${next.name}。儲存時會另寫 JSON 與 PNG；雲端同步由桌面程式處理。`);}
      catch(_){status(`已選擇：${next.name}；無法記住資料夾，下次開啟請重選。`);}
    }catch(error){if(error.name==='AbortError')status(directory?`已取消選擇，保留：${directory.name}`:'已取消選擇；本機儲存仍可使用。');else status('無法選擇資料夾：'+error.message);}
    finally{choosing=false;el('saveBtn').disabled=false;el('backupFolderBtn').disabled=false;}
  }
  async function save(entry,{listSaved=true}={}){
    if(busy||choosing)return {ok:false,error:'saving'};busy=true;el('saveBtn').disabled=true;el('backupFolderBtn').disabled=true;
    const snapshot=JSON.parse(JSON.stringify(entry)),pack={name:safeName(snapshot.name),json:new Blob([JSON.stringify(snapshot,null,2)],{type:'application/json;charset=utf-8'})};
    const target=directory,note=listSaved?'本機清單已儲存。':'本機清單寫入失敗。';links(pack);status(note+' 正在產生完整路單 PNG…');
    try{
      const image=await png(snapshot);pack.png=image.blob;pack.image=image;links(pack);
      if(!target){status(note+' 已送出 JSON 下載；請下載完整 PNG。若要同步備份，先選擇 Google Drive（或 OneDrive）資料夾後再儲存。');return {ok:false,reason:'no-directory',pack};}
      const result=await writePair(target,pack);
      if(result.ok)status(note+` 已寫入同步資料夾「${target.name}」：${result.files.map(f=>f.name).join('、')}；未確認雲端同步完成。`);
      else status(note+' 備份未完成：'+result.error+(result.files.length?'（可能有部分檔案，未回報成功）':'')+'；可使用 JSON／PNG 下載連結。');
      return {...result,pack};
    }catch(error){status(note+' 備份未完成：'+error.message);return {ok:false,error:error.message,pack};}
    finally{busy=false;el('saveBtn').disabled=false;el('backupFolderBtn').disabled=false;}
  }
  root.RoadBackup={save,writePair,png,choose,get busy(){return busy||choosing;}};
  document.addEventListener('DOMContentLoaded',async()=>{
    if(root.ResizeObserver)new ResizeObserver(()=>{if(typeof fitApp==='function')fitApp();}).observe(document.querySelector('.backup-tools'));
    el('backupFolderBtn').addEventListener('click',choose);
    if(!root.showDirectoryPicker)el('backupFolderBtn').textContent='備份下載說明';
    try{const saved=await store('readonly');if(saved){directory=saved;status(await saved.queryPermission({mode:'readwrite'})==='granted'?`備份資料夾：${saved.name}`:'備份資料夾需要重新授權，請按「選擇備份資料夾」。');}}catch(_){}
  });
})(window);
