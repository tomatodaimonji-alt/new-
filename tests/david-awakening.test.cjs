const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(x,y)=>{const i=html.indexOf(x),j=html.indexOf(y,i+1);a(i>=0&&j>i,x);return html.slice(i,j)};
const o={type:'monsterStoneDavid',x:24,z:104,y:0};
function game(){
 const b={...o,room:{minX:13,maxX:35,minZ:93,maxZ:115}},
  s={x:24,z:104,fromX:24,fromZ:104,moveStarted:-10000,hp:1050};
 const pulls=[],stops=[],contacts=[],c={facilitySite:{id:'base',davidTemple:{boss:b}},poiWalkActive:true,poiWalkLevel:0,document:{hidden:false,addEventListener(){}},
  poiEnemyThreatEnabled:()=>c.threat,threat:true,poiAimOrigin:()=>c.p,p:{x:24,z:98,y:0},poiMonsterStates:new Map([[o,s]]),poiMonsterMeshDirty:false,
  poiAimWall:()=>()=>true,poiMonsterCanMove:()=>true,POI_AIM_EPS:1e-7,poiMobHitPlayer:(_o,now,n)=>{contacts.push([now,n]);return false},
  poiDavidExtractionFoley:(o,s,b,i,at)=>pulls.push([i,at]),poiDavidStopAttackFoley:()=>stops.push(1),poiDavidAttackFoley(){},poiDavidImpactStomp(){}};
 const api=vm.runInNewContext(cut('// BEGIN DAVID TEMPLE COMBAT','// END DAVID TEMPLE COMBAT')+
  cut('function poiAimWallLimit(','function poiAimChooseLock(')+cut('const POI_DAVID_EYE_Y=','function poiDavidSkirt(')+
  ';({step:poiDavidMobFrame,tick:poiDavidCombatFrame,begin:poiDavidBegin,incoming:poiDavidIncoming,pose:poiDavidPose,rig:poiDavidRig,battle:typeof poiDavidBattleActive==="function"?poiDavidBattleActive:()=>false})',c);
 return {api,c,s,b,pulls,stops,contacts,rig:t=>api.rig(api.pose(s,t))};
}
const near=(x,y,eps=1e-6)=>a(Math.abs(x-y)<eps,`${x} not near ${y}`);
test('both long blades planted, red eyes on before ordered real extraction, and no fight until stance is ready',()=>{
 const g=game(),{api,c,s,pulls,rig}=g,zero=1000;
 const dormant=rig(zero-1);a(!dormant.glow);
 dormant.swordTips.forEach((tip,i)=>{
  a(tip[1]<0&&tip[1]>-.20,'tip physically rooted near floor');
  a(Math.abs(tip[0])>.85&&tip[2]>.42,'planted longswords flank the figure');
  near(Math.hypot(...tip.map((v,j)=>v-dormant.hands[i][j])),3.1);
 });
 a(api.step(o,s,zero));
 for(const t of [zero+200,zero+370,zero+700,zero+910])api.tick(t);
 a(rig(zero+370).wakeGlow>.7,'red eye ignition precedes the pull');
 a.equal(pulls.length,0);a.equal(api.battle(zero+910),false);a.equal(api.incoming(o,s,100,zero+910),0);
 a(!api.begin(o,s,zero+910,'sweep'));
 api.tick(zero+920); const first=rig(zero+920);a(first.swordTips[0][1]>0&&first.swordTips[1][1]<0);
 for(const t of [zero+1050,zero+1390,zero+1580,zero+1830,zero+1840,zero+1990,zero+2439])api.tick(t);
 a.deepEqual(pulls,[[0,zero+920],[1,zero+1840]]);
 a(rig(zero+1990).swordTips.every(t=>t[1]>.25));
 a(!api.battle(zero+2439));a.equal(g.contacts.length,0);a.deepEqual([s.x,s.z],[24,104]);
 api.tick(zero+2440);a(api.battle(zero+2440));a(api.incoming(o,s,100,zero+2440)>0);
 a(s.david.attack||s.x!==24||s.z!==104,'choreography hands off to the genuine combat scheduler');
});
test('interruption and slow frames never bunch two extraction sounds or activate combat in the old safe position',()=>{
 const g=game(),{api,c,s,pulls,stops}=g;
 a(api.step(o,s,1000));api.tick(3500);
 a.deepEqual(pulls,[[0,3500]],'one valid authored pull at most per frame');
 a(!api.battle(3500));a.equal(g.contacts.length,0);
 c.p.z=91;api.tick(3550);a(!api.begin(o,s,3560,'sweep'));
 a(!api.battle(3550));a.equal(stops.length,1);
 api.tick(4200);a.equal(s.david,null);a.deepEqual(pulls,[[0,3500]]);
 a(!api.battle(4200));
});
