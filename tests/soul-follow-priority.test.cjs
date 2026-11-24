const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.WORLD_HTML||'world-editor.html','utf8');
function slice(a,b){const i=h.indexOf(a),j=h.indexOf(b,i+a.length);assert(i>=0&&j>i,a);return h.slice(i,j)}
test('4→2 follows without player-speed matching, using the authored hostile movement rates',()=>{
 const c=vm.createContext({POI_MONSTER_FREE_TICK:380});
 vm.runInContext(slice('// BEGIN COMPANION FRACTIONAL FOLLOW','function poiCompanionPosition('),c);
 const a={id:'slimeSoul'};
 assert.equal(c.poiCompanionFollowWanted(a,3.99),false);
 assert.equal(c.poiCompanionFollowWanted(a,4.01),true);
 assert.equal(c.poiCompanionFollowWanted(a,3.20),true);
 assert.equal(c.poiCompanionFollowWanted(a,2.01),true);
 assert.equal(c.poiCompanionFollowWanted(a,2),false);
 assert.equal(c.poiCompanionFollowWanted(a,3.95),false);
 for(const id of ['slimeSoul','goblinSoul','skeletonSoul'])assert.equal(c.poiCompanionSpeed({id}),1/380);
 assert.equal(c.poiCompanionSpeed({id:'orvasSoul'}),1/235);
 assert.match(h,/dt\*poiCompanionSpeed\(a\)/);
});
test('same arena retains a living established boss target far away but not outside or dead',()=>{
 const foe={type:'monsterStoneDavid',y:0},state={x:12,z:4,hp:100,david:{awake:true}},r={};
 const c=vm.createContext({poiWalkX:4,poiWalkZ:4,poiWalkLevel:0,poiMonsterStates:new Map([[foe,state]]),
  poiDavidMatch:()=>r,poiDavidBattleActive:()=>true,poiDavidIn:(_r,p)=>p.x>=0&&p.x<=34&&p.z>=0&&p.z<=34,
  poiDavidLine:()=>true,performance:{now:()=>10}});
 vm.runInContext(slice('// BEGIN COMPANION DAVID','function poiCompanionDavidVictim('),c);
 const a={x:9,z:4,y:0,fightLatch:{o:foe,s:state}};
 assert(c.poiCompanionDavidTarget(a,foe,state,true));
 c.poiWalkX=32;assert(c.poiCompanionDavidTarget(a,foe,state,true),'far legal kite cannot release established target');
 a.fightLatch=null;assert(!c.poiCompanionDavidTarget(a,foe,state),'far unacquired remains gated');
 a.fightLatch={o:foe,s:state};c.poiWalkX=35;assert(!c.poiCompanionDavidTarget(a,foe,state));
 c.poiWalkX=31;state.hp=0;assert(!c.poiCompanionDavidTarget(a,foe,state));
});
