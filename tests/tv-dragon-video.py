"""Actual local gold/blue video playback, isolation and fallback integration."""
from pathlib import Path
from urllib.parse import unquote
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import atexit, json, threading, urllib.request
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'.preview/dragon-video-fix';OUT.mkdir(parents=True,exist_ok=True)
BASE='http://127.0.0.1:8768'
HARNESS='''<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>長龍金龍・本機試播</title>
<style>body{margin:0;background:#171717;color:#f7e7ba;font:15px system-ui}header{display:flex;align-items:center;gap:10px;padding:8px 14px;flex-wrap:wrap}button{background:#802018;color:#fff2c7;border:1px solid #bc963b;border-radius:5px;padding:8px 16px;cursor:pointer}small{color:#d5cdb8}iframe{display:block;width:100%;height:calc(100vh - 57px);border:0;background:#7a0b0b}</style>
<header><strong>金龍本機試播</strong><button disabled onclick="streak('B')">莊長龍</button><button disabled onclick="streak('P')">閒長龍</button><button disabled onclick="replay()">重播</button><button disabled onclick="road.contentWindow.eval('DragonFx.fadeOut()')">關閉特效</button><small>此獨立本機網址只使用測試資料，不影響原本牌局。</small></header>
<iframe id="road" src="tv.html?preview=dragon" title="長龍特效電視版測試"></iframe>
<script>const road=document.getElementById('road');road.onload=()=>{road.contentWindow.eval('speech.enabled=false');document.querySelectorAll('button').forEach(button=>button.disabled=false)};function streak(color){road.contentWindow.eval("speech.enabled=false;state.rounds=[];renderAll();for(let i=0;i<getDragonThreshold()+1;i++)addRound("+JSON.stringify(color==='P'?'P':'B')+")")}function replay(){road.contentWindow.eval("(function(){const rounds=state.rounds.filter(r=>r&&r.r&&r.r!=='T');const color=rounds.length&&rounds[rounds.length-1].r==='P'?'P':'B';DragonFx.triggerShowcase(color,getDragonThreshold()+1,false)})()")}</script>'''
class HarnessHandler(SimpleHTTPRequestHandler):
 def __init__(self,*args,**kwargs):
  super().__init__(*args,directory=str(ROOT),**kwargs)
 def do_GET(self):
  if self.path.split('?',1)[0]=='/dragon-test.html':
   body=HARNESS.encode('utf-8')
   self.send_response(200)
   self.send_header('Content-Type','text/html; charset=utf-8')
   self.send_header('Content-Length',str(len(body)))
   self.send_header('Cache-Control','no-store')
   self.end_headers()
   self.wfile.write(body)
   return
  super().do_GET()
 def log_message(self,fmt,*args):
  return
def harness_ready():
 try:
  with urllib.request.urlopen(BASE+'/dragon-test.html',timeout=3) as res:
   text=res.read().decode('utf-8','replace')
 except Exception:
  return False
 return 'tv.html?preview=dragon' in text and '莊長龍' in text and '關閉特效' in text
try:
 httpd=ThreadingHTTPServer(('127.0.0.1',8768),HarnessHandler)
except OSError:
 httpd=None
 if not harness_ready():
  raise SystemExit('127.0.0.1:8768 已被佔用，而且不是這支測試的長龍試播頁')
else:
 httpd.daemon_threads=True
 threading.Thread(target=httpd.serve_forever,daemon=True).start()
def stop_harness():
 if httpd:
  httpd.shutdown();httpd.server_close()
atexit.register(stop_harness)
SENTINEL=[{'r':'P','bp':True},{'r':'B'},{'r':'T'}]
SRC={'B':'assets/dragons/dragon-gold-transparent-v2.webm','P':'特效/dragon-long-v2.webm'}
checks=[];errors=[]
def record(name,details=True):
 checks.append({'check':name,'details':details});print('PASS '+name,flush=True)
def opened(browser,fault=None,harness=False):
 c=browser.new_context(viewport={'width':1280,'height':720},reduced_motion='no-preference')
 c.route('https://**',lambda r:r.fulfill(body=''))
 c.add_init_script("localStorage.setItem('baccarat_road_rounds_v1',JSON.stringify("+json.dumps(SENTINEL)+"));")
 if fault=='load':c.route('**/dragon-gold-transparent-v2.webm',lambda r:r.abort())
 if fault=='blue-load':c.route('**/dragon-long-v2.webm',lambda r:r.abort())
 if fault=='reject':c.add_init_script("""const nativePlay=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){return this.src.includes('dragon-gold-transparent')?Promise.reject(new DOMException('isolated rejection','NotAllowedError')):nativePlay.call(this)}""")
 if fault in ['pending','timeout']:c.add_init_script("""window.testPlays=[];const nativePlay=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){return this.src.includes('dragon-gold-transparent')?new Promise((resolve,reject)=>testPlays.push({resolve,reject})):nativePlay.call(this)}""")
 if fault=='unsupported':c.add_init_script("HTMLMediaElement.prototype.canPlayType=function(){return ''}")
 page=c.new_page();page.set_default_timeout(15000)
 page.on('pageerror',lambda e:errors.append(str(e)))
 requests=[];page.on('request',lambda r:requests.append(unquote(r.url)) if '.webm' in r.url else None)
 page.goto(BASE+('/dragon-test.html' if harness else '/tv.html?preview=dragon'),wait_until='domcontentloaded')
 if harness:
  page.wait_for_function("!document.querySelector('button').disabled")
  f=page.frame(url=lambda u:'tv.html?preview=dragon' in u)
 else:f=page
 assert f.evaluate('dragonPreview')
 f.evaluate('speech.enabled=false')
 unchanged(f)
 return c,page,f,requests
def unchanged(f):assert f.evaluate('JSON.parse(localStorage.getItem("baccarat_road_rounds_v1"))')==SENTINEL
def trigger(f,side):f.evaluate("c=>DragonFx.triggerShowcase(c,getDragonThreshold()+1,false)",side)
def playing(f,side='B'):
 f.wait_for_function("""side=>{let o=document.querySelector('#dragonOverlay'),v=document.querySelector('#dragonVideo');return o.classList.contains('active')&&o.classList.contains(side==='P'?'player-dragon-overlay':'banker-dragon-overlay')&&o.classList.contains('dragon-video-mode')&&!v.paused&&v.currentTime>.1}""",arg=side)
 info=f.locator('#dragonVideo').evaluate("v=>({src:v.currentSrc,width:v.videoWidth,height:v.videoHeight,duration:v.duration,time:v.currentTime,muted:v.muted})")
 assert unquote(info['src']).endswith('/'+SRC[side]) and info['width']==1280 and info['height']==720 and info['muted'],info
 assert f.locator('#dragonVideo').evaluate("v=>getComputedStyle(v).display")=='block'
 return info
def closed(f):
 f.wait_for_function("!document.querySelector('#dragonOverlay').classList.contains('active')&&!document.querySelector('#dragonOverlay').classList.contains('fading-out')",timeout=14000)
 v=f.locator('#dragonVideo').evaluate("v=>({paused:v.paused,src:v.getAttribute('src'),display:getComputedStyle(v).display})")
 assert v['paused'] and not v['src'] and v['display']=='none',v
 assert not f.locator('#dragonOverlay').evaluate("e=>e.classList.contains('dragon-video-mode')")
def native(f,side):
 f.wait_for_function("!document.querySelector('#dragonVideo').hasAttribute('src')",timeout=9000)
 info=f.evaluate("""side=>{const o=document.querySelector('#dragonOverlay'),v=document.querySelector('#dragonVideo'),i=o.querySelector(side==='P'?'.dragon-player-img':'.dragon-banker-img');return {active:o.classList.contains('active'),side:o.classList.contains(side==='P'?'player-dragon-overlay':'banker-dragon-overlay'),paused:v.paused,video:getComputedStyle(v).display,image:getComputedStyle(i).display,src:i.getAttribute('src'),animation:getComputedStyle(i).animationName,canvas:getComputedStyle(document.querySelector('#dragonFxCanvas')).display,aura:getComputedStyle(o.querySelector('.dragon-aura-ring')).display}}""",side)
 assert info['active'] and info['side'] and info['paused'] and info['video']=='none',info
 assert info['image']!='none' and info['canvas']!='none' and info['aura']!='none' and 'tv-dragon-three-step' in info['animation'],info
 assert info['src']==('assets/dragon_player.png' if side=='P' else 'assets/dragon_banker.png')
 return info
def seek(f,t):
 f.locator('#dragonVideo').evaluate('(v,t)=>v.currentTime=t',t)
 f.wait_for_function("t=>{let v=document.querySelector('#dragonVideo');return !v.seeking&&v.currentTime>=t-.1}",arg=t)
 f.wait_for_timeout(120)
def frame_stats(f):
 return f.locator('#dragonVideo').evaluate("""v=>{let c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;let x=c.getContext('2d');x.drawImage(v,0,0);let d=x.getImageData(0,0,c.width,c.height).data,transparent=0,opaque=0,blue=0,sum=0;for(let i=0;i<d.length;i+=16){let a=d[i+3];if(!a)transparent++;if(a>250)opaque++;if(a>200&&d[i+2]>d[i]*1.2&&d[i+1]>d[i]*1.1)blue++;sum=(sum+d[i]*3+d[i+1]*5+d[i+2]*7+a)%1000000007}return {transparent,opaque,blue,signature:sum}}""")
with sync_playwright() as p:
 b=p.chromium.launch(headless=True)
 try:
  c,page,f,requests=opened(b)
  # Original blue video, including its own animated body/particles, not a static fallback.
  trigger(f,'P');info=playing(f,'P')
  t=info['time'];page.wait_for_timeout(250);assert f.locator('#dragonVideo').evaluate('v=>v.currentTime')>t+.1
  seek(f,1.5);a=frame_stats(f)
  seek(f,4.9);z=frame_stats(f)
  assert a['signature']!=z['signature'] and z['blue']>500 and z['transparent']>20000 and z['opaque']>3000,[a,z]
  assert not any(SRC['B'] in u for u in requests),requests
  page.screenshot(path=str(OUT/'player-original-blue-video.png'))
  record('player actually decodes original dragon-long-v2.webm with moving blue frames and transparency',{'media':info,'frame1':a,'frame2':z})
  trigger(f,'B');info=playing(f,'B')
  seek(f,4.9);a=frame_stats(f);assert a['transparent']>20000 and a['opaque']>3000,a
  page.screenshot(path=str(OUT/'banker-transparent-gold.png'))
  record('banker keeps the confirmed transparent gold video',{'media':info,'alpha':a})
  for side in ['P','B','P']:
   trigger(f,side);playing(f,side)
   f.locator('#dragonVideo').evaluate("v=>{v.dispatchEvent(new Event('ended'));v.dispatchEvent(new Event('error'))}")
   assert f.locator('#dragonOverlay').evaluate("e=>e.classList.contains('active')")
  record('bidirectional switches replace sources; stale ended/error events do not close the new side')
  page.mouse.click(10,10);closed(f)
  record('actual click closes blue video and clears source/mode')
  for side in ['B','P']:
   f.evaluate("c=>{state.rounds=Array.from({length:getDragonThreshold()+1},()=>({r:c}));renderAll()}",side)
   playing(f,side)
   f.evaluate('DragonFx.fadeOut()');closed(f)
   page.locator('#dragonCornerBadge').click();info=playing(f,side);assert info['time']<2
   seek(f,info['duration']-.15);closed(f)
   record(side+' badge replay restarts the right video; actual media ended cleans up')
  unchanged(f);c.close()
  for fault in ['load','reject','unsupported','timeout']:
   c,page,f,requests=opened(b,fault=fault)
   trigger(f,'B');info=native(f,'B')
   record('gold '+fault+' failure restores original banker effect',info)
   trigger(f,'P')
   if fault=='unsupported':native(f,'P')
   else:playing(f,'P')
   record('gold '+fault+' failure never leaks gold into player')
   unchanged(f);c.close()
  c,page,f,requests=opened(b,fault='blue-load')
  trigger(f,'P');native(f,'P')
  assert not any(SRC['B'] in u for u in requests),requests
  trigger(f,'B');playing(f,'B')
  record('blue loading failure falls back to original blue image/particles, never gold; banker still works')
  unchanged(f);c.close()
  c,page,f,requests=opened(b)
  f.evaluate("document.querySelector('#dragonVideo').dataset.playerSrc='assets/dragons/dragon-gold-transparent-v2.webm'")
  trigger(f,'P');native(f,'P');assert not requests,requests
  record('obsolete shared-gold player source is rejected rather than played')
  c.close()
  c,page,f,requests=opened(b,fault='pending')
  trigger(f,'B');trigger(f,'P');playing(f,'P');trigger(f,'B')
  f.evaluate("testPlays[0].reject(new DOMException('old run','AbortError'))")
  page.wait_for_timeout(120);assert f.locator('#dragonVideo').get_attribute('src')==SRC['B']
  f.evaluate("DragonFx.fadeOut();testPlays[1].reject(new DOMException('closed run','AbortError'))")
  closed(f);record('stale play rejection cannot clear newer media or revive a dismissed run')
  unchanged(f);c.close()
  c,page,f,requests=opened(b,harness=True)
  f.evaluate("state.rounds=Array.from({length:getDragonThreshold()},()=>({r:'P'}));renderAll();addRound('T')")
  assert f.locator('#dragonCornerBadge').is_visible()
  page.wait_for_timeout(3200)
  assert not f.locator('#dragonOverlay').evaluate("e=>e.classList.contains('active')")
  assert f.evaluate('computeDragonIdxs(state.rounds,getDragonThreshold()).dragonIdxs.size')==f.evaluate('getDragonThreshold()')
  f.evaluate("addRound('P')")
  page.wait_for_timeout(700)
  assert f.locator('#resultAnnouncement').is_visible()
  assert not f.locator('#dragonOverlay').evaluate("e=>e.classList.contains('active')")
  playing(f,'P');assert f.locator('#resultAnnouncement').is_hidden()
  record('threshold, ties and result-before-dragon sequencing preserved with real blue video')
  page.get_by_role('button',name='關閉特效').click();closed(f)
  page.get_by_role('button',name='重播',exact=True).click();playing(f,'P')
  page.get_by_role('button',name='莊長龍',exact=True).click();playing(f,'B')
  page.get_by_role('button',name='閒長龍',exact=True).click();playing(f,'P')
  page.get_by_role('button',name='關閉特效').click();closed(f)
  unchanged(f);record('localhost control page: both videos, replay, close; formal road key unchanged')
  c.close()
  assert not errors,errors
 finally:b.close()
 page_html=(ROOT/'tv.html').read_text(encoding='utf-8')
 style=page_html[page_html.index('<style>'):page_html.index('</style>')]
 stats=page_html[page_html.index('<ul class="stats-list">'):page_html.index('</ul>',page_html.index('<ul class="stats-list">'))]
 assert '--stat-fit-size' in style and '--stat-count-fit-size' in style
 cells=[part.split('</li>',1)[0] for part in stats.split('<li ')[1:]]
 tigers=[cell for cell in cells if '小老虎' in cell or '大老虎' in cell]
 assert len(tigers)==2 and all('幸運6' not in cell for cell in tigers), tigers
 sevens=[cell for cell in cells if 'tv-stat-seven' in cell]
 assert len(sevens)==5 and sum('超級' in cell for cell in sevens)==3 and all('tv-stat-mult' in cell and '幸運7' in cell for cell in sevens), sevens
 record('statistics markup and stat-font contract still present')
 report={'passed':True,'checks':checks,'runtimeErrors':errors,'sources':SRC,'preview':BASE+'/dragon-test.html'}
 (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
 print(json.dumps({'PASS':len(checks),'runtimeErrors':errors,'report':str(OUT/'report.json')},ensure_ascii=False))

