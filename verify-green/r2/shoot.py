import json
from playwright.sync_api import sync_playwright
from PIL import Image, ImageChops
B='http://localhost:8799/百家樂路單/';O='verify-green/r2/';R={};errs=[]
M="""()=>{const q=s=>{const e=document.querySelector(s);if(!e)return null;const b=e.getBoundingClientRect();return [b.x,b.y,b.right,b.bottom].map(v=>+v.toFixed(1))};const cs=(s,p)=>{const e=document.querySelector(s);if(!e)return null;const c=getComputedStyle(e,p||null);return {bg:c.backgroundImage.slice(0,90),bgc:c.backgroundColor,bd:c.borderTopWidth+' '+c.borderTopStyle,bimg:c.borderImageSource.slice(0,110),rad:c.borderRadius,font:c.fontFamily,fw:c.fontWeight,fs:c.fontSize,color:c.color,shadow:c.boxShadow.slice(0,80),w:c.width,h:c.height,bw:c.borderWidth,bc:c.borderTopColor,content:c.content}};
const bad=/segoe|pingfang|jhenghei|微軟|arial|system-ui|helvetica|sans-serif/i;const sys={};document.querySelectorAll('body *').forEach(e=>{if(e.getBoundingClientRect().width&&[...e.childNodes].some(n=>n.nodeType==3&&n.nodeValue.trim())){const f=getComputedStyle(e).fontFamily;if(bad.test(f))sys[f]=(sys[f]||[]).concat(e.tagName+'#'+e.id+'.'+e.className).slice(0,4)}});
return {skin:document.documentElement.dataset.skin||null,rect:{edit:q('#tvEditToggle'),save:q('#saveBtn'),skinbtn:q('#tvSkinToggle'),logo:q('.tv-logo'),logobtn:q('.tv-logo-btn'),big:q('.big-panel'),limit:q('.limit-panel')},
save:cs('#saveBtn'),skinbtn:cs('#tvSkinToggle'),edit:cs('#tvEditToggle'),big:cs('.big-panel'),bigBefore:cs('.big-panel','::before'),bigAfter:cs('.big-panel','::after'),table:cs('.tv-table-board'),tableBefore:cs('.tv-table-board','::before'),grid:cs('#bigRoad, .big-panel .grid-board'),
stat:{banker:cs('.stat-banker'),bankerK:cs('.stat-banker .k'),player:cs('.stat-player'),playerK:cs('.stat-player .k'),tie:cs('.stat-tie'),tieK:cs('.stat-tie .k'),l6:cs('.stat-lucky6'),l6k:cs('.stat-lucky6 .k'),l7:cs('.tv-lucky7'),sl7:cs('.tv-super-lucky7'),bp:cs('.stat-banker-pair'),pp:cs('.stat-player-pair'),num:cs('#cntB'),head:cs('.tv-stat-head'),headb:cs('.tv-stat-head b'),empty:cs('.tv-stat-empty')},
html:cs('html'),body:cs('body'),sysFonts:sys,ovf:['#saveBtn','#tvSkinToggle','#tvEditToggle'].map(s=>{const e=document.querySelector(s);return e.scrollWidth>e.clientWidth||e.scrollHeight>e.clientHeight}),ls:localStorage.getItem('tv_skin_v1')}}"""
def ov(a,b):
  if not a or not b: return None
  w=min(a[2],b[2])-max(a[0],b[0]);h=min(a[3],b[3])-max(a[1],b[1]);return [round(max(w,0),1),round(max(h,0),1)]
with sync_playwright() as p:
  br=p.chromium.launch()
  def page(u,skin,tag):
    c=br.new_context(viewport={'width':1704,'height':943});pg=c.new_page()
    pg.on('console',lambda m:errs.append(tag+' '+m.type+': '+m.text[:200]) if m.type in('error','warning') else None);pg.on('pageerror',lambda e:errs.append(tag+' pageerror '+str(e)[:200]))
    pg.add_init_script("if(!sessionStorage.getItem('x')){localStorage.setItem('tv_skin_v1','%s');sessionStorage.setItem('x','1')}"%skin);pg.goto(u,wait_until='networkidle');pg.evaluate('async()=>{await document.fonts.ready}');pg.wait_for_timeout(1500);return pg
  pg=page(B+'tv-orig.html','red','orig');pg.screenshot(path=O+'0-red-orig.png')
  pg=page(B+'tv.html','red','red');R['red']=pg.evaluate(M);pg.screenshot(path=O+'1-red.png')
  pg=page(B+'tv.html','green','green');R['green']=pg.evaluate(M);pg.screenshot(path=O+'2-green.png')
  g=R['green']['rect'];R['overlap']={k:ov(g[a],g[b]) for k,a,b in [('edit-logo','edit','logo'),('edit-logobtn','edit','logobtn'),('edit-save','edit','save'),('edit-limit','edit','limit'),('skin-big','skinbtn','big'),('skin-logo','skinbtn','logo'),('save-logo','save','logo')]}
  r=R['red']['rect'];R['overlap_red']={'edit-logo':ov(r['edit'],r['logo'])}
  pg.reload(wait_until='networkidle');pg.evaluate('async()=>{await document.fonts.ready}');pg.wait_for_timeout(1500);R['reload']={'skin':pg.evaluate("document.documentElement.dataset.skin"),'ls':pg.evaluate("localStorage.getItem('tv_skin_v1')"),'btn':pg.evaluate("document.getElementById('tvSkinToggle').textContent")};pg.screenshot(path=O+'7-green-after-reload.png')
  pg.click('#tvEditToggle');pg.wait_for_timeout(600);pg.click('.tv-table-board .tv-board-title-en');pg.wait_for_timeout(1200)
  R['selbox']=pg.evaluate("()=>{const e=document.querySelector('.tv-edit-selbox');const c=getComputedStyle(e);const b=e.getBoundingClientRect();return {display:c.display,border:c.borderTopWidth+' '+c.borderTopStyle+' '+c.borderTopColor,radius:c.borderRadius,bg:c.backgroundColor,bimg:c.borderImageSource,box:[b.x,b.y,b.width,b.height].map(Math.round)}}")
  R['editPressed']=pg.evaluate("(()=>{const b=document.getElementById('tvEditToggle').getBoundingClientRect();return [b.x,b.y,b.right,b.bottom].map(v=>+v.toFixed(1))})()")
  pg.screenshot(path=O+'6-green-edit-selbox.png');bx=R['selbox']['box']
  pg.screenshot(path=O+'6b-green-edit-selbox-zoom.png',clip={'x':max(0,bx[0]-60),'y':max(0,bx[1]-14),'width':bx[2]+120,'height':bx[3]+60})
  pg.screenshot(path=O+'6c-green-edit-topright.png',clip={'x':1380,'y':0,'width':324,'height':130})
  br.close()
R['errs']=errs
g=Image.open(O+'2-green.png')
def z(box,name,k=2): im=g.crop(box);im.resize((im.width*k,im.height*k),Image.NEAREST if k>2 else Image.LANCZOS).save(O+name)
z((1380,0,1704,130),'3-green-zoom-topright.png');z((22,580,567,936),'4-green-zoom-stats.png');z((12,108,132,178),'5-green-zoom-corner.png',4);z((1660,330,1704,600),'5b-green-zoom-felt.png',4)
a=Image.open(O+'0-red-orig.png').convert('RGB');n=Image.open(O+'1-red.png').convert('RGB');m=ImageChops.difference(a,n).convert('L').point(lambda v:255 if v else 0)
px=m.load();ins=out=0;ob=None
for y in range(m.height):
  for x in range(m.width):
    if px[x,y]:
      if 1444<=x<=1533 and 83<=y<=109: ins+=1
      else:
        out+=1;ob=[x,y,x,y] if ob is None else [min(ob[0],x),min(ob[1],y),max(ob[2],x),max(ob[3],y)]
R['reddiff']={'bbox':m.getbbox(),'inToggle':ins,'outside':out,'outsideBBox':ob}
Image.composite(Image.new('RGB',n.size,(255,0,0)),Image.blend(n,Image.new('RGB',n.size),0.6),m).save(O+'diff-red-orig-vs-new.png')
json.dump(R,open(O+'result.json','w',encoding='utf8'),ensure_ascii=False,indent=1);print(json.dumps(R,ensure_ascii=False))