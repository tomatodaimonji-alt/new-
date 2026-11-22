const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const actor=(id,x,z,fromX,fromZ)=>({role:{id,name:id,role:'visitor'},x,z,y:0,fromX,fromZ,fromY:0,moveAt:100,activity:'walk'});
function stage(actors){
 const blocked=new Set(), monsters=new Map(), c=vm.createContext({$:()=>null,performance:{now:()=>100},
  poiTownNpcActive:()=>true,poiTownNpcActors:actors,poiWalkX:5,poiWalkZ:5,poiWalkFacing:0,poiWalkLevel:0,
  poiMonsterStates:monsters,poiTownNpcGraph:()=>({}),poiTownNpcNextTile:(p,x,z)=>blocked.has(x+','+z)?null:{x,z,y:p.y},
  poiShopSync(){},poiTownNpcFace(a,f){a.facing=f},POI_TOWN_RESIDENT_TICK:250});
 const vis=html.slice(html.indexOf('function poiTownNpcStepT('),html.indexOf('function poiTownNpcVisualCadence('));
 vm.runInContext(vis+html.match(/\/\/ BEGIN TOWN DIALOGUE\n([\s\S]*?)\/\/ END TOWN DIALOGUE/)[1],c);
 return {c,blocked,monsters};
}
test('moving side target stays the same actor after the motion ends and another actor enters the direct tile',()=>{
 const a=actor('a',6,4,6,5),b=actor('b',3,5,3,4),{c}=stage([a,b]);
 assert.equal(c.poiTownDialogueTarget(170),a);
 assert.equal(c.poiTownDialogueAction(170),true);
 b.x=5;b.z=4;
 assert.equal(c.poiTownDialogueUpdate(370),a);
 assert.equal(c.poiTownDialogueSnapshot().id,'a');
 c.poiTownDialogueClose();
 assert.equal(c.poiTownDialogueTarget(371),b);
});
test('direct stationary target still beats the relaxed moving target',()=>{
 const a=actor('a',6,4,6,5),b=actor('b',5,4,3,4),{c}=stage([a,b]);
 assert.equal(c.poiTownDialogueTarget(170),b);
});
test('no relaxed talk through corner, on another floor, from behind, at long range, while asleep or in combat',()=>{
 const a=actor('a',6,4,6,5),{c,blocked,monsters}=stage([a]);
 for(const closed of ['5,4','6,5']){blocked.add(closed);assert.equal(c.poiTownDialogueTarget(170),null);blocked.clear()}
 monsters.set({y:0},{hp:8,x:6,z:5});assert.equal(c.poiTownDialogueTarget(170),null);monsters.clear();
 for(const options of [{y:1},{x:5,z:6,fromX:6,fromZ:6},{x:8,z:4,fromX:7,fromZ:4},{activity:'sleep-home'},{target:{}},{hitAt:123}]){
  const original={...a};Object.assign(a,options);
  assert.equal(c.poiTownDialogueTarget(170),null);Object.assign(a,original,{target:null,hitAt:null});
 }
 assert.equal(c.poiTownDialogueTarget(400),null,'no fresh relaxed link to stationary actors');
});
