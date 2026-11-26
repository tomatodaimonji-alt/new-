const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(process.argv[2],'utf8');
for(const m of src.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
const extract=name=>src.match(new RegExp('^function '+name+'\\([^]*?^}','m'))?.[0]??'';
const ctx={$:()=>null,world:[],poiWalkLevel:0,poiWalkActive:true,facilitySite:{id:'frontier',decks:new Set()},sourceReads:0,
  validPos:(x,z)=>x>=0&&z>=0,frontierSouthSlopeLevel:()=>null,frontierSouthSurfaceBlocked:()=>false,
  poiEastNatureBlocked:()=>false,frontierCollisionCave:null,frontierPlayCave:false,frontierBurrowWalkEdge:()=>true,
  frontierVillageFence:()=>false,frontierGroundKind:()=> 'grass',pineSuperVehicleType:type=>type==='truck',
  poiWalkPassableDoor:type=>type==='door',isFloor:type=>type==='grass',poiIsMonster:type=>type==='monster',
  frontierRuinsChestAt:(x,z)=>x===10&&z===7,frontierRuinsGateAt:()=>false,
  poiMonsterAt:()=>false,frontierLayerAfter:c=>c,frontierWalkableProp:()=>false,
  poiTownNpcActorOccupied:()=>false,isWallId:type=>type==='stoneWall',
  frontierTreeTrunkType:()=>false,frontierHouseFineTile:()=>false};
vm.createContext(ctx);
const helpers=src.match(/\/\/ BEGIN FRONTIER WALK CELL INDEX\n([^]*?)\/\/ END FRONTIER WALK CELL INDEX/)?.[1]??'';
vm.runInContext(helpers+extract('poiWalkCanStep'),ctx);
const observed=new Proxy(Array.from({length:3000},(_,i)=>({x:i+20,z:30,y:0,type:'grass'})).concat([
 {x:1,z:4,y:0,type:'grass'},{x:2,z:4,y:0,type:'stoneWall'},{x:3,z:4,y:0,type:'stoneWall'},{x:3,z:4,y:0,type:'door'},
 {x:4,z:4,y:1,type:'stoneWall'},{x:3,z:4,y:-1,type:'stoneWall'},{x:5,z:4,y:0,type:'monster'},
 {x:8,z:4,y:0,type:'truck'},{x:10,z:7,y:0,type:'chest'}
]),{get:(a,k)=>{if(typeof k==='string'&&/^\d+$/.test(k))ctx.sourceReads++;return Reflect.get(a,k)}});
ctx.world=observed;
const test=()=>Array.from({length:11},(_,i)=>ctx.poiWalkCanStep(i,4));
assert.deepEqual(test(),[true,true,false,true,true,true,true,false,false,false,true]);
assert.equal(ctx.poiWalkCanStep(10,7),true);ctx.frontierPlayCave=true;
assert.equal(ctx.poiWalkCanStep(10,7),false);ctx.frontierPlayCave=false;
ctx.sourceReads=0;for(let i=0;i<20;i++)test();
assert.ok(ctx.sourceReads<30,'a warmed frontier scene should not scan distant world objects when checking village steps (reads='+ctx.sourceReads+')');
ctx.world.push({x:6,z:4,y:0,type:'stoneWall'});
assert.equal(ctx.poiWalkCanStep(6,4),false,'refresh after object count changes');
if(ctx.frontierWalkCellInvalidate){
 ctx.world[ctx.world.length-1]={x:6,z:4,y:0,type:'grass'};
 ctx.frontierWalkCellInvalidate(ctx.world);
 assert.equal(ctx.poiWalkCanStep(6,4),true,'refresh after a same-size map edit');
}
console.log('Checks keep doors/walls, layers, traffic and occupancy while avoiding repeated world scans');
