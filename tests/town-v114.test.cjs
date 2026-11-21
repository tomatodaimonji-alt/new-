const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {createHash}=require('node:crypto');
const {test}=require('node:test');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function extract(a,b){
 const i=html.indexOf(a), j=html.indexOf(b,i+1);
 assert(i>=0&&j>i,'missing source block '+a);
 return html.slice(i,j);
}
const buildingJS=extract('const FACILITY_SITES=', 'function workshopResumeDecode(');
const {sites,build}=vm.runInNewContext(buildingJS+';({sites:FACILITY_SITES,build:buildFacilitySite})');
const floorJS=html.match(/^function isFloor\(t\)\{.*\}$/m)?.[0];
const vehicleJS=html.match(/^function pineSuperVehicleType\(t\)\{.*\}$/m)?.[0];
assert(floorJS&&vehicleJS);
const movement=vm.runInNewContext(`
 ${extract('const ROAD_BASES=', 'const ROAD_COLORS=')}
 ${extract('const WALL_MATERIAL_IDS=', '// Shared staggered timber')}
 ${floorJS}
 ${vehicleJS}
 ${extract('function poiWalkPassableDoor(', 'function poiWalkCamera(')}
 let MAP_W,MAP_H,world,poiWalkLevel;
 const facilitySite=true,poiWalkActive=false;
 const validPos=(x,z)=>x>=0&&x<MAP_W&&z>=0&&z<MAP_H;
 const facilityValidLanding=(x,z,y)=>validPos(x,z)&&world.some(o=>o.x===x&&o.z===z&&o.y===y&&(isFloor(o.type)||o.type==='guildStairDown'||o.type==='guildStairUp'));
 const poiMonsterAt=()=>null;
 ({walkable(site,level=0){
   ({width:MAP_W,height:MAP_H,world}=site.map);poiWalkLevel=level;
   const out=new Set(),cells=new Map();
   for(const o of world)if(o.y===level){
    const k=o.x+','+o.z;if(!cells.has(k))cells.set(k,[]);cells.get(k).push(o);
   }
   // Preserve actual collision decisions but narrow the captured world to one
   // occupied tile per call. This map catalog has no catalogue vehicles.
   const saved=world;
   if(saved.some(o=>pineSuperVehicleType(o.type)))throw new Error('review vehicle radius before this optimization');
   for(let z=0;z<MAP_H;z++)for(let x=0;x<MAP_W;x++){
    const key=x+','+z;world=cells.get(key)||[];
    if(poiWalkCanStep(x,z))out.add(key);
   }
   world=saved;return out;
 },isFloor,poiWalkPassableDoor})
`);
const dirs=[[0,1],[-1,0],[0,-1],[1,0]],key=(x,z)=>x+','+z;
const hash=o=>createHash('sha256').update(JSON.stringify(o)).digest('hex');
const coords=p=>key(p.x,p.z);
const records=o=>[o.x,o.z,o.y,o.type,o.rot];
function flood(start,allowed){
 const first=coords(start),seen=new Set();
 if(!allowed.has(first))return seen;
 const q=[[start.x,start.z]];seen.add(first);
 for(let i=0;i<q.length;i++){
  const [x,z]=q[i];
  for(const [a,b] of dirs){const nx=x+a,nz=z+b,next=key(nx,nz);
   if(allowed.has(next)&&!seen.has(next)){seen.add(next);q.push([nx,nz]);}
  }
 }
 return seen;
}
const priorStamps={
 lodging:'1a618bb28e8e3b983d5d3c1b2b3e7c305741b7b2079db96343b587c2cc13d15a',
 kitchen:'a81947d6b5aabb527f8a6afed0fee4a2170e0d6e6e6b82e2cee01350db2a0d44',
 workshop:'6e618c4eb01ab145f18621dcab078e3a4ed499507333a6764aaa2c301d1977fb'
};
const priorRoadRows={0:[[16,25]],12:[[18,20]],13:[[18,20]],14:[[13,15],[18,20],[24,25]],
 15:[[12,26]],16:[[12,26]],17:[[12,26]],18:[[12,26]],19:[[12,26]],20:[[13,25]],
 21:[[18,20]],22:[[18,20]],23:[[18,20]],24:[[18,20]],25:[[18,20]],26:[[18,20]],27:[[18,20]]};

test('v114 adds four selectable routes and keeps base URL/identity but renames it to 拠点',()=>{
 const ids=Array.from(sites,s=>s.id);
 assert.equal(new Set(ids).size,ids.length);
 for(const id of ['lodging','kitchen','workshop','base','artisan','stable','homes','toolshop']){
  assert.ok(ids.includes(id),id);
  assert.ok(build(id),id);
 }
 assert.equal(sites.find(s=>s.id==='base').name,'拠点');
 assert.equal(build('not-a-poi'),null);
});

test('existing standalone authored maps and every old compound building, furnishing and road stay put',()=>{
 for(const [id,digest] of Object.entries(priorStamps)){
  const {map,buildings,spawn}=build(id);
  // New blueprint labels are UI metadata, not placement changes.
  const plain=Array.from(buildings,({x1,x2,z1,z2,footprint,floorFootprints})=>({x1,x2,z1,z2,footprint,floorFootprints}));
  assert.equal(hash({map,spawn,buildings:plain}),digest,id);
 }
 const base=build('base');
 assert.deepEqual({...base.spawn},{x:19,z:21});
 const oldWindow=base.map.world.filter(o=>o.x<41&&o.z<30);
 const southExtension=o=>o.y===0&&o.type==='earth'&&o.x>=18&&o.x<=20&&o.z>=28&&o.z<=29;
 const priorBench=o=>o.x===16&&o.z===17&&o.type==='benchWood';
 const repaired=oldWindow.filter(priorBench);
 assert.equal(repaired.length,1,'one western bench');
 assert.deepEqual(records(repaired[0]),[16,17,0,'benchWood',1],'western bench sits on the courtyard with its intended rotation');
 const oldStructures=oldWindow.filter(o=>!/^road/.test(o.type)&&!southExtension(o))
  .map(o=>records(priorBench(o)?{...o,y:1,rot:0}:o)).sort();
 const oldRoads=oldWindow.filter(o=>o.y===0&&movement.isFloor(o.type)&&priorRoadRows[o.z]?.some(([a,b])=>o.x>=a&&o.x<=b)).map(records).sort();
 assert.equal(hash(oldStructures),'11bce7995fe3e447768685e4836a8820092974abcbdc539307e6b9773247e98c','original compound objects');
 assert.equal(hash(oldRoads),'f0f772256770c59f0342967397803bb65b1edd5a43bcfa773652883feae765ed','original compound roads');
});

function assertDoor(site,bld,available,reachable,label){
 const mask=new Set(Array.from(bld.footprint,coords));
 const {x,z}=bld.entrance;const k=key(x,z);
 assert.ok(mask.has(k),label+' entrance is part of house');
 const door=site.map.world.find(o=>o.x===x&&o.z===z&&o.y===0&&movement.poiWalkPassableDoor(o.type));
 assert.ok(door,label+' actual in-game passable doorway');
 assert.ok(reachable.has(k),label+' entrance reachable from spawn despite games collision');
 const [dx,dz]=dirs[door.rot];
 assert.ok(!mask.has(key(x+dx,z+dz))&&mask.has(key(x-dx,z-dz)),label+' entrance faces exterior');
 assert.ok(reachable.has(key(x+dx,z+dz)),label+' exterior approach open');
 assert.ok(reachable.has(key(x-dx,z-dz)),label+' door not directly blocked by furniture');
 const indoor=new Set([...available].filter(p=>mask.has(p)));
 const room=flood(bld.entrance,indoor);
 assert.ok(room.size>=4,label+' no usable interior');
 return {mask,room,door};
}

const shape={artisan:[16,16,1],stable:[22,21,1],homes:[38,20,3],toolshop:[17,17,1],base:[63,49,9]};
test('all authored standalone and combined entrances connect to spawn and to a navigable interior',()=>{
 for(const [id,[width,height,siteCount]] of Object.entries(shape)){
  const site=build(id);
  assert.deepEqual([site.map.width,site.map.height,site.buildings.length],[width,height,siteCount],id);
  const available=movement.walkable(site),reachable=flood(site.spawn,available);
  assert.ok(reachable.size,id+' spawn obstructed');
  const used=new Map();
  for(const bld of site.buildings){
   for(const [floor,points] of Object.entries(bld.floorFootprints))for(const p of points){
    assert.ok(p.x>=0&&p.x<width&&p.z>=0&&p.z<height,id+' building outside map: '+bld.id);
    const token=coords(p)+','+floor;
    assert.ok(!used.has(token),id+' buildings physically overlap: '+used.get(token)+' and '+bld.id);
    used.set(token,bld.id);
   }
   assertDoor(site,bld,available,reachable,id+': '+bld.id);
  }
  for(const o of site.map.world)
   assert.ok(Number.isInteger(o.x)&&Number.isInteger(o.z)&&o.x>=0&&o.x<width&&o.z>=0&&o.z<height&&o.rot>=0&&o.rot<4,id+' off-map/invalid prop '+JSON.stringify(o));
 }
});

const poiInside=(site,b)=>{const inside=new Set(Array.from(b.footprint,coords));return Array.from(site.map.world).filter(o=>o.y===0&&inside.has(coords(o)));};
test('new buildings serve distinct functions instead of duplicates',()=>{
 const artisan=build('artisan');
 const artisanProps=poiInside(artisan,artisan.buildings[0]);
 assert.ok(artisanProps.some(o=>/^bed/.test(o.type)),'artisan bed');
 assert.ok(artisanProps.some(o=>/fireplace|kitchenStove/.test(o.type)),'artisan heat/cooking');
 assert.ok(artisanProps.some(o=>/table|counter|Shelf/.test(o.type)),'artisan work furnishing');
 const toolshop=build('toolshop');
 const stock=poiInside(toolshop,toolshop.buildings[0]);
 assert.ok(stock.some(o=>/counter/i.test(o.type)),'sales counter');
 assert.ok(stock.filter(o=>/shelf|rack|crate|chest/i.test(o.type)).length>=2,'wares and stock');
 const stable=build('stable');
 const stableTypes=Array.from(stable.map.world,o=>o.type);
 assert.ok(stableTypes.filter(t=>/fenceWood/.test(t)).length>=8,'stalls or fenced yard');
 assert.ok(stableTypes.some(t=>/handcart/i.test(t)),'dedicated loading yard');
 assert.ok(stableTypes.filter(movement.poiWalkPassableDoor).length>=2,'stable has yard and through access');
 assert.ok(stableTypes.filter(t=>/hay|straw|sack|crate|barrel|handcart|manger|trough/i.test(t)).length>=4,'stable and loading yard furnishings');
 const homes=build('homes'),signatures=new Set();
 for(const bld of homes.buildings){
  const props=poiInside(homes,bld);
  assert.ok(props.some(o=>/^bed/.test(o.type)),bld.id+' bed');
  const propsOnly=props.filter(o=>!movement.isFloor(o.type)&&!/wall/i.test(o.type)).map(o=>o.type).sort();
  signatures.add(propsOnly.join(','));
 }
 assert.equal(signatures.size,3,'three cottages need distinct furniture, not rotated clones');
});

test('new entrance offsets and structures match their locations in the connected base',()=>{
 const base=build('base');
 const expectedDoors={artisan:[47,29],stable:[10,41],toolshop:[47,15],
  cottage:[38,40],rowhouse:[48,42],gardener:[54,36]};
 for(const [id,point] of Object.entries(expectedDoors)){
  const b=base.buildings.find(p=>p.id===id);
  assert.ok(b,id+' unavailable in base');
  assert.deepEqual([b.entrance.x,b.entrance.z],point,id);
 }
});
