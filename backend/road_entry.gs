// TV-compatible validator used by the existing Apps Script receiver.
// Replace its roadEntry_ function with this file's functions; do not change tokens.
function roadRound_(r) {
  const required = ['r', 'bp', 'pp', 'l6'], optional = ['l7', 's7', 'tiger'];
  if (!r || typeof r !== 'object' || Array.isArray(r) ||
      required.some(k => !Object.prototype.hasOwnProperty.call(r, k)) ||
      Object.keys(r).some(k => !required.includes(k) && !optional.includes(k))) roadFail_('invalid_schema');
  if (!['B', 'P', 'T'].includes(r.r) || ['bp', 'pp', 'l6'].some(k => typeof r[k] !== 'boolean') ||
      (r.l7 != null && ![2, 3].includes(r.l7)) ||
      (r.s7 != null && ![4, 5, 6].includes(r.s7)) ||
      (r.tiger != null && !['small', 'big'].includes(r.tiger))) roadFail_('invalid_rounds');
}
function roadEntry_(o) {
  roadKeys_(o, ['id', 'name', 'createdAt', 'counts', 'outcomes', 'nonTieOutcomes', 'rounds']);
  if (typeof o.id !== 'string' || o.id.length > 128 || !/^road-[a-zA-Z0-9-]+$/.test(o.id) ||
      typeof o.name !== 'string' || !o.name.trim() || o.name.length > 100 || /[\x00-\x1f]/.test(o.name) ||
      typeof o.createdAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(o.createdAt) ||
      !Number.isFinite(Date.parse(o.createdAt))) roadFail_('invalid_schema');
  if (!Array.isArray(o.rounds) || !o.rounds.length || o.rounds.length > ROAD_LIMIT.rounds) roadFail_('invalid_rounds');
  const c = {banker: 0, player: 0, tie: 0, total: o.rounds.length}, out = [], non = [];
  o.rounds.forEach(r => {
    roadRound_(r);
    const s = r.r === 'B' ? '莊' : r.r === 'P' ? '閒' : '和';
    c[r.r === 'B' ? 'banker' : r.r === 'P' ? 'player' : 'tie']++; out.push(s);
    if (r.r !== 'T') non.push(s);
  });
  roadKeys_(o.counts, ['banker', 'player', 'tie', 'total']);
  if (Object.keys(c).some(k => o.counts[k] !== c[k]) || JSON.stringify(out) !== JSON.stringify(o.outcomes) ||
      JSON.stringify(non) !== JSON.stringify(o.nonTieOutcomes)) roadFail_('invalid_counts');
  const json = JSON.stringify(o, null, 2);
  if (Utilities.newBlob(json).getBytes().length > ROAD_LIMIT.json) roadFail_('json_too_large');
  return json;
}
