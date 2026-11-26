const a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.argv[2],'utf8');
const extract=(x,y)=>{const i=h.indexOf(x);a.ok(i>=0,x);return h.slice(i,h.indexOf(y,i+x.length));};
const cedar={x:121,z:26,y:0,type:'treeCedar'};
const c=vm.createContext({world:[cedar],facilitySite:{id:'frontier',decks:new Set()},poiWalkLevel:0,poiWalkActive:true,
  frontierCollisionCave:false,frontierPlayCave:false,frontierSouthSlopeLevel:()=>null,frontierSouthSurfaceBlocked:()=>false,
  validPos:()=>true,poiEastNatureBlocked:()=>false,frontierBurrowWalkEdge:()=>true,surfaceNoise:()=>.5,
  pineSuperVehicleType:()=>false,poiMonsterAt:()=>false,poiIsMonster:()=>false,poiCompanionNavWorldChanged:()=>{},frontierHouseClip:()=>null,
  frontierLayerAfter:()=>false,poiWalkPassableDoor:()=>false,isFloor:()=>false,frontierHouseFineTile:()=>false,isWallId:()=>false});
vm.runInContext('const FRONTIER_WEST_OFFSET=64;'+extract('const FRONTIER_WATER_FORM=','function frontierLakeMix')+
 extract('const FRONTIER_VILLAGE={','\n')+extract('function frontierVillageRadius','function frontierVillageTrack')+
 extract('const FRONTIER_BRIDGE=','function frontierTrack')+extract('function frontierSmooth','function frontierRise')+extract('function frontierWalkableProp','function pineDrawFrontierTree')+
 extract('// BEGIN FRONTIER WALK CELL INDEX','function poiFreeCenter')+extract('// BEGIN FREE MOVEMENT SOLVER','// END FREE MOVEMENT SOLVER')+
 `const frontierGroundKind=(x,z)=>frontierRiver(x+.5,z+.5)<0?'river':'grass';
 const can=(x,z,fx,fz)=>poiWalkCanStep(x,z,fx,fz,undefined,true,true);
 globalThis.f={can,walk:(x,z,dx,dz)=>poiFreeAdvance(x,z,dx,dz,.2,can,can,frontierMovementClip(null,x,z),true)};`,c);
const p=c.f.walk(120.42,24.95,0,3.22);
a.ok(p.z>28.1,'walk through the gap between the north cedar and east village fence: '+JSON.stringify(p));
const back=c.f.walk(p.x,p.z,0,-3.22);
a.ok(back.z<25.02,'walk through it both ways');
const fence=c.f.walk(120.42,26,-2.8,0);a.ok(fence.x>119.35,'must not walk through fence: '+JSON.stringify(fence));
const trunk=c.f.walk(120.42,26,1.1,0);a.ok(trunk.x<120.61,'must not walk through tree: '+JSON.stringify(trunk));
a.ok(!c.f.can(124,25,123,25),'river tile still solid');
console.log('PASS gap on both directions; fence, cedar and river still solid',p,back);
