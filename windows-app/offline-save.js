(() => {
  window.prompt = (message, initial) => window.OfflineRoadmap.prompt(message, initial);
  let busy = false, pending = null;
  const el = id => document.getElementById(id);
  // 雲端備份開關存在電視設定裡（基本設定 → 儲存時上傳雲端），預設關閉。
  function cloudEnabled() {
    try { return JSON.parse(localStorage.getItem('baccarat_tv_settings_v1') || '{}').cloudBackup === true; } catch (_) { return false; }
  }
  const messages = {
    rate_limit: '收件暫時繁忙，請稍後再試。', daily_size_limit: '今天收件容量已滿。', busy: '收件服務忙碌，請稍後重試。',
    invalid_png: 'PNG 格式或尺寸不符合收件限制。', invalid_rounds: '路單局數超出收件限制（最多1000局）。',
    invalid_schema: '路單格式不符合收件要求。', invalid_counts: '路單統計與內容不一致。', json_too_large: 'JSON 超出收件大小限制。',
    receipt_conflict: '提交識別碼衝突，未覆寫既有備份。', submission_incomplete: '上次收件未完成。', storage_unavailable: '雲端收件未完成，請稍後再試。',
    onedrive_not_configured: 'OneDrive 收件尚未啟用，請通知業主。', onedrive_authorization_required: 'OneDrive 授權已失效，請通知業主重新授權。',
    folder_not_private: '收件資料夾的私人設定已改變，為保護資料已停止上傳；請通知業主。'
  };
  const receipt = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
  async function base64(blob) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let out = '';
    for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(out);
  }
  // 上傳由主程式代送（畫面本身仍不連網）；逾時時用同一個收件碼查核，不會重送第二份。
  async function upload(item) {
    let response;
    try { response = await window.OfflineRoadmap.cloud(item.request); }
    catch (_) {
      try {
        const check = await window.OfflineRoadmap.cloudStatus(item.request.receipt);
        if (check?.success && check.receipt === item.request.receipt && check.state === 'complete') return;
        if (check?.state === 'failed') throw Error('雲端收件失敗。');
      } catch (_) {}
      throw Error('尚無法確認雲端是否收齊（請檢查網路），可按重試。');
    }
    if (response?.success && response.receipt === item.request.receipt && response.state === 'complete') return;
    throw Error(messages[response?.error] || '雲端尚未確認兩個檔案均已儲存。');
  }
  async function sendCloud(item) {
    const status = el('backupStatus');
    status.textContent = item.local + ' 正在上傳雲端…';
    try {
      await upload(item);
      pending = null; el('backupRetryBtn').hidden = true;
      status.textContent = item.local + ' 雲端已收齊。';
    } catch (error) {
      pending = item; el('backupRetryBtn').hidden = false;
      status.textContent = item.local + ' 雲端上傳未完成：' + error.message;
    }
  }
  window.RoadBackup = {
    get busy() { return busy; },
    async save(entry) {
      if (busy) return { ok: false };
      busy = true; pending = null;
      const notice = el('backupNotice');
      const status = el('backupStatus');
      el('backupRetryBtn').hidden = true;
      notice.hidden = false;
      status.textContent = '正在儲存路單紀錄…';
      try {
        const saveFolder = (function() {
          try {
            const s = JSON.parse(localStorage.getItem('baccarat_tv_settings_v1') || '{}');
            return (typeof s.customSavePath === 'string' && s.customSavePath.trim()) ? s.customSavePath.trim() : '';
          } catch (_) { return ''; }
        })();
        const result = await window.OfflineRoadmap.save({
          name: entry.name,
          json: JSON.stringify(entry, null, 2),
          folder: saveFolder
        });
        const local = '已儲存 JSON：' + result.folder + '。';
        status.textContent = local;
        if (cloudEnabled()) {
          const image = await window.BaccaratTVExport.png(entry);
          if (image.blob.size > 6291456) status.textContent = local + ' 圖片超過 6MB，未上傳雲端。';
          else await sendCloud({ local, request: { receipt: receipt(), roadmap: JSON.parse(JSON.stringify(entry)), pngBase64: await base64(image.blob) } });
        }
        return { ok: true, ...result };
      } catch (error) {
        status.textContent = '儲存未完成：' + error.message + '。路單仍保留在本機清單。';
        return { ok: false, error: error.message };
      } finally { busy = false; }
    },
    async retry() {
      if (busy || !pending) return;
      busy = true;
      try { await sendCloud(pending); } finally { busy = false; }
    }
  };
  document.addEventListener('DOMContentLoaded', () => {
    el('backupRetryBtn').hidden = true;
    el('backupRetryBtn').addEventListener('click', () => window.RoadBackup.retry());
    el('backupCloseBtn').addEventListener('click', () => { el('backupNotice').hidden = true; });
  });
})();
