const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function setup(){
 const start=h.indexOf('// BEGIN PLAYER WEAPON PROFILES'),end=h.indexOf('// END PLAYER WEAPON PROFILES');
 assert(start>=0&&end>start);
 const counts={walls:0,avatar:0,strip:0,projectile:0,draw:0};
 const c={poiWalkActive:true,poiWalkLevel:0,poiWalkFacing:1,poiWalkX:10,poiWalkZ:10,pineAIActive:false,
  document:{hidden:false},poiWalkActionStarted:0,poiAttackReady:0,poiWalkActionWeapon:null,
  poiAimNewShot:s=>({...s,aim:{x:10,z:10,y:0},dx:1,dz:0}),poiWalkAvatar:()=>counts.avatar++,
  poiAimWall:()=>{counts.walls++;return ()=>true},poiAimWallLimit:(_o,_d,r)=>r,POI_AIM_EPS:1e-7,
  POI_SWORD_FORWARD:1.3,POI_SWORD_HALF_WIDTH:1.5,poiCreekPlayerHeight:()=>0,
  mesh:()=>({p:[]}),quad:m=>{counts.strip++;m.p.push(1)},cube:m=>{counts.projectile++;m.p.push(1)},
  upload:()=>({buf:1}),draw:()=>counts.draw++,gl:{deleteBuffer(){}},poiSound(){},facilitySite:null,terrainY:()=>0};
 const ctx=vm.createContext(c);
 const api=vm.runInContext(h.slice(start,end)+';({start:poiPlayerStartProfile,draw:poiPlayerWeaponDraw,pose:poiPlayerWeaponProfile,pending:()=>poiPlayerWeaponPending,mage:v=>poiEnemyMageBolts.push(v)});',ctx);
 return {api,counts};
}
test('physical sword still starts the timed motion and pending contact, but emits no geometry strip or preflight rays',()=>{
 const {api,counts}=setup();
 assert(api.start('equipWoodSword',100));
 assert.equal(api.pending().type,'equipWoodSword');
 assert.equal(api.pose('equipWoodSword').hit,108);assert.equal(api.pose('equipWoodSword').pose,296);
 assert.equal(counts.avatar,1);
 api.draw(208,{});
 assert.equal(counts.walls,0,'no ray work solely for removed trail');
 assert.equal(counts.strip,0,'no blue sword strip');
 assert.equal(counts.draw,0,'no upload/draw for a sword alone');
});
test('projectile draw is still routed through the real projectile renderer',()=>{
 const {api,counts}=setup();
 api.mage({type:'monsterSkelMage',x:10,z:10,y:0,toX:12,toZ:10,started:100,travel:200});
 api.draw(150,{});
 assert.equal(counts.projectile,3);assert.equal(counts.draw,1);
});
