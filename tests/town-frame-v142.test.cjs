const {beforeAbandonedMine}=require('./mine-history-v165.cjs');
const {kitchenChestAddedV162}=require('./kitchen-chest-history.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {createHash}=require('node:crypto');
const html=fs.readFileSync(process.env.HTML||path.join(__dirname,'../world-editor.html'),'utf8');
const source=html.match(/const FACILITY_SITES[\s\S]*?(?=function facilityNavigate\()/)?.[0];
assert(source,'Game World authored builders');
const build=vm.runInNewContext(source+';buildFacilitySite');
const live=beforeAbandonedMine(JSON.parse(JSON.stringify(build('base'))));
const prior=Object.freeze({
 count:5206,
 world:'1b31991c89c33864aac594be48acd8ba1874107aab6137dbece9e390f0e37d56',
 metadata:'8f9a94327ddc5023da1d3b373180910e7bf2f3ee0ca1918a72d4ff6c016eae85',
 stackCount:4028, stacks:'a3ac8b61f8ecc2af121fac16b1c3dfc6d8f500a3baa9bf48fc3a9895d9bc9e9b'
});
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

function inverse(value){
 if(Array.isArray(value))return value.map(inverse);
 if(value===null||typeof value!=='object')return value;
 const coords=new Set(['x','z','x1','z1','x2','z2']);
 return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,coords.has(k)&&Number.isFinite(v)?v-12:inverse(v)]));
}
const tuple=o=>JSON.stringify([o.x,o.z,o.y,o.type,o.rot]);

const history=require('./town-frame-history.cjs');
test('the previous 108×68 frame preserves its complete +12, +12 translation from v141',()=>{
 // Independently pinned v144 original-record guard confirms no old cells
 // change as the public builder gains the new eastern/southern margin.
 const framed=require('./town-frame-v144-projection.cjs').originalFrame(live);
 framed.map.world=framed.map.world.filter(o=>!kitchenChestAddedV162(o,12));
 assert.equal(framed.townOffset,12);
 const {townOffset,map:{world,...map},...meta}=inverse(framed);
 map.size=96;map.width=96;map.height=56;
 assert.equal(digest({map,...meta}),prior.metadata,'all v141 metadata translated with no other edits');
 assert.equal(new Set(framed.map.world.map(tuple)).size,world.length,'no duplicate live rows');
 const marginSet=new Set(history.fixture.addedMargin.map(r=>JSON.stringify(r)));
 const liveRecords=new Set(framed.map.world.map(tuple));
 for(const row of history.fixture.addedMargin){
  assert(row[0]<12||row[1]<12||row[0]===12&&row[1]>=38&&row[1]<=40,'margin only');
  assert(liveRecords.has(JSON.stringify(row)),'new exterior margin: '+row);
 }
 const interior=framed.map.world.filter(o=>!marginSet.has(tuple(o))).map(inverse);
 const present=new Set(interior.map(tuple));
 for(const r of history.added)assert(present.has(r),'intentional approach/gate row '+r);
 for(const r of history.removed)assert(!present.has(r),'replaced wall row '+r);
 const restored=history.prior(interior).sort();
 assert.equal(restored.length,prior.count);
 assert.equal(digest(restored),prior.world,'all non-enumerated v141 rows survive');
 const groupKey=o=>JSON.stringify([o.x,o.z,o.y]);
 const gateCells=new Set(history.fixture.remove.map(row=>JSON.stringify(row.slice(0,3))));
 const groups=Object.groupBy(interior.filter(o=>!history.added.has(tuple(o))),groupKey);
 const stacks=Object.keys(groups).filter(k=>!gateCells.has(k)).sort().map(k=>[k,groups[k].map(o=>[o.type,o.rot])]);
 assert.equal(stacks.length,prior.stackCount);
 assert.equal(digest(stacks),prior.stacks,'same-cell drawing/selection order survives, including all historic bridges');
});
