const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
test('shared loot support follows paved center mesh, keeps natural surfaces low, and never doubles lookout elevation',()=>{
 const start=h.indexOf('function poiLootFloorTop('),end=h.indexOf('function poiEconomyDraw(',start);
 assert(start>=0&&end>start,'missing draw-only floor support');
 const world=[{x:1,z:3,y:-1,type:'stone'},{x:2,z:3,y:-1,type:'roadBasaltFull'},{x:3,z:3,y:0,type:'roadGravelFull'},
  {x:4,z:3,y:0,type:'roadGravelDiagonal'},{x:5,z:3,y:0,type:'grassPebbles'},{x:6,z:3,y:0,type:'moss'},
  {x:7,z:3,y:0,type:'stone'},{x:8,z:3,y:0,type:'woodfloorDark'},{x:9,z:3,y:0,type:'river'}];
 const c={world,isFloor:t=>t!=='bridgeStone',ROAD_IDS:new Set(['roadBasaltFull','roadGravelFull','roadGravelDiagonal']),
 ROAD_DIAGONALS:new Set(['roadGravelDiagonal'])};
 vm.createContext(c);vm.runInContext(h.slice(start,end),c);
 assert.equal(c.poiLootFloorTop(1,3,-1),.13);assert.equal(c.poiLootFloorTop(1,3,0),0);
 assert.equal(c.poiLootFloorTop(2,3,-1),.13);assert.equal(c.poiLootFloorTop(3,3,0),.13);
 assert.equal(c.poiLootFloorTop(4,3,0),.115);
 assert.equal(c.poiLootFloorTop(5,3,0),0);assert.equal(c.poiLootFloorTop(6,3,0),0);
 assert.equal(c.poiLootFloorTop(7,3,0,.13),.13);assert.equal(c.poiLootFloorTop(8,3,0),.13);
 assert.equal(c.poiLootFloorTop(9,3,0),0);
 world.push({x:7,z:3,y:0,type:'moss'});assert.equal(c.poiLootFloorTop(7,3,0),0,'grade uses last floor exactly like scene');
});
test('both opaque pickup meshes use the mapped support when built, not the shader or pickup path',()=>{
 const span=(a,b)=>h.slice(h.indexOf(a),h.indexOf(b,h.indexOf(a)));
 assert.match(span('function poiEconomyDraw(','function poiDrawLootMesh('),/poiLootFloorTop\(x,z,0,lookout\)/);
 assert.match(span('function poiInventoryDraw(','\/\/ BEGIN MINE VAULT'),/poiLootFloorTop\(d.x,d.z,d.y,lookout\)/);
});
