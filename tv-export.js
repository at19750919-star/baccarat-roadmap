(function(root){
  'use strict';
  function compatibleGradients(view){
    // Browsers resolve color-mix to color(srgb ...); html2canvas 1.4 needs rgba.
    const pixel=document.createElement('canvas');pixel.width=pixel.height=1;
    const context=pixel.getContext('2d',{willReadFrequently:true}),cache=new Map(),rules=[];
    const convert=value=>value.replace(/(?:color|oklab|oklch|lab|lch)\([^)]*\)/g,color=>{
      if(cache.has(color))return cache.get(color);
      context.clearRect(0,0,1,1);context.fillStyle=color;context.fillRect(0,0,1,1);
      const [r,g,b,a]=context.getImageData(0,0,1,1).data;
      const rgba=`rgba(${r},${g},${b},${a/255})`;cache.set(color,rgba);return rgba;
    });
    for(const [index,node]of [...view.querySelectorAll('.big-circle,.derived-dot')].entries()){
      for(const pseudo of [null,'::before','::after']){
        const image=getComputedStyle(node,pseudo).backgroundImage;
        if(!/(?:color|oklab|oklch|lab|lch)\(/.test(image))continue;
        const compatible=convert(image);
        if(!pseudo)node.style.setProperty('background-image',compatible,'important');
        else{
          node.dataset.exportPaint=index;
          // Match the customized slash selector's specificity, after its stylesheet.
          rules.push(`html .tv-app.road-export-frame .derived-dot.shape-slash[data-export-paint="${index}"]${pseudo}{background-image:${compatible}!important}`);
        }
      }
    }
    if(rules.length){const style=document.createElement('style');style.textContent=rules.join('\n');view.append(style);}
  }
  async function png(entry){
    const rounds=entry.rounds,source=document.querySelector('.tv-app');
    const css=getComputedStyle(source),number=key=>parseFloat(css.getPropertyValue(key));
    const bigSize=number('--cell-big'),derivedSize=number('--cell-derived'),beadSize=number('--cell-bead');
    const bottomScale=number('--tv-bottom-scale'),big=buildBigRoad(rounds);
    const bigCols=Math.max(number('--cols-big'),big.cols),derived=[];
    for(const [id,title,offset,shape]of [['bigEye','大眼仔',1,'hollow'],['smallRoad','小路',2,'solid'],['cockroachRoad','蟑螂路',3,'slash']]){
      const marks=buildDerivedRoad(big.grid,offset,big.cols,big.rows);
      derived.push({id,title,shape,marks,cols:Math.max(number('--cols-derived'),layoutDerivedMarks(marks,6).cols)});
    }
    const starCols=Math.max(number('--cols-star'),Math.ceil(rounds.filter(r=>r.r==='B'||r.r==='P').length/3));
    const beadCols=Math.max(number('--cols-bead'),Math.ceil(rounds.length/6));
    const width=Math.ceil(Math.max(1920,bigCols*bigSize+28,
      2*(Math.max(...derived.map(d=>d.cols))*derivedSize+6)+26,
      2*(starCols*bigSize+6)+26,622+162+12+(beadCols*beadSize+6)*bottomScale+20));
    const host=document.createElement('div'),view=source.cloneNode(true),boards=[];
    host.className='road-export-host';host.style.cssText='position:absolute;left:0;top:0;z-index:-2147483647;pointer-events:none';
    host.setAttribute('aria-hidden','true');host.inert=true;view.classList.add('road-export-frame');host.append(view);
    const inputs=source.querySelectorAll('input');view.querySelectorAll('input').forEach((n,i)=>{n.value=inputs[i].value;n.setAttribute('value',n.value);});
    // html2canvas clips text inputs with custom fonts. Static text keeps full limits.
    view.querySelectorAll('.limit-input').forEach(input=>{
      const text=document.createElement('span');text.className=input.className;
      text.dataset.k=input.dataset.k;text.textContent=input.value;
      text.style.display='block';text.style.whiteSpace='nowrap';input.replaceWith(text);
    });
    view.querySelectorAll('[id]').forEach(n=>{n.dataset.exportId=n.id;n.removeAttribute('id');});
    view.querySelectorAll('.tv-save-btn,.dragon-overlay,.dragon-corner-badge,.dragon-neon,.dragon-spine-svg,.result-announcement,.bead-orbit,.bead-local-glow,.bead-seven-sweep,.bead-seven-flash,.bead-tiger-sweep,.bead-tiger-flash').forEach(n=>n.remove());
    const target=id=>view.querySelector('[data-export-id="'+id+'"]');
    const board=(id,title,cols,size,rows=6)=>{
      const grid=target(id);
      Object.assign(grid.style,{gridTemplateColumns:`repeat(${cols},${size}px)`,gridTemplateRows:`repeat(${rows},${size}px)`,width:`${cols*size+2}px`,height:`${rows*size+2}px`,flexShrink:'0',backgroundSize:`100% ${size}px, ${size}px 100%, auto`});
      grid.style.setProperty('--skin-cell',size+'px');
      boards.push({title,cols});return grid;
    };
    renderBigRoad(big,{target:board('bigRoad','大路',bigCols,bigSize),rounds,cols:bigCols});
    for(const d of derived)renderDerived('',d.marks,d.shape,{target:board(d.id,d.title,d.cols,derivedSize),cols:d.cols});
    root.BaccaratTVView.renderStarRoad({target:board('starRoad','三星路',starCols,bigSize,3),rounds,cols:starCols});
    renderBead(rounds,board('beadBoard','珠子路',beadCols,beadSize),beadCols);
    // Renderers create effects and IDs, too; strip them after drawing the snapshot.
    view.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));
    view.querySelectorAll('.bead-orbit,.bead-local-glow,.bead-seven-sweep,.bead-seven-flash,.bead-tiger-sweep,.bead-tiger-flash').forEach(n=>n.remove());
    const counts={totalCount:rounds.length,tvTopRoundCount:rounds.length,cntB:rounds.filter(r=>r.r==='B').length,cntP:rounds.filter(r=>r.r==='P').length,cntT:rounds.filter(r=>r.r==='T').length,
      cntBP:rounds.filter(r=>r.bp).length,cntPP:rounds.filter(r=>r.pp).length,cntL6:rounds.filter(r=>r.l6).length,
      cntST:rounds.filter(r=>r.r==='B'&&r.tiger==='small').length,cntBT:rounds.filter(r=>r.r==='B'&&r.tiger==='big').length,
      cntL72:rounds.filter(r=>r.l7===2).length,cntL73:rounds.filter(r=>r.l7===3).length,
      cntS74:rounds.filter(r=>r.s7===4).length,cntS75:rounds.filter(r=>r.s7===5).length,cntS76:rounds.filter(r=>r.s7===6).length};
    for(const [id,count]of Object.entries(counts))if(target(id))target(id).textContent=count;
    // Retain all TV layout variables instead of replacing the inline style.
    Object.assign(view.style,{position:'relative',left:'0',top:'0',transform:'none',width:width+'px',height:'1080px'});
    const bottom=view.querySelector('.bottom-row');bottom.style.width=(width-20)/bottomScale+'px';
    document.body.append(host);
    try{
      await document.fonts?.ready;
      await Promise.all([...view.querySelectorAll('img')].map(img=>img.decode().catch(()=>{})));
      root.BaccaratTVView.fitStats?.(view.querySelector('.tv-stats .stats-list'));
      compatibleGradients(view);
      const w=view.offsetWidth,h=view.offsetHeight,scale=Math.min(1.5,11998/w,11998/h,Math.sqrt(23900000/(w*h)));
      if(scale<.3)throw Error('路單過長，圖片超出安全尺寸；JSON已保留，請分段儲存。');
      const canvas=await html2canvas(view,{backgroundColor:getComputedStyle(view).backgroundColor,scale,useCORS:true,logging:false,width:w,height:h,windowWidth:Math.max(w,1920),windowHeight:1080,
        onclone:doc=>{doc.body.style.overflow='visible';doc.body.style.height='auto';}});
      const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('PNG產生失敗，未傳送雲端備份。')),'image/png'));
      return {blob,width:canvas.width,height:canvas.height,boards};
    }finally{host.remove();}
  }
  root.BaccaratTVExport={png};
})(window);
