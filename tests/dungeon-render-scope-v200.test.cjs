const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const h=fs.readFileSync('world-editor.html','utf8');
function setup(){
 const a=h.indexOf('function poiDungeonPointIn('),b=h.indexOf('function poiChapelWater(',a);
 const c={facilitySite:{id:'base',chapel:{bounds:{y:-1,x1:73,x2:83,z1:73,z2:90}},otherworld:{bounds:{y:-1,x1:95,x2:109,z1:73,z2:93}}},poiWalkX:116,poiWalkZ:61,poiWalkLevel:-1};
 vm.createContext(c);vm.runInContext(h.slice(a,b),c);return c;
}
test('mine retains all authored enemies inclusive of annex; dragon/chapel on same B1 excluded',()=>{
 const c=setup();
 for(const [x,z] of [[115,59],[120,55],[101,61],[110,56],[121,43]])assert.equal(c.poiDungeonVisualVisible(x,z,-1),true);
 assert.equal(c.poiDungeonVisualVisible(101,79,-1),false);
 assert.equal(c.poiDungeonVisualVisible(79,78,-1),false);
 assert.equal(c.poiDungeonVisualVisible(120,55,0),false);
});
test('realm focus is reciprocal and all unrelated sessions preserve same-floor visibility',()=>{
 const c=setup();
 c.poiWalkX=100;c.poiWalkZ=90;
 assert.equal(c.poiDungeonVisualVisible(101,79,-1),true);
 assert.equal(c.poiDungeonVisualVisible(120,55,-1),false);
 c.poiWalkX=78;c.poiWalkZ=88;
 assert.equal(c.poiDungeonVisualVisible(79,78,-1),true);
 assert.equal(c.poiDungeonVisualVisible(101,79,-1),false);
 c.facilitySite={id:'standalone'};assert.equal(c.poiDungeonVisualVisible(101,79,-1),true);
 c.facilitySite=null;assert.equal(c.poiDungeonVisualVisible(101,79,-1),true);
});
test('actor mesh, HP labels, debris and loose pickups use the same scope',()=>{
 for(const [a,b] of [['function poiRenderEnemyHealth(','function poiMonsterAt('],['function poiMonsterRender(now','// BEGIN PLAYER DEFEAT'],['function poiMonsterDrawBreaks(','let poiSlimeMeshAnimating'],['function poiInventoryDraw(','// BEGIN MINE VAULT']]){
  const start=h.indexOf(a);assert.match(h.slice(start,h.indexOf(b,start+1)),/poiDungeonVisualVisible/);
 }
});

