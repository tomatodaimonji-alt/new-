const assert=require('node:assert/strict'),{test}=require('node:test'),vm=require('node:vm'),fs=require('node:fs');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const start=h.indexOf('function poiTownNpcActorSettle('),end=h.indexOf('function poiTownNpcFace(',start);
const mk=(opts={})=>{
 const path=[{x:1,z:0,y:0},{x:1,z:1,y:0},{x:2,z:1,y:0}];let plans=0,pulls=0,blocked=!!opts.blocked;
 const c={POI_TOWN_RESIDENT_TICK:380,POI_SOUTH_MERCHANT_ID:'southmerchant',poiTownNpcVersion:0,poiFreeCell:x=>Math.floor(x+.5),
  poiTownNpcKey:(x,z,y)=>[x,z,y].join(),poiTownNpcHere:(a,b)=>!!a&&!!b&&a.x===b.x&&a.z===b.z&&a.y===b.y,
  poiTownNpcFace:()=>{},poiTownFindPath:()=>{plans++;return path.map(a=>({...a}))},poiTownNpcGraph:()=>({}),
  poiTownNpcActorPinned:()=>false,poiTownNpcActorOccupied:()=>blocked,
  poiTownNpcNextTile:(a,x,z)=>({x,z,y:a.y}),poiActorHeading:()=>0,
  poiActorPickSegment:()=>{pulls++;return {used:2,target:path[1],length:Math.SQRT2}},
  poiActorFrameDt:(n,l,r)=>Math.min(n-l,r),poiActorAdvance:()=>({x:.15,z:.08,stopped:true,distance:.17})};
 const api=vm.runInNewContext(h.slice(start,end)+';({move:poiTownNpcMove,run:poiTownNpcActorRun})',c);
 const goal={x:3,z:1,y:0};
 const actor={role:{id:opts.id||'towncook'},x:0,z:0,y:0,path:null,nextPlan:0};
 return {actor,goal,api,stats:()=>({pulls,plans}),unblock(){blocked=false}};
}
test('failed angled leg at same origin attempts one valid cardinal step before retrying angles',()=>{
 const {actor,goal,api,stats}=mk();
 api.move(actor,goal,'errand',0,{plans:2});
 assert(actor.actorLeg); assert.equal(stats().pulls,1);
 api.run(actor,64,{});
 assert.equal(actor.actorLeg,null);
 api.move(actor,goal,'errand',444,{plans:2});
 assert.deepEqual([actor.x,actor.z],[1,0]);assert.equal(stats().pulls,1);
 actor.path=null;
 api.move(actor,goal,'errand',824,{plans:2});
 assert.equal(stats().pulls,2);
});
test('failed angle cannot bypass occupancy; retry is preserved until actual valid cardinal progress',()=>{
 const {actor,goal,api,stats,unblock}=mk({blocked:true});
 api.move(actor,goal,'errand',0,{plans:2});
 api.run(actor,64,{});
 api.move(actor,goal,'errand',444,{plans:2});
 assert.deepEqual([actor.x,actor.z],[0,0]);assert.equal(stats().pulls,1);
 unblock();api.move(actor,goal,'errand',824,{plans:2});
 assert.deepEqual([actor.x,actor.z],[1,0]);assert.equal(stats().pulls,1);
});
test('Tobin uses the exact cardinal path only for authored pickup and return',()=>{
 for(const label of ['supply-pickup','supply-return','going-work']){
  const {actor,goal,api,stats}=mk({id:'toolkeeper'});
  api.move(actor,goal,label,0,{plans:2});
  assert.equal(!!actor.actorLeg,label==='going-work');
  assert.equal(stats().pulls,label==='going-work'?1:0);
 }
});
