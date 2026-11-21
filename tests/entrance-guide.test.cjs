const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const extract=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i+1);assert(i>=0&&j>i,'missing '+a);return html.slice(i,j)};
const ids=['base','lodging','kitchen','workshop','artisan','stable','toolshop','homes'];
const build=vm.runInNewContext(extract('const FACILITY_SITES=','function workshopResumeDecode(')+';buildFacilitySite');
test('stable doorstep has a single gravel threshold on the retained earth approach',()=>{
 for(const [id,x,z] of [['base',32,64],['stable',10,12]]){
  const {map}=build(id);const at=(x,z)=>map.world.filter(o=>o.x===x&&o.z===z&&o.y===0).map(o=>o.type);
  assert.deepEqual(Array.from(at(x,z)),['roadGravelFull']);
  assert.deepEqual(Array.from(at(x,z+1)),['earth']);
  assert.deepEqual(Array.from(at(x+1,z)),['earth']); // secondary/loading entrance unchanged
 }
});
test('only true authored main doors under a live approved roof have a guide',()=>{
 const isRoof=o=>/^roof/.test(o.type)&&o.y>0;
 const read=vm.runInNewContext(extract('function facilityCollectEntranceGuides(','function facilityDrawEntranceGuides(')+';facilityCollectEntranceGuides',
  {facilityIsRoofPiece:isRoof,rot2:(x,z,r)=>[[x,z],[-z,x],[-x,-z],[z,-x]][r]});
 for(const id of ids){
  const b=build(id),actual=JSON.parse(JSON.stringify(read(b,b.map.world)));
  assert.equal(actual.length,b.buildings.length,id);
  for(const guide of actual){
   const target=b.buildings[guide.owner];
   assert.equal(guide.id,target.id); assert.equal(Math.abs(guide.x-target.entrance.x)+Math.abs(guide.z-target.entrance.z),1);
   assert(!b.buildings.some(o=>o.footprint.some(p=>p.x===guide.x&&p.z===guide.z)));
  }
  const {x,z}=b.buildings[0].entrance;
  const off=(o)=>o.x!==x||o.z!==z||!isRoof(o);
  assert.equal(read(b,b.map.world.filter(off)).length,actual.length-1);
  assert.equal(read(b,b.map.world.filter(o=>o.x!==x||o.z!==z||!o.type.endsWith('Door'))).length,actual.length-1);
  assert.equal(read({...b,id:'guildsaved'},b.map.world).length,0);
 }
});
