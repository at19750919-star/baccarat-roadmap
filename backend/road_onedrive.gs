// Owner credentials live only in Script Properties, never in client responses.
function roadOneDriveOwnerCheck() {
  const config = roadOneDriveConfig_();
  roadOneDrivePrivate_(roadOneDriveToken_(config), config);
  console.log('OneDrive owner authorization and private inbox verified.');
}

function roadOneDriveConfig_() {
  const raw = PropertiesService.getScriptProperties().getProperty(ROAD_KEY + 'onedrive_config');
  if (!raw) roadFail_('onedrive_not_configured');
  const config = JSON.parse(raw);
  if (!config.clientId || !config.clientSecret || !config.refreshToken || !config.rootId) roadFail_('onedrive_not_configured');
  return config;
}

function roadOneDriveToken_(config) {
  // Broader access is opt-in only after owner consent; legacy app-folder configs remain valid.
  const requestedScope=config.scope || 'Files.ReadWrite.AppFolder';
  if (!['Files.ReadWrite.AppFolder','Files.ReadWrite'].includes(requestedScope)) roadFail_('onedrive_not_configured');
  const response = UrlFetchApp.fetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/token', {
    method: 'post', muteHttpExceptions: true, followRedirects: false,
    payload: {client_id: config.clientId, client_secret: config.clientSecret,
      refresh_token: config.refreshToken, grant_type: 'refresh_token',
      scope: requestedScope + ' offline_access'}
  });
  if (response.getResponseCode() !== 200) roadFail_('onedrive_authorization_required');
  const token = JSON.parse(response.getContentText());
  const scopes = String(token.scope || '').toLowerCase().split(' ');
  const requiredScope=requestedScope.toLowerCase();
  const allowedFileScopes=requiredScope==='files.readwrite'?['files.readwrite','files.readwrite.appfolder']:['files.readwrite.appfolder'];
  if (!token.access_token || !scopes.includes(requiredScope) ||
      scopes.some(scope => /^files\./.test(scope) && !allowedFileScopes.includes(scope))) roadFail_('onedrive_authorization_required');
  if (token.refresh_token) {
    config.refreshToken = token.refresh_token;
    PropertiesService.getScriptProperties().setProperty(ROAD_KEY + 'onedrive_config', JSON.stringify(config));
  }
  return token.access_token;
}

function roadOneDriveRequest_(token, path, method, payload, contentType) {
  const options = {method: method || 'get', muteHttpExceptions: true,
    followRedirects: false, headers: {Authorization: 'Bearer ' + token}};
  if (payload !== undefined) { options.payload = payload; options.contentType = contentType || 'application/json'; }
  const response = UrlFetchApp.fetch('https://graph.microsoft.com/v1.0/me/drive' + path, options);
  const code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    // Do not log tokens, file content, signed download URLs, or Graph responses.
    console.error('OneDrive receiver HTTP ' + code);
    let reason = 'unknown';
    try { const parsed = JSON.parse(response.getContentText()); const value = parsed.error && parsed.error.code;
      if (typeof value === 'string' && /^[A-Za-z0-9_.-]{1,80}$/.test(value)) reason = value;
    } catch (_) {}
    const error = new Error('ROAD:' + (code === 401 ? 'onedrive_authorization_required' : code === 429 ? 'rate_limit' : 'storage_unavailable'));
    error.roadDiagnostic = {http: code, reason: reason, stage: method === 'put' ? 'upload' : method === 'post' ? 'create_folder' : method === 'delete' ? 'cleanup' : 'permissions'};
    throw error;
  }
  const text = response.getContentText();
  return text ? JSON.parse(text) : null;
}

function roadOneDrivePrivate_(token, config) {
  const result = roadOneDriveRequest_(token, '/items/' + encodeURIComponent(config.rootId) + '/permissions');
  if (!Array.isArray(result.value) || !result.value.length) roadFail_('folder_not_private');
  for (const permission of result.value) {
    if (permission.invitation || permission.link && permission.link.scope) roadFail_('folder_not_private');
    if (permission.roles && permission.roles.includes('owner')) continue;
    const user = permission.grantedTo && permission.grantedTo.user;
    const app = user && user.id === '00000000-0000-0000-0000-000000000000' &&
      String(user.displayName || '').toLowerCase().startsWith('i:0i.t|ms.sp.ext|' + config.clientId.toLowerCase() + '@');
    if (!app || !permission.roles || permission.roles.join(',') !== 'write') roadFail_('folder_not_private');
  }
}

// A folder-create 404 has occurred while this private parent still exists.
// Keep one name across attempts, reconcile an unknown outcome, and fail closed
// if the parent is missing or the service keeps failing. Never use "rename".
function roadOneDriveCreateFolder_(token, config, receipt) {
  const parentPath='/items/'+encodeURIComponent(config.rootId);
  const name=new Date().toISOString().replace(/[:.]/g,'-')+'_'+receipt;
  const payload=JSON.stringify({name:name,folder:{},'@microsoft.graph.conflictBehavior':'fail'});
  for(let attempt=0;attempt<3;attempt++) {
    try {return roadOneDriveRequest_(token,parentPath+'/children','post',payload);}
    catch(error) {
      const d=error.roadDiagnostic;
      if(!d || d.http!==404 || d.reason!=='itemNotFound') throw error;
      d.attempts=attempt+1;
      const parent=roadOneDriveRequest_(token,parentPath);
      if(!parent || parent.id!==config.rootId || !parent.folder) throw error;
      let existing;
      try {existing=roadOneDriveRequest_(token,parentPath+':/'+encodeURIComponent(name));}
      catch(lookupError) {
        const ld=lookupError.roadDiagnostic;
        if(!ld || ld.http!==404 || ld.reason!=='itemNotFound') throw lookupError;
      }
      if(existing) {
        if(!existing.id || existing.name!==name || !existing.folder || existing.folder.childCount!==0 ||
           !existing.parentReference || existing.parentReference.id!==config.rootId) throw error;
        console.log('OneDrive folder creation reconciled after 404.');return existing;
      }
      if(attempt===2) throw error;
      console.log('Retrying OneDrive folder creation after verified-parent 404.');
      Utilities.sleep(attempt===0?400:1200);
    }
  }
}

function roadOneDrivePair_(data, json, image) {
  const config = roadOneDriveConfig_(), token = roadOneDriveToken_(config);
  roadOneDrivePrivate_(token, config);
  let folder;
  try {
    folder = roadOneDriveCreateFolder_(token, config, data.receipt);
    if (!folder || !folder.id) roadFail_('storage_unavailable');
    let name = data.roadmap.name.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/[. ]+$/, '').slice(0, 100) || '路單';
    if (/^(CON|PRN|AUX|NUL|COM\d|LPT\d)(\.|$)/i.test(name) || name.startsWith('~')) name = '_' + name;
    const files = [{name: name + '.json', bytes: Utilities.newBlob(json).getBytes(), type: 'application/json'},
      {name: name + '.png', bytes: image, type: 'image/png'}];
    for (const file of files) {
      const stored = roadOneDriveRequest_(token, '/items/' + encodeURIComponent(folder.id) + ':/' + encodeURIComponent(file.name) + ':/content',
        'put', Utilities.newBlob(file.bytes, file.type, file.name), file.type);
      if (!stored || !stored.id || stored.size !== file.bytes.length || !stored.file) roadFail_('storage_unavailable');
      const sha1 = stored.file.hashes && stored.file.hashes.sha1Hash;
      if (sha1) {
        const expected = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_1, file.bytes).map(b => ('0' + (b & 255).toString(16)).slice(-2)).join('');
        if (sha1.toLowerCase() !== expected) roadFail_('storage_unavailable');
      }
    }
    // A complete receipt is written by the caller only after both uploads validate.
  } catch (error) {
    if (folder && folder.id) {
      try { roadOneDriveRequest_(token, '/items/' + encodeURIComponent(folder.id), 'delete'); }
      catch (_) { console.error('OneDrive partial submission retained for owner inspection'); }
    }
    throw error;
  }
}
