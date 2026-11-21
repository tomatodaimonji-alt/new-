const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const predicate=html.slice(html.indexOf('function poiWalkCanStep('),html.indexOf('function poiWalkCamera('));
const item=(type,y=0)=>({x:2,z:2,y,type,rot:0});
function canStep(world,level=0,facilitySite=null){
 return vm.runInNewContext(predicate+'\npoiWalkCanStep(2,2)',{
  world,facilitySite,poiWalkLevel:level,poiWalkActive:true,
  validPos:()=>true,pineSuperVehicleType:()=>false,poiIsMonster:()=>false,
  poiMonsterAt:()=>null,poiWalkPassableDoor:t=>t.endsWith('Door'),
  isFloor:t=>t==='woodfloorLight',isWallId:t=>t.endsWith('wall'),
  facilityValidLanding:(x,z,y)=>world.some(o=>o.x===x&&o.z===z&&o.y===y&&o.type==='woodfloorLight')
 });
}
test('benches are passable with a floor in both common play and facility play',()=>{
 for(const facility of [null,{}]){
  assert.equal(canStep([item('benchWood'),item('woodfloorLight')],0,facility),true);
  assert.equal(canStep([item('benchWood',1),item('woodfloorLight',1)],1,facility),true);
 }
});
test('the bench exception never permits crossing a stacked wall or upper void',()=>{
 for(const facility of [null,{}]){
  assert.equal(canStep([item('benchWood'),item('woodfloorLight'),item('woodwall')],0,facility),false);
  assert.equal(canStep([item('benchWood',1)],1,facility),false);
 }
});
