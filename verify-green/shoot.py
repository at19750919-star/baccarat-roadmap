import json
from playwright.sync_api import sync_playwright
U='http://localhost:8799/百家樂路單/tv.html';W,H=1704,943;O='verify-green/'
def ready(pg): pg.evaluate('async()=>{await document.fonts.ready}');pg.wait_for_timeout(1500)
M="""()=>{const r=e=>{const b=document.querySelector(e).getBoundingClientRect();return {x:Math.round(b.x),y:Math.round(b.y),w:Math.round(b.width),h:Math.round(b.height),r:Math.round(b.right),b:Math.round(b.bottom)}};
const t=document.getElementById('tvSkinToggle'),s=document.getElementById('saveBtn');const bad=/segoe|pingfang|jhenghei|微軟|arial|system-ui|helvetica|sans-serif/i;
const sys=new Set();document.querySelectorAll('body *').forEach(e=>{if(e.getBoundingClientRect().width&&e.childNodes.length&&[...e.childNodes].some(n=>n.nodeType==3&&n.nodeValue.trim())){const f=getComputedStyle(e).fontFamily;if(bad.test(f))sys.add(f)}});
const ov=[t,s].map(e=>e.scrollWidth>e.clientWidth);const tb=document.querySelector('.title-bar').getBoundingClientRect();
return {skin:document.documentElement.getAttribute('data-skin'),save:r('#saveBtn'),toggle:r('#tvSkinToggle'),titleBottom:Math.round(tb.bottom),toggleText:t.textContent,toggleFont:getComputedStyle(t).fontFamily,toggleRad:getComputedStyle(t).borderRadius,toggleColor:getComputedStyle(t).color,toggleBg:getComputedStyle(t).backgroundImage.slice(0,60),overflow:ov,sysFonts:[...sys],ls:localStorage.getItem('tv_skin_v1')}}"""
res={}
with sync_playwright() as p:
  b=p.chromium.launch();ctx=b.new_context(viewport={'width':W,'height':H});pg=ctx.new_page();errs=[]
  pg.on('console',lambda m:errs.append(m.type+': '+m.text[:200]) if m.type in('error','warning') else None);pg.on('pageerror',lambda e:errs.append('pageerror: '+str(e)[:200]))
  pg.goto(U,wait_until='networkidle');pg.evaluate("localStorage.removeItem('tv_skin_v1')");pg.reload(wait_until='networkidle');ready(pg)
  res['red']=pg.evaluate(M);res['red_errs']=errs[:];pg.screenshot(path=O+'1-red.png')
  errs.clear();pg.click('#tvSkinToggle');pg.wait_for_timeout(800);res['green']=pg.evaluate(M);pg.screenshot(path=O+'2-green.png')
  pg.reload(wait_until='networkidle');ready(pg)
  # 首次繪製檢查：attribute 在 DOMContentLoaded 前已存在
  res['green_reload']=pg.evaluate(M);res['green_errs']=errs[:];pg.screenshot(path=O+'4-green-after-reload.png')
  pg.click('#tvEditToggle');pg.wait_for_timeout(600);pg.click('.tv-table-board .tv-board-title-en');pg.wait_for_timeout(1200)
  res['selbox']=pg.evaluate("()=>{const e=document.querySelector('.tv-edit-selbox');const c=getComputedStyle(e);const b=e.getBoundingClientRect();return {display:c.display,border:c.borderTopWidth+' '+c.borderTopStyle+' '+c.borderTopColor,radius:c.borderRadius,bg:c.backgroundColor,box:[Math.round(b.x),Math.round(b.y),Math.round(b.width),Math.round(b.height)]}}")
  pg.screenshot(path=O+'3-green-edit-selbox.png');bx=res['selbox']['box']
  pg.screenshot(path=O+'3b-green-edit-selbox-zoom.png',clip={'x':max(0,bx[0]-60),'y':max(0,bx[1]-40),'width':bx[2]+120,'height':bx[3]+80})
  res['edit_errs']=errs[:]
  # 對照：紅金編輯框
  pg.click('#tvEditToggle');pg.evaluate("localStorage.setItem('tv_skin_v1','red')");pg.reload(wait_until='networkidle');ready(pg)
  pg.click('#tvEditToggle');pg.wait_for_timeout(600);pg.click('.tv-table-board .tv-board-title-en');pg.wait_for_timeout(1200)
  res['selbox_red']=pg.evaluate("()=>{const e=document.querySelector('.tv-edit-selbox');const c=getComputedStyle(e);return {border:c.borderTopWidth+' '+c.borderTopColor,radius:c.borderRadius}}")
  pg.click('#tvEditToggle');res['final_errs']=errs[:];b.close()
json.dump(res,open(O+'result.json','w',encoding='utf8'),ensure_ascii=False,indent=1);print(json.dumps(res,ensure_ascii=False,indent=1))