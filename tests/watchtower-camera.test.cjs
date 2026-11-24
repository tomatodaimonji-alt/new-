const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||path.join(__dirname,'../world-editor.html'),'utf8');
const begin=html.indexOf('let facilityWatchtowerCameraWalls=');
const end=html.indexOf('function parameters()',begin);
function camera(world=[]){
 assert.ok(begin>=0&&end>begin,'scoped camera helper missing');
 const ctx=vm.createContext({world,facilitySite:{id:'base'},terrainY:()=>0,isWallId:id=>id==='stonewall',poiWalkPassableDoor:id=>id==='ruinDoorBroken'});
 vm.runInContext(html.slice(begin,end),ctx);
 return {ctx,clamp:(...args)=>ctx.facilityWatchtowerCameraEye(...args)};
}
const blocked=[{x:86,z:38,y:1,type:'towerWindow',rot:0},{x:86,z:38,y:0,type:'ruinDoorBroken',rot:0},
 ...[84,85,87,88].flatMap(x=>[0,1,2].map(y=>({x,z:38,y,type:y===2?'towerBattlement':'stonewall',rot:0})))];
test('keeps the third-person eye on the player side of the wall, including the QA angle at the south threshold',()=>{
 const {clamp}=camera(blocked);
 const target=[86.5,1.1,39.5],eye=[86.5,1.1+5.5*Math.sin(.35),39.5-5.5*Math.cos(.35)];
 const settled=clamp(target,eye);
 assert.ok(settled[2]>39.02||settled[0]>89.07||settled[0]<83.93,settled);
 assert.ok(Math.hypot(...settled.map((v,i)=>v-target[i]))>=1.8,'camera must not enter the avatar');
 assert.deepEqual(settled,clamp(target,eye),'emergency orbit is stable');
 assert.ok(settled[1]>1.1&&settled[1]<=eye[1]);
 const side=clamp([85.5,1.1,39.5],[85.5,3,35]);
 assert.ok(side[2]>39.02||side[0]>89.07||side[0]<83.93,side);
 const clear=[86.5,3.9,44.5];
 assert.equal(clamp(target,clear),clear,'unobstructed hand-controlled orbit unchanged');
});
test('edit invalidation, other routes, and the rest of the base are not clipped',()=>{
 const {ctx,clamp}=camera(blocked);
 const target=[86.5,1.1,39.5],eye=[86.5,3,34.3];
 assert.notEqual(clamp(target,eye),eye);
 ctx.facilitySite.id='kitchen';assert.equal(clamp(target,eye),eye);
 ctx.facilitySite.id='base';ctx.world=[];
 vm.runInContext('facilityWatchtowerCameraWalls=null',ctx);assert.equal(clamp(target,eye),eye);
 const westEye=[50,2,33];assert.equal(clamp([50,1,38],westEye),westEye);
 const start=html.indexOf('  const mineCamera=',end),stop=html.indexOf('  const arm=',start);
 assert.ok(start>end&&stop>start,'mine and tower share the real third-person eye selection');
 const select=html.slice(start,stop);
 const branch=Function('facilitySite','poiWalkLevel','x','z','poiDungeonPointIn','poiDungeonTravelKey',
  'facilityMineCameraWalls','sceneMesh','facilityMineCameraEye','facilityWatchtowerCameraEye','target','desired',
  select+';return eye;');
 const run=(id,y,inside,realm)=>branch({id,mine:{bounds:{}}},y,86,39,()=>inside,()=>realm,
  actual=>{assert.equal(actual,'scene');return 'walls'},'scene',
  (start,desired,walls)=>{assert.equal(walls,'walls');return 'mine'},()=> 'tower',target,eye);
 assert.equal(run('base',0,true,null),'tower','surface watchtower still takes its established helper');
 assert.equal(run('base',-1,true,null),'mine','B1 abandoned mine uses the targeted wall clip');
 assert.equal(run('base',-1,false,null),'tower','distant B1 sections retain their existing branch');
 assert.equal(run('base',-1,true,'chapel'),'tower','other realm remains on its previous route');
 assert.equal(run('kitchen',-1,true,null),'tower','standalone sessions retain their previous route');
 const invalidate=html.indexOf('function facilityInvalidateScenes(){');
 assert.ok(invalidate>=0&&html.slice(invalidate,invalidate+240).includes('facilityWatchtowerCameraWalls=null;'),'global edits still invalidate watchtower wall geometry');
});
