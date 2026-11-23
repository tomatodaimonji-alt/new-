const fs=require('node:fs'),vm=require('node:vm'),a=require('node:assert/strict'),{test}=require('node:test');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const take=(x,y)=>{const i=h.indexOf(x),j=h.indexOf(y,i+x.length);a(i>=0&&j>i,x);return h.slice(i,j)};
function fixture(){
 const events=[],victim={x:2,z:3,hp:50},c={poiWalkActive:true,poiWalkLevel:0,facilitySite:null,poiOtherworldTravelSerial:3,
  canvas:{width:740,height:390},document:{hidden:false},poiMonsterMeshDirty:false,pineGameActive:false,
  poiDamageNumber(){},terrainY:()=>0,poiSound(...q){events.push(q[0])},poiMonsterBreak(){},toast(){}};
 const real=take('function poiPlayerDamageTarget(','function poiPlayerWeaponResolve(');
 const api=vm.runInNewContext(take('// BEGIN PLAYER HITSTOP','// END PLAYER HITSTOP')+'\n'+real+
  ';({ask:poiHitstopRequest,hold:poiHitstopHold,paint:poiHitstopMarkDrawn,pending:poiHitstopPending,kill:poiPlayerDamageTarget,state:()=>poiPlayerHitstop})',c);
 return {api,events,victim,c,hit:(amount,weapon,now=100)=>api.kill([{type:'monsterSlime'},victim],2,3,amount,weapon,now)};
}
test('only real player HP damage queues hitstop; paint one contact frame, then hold bounded output',()=>{
 const s=fixture(),r=s.api;
 a.equal(r.hold(100),false);s.hit(0,'equipWoodSword');a.equal(r.state(),null);
 s.hit(10,'equipWoodSword');a.equal(s.victim.hp,40);a.equal(s.events.at(-1),'hit');
 a.equal(r.pending(),true);a.equal(r.hold(108),false,'first real contact frame may draw');
 a.equal(r.paint(109),true);a.equal(r.pending(),false);
 a.equal(r.hold(120),true);a.equal(r.hold(156.8),true);a.equal(r.hold(157),false);
 a.equal(r.state(),null);
});
test('multi-enemy hits do not extend one active window; fresh projectile hit uses shorter duration',()=>{
 const s=fixture(),r=s.api;s.hit(2,'equipIronSword',100);
 a.equal(r.ask(105,'equipIronSword'),false);
 r.paint(110);a.equal(r.ask(129,'equipWoodBow'),false);a.equal(r.state().until,158);
 a.equal(r.hold(158),false);s.hit(2,'fireWand',160);r.paint(162);
 a.equal(r.state().until,200);a.equal(r.hold(199),true);a.equal(r.hold(200),false);
});
test('no stale freeze crosses portal/floor, resize, background, or play exit',()=>{
 for(const invalidate of [c=>c.poiOtherworldTravelSerial++,c=>c.poiWalkLevel++,c=>c.canvas.width++,c=>c.document.hidden=true,c=>c.poiWalkActive=false]){
  const s=fixture(),r=s.api;s.hit(3,'kitchenKnife',100);r.paint(101);invalidate(s.c);
  a.equal(r.hold(110),false);a.equal(r.state(),null);
 }
});
test('renderer skips redraw before simulation and arms hitstop only after the drawn frame',()=>{
 const r=take('function render(){','let savedMapRestoreFailed=');
 a.match(r,/if\(poiScreenNoteFrozen\(\)\)\{[^}]*poiHitstopReset\(\)/);
 a(r.indexOf('requestAnimationFrame(render)')<r.indexOf('poiHitstopHold(now)'));
 a(r.indexOf('poiHitstopHold(now)')<r.indexOf('poiTownClockFrame(now)'));
 a(r.indexOf('poiHitstopHold(now)')<r.indexOf('gl.clear('));
 a(r.indexOf('poiHitstopMarkDrawn(performance.now())')>r.indexOf('poiScreenNoteCaptureFrame()'));
 a.doesNotMatch(take('function poiMobHitPlayer(','function poiMineEarlyMayMove('),/poiHitstop/);
});
