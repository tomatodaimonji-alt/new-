const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{runInNewContext}=require('node:vm');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const source=html.match(/const FACILITY_SITES[\s\S]*?(?=function facilityNavigate\()/)?.[0];
const sites=runInNewContext(source+';Object.fromEntries(FACILITY_SITES.map(s=>[s.id,buildFacilitySite(s.id)]))');
test('mix of rectangular and irregular ground floors with a latrine in each',()=>{
 for(const id of ['lodging','kitchen','workshop']){
  const {map,buildings:[b]}=sites[id];
  const size=(b.x2-b.x1+1)*(b.z2-b.z1+1);
  assert(b.footprint?.length>20,id+' missing authored footprint');
  if(id==='lodging')assert(b.footprint.length<size,'inn should keep offsets');
  else assert.equal(b.footprint.length,size,id+' should have a clean rectangular envelope');
  assert(map.world.some(o=>/latrine/i.test(o.type)),id+' no toilet');
  assert(map.world.some(o=>o.type==='poiStreetLamp'),id+' no street lighting');
 }
});
test('new distinctive sign, upper level and physically below-grade cellar',()=>{
 assert(sites.lodging.map.world.some(o=>o.type==='poiInnSign'));
 for(const [id,y] of [['lodging',1],['kitchen',-1]]){
  const {map,buildings:[b]}=sites[id];
  assert(b.floorFootprints?.[y]?.length>10,id+' has no distinct storey');
  assert(map.world.some(o=>o.y===y&&o.type.startsWith('guildStair')),id+' no staircase');
  assert(sites.base.map.world.some(o=>o.y===y&&o.type.startsWith('guildStair')),'combined site missing stairs');
 }
});
test('preview owns and exports layer movement without changing ordinary save schema',()=>{
 assert.match(html,/groundY:\s*floorOffset/);
 assert(html.includes('canStep:poiWalkCanStep'),'no facility collision hook');
 assert.match(html,/sceneLayer/);
 assert.match(html,/poiInnSign/);
 assert.match(html,/poiStreetLamp/);
});
