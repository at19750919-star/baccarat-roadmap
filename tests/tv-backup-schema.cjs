const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=process.env.ROAD_SCHEMA_SOURCE||'backend/road_entry.gs';
const ctx={ROAD_LIMIT:{rounds:1000,json:262144},roadFail_:code=>{throw Error(code)},
  roadKeys_:(o,keys)=>{if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).sort().join('|')!==[...keys].sort().join('|'))throw Error('invalid_schema')},
  Utilities:{newBlob:s=>({getBytes:()=>Buffer.from(s)})}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(source,'utf8'),ctx);
const make=rounds=>({id:'road-tv-schema-test',name:'TV 完整資料',createdAt:'2026-10-29T00:00:00.000Z',
  rounds,counts:{banker:rounds.filter(r=>r.r==='B').length,player:rounds.filter(r=>r.r==='P').length,tie:rounds.filter(r=>r.r==='T').length,total:rounds.length},
  outcomes:rounds.map(r=>({B:'莊',P:'閒',T:'和'})[r.r]),nonTieOutcomes:rounds.filter(r=>r.r!=='T').map(r=>({B:'莊',P:'閒'})[r.r])});
const base={r:'B',bp:false,pp:false,l6:false};
const old=make([base,{...base,r:'P'},{...base,r:'T'}]);
assert.deepEqual(JSON.parse(ctx.roadEntry_(old)),old);
const tv=make([{...base,r:'P',l7:2,s7:null,tiger:null},{...base,r:'P',l7:3,s7:null,tiger:null},
  ...[4,5,6].map(s7=>({...base,r:'P',l7:null,s7,tiger:null})),
  ...['small','big'].map(tiger=>({...base,l6:true,l7:null,s7:null,tiger}))]);
assert.deepEqual(JSON.parse(ctx.roadEntry_(tv)),tv,'TV fields must be preserved exactly');
for(const extra of [{l7:4},{l7:'2'},{s7:3},{s7:'5'},{tiger:'other'},{tiger:123},{surprise:'x'},{bp:1}]){
  assert.throws(()=>ctx.roadEntry_(make([{...base,...extra}])));
}
const bad=structuredClone(tv);bad.counts.total++;
assert.throws(()=>ctx.roadEntry_(bad));
assert.throws(()=>ctx.roadEntry_(make([])));
console.log('PASS legacy and TV JSON schemas: preserves seven/tiger fields, rejects unknown/invalid types and inconsistent counts');
