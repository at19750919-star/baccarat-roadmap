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
    expect(page.locator('#saveBtn')).to_be_attached(timeout=3000)  # button is hidden in TV; shortcut 8 clicks it
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
    page.evaluate("document.getElementById('saveBtn').click()")
    expect(page.locator('#tvSaveModalInput')).to_be_visible(timeout=3000)
    page.locator('#tvSaveModalInput').fill('TV-儲存驗證-20261029' if os.environ.get('TV_REAL_CLOUD') else 'TV-save-test')
    page.locator('#tvSaveConfirmBtn').click()
    page.wait_for_function('RoadBackup.busy || document.getElementById("backupStatus").textContent',timeout=10000)
    page.wait_for_function('!RoadBackup.busy',timeout=120000)
    assert '已收齊' in page.locator('#backupStatus').text_content(), page.locator('#backupStatus').text_content()
    page.wait_for_timeout(500)
    assert len(downloads)==1 and downloads[0].suggested_filename.endswith('.json'), [d.suggested_filename for d in downloads]
    assert page.evaluate('exportChecks.length')==0, 'save must not generate PNG'
    assert page.locator('#backupPngLink').count()==0
    for d in downloads:d.save_as(OUT/d.suggested_filename)
    saved=json.loads((OUT/downloads[0].suggested_filename).read_text(encoding='utf-8'))
    assert len(saved['rounds'])==20 and saved['counts']['total']==20
    assert page.evaluate('state.rounds.length')==20
    if uploads:
        assert uploads[0]['roadmap']==saved
        assert 'pngBase64' not in uploads[0] and set(uploads[0])=={'action','receipt','roadmap'}, list(uploads[0])
        assert '已收齊 JSON' in page.locator('#backupStatus').text_content() and 'PNG' not in page.locator('#backupStatus').text_content()
    else:
        assert len(live_receipts)==1
        endpoint=page.evaluate('''async receipt=>{const script=await(await fetch('road_backup.js')).text();const endpoint=script.match(/const ENDPOINT='([^']+)'/)[1];return await(await fetch(endpoint+'?action=roadStatus&receipt='+receipt)).json();}''',live_receipts[0])
        assert endpoint['success'] and endpoint['state']=='complete' and endpoint['receipt']==live_receipts[0],endpoint
        (OUT/'real-receipt.json').write_text(json.dumps({'receipt':live_receipts[0],'status':endpoint,'name':saved['name']}),encoding='utf-8')
    print('PASS TV local JSON-only download, no PNG; '+('real backend confirmed' if os.environ.get('TV_REAL_CLOUD') else 'mock cloud payload is JSON-only and matches download'))
    # Auto-save on clear (silent) also downloads JSON only and uploads JSON only.
    before=len(downloads);n_up=len(uploads)
    if n_up:
        page.evaluate("executeSaveRoadmap('TV-auto-clear-test',{silent:true})")
        page.wait_for_function('!RoadBackup.busy',timeout=60000);page.wait_for_timeout(500)
        assert [d.suggested_filename for d in downloads[before:]]==['TV-auto-clear-test.json'],[d.suggested_filename for d in downloads]
        assert len(uploads)==n_up+1 and 'pngBase64' not in uploads[-1]
        print('PASS silent clear auto-save downloads JSON only, no PNG')
    # PNG renderer is retained for other features (not used by save); still verify it on long history.
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
        expect(page.locator('#backupJsonLink')).to_be_visible()
        expect(page.locator('#backupRetryBtn')).to_be_visible()
        assert '已收齊' not in page.locator('#backupStatus').text_content()
        page.unroute('https://script.google.com/**');page.route('https://script.google.com/**',receive)
        page.locator('#backupRetryBtn').click();page.wait_for_function('!RoadBackup.busy')
        assert uploads[-1]==failed[0]
        expect(page.locator('#backupRetryBtn')).not_to_be_visible()
        print('PASS upload failure preserves JSON; retry uses identical payload and receipt')
    assert not errors,errors
    browser.close()
