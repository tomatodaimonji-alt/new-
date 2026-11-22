const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const html=fs.readFileSync('world-editor.html','utf8');
function fixture(){
 const o={x:117,z:28,y:0,type:'monsterPondSkater'},bank={x:118,z:28,y:0,type:'water'};
 const c={facilitySite:{id:'base',northTrail:{marsh:{pond:{guard:o,leash:{x1:112,x2:120,z1:24,z2:32},water:[o,bank]}}}},poiWalkLevel:0,world:[{...o,type:'water'},bank],poiMonsterAt:()=>false,poiWalkCanStep:()=>false,poiWalkX:119,poiWalkZ:28,isFloor:id=>id==='water'};
 const a=html.indexOf('// BEGIN POND SKATER'),b=html.indexOf('// END POND SKATER');
 assert.ok(a>=0&&b>a);vm.createContext(c);vm.runInContext(html.slice(a,b),c);return {c,o};
}
test('skims exact tagged water but cannot roam or threaten on the main road',()=>{
 const {c,o}=fixture();
 assert.equal(c.poiPondSkaterWater(118,28),true);
 assert.equal(c.poiPondSkaterMayMove(o,118,28),true);
 assert.equal(c.poiPondSkaterMayMove(o,121,28),false);
 c.world.push({x:118,z:28,y:0,type:'rock'});assert.equal(c.poiPondSkaterMayMove(o,118,28),false);
 assert.equal(c.poiPondSkaterMayMove({...o,x:116},118,28),false);
 c.poiWalkLevel=-1;assert.equal(c.poiPondSkaterWater(118,28),false);
});
test('pose shows grounded warning, release lunge and finite recoil without mutating attack',()=>{
 const {c}=fixture(),s={playerAttack:{start:100,hit:740,pending:true,dx:1,dz:0}};
 const tell=c.poiPondSkaterPose(s,400);assert.ok(tell.dx<0);assert.equal(tell.facing,3);
 s.playerAttack.pending=false;s.playerAttack.visualHitAt=750;
 assert.ok(c.poiPondSkaterPose(s,750).dx>.45);
 assert.equal(c.poiPondSkaterPose(s,1120),null);
});
