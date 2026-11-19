from playwright.sync_api import sync_playwright
from PIL import Image, ImageChops
B='http://localhost:8799/百家樂路單/'
with sync_playwright() as p:
  br=p.chromium.launch()
  for i,u in enumerate(['tv-orig.html','tv-orig.html','tv.html']):
    pg=br.new_context(viewport={'width':1704,'height':943}).new_page();pg.add_init_script("localStorage.setItem('tv_skin_v1','red')");pg.goto(B+u,wait_until='networkidle');pg.evaluate('async()=>{await document.fonts.ready}');pg.wait_for_timeout(1500);pg.screenshot(path=f'verify-green/r3/_t{i}.png')
    print(u,pg.evaluate("(()=>{const c=getComputedStyle(document.getElementById('tvEditToggle'));return c.boxShadow+'|'+c.borderColor+'|'+c.right+'|'+c.top+'|'+c.transition})()"))
  br.close()
im=[Image.open(f'verify-green/r3/_t{i}.png').convert('RGB') for i in range(3)]
print('orig-vs-orig',ImageChops.difference(im[0],im[1]).getbbox())
d=ImageChops.difference(im[0],im[2]);print('orig-vs-new',d.getbbox());c=d.crop((1600,0,1704,60));print([ (x+1600,y,im[0].getpixel((x+1600,y)),im[2].getpixel((x+1600,y))) for x in range(104) for y in range(60) if c.getpixel((x,y))!=(0,0,0)][:8])
