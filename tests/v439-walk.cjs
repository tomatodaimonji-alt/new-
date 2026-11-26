const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'candidate.html','utf8');
const cut=(x,y)=>{const i=h.indexOf(x),j=h.indexOf(y,i+x.length);a(i>=0&&j>i,x);return h.slice(i,j);};
test('actual B1 support uses physical bedrock/ramp rather than arbitrary surface elevation',()=>{
 const c={facilitySite:{id:'frontier'},frontierSouthRuinsOwn:(x,z)=>x===160&&z>=81,
  frontierSouthRampHeight:(_x,z)=>z<81?-(z-76)*.28:null,FRONTIER_SOUTH_BEDROCK:-1.4};
 vm.runInNewContext(cut('function poiTownNpcSouthFloorY(','function poiTownNpcVisualPosition('),c);
 a.equal(c.poiTownNpcSouthFloorY({y:-1},160,83),-1.4);
 a(Math.abs(c.poiTownNpcSouthFloorY({y:-1},160,79)+.98)<1e-9);
 a.equal(c.poiTownNpcSouthFloorY({y:0},160,81),null);
});
test('B1 ignores outdoor grade but not walls, bodies, real level changes; straight route pulling is explicitly enabled only there',()=>{
 const c={facilitySite:{id:'frontier'},poiWalkLevel:-1,frontierSouthRuinsOwn:(x,z)=>z>=81,
  poiTownNpcActors:[],poiTownNpcActorPinned:()=>false,poiActorSameGrade:()=>false,
  poiMonsterAt:()=>false,poiTownNpcActorOccupied:()=>false,
  poiTownNpcNextTile:(p,x,z)=>c.wall?null:{x,z,y:c.stair?0:p.y}};
 vm.runInNewContext(cut('function poiTownNpcSouthUnderground(','function poiTownNpcActorRun('),c);
 const npc={x:160,z:85,y:-1};
 a(c.poiTownNpcActorLegal(npc,{},null,160,86,160,85));
 a(!c.poiTownNpcActorLegal(npc,{},null,160,80,160,81));
 c.wall=true;a(!c.poiTownNpcActorLegal(npc,{},null,160,86,160,85));c.wall=false;
 c.stair=true;a(!c.poiTownNpcActorLegal(npc,{},null,160,86,160,85));c.stair=false;
 c.poiTownNpcActors.push({x:160,z:86,y:-1});a(!c.poiTownNpcActorLegal(npc,{},null,160,86,160,85));
 const v={poiActorAdvance:(from,to,len,legal)=>({...to,distance:len,stopped:!legal(to.x,to.z)})};
 vm.runInNewContext(cut('function poiActorPickSegment(','// Elevation transitions'),v);
 const p=[{x:160,z:86,y:-1},{x:160,z:87,y:-1},{x:160,z:88,y:-1}];
 a.equal(v.poiActorPickSegment(npc,p,()=>false,()=>true).used,1);
 a.equal(v.poiActorPickSegment(npc,p,()=>false,()=>true,true).used,3);
 a.equal(v.poiActorPickSegment(npc,p,()=>false,(_x,z)=>z<88,true).used,2);
});
test('real mover commits fractional forward travel in paced frames, never crosses a wall, and preserves gait mileage',()=>{
 const npc={x:160,z:83,y:-1,activity:'expedition-march'};
 const c={facilitySite:{id:'frontier'},poiWalkLevel:-1,frontierSouthRuinsOwn:()=>true,
  poiTownNpcActors:[npc],poiTownNpcActorPinned:()=>false,poiActorSameGrade:()=>false,poiMonsterAt:()=>false,
  poiTownNpcActorOccupied:()=>false,poiTownNpcNextTile:(p,x,z)=>c.wall===z?null:{x,z,y:p.y},
  poiTownNpcPlayerBodyBlocks:()=>false,frontierNpcSweepBlocked:()=>false,frontierNpcBodies:()=>[],
  poiTownNpcActorSettle:a=>{c.settled=true;a.actorLeg=null},poiTownNpcVersion:0};
 vm.runInNewContext(cut('// BEGIN FREE MOVEMENT SOLVER','// END FREE MOVEMENT SOLVER')+cut('// BEGIN ACTOR FREE MOVEMENT','// END ACTOR FREE MOVEMENT')+
  cut('function poiTownNpcSouthUnderground(','function poiTownNpcPlayerBlocksStep('),c);
 function leg(){npc.actorLeg={x:160,z:83,target:{x:160,z:85},dx:0,dz:2,length:2,last:0,elapsed:0,duration:500,traveled:0,foot:1,underground:true};}
 leg();
 c.poiTownNpcActorRun(npc,50,{});a(Math.abs(npc.actorLeg.z-83.2)<1e-6);a.equal(npc.z,83);
 for(let t=100;t<=500;t+=50)c.poiTownNpcActorRun(npc,t,{});
 a.equal(npc.z,85);a.equal(npc.y,-1);a.equal(npc.actorLeg,null);a(Math.abs(npc.undergroundMileage-2)<1e-6);
 npc.z=83;c.wall=84;leg();
 for(let t=50;t<=500&&npc.actorLeg;t+=50)c.poiTownNpcActorRun(npc,t,{});
 a.equal(npc.z,83);a(c.settled);
});
test('real occupancy blocks underground enemies while player remains at surface or in a different plane',()=>{
 const mob={x:160,z:86,y:-1,type:'monsterSlime'};
 const state={x:160,z:86,hp:30,frontierRuins:false};
 const c={facilitySite:{id:'frontier'},poiWalkLevel:0,frontierPlayCave:true,frontierCollisionCave:null,
  frontierSouthRuinsOwn:()=>true,poiMonsterStates:new Map([[mob,state]]),
  poiTownNpcActors:[],poiTownNpcActorPinned:()=>false,poiTownNpcActorOccupied:()=>false,
  poiTownNpcNextTile:(p,x,z)=>({x,z,y:p.y})};
 vm.runInNewContext(cut('function frontierPlaneMatches(','function frontierGroundRecordLayer(')+
  cut('function poiMonsterAt(','const POI_WILD_MAX')+
  cut('function poiTownNpcSouthUnderground(','function poiTownNpcActorRun('),c);
 const npc={x:160,z:85,y:-1};
 a.equal(c.poiMonsterAt(160,86,true),null);
 a(!c.poiTownNpcActorLegal(npc,{},null,160,86,160,85));
 state.frontierRuins=true;a(c.poiTownNpcActorLegal(npc,{},null,160,86,160,85));
 state.frontierRuins=false;mob.y=0;a(c.poiTownNpcActorLegal(npc,{},null,160,86,160,85));
 mob.y=-1;state.hp=0;a(c.poiTownNpcActorLegal(npc,{},null,160,86,160,85));
});
