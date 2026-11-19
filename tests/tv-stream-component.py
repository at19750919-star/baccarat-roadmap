from pathlib import Path
import io,json,sys,hashlib
from PIL import Image,ImageChops,ImageDraw
from playwright.sync_api import sync_playwright
root=Path(sys.argv[1]); out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
fixtures=[
 {'r':'B','l6':True}, {'r':'B','l6':True,'tiger':'small'}, {'r':'B','l6':True,'tiger':'big'},
 {'r':'P','l7':2}, {'r':'P','l7':3}, {'r':'P','s7':4}, {'r':'P','s7':5}, {'r':'P','s7':6},
 {'r':'B','s7':6}, {'r':'P','tiger':'big'}]
results={};frames={}
def changed(a,b,region,threshold=10):
 d=ImageChops.difference(a,b)
 return sum(max(d.getpixel((x,y)))>threshold for y in range(61) for x in range(61) if region(x,y))
ring=lambda x,y: 24<((x-30)**2+(y-30)**2)**.5<31
inner=lambda x,y: ((x-30)**2+(y-30)**2)**.5<24
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,timeout=10000)
 context=browser.new_context(viewport={'width':1920,'height':1080},reduced_motion='no-preference')
 page=context.new_page();page.set_default_timeout(10000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('https://**',lambda r:r.fulfill(body=''))
 page.goto((root/'tv.html').as_uri(),wait_until='domcontentloaded')
 page.evaluate('(rounds)=>{state.rounds=rounds;renderAll()}',fixtures)
 actual=page.locator('#beadBoard .bead').evaluate_all('(beads)=>beads.map(b=>({orbit:!!b.querySelector(".bead-orbit"),glow:!!b.querySelector(".bead-local-glow")}))')
 expected=[False,False,True,False,False,False,False,True,False,False]
 assert [v['orbit'] for v in actual]==expected,actual
 assert [v['glow'] for v in actual]==expected,actual
 assert page.locator('.bead-stream').count()==0
 assert page.locator('#beadBoard .bead-orbit').count()==2
 assert page.locator('#beadBoard .orbit-dot').count()==6
 assert page.locator('#beadBoard .tiger-eye').count()==2
 assert page.locator('#beadBoard .bead-local-seven').count()==1
 assert page.locator('#beadBoard .seven-cards').evaluate_all("(es)=>es.every(e=>getComputedStyle(e).color==='rgb(255, 255, 255)')")
 for name,index in [('tiger',2),('purple-seven',7)]:
  page.evaluate('''index=>{
    document.querySelector('#effectFixture')?.remove();
    const f=document.createElement('div');f.id='effectFixture';f.className='tv-app';
    f.style.cssText='display:block;position:fixed;left:0;top:0;width:61px;height:61px;z-index:99999;padding:0;margin:0;background:white;--cell-bead:61px;transform:none';
    const b=document.querySelectorAll('#beadBoard .bead')[index].cloneNode(true);
    b.style.cssText='width:61px;height:61px;margin:0';
    f.appendChild(b);document.body.appendChild(f);
  }''',index)
  bead=page.locator('#effectFixture .bead')
  page.locator('#effectFixture img').evaluate_all('(imgs)=>Promise.all(imgs.map(i=>i.decode()))')
  orbit=page.locator('#effectFixture .bead-orbit');glow=page.locator('#effectFixture .bead-local-glow')
  assert orbit.locator('.orbit-dot').count()==3
  timing=orbit.evaluate('e=>e.getAnimations()[0].effect.getTiming()')
  assert timing['duration']==8000 and timing['easing']=='linear',timing
  t1=orbit.evaluate('e=>e.getAnimations()[0].currentTime');page.wait_for_timeout(300);t2=orbit.evaluate('e=>e.getAnimations()[0].currentTime')
  assert t2-t1>180,(t1,t2)
  bead.evaluate("e=>e.getAnimations({subtree:true}).forEach(a=>a.pause())")
  def settime(local,spin=0):
   orbit.evaluate('(e,t)=>e.getAnimations()[0].currentTime=t',spin)
   glow.evaluate('(e,t)=>e.getAnimations()[0].currentTime=t',local)
  def shot():
   return Image.open(io.BytesIO(bead.screenshot())).convert('RGB')
  frames[name]=[]
  for t in [0,2000,4000,8000]:
   settime(t,t);frames[name].append(shot())
  ringdelta=[changed(frames[name][0],frames[name][i],ring) for i in [1,2,3]]
  assert ringdelta[0]>8 and ringdelta[1]>8 and ringdelta[2]==0,ringdelta
  assert ImageChops.difference(frames[name][0],frames[name][3]).getbbox() is None
  settime(0);off=shot()
  settime(2000);on=shot()
  localdelta=changed(off,on,inner,5)
  assert localdelta>4,(name,localdelta)
  localring=changed(off,on,ring,5)
  assert localring==0,(name,'local light leaked to rim',localring)
  if name=='tiger':
   d=ImageChops.difference(off,on)
   assert all((19<=x<=42 and 24<=y<=31) for y in range(61) for x in range(61) if max(d.getpixel((x,y)))>5),'eyes light outside eye area'
  else:
   # The card count in the lower right must stay white and must not breathe.
   assert changed(off,on,lambda x,y:x>=43 and y>=43,2)==0
  page.emulate_media(reduced_motion='reduce')
  orbit.evaluate('e=>e.getAnimations()[0].play()')
  a=orbit.evaluate('e=>e.getAnimations()[0].currentTime');page.wait_for_timeout(250);z=orbit.evaluate('e=>e.getAnimations()[0].currentTime')
  assert z-a>150
  results[name]={'dots':3,'orbitMs':8000,'liveAdvanceMs':round(t2-t1),'ringPixelChanges2s4s8s':ringdelta,'localizedGlowPixelChanges':localdelta,'localGlowLeaksToRim':localring}
  page.emulate_media(reduced_motion='no-preference')
  off.save(out/(name+'-glow-off.png'));on.save(out/(name+'-glow-on.png'))
 assert not errors,errors
 browser.close()
# Keep actual-size rendered evidence; this composes screenshots without editing image assets.
canvas=Image.new('RGB',(440,200),'#eee');draw=ImageDraw.Draw(canvas)
for row,(name,images) in enumerate(frames.items()):
 draw.text((4,row*95+30),name,fill='black')
 for col,(label,im) in enumerate(zip(['0s','2s','4s','8s'],images)):
  canvas.paste(im,(100+col*85,row*95+22));draw.text((105+col*85,row*95+5),label,fill='black')
canvas.save(out/'orbit-dots-comparison.png')
asset_hashes=json.loads((root/'.preview/orbit-dots-before/asset-hashes.json').read_text(encoding='utf-8'))
assert all(hashlib.sha256((root/'assets/beads'/n).read_bytes()).hexdigest()==h for n,h in asset_hashes.items())
print(json.dumps({'PASS':results,'gatingCases':len(fixtures),'assetFilesUnchanged':True,'runtimeErrors':errors,'comparison':str(out/'orbit-dots-comparison.png')},ensure_ascii=False))

