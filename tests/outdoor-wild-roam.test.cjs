const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function block(x,y){const i=h.indexOf(x),j=h.indexOf(y,i+1);a(i>=0&&j>i,x);return h.slice(i,j)}
function setup(){
 const site=vm.runInNewContext(block('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+";buildFacilitySite('base')");
 site.id="base";
 const ctx={facilitySite:site,world:site.map.world,poiWalkX:105,poiWalkZ:81,poiWalkLevel:0,
  poiMonsterStates:new Map(),poiMonsterMeshDirty:false,validPos:(x,z)=>x>=0&&x<128&&z>=0&&z<128,
  facilityFloorOwner:()=>null,facilityCreekIndex:{water:new Set()},terrainPassable:()=>true,isFloor:t=>/^(grass|earth|road|stone)/.test(t),
  terrainLevel:()=>0,poiMonsterAt:()=>null,poiWalkCanStep:()=>true,
  poiCombatActorMake:()=>({hp:50,moveStarted:-1}),poiTownNpcActorOccupied:()=>false,POI_MONSTER_FREE_TICK:380};
 const api=vm.runInNewContext(block('const POI_SAFE_TOWN=','function poiRegionAt(')+block('const POI_WILD_MAX=','function poiMonsterCanMove(')+
  ';({policy:poiWildFieldFixedPolicy,frame:poiWildRegionalFrame,pick:poiWildRegionalPick,roam:poiWildRoamStep,protected:poiWildProtectedArea})',ctx);
 return {site,ctx,api};
}
test('only three optional outdoor weapon carriers relocate; authored guardians and other floors stay fixed',()=>{
 const {site,api}=setup(),field=site.map.world.filter(o=>o.y===0&&o.type.startsWith('monster'));
 a.deepEqual(Array.from(field.filter(o=>api.policy(o)==='regional'),o=>o.type),['monsterSkelArcher','monsterSkelMage','monsterSkelLongStaff']);
 a(field.filter(o=>!api.policy(o)).some(o=>o.type==='monsterPondSkater'));
 a(field.filter(o=>!api.policy(o)).some(o=>o.type==='monsterSkelWarrior'));
 a.equal(api.policy({x:105,z:86,y:-1,type:'monsterSlime'}),null);
 a.equal(api.policy({x:45,z:45,y:0,type:'monsterGoblin'}),null);
 a(api.protected(102,13));a(api.protected(117,28));
});
test('real authored field encounter picks diverse bounded positions without changing identity or map',()=>{
 const p=setup(),q=setup(),state=({api,ctx},rng)=>{api.frame(10000,rng);return [...ctx.poiMonsterStates][0]};
 const [a0,s0]=state(p,()=>0),[a1,s1]=state(q,()=>.99999);
 a.equal(a0.type,'monsterSkelArcher');a.equal(a1.type,a0.type);
 a.deepEqual([a0.x,a0.z],[105,86]);
 a.notDeepEqual([s0.x,s0.z],[s1.x,s1.z]);
 for(const s of [s0,s1]){const d=Math.hypot(s.x-a0.x,s.z-a0.z);a(d>=1.5&&d<=5);a(s.wildSpawn&&s.regionalWild)}
 a(p.site.map.world.includes(a0),'canonical authored object remains the loot identity');
 for(const [x,z,type] of [[40,82,'monsterSkelMage'],[43,11,'monsterSkelLongStaff']]){
  const branch=setup();branch.ctx.poiWalkX=x;branch.ctx.poiWalkZ=z;
  const [actual,mob]=state(branch,()=>.55);
  a.equal(actual.type,type);a(mob.regionalWild&&Math.hypot(mob.x-actual.x,mob.z-actual.z)>=1.5);
 }
 p.api.frame(15000,()=>.7);a.equal(p.ctx.poiMonsterStates.size,1);
 s0.hp=0;p.api.frame(20000,()=>.2);a.equal(p.ctx.poiMonsterStates.get(a0),s0,'same-session death stays dead near the region');
});
test('regional placement cannot cross a full blocking wall',()=>{
 const {api}=setup(),wall=x=>x!==1;
 const p=api.pick({x:0,z:0},{x:0,z:-10},()=>.6,wall,(x,z)=>x>1);
 a.equal(p,null);
});
test('ambient roam persistently moves multiple oblique tiles and steers away from its home boundary',()=>{
 const {api,ctx}=setup(),obj={x:0,z:0};
 ctx.poiFreeCell=v=>Math.floor(v+.5);ctx.poiActorSameGrade=()=>true;ctx.poiMonsterCanMove=()=>true;
 ctx.poiMonsterActorFootprint=(x,z)=>new Set([ctx.poiFreeCell(x)+','+ctx.poiFreeCell(z)]);
 ctx.poiActorAdvance=(from,to,d,can)=>{can(ctx.poiFreeCell(to.x),ctx.poiFreeCell(to.z),ctx.poiFreeCell(from.x),ctx.poiFreeCell(from.z));return {...to,stopped:false}};
 ctx.poiMonsterActorStart=(obj,state,t,from,x,z)=>{state.actorFree={x,z};state.x=ctx.poiFreeCell(x);state.z=ctx.poiFreeCell(z)};
 // Use exterior part of the real map, avoiding town for every accepted point.
 Object.assign(obj,{x:105,z:80});const state={x:105,z:80};
 for(let i=0;i<7;i++)a(api.roam(obj,state,i*380,()=>.5+i*.01));
 a(Math.hypot(state.actorFree.x-105,state.actorFree.z-80)>3);
 a(Math.abs(state.actorFree.z-80)>.1&&Math.abs(state.actorFree.x-105)>3);
 for(let i=7;i<16;i++)api.roam(obj,state,i*380,()=>.5);
 a(Math.hypot(state.actorFree.x-105,state.actorFree.z-80)<=5);
});
