const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {runInNewContext}=require('node:vm');
const html=readFileSync(process.env.WORKSHOP_HTML||require('node:path').join(__dirname,'../world-editor.html'),'utf8');
const extract=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
function town(tiles){
 const walk=new Set(tiles.map(p=>p.join(','))),blocked={x:101,z:112,y:0};
 const m={POI_TOWN_RESIDENT_TICK:380,POI_SOUTH_MERCHANT_ID:'southmerchant',poiTownNpcVersion:0,poiWalkX:101,poiWalkZ:112,checks:0,
  poiTownNpcGraph:()=>null,poiTownNpcStance:p=>walk.has([p.x,p.z,p.y].join(',')),
  poiTownNpcNextTile:(p,x,z)=>walk.has([x,z,p.y].join(','))?{x,z,y:p.y}:null,
  poiTownNpcPlayerBodyBlocks:(x,z,nx,nz,y)=>{m.checks++;return !!blocked.enabled&&nx===blocked.x&&nz===blocked.z&&y===blocked.y;}};
 runInNewContext(extract('const poiTownNpcKey=','function poiTownNpcActive(')+
  extract('function poiTownFindPath(','function poiTownNpcExistsBed(')+
  extract(html.includes('function poiTownNpcPlayerBlocksStep(')?'function poiTownNpcPlayerBlocksStep(':'function poiTownNpcMove(','function poiTownNpcAct('),m);
 return {m,blocked,actor:{x:101,z:113,y:0,role:{id:'southmerchant'}},goal:{x:105,z:111,y:0}};
}
const direct=[[101,113],[101,112],[101,111],[102,111],[103,111],[104,111],[105,111]].map(p=>[...p,0]);
test('merchant replans around an idle player without crossing their body',()=>{
 const {m,blocked,actor,goal}=town([...direct,[100,113,0],[100,112,0],[100,111,0]]);
 blocked.enabled=true;
 m.poiTownNpcMove(actor,goal,'shipment',0,{plans:1});
 assert.deepEqual([actor.x,actor.z],[101,113]);
 const route=[];
 for(let now=380;now<=3800;now+=380){
  m.poiTownNpcMove(actor,goal,'shipment',now,{plans:1});route.push([actor.x,actor.z]);
 }
 assert.deepEqual(route[0],[100,113]);
 assert(!route.some(([x,z])=>x===101&&z===112));
 assert.deepEqual(route.at(-1),[105,111]);
});
test('fully blocked doorway waits with a bounded retry and never moves the player',()=>{
 const {m,blocked,actor,goal}=town(direct);blocked.enabled=true;
 m.poiTownNpcMove(actor,goal,'shipment',0,{plans:1});m.poiTownNpcMove(actor,goal,'shipment',380,{plans:1});
 const plan={plans:1};m.poiTownNpcMove(actor,goal,'shipment',760,plan);
 assert.equal(plan.plans,1);assert.deepEqual([actor.x,actor.z],[101,113]);
 blocked.enabled=false;m.poiTownNpcMove(actor,goal,'shipment',2300,{plans:1});
 assert.deepEqual([actor.x,actor.z],[101,112]);
});
