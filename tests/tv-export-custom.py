from pathlib import Path
from playwright.sync_api import sync_playwright
import json
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    page=browser.new_page(viewport={'width':1280,'height':720})
    page.route('https://fonts.googleapis.com/**',lambda r:r.fulfill(body=''))
    page.route('https://fonts.gstatic.com/**',lambda r:r.abort())
    page.route('https://cdn.jsdelivr.net/npm/html2canvas@*/dist/html2canvas.min.js',lambda r:r.fulfill(path=str(ROOT/'.preview/html2canvas.min.js'),content_type='text/javascript'))
    page.goto('http://127.0.0.1:8082/roadmap/tv.html',wait_until='domcontentloaded')
    page.evaluate('localStorage.setItem("baccarat_tv_settings_v1",JSON.stringify({columns:38,statsNameSize:24,statsNumberSize:36,statsHeaderSize:24,colors:{red:"#ab12cd",blue:"#12abcd",grid:"#faf0dd",gridLine:"#789abc",statBanker:"#572c91"}}))')
    page.reload(wait_until='domcontentloaded')
    page.select_option('#themeSelect','black-gold',force=True)
    result=page.evaluate('''async()=>{
      speech.enabled=false;state.rounds=Array.from({length:20},(_,i)=>({r:i%3===0?'B':i%4===0?'T':'P',bp:i%5===0,pp:i%7===0,l6:false}));renderAll();
      const original=html2canvas;let layout;
      html2canvas=async(view,options)=>{
        layout={panels:[...view.querySelectorAll('.grid-board')].map(n=>({width:n.getBoundingClientRect().width,parent:n.parentElement.getBoundingClientRect().width})),
          color:getComputedStyle(view.querySelector('.bead.B')).backgroundColor,
          text:view.querySelector('[data-k="bpMax"]').textContent,
          countFont:getComputedStyle(view.querySelector('[data-export-id="cntB"]')).fontSize};
        return original(view,options);
      };
      const image=await RoadBackup.png({rounds:JSON.parse(JSON.stringify(state.rounds))});
      return {layout,bytes:image.blob.size};
    }''')
    assert result['layout']['color']=='rgb(171, 18, 205)',result
    assert result['layout']['countFont']=='36px',result
    assert result['layout']['text']=='1,500,000',result
    assert all(x['width']<=x['parent']+1 for x in result['layout']['panels']),result
    assert result['bytes']>10000,result
    print('PASS custom colors, black-gold theme, 38 columns, custom stats font, full limit values in real PNG')
    browser.close()
