const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(a,b)=>{const i=h.indexOf(a),j=h.indexOf(b,i+1);assert(i>=0&&j>i,[a,b]);return h.slice(i,j)};
test('old player position and editor pan are translated once, preserving earlier layout migrations',()=>{
 const x=vm.runInNewContext(cut('function workshopResumeTownPosition(','function workshopResumeRestore(')+';({position:workshopResumeTownPosition,view:workshopResumeTownView})');
 const p=(x,z,y,townLayout)=>({position:{x,z,y,facing:2},townLayout});
 for(const [s,expected] of [[p(47,13,0,3),[59,25,0]],[p(38,39,0,2),[62,52,0]],
  [p(75,11,1,undefined),[42,22,1]],[p(59,25,0,4),[59,25,0]]]){
  const r=x.position(s,12);assert.deepEqual([r.x,r.z,r.y],expected);assert.equal(r.facing,2);
 }
 const v={panX:3,panZ:-2,level:0,zoom:.8};
 assert.deepEqual({...x.view({townLayout:3},v,108,68,12)},{...v,panX:9,panZ:4});
 assert.deepEqual({...x.view({townLayout:4},v,108,68,12)},v);
});
test('the translated town remains protected while all four gate approaches provide meadow candidates',()=>{
 const site={id:'base',townOffset:12,buildings:[]};
 const x={facilitySite:site,poiWalkX:0,poiWalkZ:0,poiWalkLevel:0,poiWalkActive:true,poiWalkFacing:0,pineAIActive:false,
  world:[],validPos:(x,z)=>x>=0&&z>=0&&x<108&&z<68,facilityFloorOwner:()=>null,poiAudioAllowed:()=>true,
  facilityCreekIndex:{water:new Set()},poiMonsterAt:()=>null,terrainLevel:()=>0,terrainPassable:()=>true,isFloor:()=>true};
 vm.createContext(x);
 vm.runInContext(cut('const POI_SAFE_TOWN=','// BEGIN LOCAL MINI CORE')+cut('const POI_WILD_MAX=','function poiMonsterCanMove('),x);
 assert.equal(x.poiRegionAt(site,31,33).difficulty,0);
 assert.equal(x.poiRegionAt(site,69,57).difficulty,0);
 for(const [gx,gz,xx,zz,face] of [[31,59,31,60,2],[74,57,75,57,1],[24,12,24,11,0],[13,39,12,39,3]]){
  Object.assign(x,{poiWalkX:gx,poiWalkZ:gz,poiWalkFacing:face});
  assert(!x.poiWildPlayerOutside(),'threshold');
  Object.assign(x,{poiWalkX:xx,poiWalkZ:zz});
  assert(x.poiWildPlayerOutside(),'outside');
  assert(x.poiWildGatePick(()=>.31),[xx,zz].join(','));
 }
});
test('north rampart allows the rear lane but crosses the outer edge only at a live gate opening',()=>{
 const x={validPos:()=>true,poiWalkActive:true,facilitySite:{id:'base',townOffset:12},poiWalkLevel:0,
  pineSuperVehicleType:()=>false,poiIsMonster:()=>false,poiMonsterAt:()=>null,isFloor:()=>false,isWallId:()=>false,
  world:[{type:'poiFortBoundary',x:30,z:12,y:0},{type:'poiFortGate',x:24,z:12,y:0}]};
 vm.createContext(x);
 vm.runInContext(cut('function poiWalkPassableDoor(','function poiWalkCamera('),x);
 const step=(x0,z0,x1,z1)=>x.poiWalkCanStep(x1,z1,x0,z0);
 assert(step(30,13,30,12),'interior rear lane');
 assert(step(30,12,31,12),'parallel rear lane');
 assert(!step(30,12,30,11),'wall blocks outward crossing');
 assert(!step(30,11,30,12),'wall blocks inward crossing');
 assert(step(24,11,24,12),'gate opens both ways');
 assert(step(24,12,24,11),'gate opens both ways');
});
test('actual grassy approach at each live gate has valid reachable slime cells after padding',()=>{
 const live=vm.runInNewContext(cut('const FACILITY_SITES=','function workshopResumeDecode(')+';buildFacilitySite("base")');
 const world=live.map.world,solidInside=new Set(live.buildings.flatMap(b=>Array.from(b.footprint,p=>p.x+','+p.z)));
 const water=new Set([...live.creek.deep,...live.canal.water].map(p=>p.x+','+p.z));
 const x={facilitySite:{...live,id:'base'},poiWalkX:0,poiWalkZ:0,poiWalkLevel:0,poiWalkActive:true,poiWalkFacing:0,pineAIActive:false,
  world,validPos:(x,z)=>x>=0&&z>=0&&x<live.map.width&&z<live.map.height,
  facilityFloorOwner:(x,z)=>solidInside.has(x+','+z)?0:null,poiAudioAllowed:()=>true,
  facilityCreekIndex:{water},poiMonsterAt:()=>null,terrainLevel:()=>0,terrainPassable:()=>true,
  isFloor:t=>/^(?:road|grass|woodfloor|basicfloor|brickfloor|stone$|earth$|moss$|river$)/.test(t)};
 vm.createContext(x);
 vm.runInContext(cut('const POI_SAFE_TOWN=','// BEGIN LOCAL MINI CORE')+cut('const POI_WILD_MAX=','function poiMonsterCanMove('),x);
 for(const [xx,zz,face] of [[41,71,2],[86,67,1],[34,20,0],[21,49,3]]){
  Object.assign(x,{poiWalkX:xx,poiWalkZ:zz,poiWalkFacing:face});
  const p=x.poiWildGatePick(()=>.31);
  assert(p,'outdoor meadow at '+[xx,zz]);
  assert(!water.has(p.x+','+p.z));
  assert(x.poiWildExterior(p.x,p.z,3));
 }
});
