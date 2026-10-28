from pathlib import Path
from playwright.sync_api import sync_playwright, expect
import json, base64, os

ROOT = Path(__file__).resolve().parents[1]
URL = 'http://127.0.0.1:8082/roadmap/tv.html'
OUT = ROOT / '.preview' / 'tv-save'
OUT.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width':1920,'height':1080}, accept_downloads=True)
    errors=[]; downloads=[]; uploads=[]; live_receipts=[]
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('download', lambda d: downloads.append(d))
    page.on('request', lambda r: live_receipts.append(r.post_data_json['receipt']) if r.url.startswith('https://script.google.com/') and r.method=='POST' else None)
    page.route('https://fonts.googleapis.com/**', lambda r:r.fulfill(body=''))
    page.route('https://fonts.gstatic.com/**', lambda r:r.abort())
    page.route('https://cdn.jsdelivr.net/npm/html2canvas@*/dist/html2canvas.min.js', lambda r:r.fulfill(path=str(ROOT/'.preview/html2canvas.min.js'), content_type='text/javascript'))
    def receive(route):
        pack=route.request.post_data_json; uploads.append(pack)
        route.fulfill(json={'success':True,'receipt':pack['receipt'],'state':'complete','provider':'onedrive'})
    if not os.environ.get('TV_REAL_CLOUD'):
        page.route('https://script.google.com/**', receive)
    page.goto(URL, wait_until='domcontentloaded')
    expect(page.locator('#saveBtn')).to_be_visible(timeout=3000)
    page.evaluate('''() => {
      speech.enabled=false;
      state.rounds=Array.from({length:20},(_,i)=>({r:i%7===0?'T':i%2?'P':'B',bp:i%4===0,pp:i%5===0,l6:i===2||i===4,l7:i===1?2:i===3?3:0,s7:i===5?4:i===11?5:i===9?6:0,tiger:i===2?'small':i===4?'big':''}));
      renderAll();window.exportChecks=[];
      const original=html2canvas;
      window.html2canvas=async(view,options)=>{
        const roads=[...view.querySelectorAll('.grid-board')];
        exportChecks.push({width:view.offsetWidth,height:view.offsetHeight,beads:view.querySelectorAll('.bead').length,
          stars:view.querySelectorAll('.tv-star-mark').length,starRows:getComputedStyle(view.querySelector('[data-export-id="starRoad"]')).gridTemplateRows.split(' ').length,
          panels:roads.map(n=>({name:n.dataset.label,width:n.getBoundingClientRect().width,parent:n.parentElement.getBoundingClientRect().width})),
          total:view.querySelector('[data-export-id="totalCount"]').textContent,
          small:view.querySelector('[data-export-id="cntST"]').textContent,big:view.querySelector('[data-export-id="cntBT"]').textContent,
          super5:view.querySelector('[data-export-id="cntS75"]').textContent,
          controls:view.querySelectorAll('#saveBtn,.tv-save-btn,.result-announcement,.dragon-overlay').length,
          ids:view.querySelectorAll('[id]').length});
        return original(view,options);
      };
    }''')
    page.on('dialog', lambda d:d.accept('TV-儲存驗證-20261029' if os.environ.get('TV_REAL_CLOUD') else 'TV-save-test'))
    page.locator('#saveBtn').click()
    page.wait_for_function('!RoadBackup.busy',timeout=120000)
    assert '已收齊' in page.locator('#backupStatus').inner_text(), page.locator('#backupStatus').inner_text()
    assert len(downloads)==2, [d.suggested_filename for d in downloads]
    for d in downloads:d.save_as(OUT/d.suggested_filename)
    saved=json.loads((OUT/next(d.suggested_filename for d in downloads if d.suggested_filename.endswith('.json'))).read_text(encoding='utf-8'))
    assert len(saved['rounds'])==20 and saved['counts']['total']==20
    first=page.evaluate('exportChecks[0]')
    assert first['beads']==20 and first['stars']==17 and first['starRows']==3,first
    assert first['small']==first['big']==first['super5']=='1',first
    assert first['ids']==first['controls']==0,first
    assert len(first['panels'])==6 and all(x['width']<=x['parent']+1 for x in first['panels']),first
    assert page.evaluate('state.rounds.length')==20
    if uploads:
        assert uploads[0]['roadmap']==saved
        png=next(d for d in downloads if d.suggested_filename.endswith('.png'))
        assert (OUT/png.suggested_filename).read_bytes()==base64.b64decode(uploads[0]['pngBase64'])
    else:
        assert len(live_receipts)==1
        endpoint=page.evaluate('''async receipt=>{const script=await(await fetch('road_backup.js')).text();const endpoint=script.match(/const ENDPOINT='([^']+)'/)[1];return await(await fetch(endpoint+'?action=roadStatus&receipt='+receipt)).json();}''',live_receipts[0])
        assert endpoint['success'] and endpoint['state']=='complete' and endpoint['receipt']==live_receipts[0],endpoint
        (OUT/'real-receipt.json').write_text(json.dumps({'receipt':live_receipts[0],'status':endpoint,'name':saved['name']}),encoding='utf-8')
    print('PASS TV local JSON + real PNG downloads; '+('real backend confirmed both files' if os.environ.get('TV_REAL_CLOUD') else 'mock cloud payload matches downloads'))
    # Full-history PNG and immutable snapshot while live rounds change.
    for count in [184]:
        result=page.evaluate('''async count=>{
          state.rounds=Array.from({length:count},(_,i)=>({r:i%13===0?'T':i%2?'P':'B',bp:i%9===0,pp:i%11===0,l6:false}));renderAll();
          const entry={rounds:JSON.parse(JSON.stringify(state.rounds))};
          const job=RoadBackup.png(entry);addRound('P');const image=await job;
          return {check:exportChecks.at(-1),width:image.width,height:image.height,bytes:image.blob.size,live:state.rounds.length};
        }''',count)
        assert result['check']['beads']==count and result['check']['stars']==169 and result['live']==count+1,result
        assert all(x['width']<=x['parent']+1 for x in result['check']['panels']),result
        assert result['width']<=12000 and result['width']*result['height']<=24000000 and result['bytes']<=6291456,result
        print('PASS TV long-history export '+json.dumps(result,ensure_ascii=False))
    assert page.locator('.road-export-host').count()==0
    if not os.environ.get('TV_REAL_CLOUD'):
        # A failed upload preserves both downloads and retries the exact same receipt.
        failed=[]
        page.unroute('https://script.google.com/**')
        def reject_upload(route):
            pack=route.request.post_data_json;failed.append(pack)
            route.fulfill(json={'success':False,'receipt':pack['receipt'],'error':'storage_unavailable','state':'failed'})
        page.route('https://script.google.com/**',reject_upload)
        result=page.evaluate('''async()=>{const rounds=state.rounds.slice(0,6);return (await RoadBackup.save({name:'TV-failure-test',rounds})).ok;}''')
        assert not result
        expect(page.locator('#backupPngLink')).to_be_visible()
        expect(page.locator('#backupJsonLink')).to_be_visible()
        expect(page.locator('#backupRetryBtn')).to_be_visible()
        assert '已收齊' not in page.locator('#backupStatus').inner_text()
        page.unroute('https://script.google.com/**');page.route('https://script.google.com/**',receive)
        page.locator('#backupRetryBtn').click();page.wait_for_function('!RoadBackup.busy')
        assert uploads[-1]==failed[0]
        expect(page.locator('#backupRetryBtn')).not_to_be_visible()
        print('PASS upload failure preserves JSON/PNG; retry uses identical payload and receipt')
    assert not errors,errors
    browser.close()
