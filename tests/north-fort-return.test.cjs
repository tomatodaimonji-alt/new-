const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(x,y)=>{const i=h.indexOf(x),j=h.indexOf(y,i+x.length);a.ok(i>=0&&j>i,x);return h.slice(i,j)};
function game(){
 const reward={id:'north-minotaur-axe',type:'equipNorthMinotaurAxe',x:64,z:13,y:-1,durability:180},store={armedDrops:[reward],northMinotaurAxeAwarded:true};
 const c={facilitySite:{id:'base',northFort:{exit:{x:64,z:25,y:-1},dungeonStand:{x:64,z:24,y:-1}}},pineAIActive:false,poiWalkActive:true,
 poiWalkX:64,poiWalkZ:13,poiWalkLevel:-1,poiMonsterStates:new Map(),poiMonsterMeshDirty:false,blocked:new Set(),allowWrite:true,accept:true,save:store,
 POI_ARMED_WAND_FIND:{x:0,z:0},poiArmedWandAvailable:()=>false,poiInventoryAllowed:()=>true,poiHotbarRead:()=>c.save,
 poiEconomyWrite:kit=>{if(!c.allowWrite)return false;c.save=kit;return true},poiInventoryAccept:(kit,type)=>({slots:[{type}],accepted:c.accept?1:0}),
 poiInventoryEdited:(kit,slots)=>({...kit,slots}),poiInventoryItemName:v=>v,poiNorthMinotaurRewardOwned:kit=>kit.slots?.some(o=>o?.type===reward.type),
 poiNorthMinotaurRewardValid:d=>d===reward,poiEconomyRefresh(){},poiSound(){},toast(){},
 poiMonsterAt:(x,z)=>c.blocked.has(x+','+z)||[...c.poiMonsterStates].some(([o,s])=>o.x===x&&o.z===z&&s.hp>0),
 poiWalkCanStep:(x,z)=>!c.blocked.has(x+','+z),poiCombatActorMake:o=>({x:o.x,z:o.z,hp:55,nextAttack:0})};
 vm.createContext(c);vm.runInContext(cut('// BEGIN NORTH FORT RETURN ENCOUNTER','// END NORTH FORT RETURN ENCOUNTER')+
  cut('function poiArmedPickup(','// END ARMED FOES'),c);
 const actors=()=>[...c.poiMonsterStates].map(([o,s])=>[o.x,o.z,o.y,o.northReturnSlot,s.hp]);
 return {c,actors,reward};
}
test('only the committed actual axe pickup arms the three stable return slots; none is ever placed on the player',()=>{
 const {c,actors}=game();c.poiWalkZ=19;c.poiNorthReturnTick(0);a.deepEqual(actors(),[]);
 c.poiWalkZ=13;c.accept=false;a.equal(c.poiArmedPickup(64,13),false);a.equal(c.save.northFortReturn,undefined);
 c.accept=true;c.allowWrite=false;a.equal(c.poiArmedPickup(64,13),false);a.equal(c.save.northFortReturn,undefined);
 c.allowWrite=true;a.equal(c.poiArmedPickup(64,13),true);a.equal(c.save.northFortReturn,0);a.equal(c.save.armedDrops.length,0);
 c.poiNorthReturnTick(0);a.deepEqual(actors(),[]);
 c.poiWalkX=59;c.poiWalkZ=16;c.poiNorthReturnTick(380);
 a.deepEqual(actors().map(x=>x.slice(0,4)),[[57,16,-1,0],[61,16,-1,2]]);
 c.poiWalkZ=17;c.poiNorthReturnTick(760);c.poiNorthReturnTick(1140);
 a.deepEqual(actors().map(x=>x.slice(0,4)),[[57,16,-1,0],[61,16,-1,2],[59,16,-1,1]]);
 a.ok([...c.poiMonsterStates.values()].every(s=>s.northReturnReady>=1830));
});
test('death persists only that slot across reload and bypass retires the remaining group without consuming equipment',()=>{
 const {c,actors}=game();a(c.poiArmedPickup(64,13));c.poiWalkZ=17;c.poiNorthReturnTick(0);
 const [o,s]=[...c.poiMonsterStates][1];s.hp=0;
 a(c.poiNorthReturnRecordDefeat(o,s));a.equal(c.save.northFortReturn,2);
 c.poiMonsterStates=new Map();c.poiNorthReturnTick(500);
 a.deepEqual(actors().map(x=>x[3]),[0,2]);
 const slots=c.save.slots;
 a(c.poiNorthReturnExit(c.facilitySite.northFort));
 a.equal(c.save.northFortReturn,7);a.equal(c.save.slots,slots);
 c.poiMonsterStates=new Map();c.poiNorthReturnTick(950);a.deepEqual(actors(),[]);
});
test('old awarded save with a real possessed reward can migrate on return, but not before nor while unclaimed',()=>{
 const {c,actors}=game();
 c.save={northMinotaurAxeAwarded:true,slots:[{type:'equipNorthMinotaurAxe'}],armedDrops:[]};
 c.poiNorthReturnTick(0);a.equal(c.save.northFortReturn,undefined);
 c.poiWalkZ=17;c.poiNorthReturnTick(0);a.equal(c.save.northFortReturn,0);a.equal(actors().length,3);
 a.equal(c.poiNorthReturnCanStand([...c.poiMonsterStates][0][0],62,16),false,'center buffer cannot be occupied');
 a.equal(c.poiNorthReturnCanStand([...c.poiMonsterStates][0][0],64,24),false,'landing kept free');
});
test('actual authored west floor is open, one axe covers all three and iron only one, center path remains safe',()=>{
 const site=vm.runInNewContext(cut('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+';buildFacilitySite("base")');
 const world=site.map.world,ell=site.northFort;
 const {c,actors}=game();a(c.poiArmedPickup(64,13));c.poiWalkZ=16;c.poiNorthReturnTick(100);
 a.equal([...c.poiMonsterStates].filter(([,s])=>s.northReturnReady===Infinity).length,3,'bypassing along center forbids engagement');
 const api=vm.runInNewContext(cut('// BEGIN ANGULAR COMBAT MATH','// END ANGULAR COMBAT MATH')+
  ';({axe:poiPlayerFrontArcContains,sword:poiSwordSweepContains,limit:poiAimWallLimit})');
 const o={x:59,z:17,y:-1},d={x:0,z:-1};
 for(const [x,z,y] of actors()){
  a(world.some(v=>v.x===x&&v.z===z&&v.y===y&&['stone','roadCutStoneFull'].includes(v.type)));
  const dx=x-o.x,dz=z-o.z,dist=Math.hypot(dx,dz);
  a(api.limit(o,{x:dx/dist,z:dz/dist},dist,(u,v)=>!world.some(t=>t.x===u&&t.z===v&&t.y===y&&t.type==='stonewall'))>=dist-1e-7);
 }
 const ids=actors().map(([x,z,y])=>({x,z,id:{y}}));
 a.equal(ids.filter(q=>api.axe(o,d,q,2.55)).length,3);
 a.equal(ids.filter(q=>api.sword(o,d,q,2)).length,1);
 a.equal(ids.filter(q=>api.sword(o,d,q,1.3)).length,1);
 for(let z=13;z<=24;z++){
  a(world.some(v=>v.x===64&&v.z===z&&v.y===-1&&v.type==='roadAncientFull'));
  a([...c.poiMonsterStates].every(([actor])=>!c.poiNorthReturnCanStand(actor,64,z)));
 }
 a.equal(ell.exit.z,25);
});
