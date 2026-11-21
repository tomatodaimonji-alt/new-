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
// Integrity of protected v113 content, not the older v112 town fixture.
// Ground mask is the exact v113 authored occupancy; unoccupied cells may
// receive the new landscape, while all higher/lower records are checked.
const priorGroundRows={
 0:[[16,25]],
 1:[[16,23]],
 2:[[16,23]],
 3:[[16,23]],
 4:[[14,23]],
 5:[[14,25],[37,37]],
 6:[[8,8],[14,26]],
 7:[[2,2],[12,12],[14,25],[33,33],[43,51]],
 8:[[14,25],[43,51]],
 9:[[2,11],[14,25],[42,51]],
 10:[[2,11],[16,25],[43,51]],
 11:[[2,11],[16,23],[27,36],[43,51],[53,53]],
 12:[[2,11],[18,22],[27,36],[43,51]],
 13:[[2,11],[18,20],[27,36],[43,51]],
 14:[[2,15],[18,20],[24,36],[43,51]],
 15:[[2,36],[43,51]],
 16:[[2,36],[39,54]],
 17:[[2,36],[39,54]],
 18:[[2,36],[39,54]],
 19:[[2,36],[39,41]],
 20:[[2,11],[13,25],[27,36],[38,41]],
 21:[[2,11],[17,20],[27,36],[39,41]],
 22:[[2,11],[18,20],[39,41],[43,50]],
 23:[[14,14],[18,21],[26,26],[39,41],[43,50]],
 24:[[5,5],[16,16],[18,20],[23,23],[28,28],[36,36],[39,50]],
 25:[[11,11],[18,20],[39,41],[43,50]],
 26:[[18,41],[43,50],[52,52]],
 27:[[18,41],[43,50]],
 28:[[18,41],[43,50]],
 29:[[17,20],[39,41],[43,50]],
 30:[[15,15],[17,20],[39,41],[45,49]],
 31:[[6,6],[17,21],[39,51],[53,53]],
 32:[[17,21],[39,51]],
 33:[[4,15],[17,21],[41,51]],
 34:[[4,15],[17,21],[34,40],[54,59]],
 35:[[4,15],[18,21],[34,40],[51,59]],
 36:[[4,15],[18,21],[34,40],[44,60]],
 37:[[4,15],[18,20],[32,32],[34,40],[44,61]],
 38:[[4,15],[18,20],[34,40],[44,60]],
 39:[[4,15],[18,20],[34,40],[44,60]],
 40:[[4,15],[18,20],[34,40],[44,60]],
 41:[[4,15],[18,20],[36,39],[41,41],[44,53]],
 42:[[6,14],[18,20],[34,34],[36,39],[45,49],[51,53],[58,58]],
 43:[[7,14],[18,20],[36,39],[47,53]],
 44:[[7,60]],
 45:[[6,6],[8,60]],
 46:[[5,7],[9,60]]
};
const priorRoadRows={
 0:[[16,25]],
 12:[[18,20]],
 13:[[18,20]],
 14:[[13,15],[18,20],[24,25]],
 15:[[12,26]],
 16:[[12,26],[39,54]],
 17:[[12,26],[39,54]],
 18:[[12,26],[39,54]],
 19:[[12,26],[39,41]],
 20:[[13,25],[39,41]],
 21:[[18,20],[39,41]],
 22:[[18,20],[39,41]],
 23:[[18,20],[39,41]],
 24:[[18,20],[39,41]],
 25:[[18,20],[39,41]],
 26:[[18,41]],
 27:[[18,41]],
 28:[[21,41]],
 29:[[17,17],[39,41]],
 30:[[17,17],[39,41],[46,48]],
 31:[[17,17],[21,21],[39,51]],
 32:[[17,17],[21,21],[39,51]],
 33:[[17,17],[21,21],[41,51]],
 34:[[17,17],[21,21]],
 35:[[21,21],[51,53]],
 36:[[21,21],[51,53]],
 37:[[51,53]],
 38:[[51,53]],
 39:[[51,53]],
 40:[[51,53]],
 41:[[37,39],[51,53]],
 42:[[7,8],[12,14],[36,39],[51,53]],
 43:[[7,8],[12,14],[36,39],[47,53]],
 44:[[7,8],[12,14],[21,43],[45,60]],
 45:[[8,8],[21,60]],
 46:[[21,60]]
};
const v113Expected={
 "lodging": {
  "footprints": "d9b14fa86b2a75af9676f1b13e44cbb977acef6bbe439e7a4aad1f1364cdbdad",
  "records": "d365010c2791436af971f854cbc9f25b8aa6b3e3a9903a5275754380e02db031"
 },
 "kitchen": {
  "footprints": "7c4f471733c2b1fa7dcce677499f4fc37512f3a49b8a81dfbaf9a222bf0c200c",
  "records": "ce62c99570e2f475aadd0babf41d58dfb190f70424dddcc1e748c3b269a0d417"
 },
 "workshop": {
  "footprints": "23bd24fe2464e71edb7c055ce3b7957ef50a7429b54e549ba1d3063eb4bd8ce6",
  "records": "52a1349017fe204a175d3bcc1a4640ec430c647dfc850a76e8de39420f533886"
 },
 "artisan": {
  "footprints": "7e67efd84dd85ff5e1e4458861b7c7f15f7a01382e14df78b66cc1b116f768f8",
  "records": "e5c4073acc59eaffadb751cd521eaaa2a5dcaca7d8a53fa844845b121eba7c86"
 },
 "stable": {
  "footprints": "54d7467cdd42e833673cc783fc8eb98371af36d8f55d1de944f4a6928def18e8",
  "records": "1219d74330066e11a92276dcd289c44da9773d5e959360841a341d6b2cb10df3"
 },
 "homes": {
  "footprints": "ab05997bbc64a45c4778ea7395aab15ccedab50539cc00947e9dee120b500b6e",
  "records": "9dc3e68056c6cd916f8569a812a9b5b5d91ab14ab962a63fbf9df9d3fc4289b0"
 },
 "toolshop": {
  "footprints": "cddd82d7db8364d9bdb143ed4b65804b23656b197ad3d5a5591023fcb3d7f960",
  "records": "4d3a2d55b1d6afea9e6027b0ec6bdc2cc0c1c7bcf441ee354e095ce8075b4d59"
 },
 "base": {
  "footprints": "5a94754411125b601836fdc8f199292929e3c1b2d8fa63ea94e34e705ddae2a6",
  "records": "201fe8add6aba66425e29d03f4599e4713141a8355c6294683d3c8c46a07060a",
  "roads": "2f2e126fbdb831de22f10c14c38eed15026b23e9bed29c77d804f1c516a59008"
 }
};
const roomSeats=new Set(['5,5','6,5','5,6','6,6','7,6','9,6','10,6','11,6','5,7','9,7','10,7','11,7']);
const seatKinds=new Set(['roundTableSet','roundTableWood','smallFlowerVase','mugCeramic','chairWood']);
const workshopProps=new Set(['2,6:table','3,5:counterWood','3,5:poiLedgerPapers','2,5:stoolRound',
 '3,7:benchWood','4,7:handcartLoaded','5,7:crate','7,10:handcartEmpty',
 '1,4:table','1,4:poiLedgerPapers','1,7:benchWood','1,8:crate','3,7:counterWood',
 '4,7:counterWood','4,7:poiLedgerPapers','3,6:stoolRound','9,11:handcartLoaded',
 '7,10:roadGravelFull','8,10:roadGravelFull','9,10:roadGravelFull',
 '7,11:roadGravelFull','8,11:roadGravelFull','9,11:roadGravelFull']);
const remodeled={
 artisan:new Set(['4,1:kitchenStove','5,1:kitchenSink','5,2:chest','6,1:kitchenCounter','6,3:bed','6,6:chest']),
 toolshop:new Set(['1,1:crate','1,1:wardrobe','1,2:sack','2,1:displayShelf','3,1:bed','4,1:poiWallSconce','4,1:wardrobe',
  '4,1:woodwall','4,2:woodwallDoor','4,3:woodwall','5,1:displayShelf','5,3:sack','6,1:displayShelf','7,3:crate']),
 cottage:new Set(['1,1:guildLatrine','1,5:fireplace','2,1:kitchenSink','2,5:poiPottedPlant','4,1:chest','4,1:wardrobe','5,1:bed',
  '5,2:wardrobe','5,3:chairWood','5,5:chest','5,7:poiPottedPlant']),
 rowhouse:new Set(['1,1:bed','1,1:poiLedgerPapers','1,1:poiPenHolder','1,1:table','1,2:chairClassic','1,2:wardrobe','1,3:bookshelf',
  '1,3:poiLedgerPapers','1,3:poiPenHolder','1,3:table','1,4:fireplace','2,1:bed','2,1:bookshelf','2,3:chairClassic',
  '4,1:guildLatrine','4,4:plasterwall','4,4:wardrobe','5,1:kitchenSink']),
 gardener:new Set(['1,2:fireplace','1,3:bed','1,4:wardrobe','1,5:chest','1,5:poiPottedPlant','2,2:basketProduce','2,2:table',
  '2,3:stoolRound','3,7:stoolRound','4,1:displayShelf','5,1:chest','5,1:poiPottedPlant','5,2:basketProduce','5,2:table',
  '5,3:guildLatrine','5,5:kitchenSink'])
};
// v115 frontage deltas are restricted to exact authored coordinates, types and turns.
const frontages={
 artisan:new Set(['2,7:oldTownShutters:0','6,7:oldTownAwning:0']),
 toolshop:new Set(['1,9:shopChestSign:0','2,8:oldTownAwning:0','2,9:shopChestSign:0','5,8:oldTownStreetLamp:0']),
 cottage:new Set(['1,7:benchWood:0','1,7:roadGravelFull:0','2,6:oldTownFlowerBox:0','2,7:roadGravelFull:0','2,7:smallFlowerVase:0',
  '5,7:poiPottedPlant:0','6,7:poiPottedPlant:0']),
 rowhouse:new Set(['1,6:poiPottedPlant:0','1,7:poiPottedPlant:0','1,7:roadBrickFull:0','2,7:roadBrickFull:0','3,6:oldTownStreetLamp:0']),
 gardener:new Set(['0,10:roadGravelFull:0','0,10:stoolRound:0','0,7:cropVegetable:0','0,7:earth:0','0,8:cropVegetable:1',
  '0,8:earth:0','0,9:barrel:0','0,9:roadGravelFull:0','1,7:barrel:0','3,7:stoolRound:0',
  '4,6:oldTownFlowerBox:0'])
};
function inRows(rows,x,z){return rows[z]?.some(([a,b])=>x>=a&&x<=b)??false;}
function localPos(o,b){
 if(b.turn===1)return [o.z-b.z1,b.x2-o.x];
 if(b.turn===3)return [b.z2-o.z,o.x-b.x1];
 return [o.x-b.x1,o.z-b.z1];
}
function protectedIndoor(site,o,bounds){
 if(o.y!==0)return true;
 for(const [id,edited] of Object.entries(frontages)){
  const b=bounds.get(id);
  if(b&&edited.has(key(...localPos(o,b))+':'+o.type+':'+((o.rot-b.turn+4)%4)))return false;
 }
 const kitchen=bounds.get('kitchen'),workshop=bounds.get('workshop');
 if(kitchen&&seatKinds.has(o.type)&&roomSeats.has(key(...localPos(o,kitchen))))return false;
 if(workshop&&workshopProps.has(key(...localPos(o,workshop))+':'+o.type))return false;
 // The house orientations, fixtures and private room may change only at
 // their authored ground-floor slots. Paving, shells and roofs stay protected.
 for(const [id,edited] of Object.entries(remodeled)){
  const b=bounds.get(id);
  if(b&&edited.has(key(...localPos(o,b))+':'+o.type))return false;
 }
 return true;
}
function v113Digests(build){
 const out={};
 for(const id of ['lodging','kitchen','workshop','artisan','stable','homes','toolshop','base']){
  const site=build(id),bounds=new Map(Array.from(site.buildings,b=>[b.id,b]));
  const footprint=Array.from(site.buildings,({id,x1,x2,z1,z2,footprint,floorFootprints})=>({
   id,x1,x2,z1,z2,footprint:Array.from(footprint,coords).sort(),
   floorFootprints:Object.fromEntries(Object.entries(floorFootprints).map(([k,v])=>[k,Array.from(v,coords).sort()]))
  }));
  const original=site.map.world.filter(o=>protectedIndoor(site,o,bounds)&&
   (id!=='base'||o.y!==0||inRows(priorGroundRows,o.x,o.z))).map(records).map(record=>{
    // v116 authorizes the stable threshold only in two views; normalize
    // it back to its exact old material for the historical digest.
    const entranceZ=id==='stable'?12:id==='base'?42:-1;
    if(record[0]===10&&record[1]===entranceZ&&record[2]===0&&record[3]==='roadGravelFull'&&record[4]===0)
      return [10,entranceZ,0,'earth',0];
    return record;
   }).sort();
  out[id]={footprints:hash(footprint),records:hash(original)};
  if(id==='base'){
   const roads=site.map.world.filter(o=>o.y===0&&movement.isFloor(o.type)&&inRows(priorRoadRows,o.x,o.z)).map(records).sort();
   out[id].roads=hash(roads);
  }
 }
 return out;
}

test('v114 adds four selectable routes and keeps base URL/identity but shows the current game-world name',()=>{
 const ids=Array.from(sites,s=>s.id);
 assert.equal(new Set(ids).size,ids.length);
 for(const id of ['lodging','kitchen','workshop','base','artisan','stable','homes','toolshop']){
  assert.ok(ids.includes(id),id);
  assert.ok(build(id),id);
 }
 assert.equal(sites.find(s=>s.id==='base').name,'ゲーム世界');
 assert.equal(build('not-a-poi'),null);
});

test('protect unchanged v113 shells, cellar, footprints, town furnishings and paved routes',()=>{
 const base=build('base');
 assert.deepEqual({...base.spawn},{x:19,z:21});
 const westBench=base.map.world.filter(o=>o.x===16&&o.z===17&&o.type==='benchWood');
 assert.equal(westBench.length,1,'one western bench');
 assert.deepEqual(records(westBench[0]),[16,17,0,'benchWood',1],'west bench is grounded');
 for(const [id,current] of Object.entries(v113Digests(build)))
  assert.deepEqual(current,v113Expected[id],id+' protected legacy content');
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

const shape={artisan:[16,16,1],stable:[22,21,1],homes:[38,20,3],toolshop:[17,17,1],base:[72,56,9]};
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
