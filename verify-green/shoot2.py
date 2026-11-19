import json
from playwright.sync_api import sync_playwright
from PIL import Image, ImageChops
B='http://localhost:8799/百家樂路單/';O='verify-green/';R={}
M="""()=>{const q=s=>{const e=document.querySelector(s);if(!e)return null;const b=e.getBoundingClientRect();return [b.x,b.y,b.width,b.height].map(v=>+v.toFixed(2))};
const t=document.getElementById('tvSkinToggle');const logo=[...document.querySelectorAll('.tv-identity *')].filter(e=>e!==t&&e.id!=='saveBtn'&&!e.closest('.tv-save-stack')&&e.getBoundingClientRect().left>(document.getElementById('saveBtn').getBoundingClientRect().right-1)).map(e=>{const b=e.getBoundingClientRect();return [e.tagName+'.'+e.className,b.x,b.y,b.width,b.height].map(v=>typeof v=='number'?+v.toFixed(1):v)});
return {save:q('#saveBtn'),toggle:q('#tvSkinToggle'),bigroad:q('.tv-big-road, #bigRoad, .big-road'),board:[...document.querySelectorAll('.panel,.tv-table-board,.limit-panel')].map(e=>{const b=e.getBoundingClientRect();return [e.className.slice(0,30),+b.x.toFixed(1),+b.y.toFixed(1),+b.right.toFixed(1),+b.bottom.toFixed(1)]}),right:logo,ovf:t?t.scrollWidth>t.clientWidth:null}}"""
with sync_playwright() as p:
  b=p.chromium.launch();errs=[]
  def page(u,skin):
    c=b.new_context(viewport={'width':1704,'height':943});pg=c.new_page()
    pg.on('console',lambda m:errs.append(skin+' '+m.type+': '+m.text[:200]) if m.type in('error','warning') else None);pg.on('pageerror',lambda e:errs.append(skin+' pageerror '+str(e)[:200]))
    pg.add_init_script("localStorage.setItem('tv_skin_v1','%s')"%skin);pg.goto(u,wait_until='networkidle');pg.evaluate('async()=>{await document.fonts.ready}');pg.wait_for_timeout(1500);return pg
  pg=page(B+'tv-orig.html','red');R['orig']=pg.evaluate(M);pg.screenshot(path=O+'0-red-orig.png')
  pg=page(B+'tv.html','red');R['red']=pg.evaluate(M);pg.screenshot(path=O+'1-red.png')
  pg=page(B+'tv.html','green');R['green']=pg.evaluate(M);pg.screenshot(path=O+'2-green.png')
  R['errs']=errs;b.close()
a=Image.open(O+'0-red-orig.png').convert('RGB');n=Image.open(O+'1-red.png').convert('RGB');d=ImageChops.difference(a,n);R['diffbbox']=d.getbbox()
m=d.convert('L').point(lambda v:255 if v>0 else 0);R['diffpx']=sum(1 for v in m.getdata() if v)
red=Image.new('RGB',n.size,(255,0,0));out=Image.composite(red,Image.blend(n,Image.new('RGB',n.size,(0,0,0)),0.6),m);out.save(O+'diff-red-orig-vs-new.png')
json.dump(R,open(O+'result2.json','w',encoding='utf8'),ensure_ascii=False,indent=1);print(json.dumps(R,ensure_ascii=False))