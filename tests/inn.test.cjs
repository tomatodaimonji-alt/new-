const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{test}=require('node:test');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const source=html.match(/const FACILITY_SITES[\s\S]*?(?=function facilityNavigate\()/)?.[0];
assert(source,'authored facility script not found');
const build=vm.runInNewContext(source+'\n;buildFacilitySite');
const dirs=[[0,1],[-1,0],[0,-1],[1,0]],slot=(x,z)=>x+','+z;
const wall=o=>/(?:wood|stone|plaster|moss)wall(?:Door|Window)?$/.test(o.type);
const door=o=>/(?:wood|stone|plaster|moss)wallDoor$/.test(o.type);
const floor=o=>/^(woodfloor(?:Dark|Light)?|stone|brickfloor)$/.test(o.type);
function inn(scope){
 const s=build(scope),b=s.buildings[0],x0=b.x1,z0=b.z1;
 const map=s.map.world.filter(o=>o.x>=b.x1&&o.x<=b.x2&&o.z>=b.z1&&o.z<=b.z2)
  .map(o=>({...o,x:o.x-x0,z:o.z-z0}));
 const at=(x,z,y=0)=>map.filter(o=>o.x===x&&o.z===z&&o.y===y);
 const tiles=y=>Array.from(b.floorFootprints[y],o=>[o.x-x0,o.z-z0]);
 return {s,b,map,at,tiles};
}
function flood(tiles,start,block){
 const cells=new Set(tiles.map(([x,z])=>slot(x,z)));
 const queue=[start],hit=new Set([slot(...start)]);
 for(let i=0;i<queue.length;i++)for(const [dx,dz] of dirs){
  const x=queue[i][0]+dx,z=queue[i][1]+dz,k=slot(x,z);
  if(cells.has(k)&&!hit.has(k)&&!block(x,z)){hit.add(k);queue.push([x,z]);}
 }
 return hit;
}
test('larger upper footprint covers every lower tile except the single matched stair shaft',()=>{
 for(const scope of ['lodging','base']){
  const {tiles,at,map,b}=inn(scope);
  assert.ok(tiles(0).length>100);
  assert.deepEqual(tiles(0).map(c=>slot(...c)).sort(),tiles(1).map(c=>slot(...c)).sort());
  const holes=tiles(1).filter(p=>!at(...p,1).some(floor));
  assert.equal(holes.length,1);
  const [p]=holes;
  assert.ok(at(...p,0).some(o=>o.type==='guildStairUp')&&at(...p,1).some(o=>o.type==='guildStairDown'));
  assert.equal(map.filter(o=>o.y===1&&o.type==='guildStairDown').length,1);
  assert.equal(b.z2,scope==='base'?33:13);
 }
});
test('every upstairs bedroom is a separate four-plus-tile room with exactly one real door to an enclosed common hall',()=>{
 for(const scope of ['lodging','base']){
  const {tiles,at,map}=inn(scope);
  const bedrooms=map.filter(o=>o.y===1&&o.type==='bed');
  assert.ok(bedrooms.length>=3);
  const hall=flood(tiles(1),[5,5],(x,z)=>at(x,z,1).some(wall));
  assert.ok(hall.has(slot(10,6)));
  const footprints=new Set();
  for(const bed of bedrooms){
   const area=flood(tiles(1),[bed.x,bed.z],(x,z)=>at(x,z,1).some(wall));
   assert.ok(area.size>=4&&!area.has(slot(5,5)));
   footprints.add(Array.from(area).sort().join(';'));
   const entrances=map.filter(o=>o.y===1&&door(o)&&dirs.some(([dx,dz])=>area.has(slot(o.x+dx,o.z+dz)))
    &&dirs.some(([dx,dz])=>hall.has(slot(o.x+dx,o.z+dz))));
   assert.equal(entrances.length,1,'bedroom needs one distinct entry from the hall');
  }
  assert.equal(footprints.size,bedrooms.length);
 }
});
test('reception contains a clerk chair and ledger, with owner room, private water room and separate rear exit',()=>{
 for(const scope of ['lodging','base']){
  const {s,b,tiles,at,map}=inn(scope);
  const has=(x,z,t)=>at(x,z).some(o=>o.type===t);
  assert.ok(has(4,8,'counterWood')&&has(4,8,'poiLedgerPapers')&&has(4,7,'chairWood'));
  assert.ok(has(5,4,'woodwallDoor')&&has(6,2,'woodwallDoor')&&has(5,0,'plasterwallDoor'));
  assert.ok(s.map.world.some(o=>o.x===b.x1+5&&o.z===b.z1-1&&o.y===0&&o.type.startsWith('road')));
  const room=(x,z)=>flood(tiles(0),[x,z],(a,b)=>at(a,b).some(wall));
  const owner=room(5,2),water=room(7,2),front=room(5,6);
  assert.ok(owner.size>=4&&water.size>=4&&front.size>=4);
  assert.ok(!owner.has(slot(7,2))&&!owner.has(slot(5,6))&&!water.has(slot(5,6)));
  assert.ok(has(3,2,'bed')&&has(4,1,'wardrobe')&&has(4,3,'table'));
  assert.ok(has(8,1,'kitchenSink')&&has(8,3,'bathWood'));
  const physical=flood(tiles(0),[5,9],(x,z)=>at(x,z).some(o=>wall(o)&&!door(o)||!wall(o)&&!floor(o)&&!['guildStairUp','chairWood','benchWood','poiInnSign'].includes(o.type)));
  for(const p of [[5,7],[5,4],[5,2],[6,2],[7,2],[5,0],[10,6],[2,7]])assert.ok(physical.has(slot(...p)),'must walk to '+p);
  for(const o of map.filter(o=>o.type==='bookshelf')){
   assert.ok(![[0,0],...dirs].some(([dx,dz])=>at(o.x+dx,o.z+dz,o.y).some(p=>/wallWindow$/.test(p.type))));
  }
 }
});
test('expanded inn keeps all floors and walls connected without diagonal-only seams',()=>{
 for(const scope of ['lodging','base']){
  const {at,b}=inn(scope);
  for(let y=0;y<=1;y++)for(let x=0;x<b.x2-b.x1;x++)for(let z=0;z<b.z2-b.z1;z++){
   const [a,b,c,d]=[[x,z],[x+1,z],[x,z+1],[x+1,z+1]].map(p=>at(...p,y).some(wall));
   assert.ok(!((a&&d&&!b&&!c)||(b&&c&&!a&&!d)),scope+' '+x+','+z+','+y);
  }
 }
});
