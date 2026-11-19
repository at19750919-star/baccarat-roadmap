from playwright.sync_api import sync_playwright
with sync_playwright() as p:
  b=p.chromium.launch();pg=b.new_page(viewport={'width':2560,'height':1440})
  pg.goto('http://localhost:8799/百家樂路單/tv.html',wait_until='networkidle');pg.wait_for_timeout(1200)
  r=pg.evaluate("""()=>{const out=[];const rx=/rgb\\((\\d+), (\\d+), (\\d+)/;document.querySelectorAll('body *').forEach(e=>{const r=e.getBoundingClientRect();if(r.width<50||r.height<20)return;const c=getComputedStyle(e);const s=c.backgroundColor+' '+c.backgroundImage;const m=[...s.matchAll(/rgba?\\((\\d+), (\\d+), (\\d+)/g)];if(m.some(x=>+x[1]>70&&+x[2]<50&&+x[3]<50)||/(89|90|100|122), (11|13)/.test(s))out.push([e.tagName,e.id,(e.className+'').slice(0,45),Math.round(r.width)+'x'+Math.round(r.height),s.slice(0,110),c.borderTopColor,c.borderRadius])});return out}""")
  for x in r: print(x)
  print('html',pg.evaluate("()=>[getComputedStyle(document.documentElement).backgroundColor,getComputedStyle(document.body).backgroundImage.slice(0,200),document.documentElement.dataset.theme]"))
  b.close()