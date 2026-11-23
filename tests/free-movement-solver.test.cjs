const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const {test}=require('node:test');
const BASELINE='world-editor.html';
const html=readFileSync(process.argv[2]||process.env.WORKSHOP_HTML||BASELINE,'utf8');
function loadMarked(name){
 const begin='// BEGIN '+name,end='// END '+name;
 if(!html.includes(begin)||!html.includes(end))return {};
 return vm.runInNewContext(html.split(begin)[1].split(end)[0]+'\n;({'+(name==='FREE MOVEMENT SOLVER'?
 'step:typeof poiFreeAdvance==="function"?poiFreeAdvance:null':'sample:typeof poiAnalogSample==="function"?poiAnalogSample:null')+'})');
}
const {step}=loadMarked('FREE MOVEMENT SOLVER'),{sample}=loadMarked('LANDSCAPE ANALOG MATH');
const tile=v=>Math.floor(v+.5);
const open=()=>true;
function advance(start,dx,dz,canStep=open,enter=()=>true,radius=.2){
 assert.equal(typeof step,'function','continuous swept motion is available in product');
 return step(start.x,start.z,dx,dz,radius,canStep,enter);
}
const near=(a,b,epsilon=1e-5)=>assert.ok(Math.abs(a-b)<epsilon,`expected ${a} within ${epsilon} of ${b}`);
function map(allowed,blockedEdges=new Set){
 return (x,z,fromX,fromZ)=>{
  assert.ok([x,z,fromX,fromZ].every(Number.isInteger),'only canonical cell coordinates reach game collision');
  assert.equal(Math.abs(x-fromX)+Math.abs(z-fromZ),1,'native collision is directional/cardinal');
  return allowed(x,z)&&!blockedEdges.has(`${fromX},${fromZ}>${x},${z}`);
 };
}
test('stick gives real analog power, keeping floating center and camera angle',()=>{
 assert.equal(sample(0,8,false,0),null);
 const half=sample(22,0,false,0),full=sample(44,0,false,0),outside=sample(88,0,false,0);
 assert.ok(half.power>0&&half.power<.6,'a lightly tilted stick walks less than full speed');
 near(full.power,1);near(outside.power,1);near(outside.knobX,44);
 const angled=sample(34,-17,false,0);
 assert.ok(angled.dx&&angled.dz);near(Math.hypot(angled.dx,angled.dz),1);
});
test('23 degree movement advances both components from the very first frame',()=>{
 const a=Math.PI*23/180,dx=Math.cos(a)*.115,dz=Math.sin(a)*.115;
 let state={x:0,z:0};
 for(let i=1;i<=4;i++){
  const after=advance(state,dx,dz);
  assert.notEqual(after.x,state.x);assert.notEqual(after.z,state.z);
  assert.equal(tile(after.x),0);assert.equal(tile(after.z),0);
  near(after.x,i*dx);near(after.z,i*dz);near(after.distance,.115);
  state=after;
 }
});
test('substep subdivision keeps a straight normalized path and exact center-entry events',()=>{
 const a=Math.PI/3,dx=Math.cos(a)*2.35,dz=Math.sin(a)*2.35;
 const edges=[];
 const record=(x,z,fromX,fromZ)=>{
  assert.equal(Math.abs(x-fromX)+Math.abs(z-fromZ),1);
  edges.push([x,z,fromX,fromZ]);
  return true;
 };
 const one=advance({x:0,z:0},dx,dz,open,record);
 let many={x:0,z:0};for(let i=0;i<120;i++)many=advance(many,dx/120,dz/120);
 near(one.x,many.x);near(one.z,many.z);near(one.distance,2.35);
 assert.equal(edges.length,tile(one.x)+tile(one.z),'only center crossings fire, not radius probes or render positions');
 assert.deepEqual(edges.at(-1)?.slice(0,2),[tile(one.x),tile(one.z)]);
});
test('wall radius holds and movement slides along an open edge',()=>{
 const wall=map(x=>x<=0);
 const entered=[];
 const end=advance({x:0,z:0},1.1,1.4,wall,(...e)=>{entered.push(e);return true});
 assert.ok(end.x>.28&&end.x<=.300001,'center keeps at least its radius from wall');
 near(end.z,1.4);
 assert.deepEqual(entered,[[0,1,0,0]],'probe of blocked cell does not send an enter event');
});
test('blocked diagonal corner cannot be cut in either reflected direction',()=>{
 for(const sign of [-1,1]){
  const allowed=map((x,z)=>x===0&&z===0||x===sign&&z===sign);
  const end=advance({x:0,z:0},sign*1.2,sign*1.2,allowed,()=>assert.fail('forbidden corner sent an enter event'));
  assert.ok(Math.abs(end.x)<=.300001&&Math.abs(end.z)<=.300001);
  assert.equal(tile(end.x),0);assert.equal(tile(end.z),0);
 }
});
test('a one-cell open doorway is passable while its side walls still clip movement',()=>{
 const room=map((x,z)=>Math.abs(x)<=1&&(z!==1||x===0));
 const seen=[];
 const end=advance({x:0,z:0},0,2,room,(x,z)=>{seen.push([x,z]);return true});
 near(end.x,0);near(end.z,2);assert.deepEqual(seen,[[0,1],[0,2]]);
 const outside=advance({x:.65,z:0},0,.9,room);
 assert.ok(outside.z<.301,'adjacent wall stops player rather than teleporting through open doorway');
});
test('bridge admits only its cardinal longitudinal edges; oblique input cannot escape sideways',()=>{
 const bridge=map((x,z)=>z<1||z>2||x===0,new Set(['0,1>1,1','0,2>1,2','0,2>1,3']));
 let seen=[];
 const end=advance({x:0,z:.8},.65,1.85,bridge,(x,z)=>{seen.push([x,z]);return true});
 assert.ok(end.z>2.5,'forward component continues through the bridge');
 assert.ok(seen.every(([x,z])=>(z<1||z>2||x===0)),'no water center cell entered');
 assert.deepEqual(seen.slice(0,2),[[0,2],[0,3]]);
 assert.equal(tile(end.x),0);
});
test('directional seam uses the real source edge, not only destination occupancy',()=>{
 const wall=map(()=>true,new Set(['0,0>1,0']));
 const east=advance({x:0,z:0},.85,0,wall);
 assert.ok(east.x<=.300001);
 const west=advance({x:1,z:0},-.75,0,wall);
 near(west.x,.25);
});
test('a consumed portal or stair event halts remaining motion synchronously',()=>{
 let count=0;
 const end=advance({x:0,z:0},2.4,.6,open,(x,z,fromX,fromZ)=>{
  assert.deepEqual([x,z,fromX,fromZ],[1,0,0,0]);count++;return false;
 });
 assert.equal(count,1);assert.equal(end.stopped,true);
 assert.ok(end.x<1&&end.z<.25,'no inherited thumb displacement after teleport/stair transaction');
});
