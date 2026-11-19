from playwright.sync_api import sync_playwright
with sync_playwright() as p:
  b=p.chromium.launch();pg=b.new_page(viewport={'width':1704,'height':943})
  pg.add_init_script("localStorage.setItem('tv_skin_v1','green')")
  pg.goto('http://localhost:8799/百家樂路單/tv.html',wait_until='networkidle');pg.wait_for_timeout(1000)
  print(pg.evaluate("""()=>{const o=[];document.querySelectorAll('.tv-stats li, .tv-stats .tv-stat-head *, .tv-board-val, .tv-board-label, .tv-limit-name, .tv-limit-key, .limit-input, .tv-next-title, .panel-title, .road-title, .tv-road-label, .tv-logo').forEach(e=>{const c=getComputedStyle(e);o.push(e.tagName+'.'+e.className+'#'+e.id+' |'+c.fontFamily+'|'+c.fontWeight+'|'+c.color+' |'+(e.innerText||'').slice(0,12).replace(/\\n/g,'/'))});return o.join('\\n')}"""))
  print(pg.evaluate("""()=>[...document.querySelectorAll('.panel')].map(e=>e.className+'#'+e.id).join('\\n')"""))
  print(pg.evaluate("""()=>{const s=new Set();document.querySelectorAll('body *').forEach(e=>{if(e.getBoundingClientRect().width&&[...e.childNodes].some(n=>n.nodeType==3&&n.nodeValue.trim())){s.add(getComputedStyle(e).fontFamily+' / '+getComputedStyle(e).fontWeight+' <- '+e.className.toString().slice(0,30))}});return [...s].join('\\n')}"""))
  b.close()
