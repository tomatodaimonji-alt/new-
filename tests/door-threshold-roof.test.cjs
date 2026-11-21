const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function slice(a,b){const i=html.indexOf(a),j=html.indexOf(b,i+1);assert(i>=0&&j>i,a);return html.slice(i,j)}
const build=vm.runInNewContext(slice('const FACILITY_SITES=','function workshopResumeDecode(')+';buildFacilitySite');
const setup=(id,site=build(id))=>{
 const c=vm.createContext({facilitySite:{...site,id},world:site.map.world,facilityFloorMasks:[],facilityRefreshCreek(){},
  poiWalkLevel:0,poiWalkActive:true,poiWalkX:0,poiWalkZ:0});
 vm.runInContext(slice('function poiWalkPassableDoor(','let facilityCreekIndex=')+
  slice('const facilityCellKey=','function pineGuildRenewalSample(')+';facilityPrepareFloorMasks()',c);
 const hidden=(x,z,y=0)=>{c.poiWalkX=x;c.poiWalkZ=z;c.poiWalkLevel=y;return c.facilityHiddenRoof()};
 return {c,hidden};
};
test('cutaway begins on each genuine exterior doorway, not on pavement or a window',()=>{
 const site=build('base'),{hidden,c}=setup('base',site);
 for(const [id,inside,door,outside] of [
  ['artisan',[47,28],[47,29],[47,30]],['townGuild',[34,15],[34,16],[34,17]],
  ['lodging',[19,2],[19,1],[19,0]],['toolshop',[47,14],[47,15],[47,16]],
  ['rowhouse',[56,28],[56,29],[56,30]]]){
  const owner=site.buildings.findIndex(b=>b.id===id);
  assert.equal(hidden(...outside),null,id+' just outside');
  assert.equal(hidden(...door),owner,id+' on door tile');
  assert.equal(hidden(...inside),owner,id+' inside');
  assert.equal(hidden(...outside),null,id+' exiting restores');
 }
 assert.equal(hidden(30,16),null,'guild window tile is not a doorway');
 assert.equal(hidden(19,47),null,'open town gate has no building cutaway');
 c.poiWalkActive=false;
 assert.equal(hidden(34,16),null,'editor preview is untouched');
});
test('usable door on a different floor is respected after an edit; no stale entrance cache',()=>{
 const site=build('base'),{c,hidden}=setup('base',site);
 const owner=site.buildings.findIndex(b=>b.id==='townGuild');
 assert.equal(hidden(34,16,1),null);
 c.world=[...c.world,{x:34,z:16,y:1,type:'stonewallDoor',rot:0}];c.facilityRefreshStairs();
 assert.equal(hidden(34,16,1),owner);
 c.world=c.world.filter(o=>!(o.x===34&&o.z===16&&o.y===1&&o.type==='stonewallDoor'));c.facilityRefreshStairs();
 assert.equal(hidden(34,16,1),null);
});
test('standalone sample and saved guild recognize the exterior door without relaxing perimeter walls',()=>{
 const base=build('base'),g=base.buildings.find(b=>b.id==='townGuild'),dx=g.x1-7,dz=g.z1-6;
 const footprint=Array.from(g.footprint,p=>({x:p.x-dx,z:p.z-dz}));
 const world=Array.from(base.map.world.filter(o=>o.x>=g.x1&&o.x<=g.x2&&o.z>=g.z1&&o.z<=g.z2),o=>({...o,x:o.x-dx,z:o.z-dz}));
 const site={map:{world},buildings:[{...g,x1:7,x2:22,z1:6,z2:20,footprint,floorFootprints:{0:footprint,1:footprint,2:footprint}}]};
 for(const id of ['guildsaved','guildrenewal']){
  const {hidden}=setup(id,site);
  assert.equal(hidden(14,21),null);assert.equal(hidden(14,20),0);assert.equal(hidden(14,19),0);
  assert.equal(hidden(10,20),null);assert.equal(hidden(14,20,1),null);
 }
});
test('ordinary authored maps hide on a covered doorway but not on a covered open porch or other level',()=>{
 const c=vm.createContext({facilitySite:null,world:[{x:1,z:1,y:1,type:'roofHip'},{x:2,z:1,y:1,type:'roofHip'},
  {x:1,z:1,y:0,type:'stonewallDoor'}],AUTO_ROOFS:new Set(),RESIDENTIAL_ROOFS:new Set(['roofHip']),
  isWallId:()=>false,poiWalkPassableDoor:t=>t.endsWith('Door'),poiWalkX:1,poiWalkZ:1,poiWalkLevel:0});
 vm.runInContext(slice('function poiWalkIndoor(','let poiEditorGhostRoof='),c);
 assert.equal(c.poiWalkIndoor(),true);c.poiWalkLevel=1;assert.equal(c.poiWalkIndoor(),false);
 c.poiWalkLevel=0;c.poiWalkX=2;assert.equal(c.poiWalkIndoor(),false);
});
