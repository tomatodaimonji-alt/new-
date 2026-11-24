const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(x,y)=>{const i=h.indexOf(x),j=h.indexOf(y,i+x.length);a(i>=0&&j>i,x);return h.slice(i,j)};
const o={type:'monsterStoneDavid',x:24,z:104,y:0};
function setup(){
 const boss={...o,room:{minX:16,maxX:31,minZ:96,maxZ:112}},s={x:24,z:104,hp:1050,facing:2},c={
  facilitySite:{id:'base',davidTemple:{boss}},document:{hidden:false,addEventListener:(event,fn)=>{c.visibility=fn}},poiWalkLevel:0,poiWalkX:24,poiWalkZ:100,player:{x:24,z:101,y:0},
  poiMonsterStates:new Map([[o,s]]),poiMonsterMeshDirty:false,valid:true,wall:()=>false,stock:100,damage:[],sounds:[],
  poiEnemyThreatEnabled:()=>c.valid,poiAimOrigin:()=>c.player,poiAimWall:()=>((x,z)=>!c.wall(x,z)),
  poiMobHitPlayer:(obj,now,n)=>{c.damage.push({obj,now,n});c.stock-=n;return c.stock<=0},
  poiMonsterCanMove:()=>true,poiSound:id=>c.sounds.push(id),terrainY:()=>0,
  mesh:()=>({p:[],c:[]}),poiEnemyCuePoint:(x,z,y)=>[x+.5,.153+y*1.4,z+.5],
  quad:(m,...q)=>{m.c.push(q.pop());for(const p of q)m.p.push(...p)}
 
 };
 const api=vm.runInNewContext(cut('// BEGIN DAVID TEMPLE COMBAT','// END DAVID TEMPLE COMBAT')+
  cut('function poiAimWallLimit(','function poiAimChooseLock(')+cut('// BEGIN DAVID TEMPLE CUES','// END DAVID TEMPLE CUES')+
  ';({step:poiDavidMobFrame,tick:poiDavidCombatFrame,pose:poiDavidPose,area:poiDavidArea,begin:poiDavidBegin,match:poiDavidMatch,incoming:poiDavidIncoming,cue:poiDavidCueGeometry})',Object.assign(c,{POI_AIM_EPS:1e-7}));
 return {c,s,api,boss};
}
test('only canonical authored room enables dormant encounter; no damage or patrol through threshold',()=>{
 const {c,s,api}=setup();c.player={x:24,z:95,y:0};api.step(o,s,1000);
 a.equal(s.david,undefined);a.deepEqual([s.x,s.z],[24,104]);c.player={x:24,z:97,y:0};
 c.wall=(x,z)=>z===99;api.step(o,s,1100);a(!s.david?.awake);c.wall=()=>false;
 api.step(o,s,1200);a(s.david.awake);a.equal(api.pose(s,1410).phase,'wake');a.equal(api.incoming(o,s,28,1410),10);
 c.player={x:24,z:94,y:0};api.tick(1800);a(!s.david?.awake);a.equal(c.damage.length,0);
 a.deepEqual([s.x,s.z],[24,104]);delete c.facilitySite.davidTemple;
 a.equal(api.match(o),null);a.equal(api.incoming(o,s,28,2000),0);
});
test('committed front geometry measures sweep, 3×3 two-contact slam and circular six-tile stomp precisely',()=>{
 const {api}=setup(),v={sx:24,sz:104,dx:0,dz:-1,y:0};
 const p=(x,z,y=0)=>({x:24+x,z:104-z,y});
 for(const [kind,hits,misses] of [
  ['sweep',[p(4.2,0),p(2,3)],[p(0,-.01),p(4.21,0),p(0,2,1)]],
  ['double',[p(1.5,.55),p(-1.5,3.55)],[p(1.51,1),p(0,.54),p(0,3.56)]],
  ['stomp',[p(0,-6),p(6,0)],[p(0,-6.01),p(0,6.01)]],
  ['beam',[p(.56,14),p(-.56,10)],[p(.57,7),p(0,14.01),p(0,-.1)]]
 ]){const q={...v,kind};for(const p0 of hits)a(api.area(q,p0),kind+' hit');for(const p0 of misses)a(!api.area(q,p0),kind+' miss');}
});
test('real double contact resolves twice with actual dodge and wall; expired contacts never stack',()=>{
 const run=(skip=false,wall=false,move=false)=>{
  const {c,s,api}=setup();api.step(o,s,1000);a(api.begin(o,s,1700,'double'));
  const q=s.david.attack;a.deepEqual(Array.from(q.hits),[2420,2740]);
  if(skip){
   for(const t of [1900,2100,2300,2600])api.tick(t);
   a.deepEqual(c.damage.map(x=>x.n),[28]);
   api.tick(2740);a.equal(c.damage.length,1,'late first contact preserves separation');
   api.tick(2920);a.deepEqual(c.damage.map(x=>x.n),[28,35]);
   return {c,s,api};
  }
  for(const t of [1900,2100,2300,2419])api.tick(t);
  a.equal(c.damage.length,0);
  api.tick(2420);a.equal(c.damage.length,1);a.equal(c.damage[0].n,28);api.tick(2430);a.equal(c.damage.length,1);
  if(wall)c.wall=(x,z)=>z===103;if(move)c.player.x+=2;
  api.tick(2740);api.tick(2750);
  return {c,s,api};
 };
 const landed=run();a.deepEqual(landed.c.damage.map(x=>x.n),[28,35]);
 a.equal(landed.api.pose(landed.s,2748).contact,2);a.equal(landed.api.incoming(o,landed.s,28,3000),18);
 for(const x of [run(false,true),run(false,false,true)])a.deepEqual(x.c.damage.map(z=>z.n),[28]);
 run(true);
});
test('hidden resume and long frame discontinuity cancel instead of replaying contacts',()=>{
 for(const hide of [true,false]){
  const {c,s,api}=setup();api.step(o,s,1000);a(api.begin(o,s,1700,'double'));
  for(const t of [1900,2100,2300])api.tick(t);
  if(hide){c.document.hidden=true;c.visibility();c.document.hidden=false;c.visibility();}
  api.tick(hide?2500:3400);
  a.equal(c.damage.length,0);a.equal(s.david.attack,null);
 }
});
test('beam cannot hit behind a wall, sweep is forward, retreat cancels an already declared attack',()=>{
 const {c,s,api}=setup();api.step(o,s,1100);
 a(api.begin(o,s,1750,'beam'));const q=s.david.attack;a.equal(q.hits[0],2750);
 c.wall=(x,z)=>z===103;api.tick(2250);api.tick(2750);a.equal(c.damage.length,0);
 c.wall=()=>false;c.player.z=104.8;a(api.begin(o,s,4000,'sweep'));c.player.z=103;api.tick(4560);a.equal(c.damage.length,0);
 c.player.z=101;a(api.begin(o,s,5700,'stomp'));c.player.z=95;api.tick(6630);
 a.equal(c.damage.length,0);a.equal(api.pose(s,6640).phase,'dormant');
});

test('live private encounter clock selects all four kinds, not only the exposed helpers',()=>{
 const {c,s,api}=setup();c.stock=1000;api.step(o,s,1000);
 const seen=new Set();
 for(let t=1000;t<8500;t+=10){api.tick(t);if(s.david?.attack)seen.add(s.david.attack.kind)}
 a.deepEqual([...seen].slice(0,4),['sweep','double','stomp','beam']);
 a.deepEqual(c.damage.slice(0,5).map(d=>d.n),[30,28,35,39,47]);
 a.equal(s.hp,1050,'monster health and general player reports are not rewritten');
});
test('actual floor cue and elevated red beam end at a new wall and never outside the arena',()=>{
 const {api,c,boss}=setup(),q={kind:'beam',dx:0,dz:-1,sx:24,sz:104,y:0};
 const open=api.cue(q,boss);
 a(open.lane.p.length>60&&open.beam.p.length>12);a(open.beam.c.every(([r,g,b])=>r>=.99&&g<=.10&&b<=.09));
 const ys=open.beam.p.filter((_,i)=>i%3===1),zs=open.beam.p.filter((_,i)=>i%3===2);
 a(Math.max(...ys)>4.7&&Math.min(...ys)<.70,'beam actually comes down from the eyes toward hit corridor');
 a(Math.min(...zs)>=96-1e-5,'ray respects room edge in front even at selected 14-tile nominal length');
 c.wall=(x,z)=>z===102;
 const closed=api.cue(q,boss);
 const n=m=>Math.min(...m.p.filter((_,i)=>i%3===2));
 a(n(closed.lane)>=103-1e-5&&n(closed.beam)>=103-1e-5,'same actual authored wall clips cue and effect');
});

test('current knife and strongest armor cannot win by stationary damage-racing; true misses open full counters',()=>{
 const {c,s,api}=setup();c.stock=100;let outgoing=0,ticks=0;
 c.poiMobHitPlayer=(_o,_now,n)=>{c.stock-=Math.max(1,n-6);return c.stock<=0};
 api.step(o,s,1000);
 for(let t=1000;t<9000;t+=5){
  if(api.tick(t))break;
  if((t-1000)%225===0){outgoing+=api.incoming(o,s,32,t);ticks++}
 }
 a(c.stock<=0&&ticks<40&&outgoing<s.hp/2,JSON.stringify({outgoing,ticks,hp:c.stock}));
 const clear=setup();clear.c.stock=1000;api.match(o);clear.api.step(o,clear.s,1000);
 a(clear.api.begin(o,clear.s,1700,'double'));
 clear.c.player.x+=2;
 clear.api.tick(2420);clear.api.tick(2740);a.equal(clear.c.stock,1000);
 a.equal(clear.api.incoming(o,clear.s,32,3000),32,'actual two-hit dodge exposes full damage');
 clear.s.hp=500;clear.c.player.x-=2;
 a(clear.api.begin(o,clear.s,3900,'beam'));
 a.equal(clear.s.david.attack.until,3900+1000+570,'late challenge tightens rest, not warning or contact');
});
