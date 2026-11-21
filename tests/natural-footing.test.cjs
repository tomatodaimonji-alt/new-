const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const a=h.indexOf('function poiWalkPassableDoor('),b=h.indexOf('function poiWalkCamera(',a);
assert(a>=0&&b>a);
function walk(types,{id='base',y=0,indoor=false,wet=false}={}){
 const scope={world:[{type:y===0?'grassPebbles':'woodfloor',x:4,z:5,y},...types.map(type=>({type,x:4,z:5,y}))],
  facilitySite:id?{id,creek:wet?{deep:[],crossings:[]}:null}:null,poiWalkLevel:y,poiWalkActive:true,
  validPos:()=>true,pineSuperVehicleType:()=>false,poiIsMonster:()=>false,
  facilityValidLanding:()=>true,facilityFloorOwner:()=>indoor?0:null,
  poiMonsterAt:()=>false,isFloor:t=>t==='grassPebbles'||t==='woodfloor',isWallId:t=>t.endsWith('wall')};
 vm.createContext(scope);
 return vm.runInContext(h.slice(a,b)+`
 if(facilitySite?.creek)facilityCreekIndex={parts:new Map(),water:new Set(['4,5'])};
 poiWalkCanStep(4,5);`,scope);
}
test('the Game World exterior allows only low loose rubble and fern newly, preserving existing grass, flowers and pebbles',()=>{
 for(const id of ['rubble','bushFern','tallGrass','flowerField','bushFlower'])assert.equal(walk([id]),true,id);
 assert.equal(walk([]),true);
 for(const id of ['rock','rockGranite','rockMossy','rockBasalt','rockCluster','rockCliff','watersideRock','treeBirch','fallenLog','brokenPillar','bush'])
  assert.equal(walk([id]),false,id);
});
test('soft plants and loose stones must not bypass indoor/upper/other-map/stacked/deep-water blockers',()=>{
 for(const prop of ['rubble','bushFern']){
  for(const options of [{id:null},{id:'stable'},{y:1},{indoor:true},{wet:true}])
   assert.equal(walk([prop],options),false,JSON.stringify(options));
  for(const stacked of ['stonewall','rockMossy','treePine','crate'])
   assert.equal(walk([prop,stacked]),false,stacked);
 }
 assert.equal(walk(['flowerField','rock']),false);
});
