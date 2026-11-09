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
    const properties=['color','background-color','background-image','border-top-color','border-right-color','border-bottom-color','border-left-color','box-shadow','text-shadow','text-decoration-color','outline-color','-webkit-text-fill-color','-webkit-text-stroke-color'];
    for(const [index,node]of [view,...view.querySelectorAll('*')].entries()){
      for(const pseudo of [null,'::before','::after']){
        const css=getComputedStyle(node,pseudo);
        if(pseudo&&css.content==='none')continue;
        for(const property of properties){
          const value=css.getPropertyValue(property);
          if(!/(?:color|oklab|oklch|lab|lch)\(/.test(value))continue;
          const compatible=convert(value);
          if(!pseudo)node.style.setProperty(property,compatible,'important');
          else{
            node.dataset.exportPaint=index;
            const selector=node===view?`.tv-app.road-export-frame[data-export-paint="${index}"]`:`.tv-app.road-export-frame [data-export-paint="${index}"]`;
            rules.push(`html:not(#_):not(#_) ${selector}${pseudo}{${property}:${compatible}!important}`);
          }
        }
      }
    }
    if(rules.length){const style=document.createElement('style');style.textContent=rules.join('\n');view.append(style);}
  }
  function compatibleBackgroundPositions(view){
    // html2canvas 1.4 cannot parse four-part edge offsets such as right 4px top 4px.
    // Resolve only those fixed-size decorative layers to pixels in the export clone.
    const rules=[],split=value=>{
      let depth=0,start=0;const parts=[];
      for(let i=0;i<value.length;i++){
        if(value[i]==='(')depth++;else if(value[i]===')')depth--;
        else if(value[i]===','&&!depth){parts.push(value.slice(start,i).trim());start=i+1;}
      }
      parts.push(value.slice(start).trim());return parts;
    };
    const absolute=(token,space)=>{
      const calc=token.match(/^calc\((-?[\d.]+)%\s*([+-])\s*([\d.]+)px\)$/);
      if(calc)return space*Number(calc[1])/100+(calc[2]==='-'?-1:1)*Number(calc[3]);
      if(/^-?[\d.]+px$/.test(token))return parseFloat(token);
      if(/^-?[\d.]+%$/.test(token))return space*parseFloat(token)/100;
      return null;
    };
    [view,...view.querySelectorAll('*')].forEach((node,index)=>{
      for(const pseudo of [null,'::before','::after']){
        const css=getComputedStyle(node,pseudo),positions=split(css.backgroundPosition);
        let sizes=split(css.backgroundSize);
        let changed=false;
        const width=pseudo?parseFloat(css.width):node.clientWidth,height=pseudo?parseFloat(css.height):node.clientHeight;
        const resolvedSizes=sizes.map(size=>{
          const tokens=size.match(/calc\([^)]*\)|[^\s]+/g);
          return tokens.map((token,axis)=>{
            const value=token.includes('calc(')?absolute(token,axis?height:width):null;
            return value!==null&&Number.isFinite(value)?Math.max(0,value)+'px':token;
          }).join(' ');
        });
        const sizeChanged=resolvedSizes.join(',')!==sizes.join(',');
        sizes=resolvedSizes;
        const images=split(css.backgroundImage),safeImages=images.map((image,i)=>{
          const size=sizes[i%sizes.length];
          return /(?:^| )0px(?: |$)/.test(size)?'none':image;
        });
        const imageChanged=safeImages.join(',')!==images.join(',');
        const resolved=positions.map((position,i)=>{
          const match=position.match(/^(left|right) ([\d.]+)px (top|bottom) ([\d.]+)px$/);
          const size=sizes[i%sizes.length].match(/^([\d.]+)px ([\d.]+)px$/);
          if(!size||!Number.isFinite(width)||!Number.isFinite(height))return position;
          let x,y;
          if(match){
            x=match[1]==='right'?width-Number(size[1])-Number(match[2]):Number(match[2]);
            y=match[3]==='bottom'?height-Number(size[2])-Number(match[4]):Number(match[4]);
          }else if(position.includes('calc(')){
            const tokens=position.match(/calc\([^)]*\)|[^\s]+/g);
            if(tokens.length!==2)return position;
            x=absolute(tokens[0],width-Number(size[1]));y=absolute(tokens[1],height-Number(size[2]));
            if(x===null||y===null)return position;
          }else return position;
          changed=true;
          return `${x}px ${y}px`;
        });
        if(!changed&&!sizeChanged&&!imageChanged)continue;
        if(!pseudo){
          if(changed)node.style.setProperty('background-position',resolved.join(','),'important');
          if(sizeChanged)node.style.setProperty('background-size',sizes.join(','),'important');
          if(imageChanged)node.style.setProperty('background-image',safeImages.join(','),'important');
        }
        else{
          node.dataset.exportPosition=index;
          const selector=node===view?`.tv-app.road-export-frame[data-export-position="${index}"]`:`.tv-app.road-export-frame [data-export-position="${index}"]`;
          rules.push(`html:not(#_):not(#_) ${selector}${pseudo}{${changed?'background-position:'+resolved.join(',')+'!important;':''}${sizeChanged?'background-size:'+sizes.join(',')+'!important;':''}${imageChanged?'background-image:'+safeImages.join(',')+'!important;':''}}`);
        }
      }
    });
    if(rules.length){const style=document.createElement('style');style.textContent=rules.join('\n');view.append(style);}
  }
  async function png(entry){
    const rounds=entry.rounds,source=document.querySelector('.tv-app');
    const css=getComputedStyle(source),number=key=>parseFloat(css.getPropertyValue(key));
    const bigSize=number('--cell-big'),derivedSize=number('--cell-derived'),beadSize=number('--cell-bead');
    const bottomScale=number('--tv-bottom-scale'),big=buildBigRoad(rounds);
    const bigCols=Math.max(number('--cols-big'),big.cols),derived=[];
    for(const [id,title,offset,shape]of [['bigEye','大眼仔',1,'hollow'],['smallRoad','小路',2,'solid'],['cockroachRoad','甲由路',3,'slash']]){
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
      compatibleBackgroundPositions(view);
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
