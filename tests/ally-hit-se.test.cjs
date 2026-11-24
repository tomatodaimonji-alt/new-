'use strict';
const {readFileSync}=require('node:fs'),vm=require('node:vm'),a=require('node:assert/strict'),{test}=require('node:test');
const h=readFileSync(process.env.PRODUCT||'world-editor.html','utf8');
const slice=(start,end)=>{
 const i=h.indexOf(start),j=h.indexOf(end,i+start.length);a(i>=0&&j>i,[start,end].join(' → '));return h.slice(i,j);
};
function setup(){
 const sounds=[],stones=[],states=new Map(),ally={id:'orvasSoul',x:0,z:0,y:0},m={kind:'leap',sx:0,sz:0,y:0,dx:1,dz:0,landed:0,allyArena:{},sweep:{victims:new WeakSet()}};
 const env=vm.createContext({poiMonsterStates:states,poiAimWall:()=>()=>true,poiDavidRoomRay:(_q,_b,_r,n)=>n,POI_DAVID_LEAP_RADIUS:7,POI_DAVID_BEAM_WIDTH:.55,
  poiOrvasAllyTarget:(_a,o,s)=>s.hp>0?{p:{x:o.x,z:o.z,y:o.y}}:null,poiDavidArea:(_q,p)=>p.x>0,poiDavidBeamRay:()=>({x:1,z:0}),
  poiDavidStoneTarget:o=>o.type==='monsterStoneDavid',poiDavidIncoming:(_o,s,v)=>s.immune?0:v,poiDavidStoneHitFoley:(o,s)=>stones.push([o.type,s.hp]),
  poiDamageNumber(){},terrainY:()=>0,facilitySite:null,pineGameActive:false,poiMonsterMeshDirty:false,poiHitFlashMonster(){},
  poiHitstopRequest:()=>{},poiSound:(...data)=>sounds.push(data),poiMonsterBreak(){},poiEconomyDrop(){},toast(){},
  poiCompanionType:()=>({attack:17}),poiCompanionTargetLegal:()=>true,poiCompanionMeleeReach:()=>1.7,poiCompanionAttackClear:()=>true,
 });
 const fxStart=h.includes('function poiCompanionImpactFlush(')?'function poiCompanionImpactFlush(':'function poiOrvasAllyHits(';
 vm.runInContext(slice(fxStart,'function poiOrvasAllyStop(')+
  slice('function poiCompanionResolve(','// BEGIN HOSTILE ALLY TARGET CHOICE')+
  slice('function poiPlayerDamageTarget(','function poiPlayerWeaponResolve('),env);
 const add=(x,z=0,hp=100,type='monsterSkeleton')=>{
  const o={x,z,y:0,type},s={x,z,hp};states.set(o,s);return {o,s};
 };
 const slime=(t,tx=t.s.x)=>{
  const s={id:'slimeSoul',x:0,z:0,y:0,attackMotion:{hit:100,target:t,tx,tz:t.s.z,pending:true}};
  env.poiCompanionResolve(s,100,'fight');return s;
 };
 return {env,add,slime,sounds,stones,ally,m};
}
test('one genuine shared-style hit for slime; a moved target has no contact audio',()=>{
 const {slime,add,sounds}=setup();
 const t=add(1);
 slime(t,2);a.equal(t.s.hp,100);a.equal(sounds.length,0);
 slime(t);a.equal(t.s.hp,83);a.deepEqual(sounds,[['hit',null,false,true]]);
});
test('Orvas leap uses one ordinary contact sound for two damaged targets, not for precontact/miss or stone',()=>{
 const {env,add,sounds,stones,ally,m}=setup();
 env.poiOrvasAllyHits(ally,m,9,43);a.equal(sounds.length,0);
 const p=add(2),q=add(3,0,20),r=add(3,1,100,'monsterStoneDavid');
 r.s.david={awake:true};
 env.poiOrvasAllyHits(ally,m,10,43);
 a.deepEqual([p.s.hp,q.s.hp,r.s.hp],[57,0,57]);a.deepEqual(stones,[['monsterStoneDavid',57]]);
 a.deepEqual(sounds,[['hit',null,true,true]]);
});
test('each distinct sword strike reuses player steel, one extended sweep uses one sound across hit frames',()=>{
 const {env,add,sounds,ally,m}=setup();
 add(2);
 m.kind='double';env.poiOrvasAllyHits(ally,m,100,28);env.poiOrvasAllyHits(ally,m,420,35);
 a.deepEqual(sounds,[['hit','equipIronSword',false,true],['hit','equipIronSword',false,true]]);
 sounds.length=0;
 m.kind='beam';env.poiOrvasAllyHits(ally,m,500,36,[-.2,.1]);add(3);
 env.poiOrvasAllyHits(ally,m,550,36,[.1,.2]);a.deepEqual(sounds,[['hit',null,false,true]]);
});
test('mitigation to zero is quiet; the original player damage call remains unchanged',()=>{
 const {env,add,sounds,ally,m}=setup();
 const t=add(2,0,100,'monsterNorthMinotaur');
 env.poiNorthMinotaurIncoming=()=>0;
 env.poiOrvasAllyHits(ally,m,90,43);
 a.equal(t.s.hp,100);a.equal(sounds.length,0);
 env.poiNorthMinotaurIncoming=(_o,_s,n)=>n;env.poiPlayerDamageTarget([t.o,t.s],2,0,23,'equipWoodSword',110,false,true);
 a.equal(t.s.hp,77);a.deepEqual(sounds,[['hit','equipWoodSword',false,true]]);
});
