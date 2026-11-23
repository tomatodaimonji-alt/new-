const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const h=fs.readFileSync(process.env.QA_HTML||'world-editor.html','utf8');
const slice=(a,b)=>{const i=h.indexOf(a),j=h.indexOf(b,i+1);assert.ok(i>=0&&j>i,a);return h.slice(i,j)};
function f(){
 const site=vm.runInNewContext(slice('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+';buildFacilitySite')('base');
 site.id='base';const market=site.southRoad.town.market,yard={x:34,z:61,y:0},noah={x:35,z:61,y:0,activity:'work',role:{id:'stablekeeper',work:{x:35,z:61,y:0},public:yard}};
 const clerk={x:71,z:35,y:0,activity:'work',role:{id:'toolkeeper',work:{x:71,z:35,y:0}}};
 const mover={...market.work,activity:'work',role:{id:'southmerchant',work:market.work,receiving:market.receiving}};
 const c={facilitySite:site,world:site.map.world,poiTownNpcActors:[noah,clerk,mover],poiTownNpcActive:()=>true,poiSouthMarketRole:()=>mover.role,
  poiHotbarRead:()=>c.kit,poiEconomyWrite:k=>{if(c.fail)return false;c.kit=k;c.writes++;return true},
  poiToolshopSupply:k=>k.toolshopSupply,poiTownNpcHere:(a,b)=>!!b&&a.x===b.x&&a.z===b.z&&a.y===b.y,
  poiTownNpcAct(a,label){a.activity=label},poiTownNpcMove(a,p,label,now){if(c.blocked)return false;const same=c.poiTownNpcHere(a,p);if(!same){Object.assign(a,p);a.moveAt=now;c.walked.push([a.role.id,p.x,p.z]);}return true},
  POI_TOWN_RESIDENT_TICK:380,POI_TOWN_OPEN:450,POI_TOWN_CLOSE:1080,POI_TOOLSHOP_SHIPMENT:4,POI_TOOLSHOP_CAP:9,
  kit:{toolshopSupply:{version:1,stock:3,cargo:0,delivered:1}},writes:0,walked:[]};
 vm.createContext(c);vm.runInContext(slice('// BEGIN SOUTH SHIPMENT','// END SOUTH SHIPMENT')+slice('// BEGIN TOOLSHOP SUPPLY ROUTINE','// END TOOLSHOP SUPPLY ROUTINE'),c);
 return {c,noah,clerk,mover,yard,site};
}
test('day 2 cargo visits shelf, road and real active Noah before one persisted handoff',()=>{
 const {c,noah,mover}=f(),clock={day:2,minute:760};
 assert.equal(c.poiSouthShipmentRoutine(mover,{day:1,minute:760},0,{}),false);
 c.blocked=true;
 assert.equal(c.poiSouthShipmentRoutine(mover,clock,2000,{}),true);
 assert.equal(c.writes,0);c.blocked=false;
 noah.activity='errand';
 for(let time=3000;time<30000;time+=400)c.poiSouthShipmentRoutine(mover,clock,time,{});
 assert.equal(c.writes,0);assert.deepEqual([mover.x,mover.z],[34,61]);
 assert(c.walked.some(([id,x,z])=>id==='southmerchant'&&x===96&&z===115));
 assert(c.walked.some(([id,x,z])=>id==='southmerchant'&&x===97&&z===91));
 noah.activity='work';c.fail=true;c.poiSouthShipmentRoutine(mover,clock,30000,{});assert.equal(c.writes,0);
 c.fail=false;c.poiSouthShipmentRoutine(mover,clock,32000,{});assert.equal(c.kit.southShipment.readyDay,2);assert.equal(c.writes,1);
 for(let time=32400;time<60000;time+=400)c.poiSouthShipmentRoutine(mover,clock,time,{});
 assert.deepEqual([mover.x,mover.z],[99,112]);assert.equal(c.writes,1);
});
test('old morning pickup unchanged; later real pickup reserves one old parcel and only real returned stock spends it',()=>{
 const {c,clerk}=f();
 const initial={...c.kit};
 const morning2={day:2,minute:590};
 for(let time=10000;time<12000;time+=400)c.poiToolshopSupplyRoutine(clerk,morning2,time,{});
 assert.equal(c.kit.toolshopSupply.stock,7);assert.equal(c.kit.southShipment,undefined);
 c.kit={...initial,southShipment:{version:1,lastReadyDay:2,readyDay:2,cargoDay:0}};
 const morning3={day:3,minute:590};
 c.poiToolshopSupplyRoutine(clerk,morning3,20000,{});c.poiToolshopSupplyRoutine(clerk,morning3,20400,{});
 assert.equal(c.kit.southShipment.cargoDay,3);assert.equal(c.kit.toolshopSupply.stock,3);
 c.poiToolshopSupplyRoutine(clerk,morning3,20800,{});c.poiToolshopSupplyRoutine(clerk,morning3,21200,{});
 assert.equal(c.kit.toolshopSupply.stock,9);assert.equal(c.kit.southShipment.readyDay,0);
 assert.equal(c.kit.southShipment.lastReadyDay,2);assert.equal(c.kit.southShipment.cargoDay,0);
});
test('actual authored walk graph covers every checkpoint and full shelves do not consume the parcel',()=>{
 const {c,site,yard}=f(),r=c.poiSouthShipmentRoute(site.southRoad,yard),m=site.map;
 Object.assign(c,{MAP_W:m.width,MAP_H:m.height,facilityCreekIndex:null,terrainHeights:new Map(m.terrainHeights.map(({x,z,h})=>[x+','+z,h])),bridgeSpanElevation:()=>0,
  isFloor:t=>/^(?:grass|earth|road|stone$|brickfloor|woodfloor|water|river)/.test(t),isWallId:t=>/wall/i.test(t),
  poiWalkPassableDoor:t=>/(?:Door|DoorOpen|Entrance)$/.test(t)});
 // Drop the test's mocked resident list before loading the navigation block
 // which declares the real list as a script-local. Route graph uses only map.
 vm.runInContext(slice('const terrainKey=','function shiftMesh(')+slice('function terrainPassable(','function waterfallFace(')+slice('const STAIR_DIRECTIONS=','function elevationStairGeometry(')+slice('function facilityRefreshCreek(','function poiCreekPlayerHeight(')+slice('const POI_TOWN_WALK_DECOR=','function poiTownNpcExistsBed('),c);
 c.facilityRefreshCreek();
 assert(c.facilityCreekIndex.parts.has('101,104')&&c.facilityCreekIndex.parts.has('101,105'));
 assert(r.some(p=>p.x===101&&p.z===104)&&r.some(p=>p.x===101&&p.z===105));
 let cells=0;
 for(let i=1;i<r.length;i++){
  const leg=c.poiTownFindPath(r[i-1],r[i]);
  assert.ok(leg,JSON.stringify([r[i-1],r[i]]));assert.ok(leg.length<24,leg.length);
  cells+=leg.length;
 }
 assert(cells>140&&cells<175,cells);
 const s={southShipment:{version:1,lastReadyDay:2,readyDay:2,cargoDay:3}};
 const full=c.poiSouthShipmentAtReturn(s,{cargo:3},9);
 assert.equal(full.stock,9);assert.equal(full.shipment.readyDay,2);assert.equal(full.shipment.cargoDay,0);
 assert.equal(c.poiSouthShipmentAtReturn(s,{cargo:4},7),null);
 assert.equal(c.poiSouthShipmentDecode({...s.southShipment,cargoDay:2}),null);
 assert.equal(c.poiSouthShipmentDecode(s.southShipment).cargoDay,3);
});
test('actual movement walks tiles to yard through both bridge decks, enqueues only at real handoff, then returns',()=>{
 const {c,site,noah,clerk,mover,yard}=f(),m=site.map;
 Object.assign(c,{MAP_W:m.width,MAP_H:m.height,facilityCreekIndex:null,terrainHeights:new Map(),bridgeSpanElevation:()=>0,
  isFloor:t=>/^(?:grass|earth|road|stone$|brickfloor|woodfloor|water|river)/.test(t),isWallId:t=>/wall/i.test(t),
  poiWalkPassableDoor:t=>/(?:Door|DoorOpen|Entrance)$/.test(t),mover,clerk,noah,poiWalkActive:true,pineAIActive:false,poiAudioAllowed:()=>true});
 vm.runInContext(slice('const terrainKey=','function shiftMesh(')+slice('function terrainPassable(','function waterfallFace(')+slice('const STAIR_DIRECTIONS=','function elevationStairGeometry(')+slice('function facilityRefreshCreek(','function poiCreekPlayerHeight(')+slice('const POI_TOWN_WALK_DECOR=','function poiTownNpcExistsBed(')+slice('function poiTownNpcPlayerBlocksStep(','function poiTownNpcReleaseHunt(')+';poiTownNpcActors=[noah,clerk,mover];',c);
 c.facilityRefreshCreek();
 let prev={x:mover.x,z:mover.z},handedAt=null;
 const crossed=new Set();
 for(let i=0;i<=350;i++){
  c.poiSouthShipmentRoutine(mover,{day:2,minute:760+Math.floor(i*.76)},380*i,{plans:2});
  assert(Math.abs(mover.x-prev.x)+Math.abs(mover.z-prev.z)<=1,'no warp');
  prev={x:mover.x,z:mover.z};
  if(mover.x===101&&[104,105].includes(mover.z))crossed.add(mover.z);
  if(c.writes&&!handedAt){handedAt=i;assert.deepEqual([mover.x,mover.z],[yard.x,yard.z]);assert(crossed.has(104)&&crossed.has(105));}
 }
 assert(handedAt>140&&handedAt<200,handedAt);
 assert.equal(c.writes,1);assert.deepEqual([mover.x,mover.z],[99,112]);
});
