const assert=require('node:assert/strict'),{test}=require('node:test'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const grab=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i+1);assert(i>=0&&j>i,'missing '+a);return html.slice(i,j)};
function avatar(armed=null,facing=2){
 let heldCalls=0;
 const x={poiWalkMesh:null,gl:{deleteBuffer(){}},poiWalkActive:true,mesh:()=>({p:[],n:[],c:[]}),
  poiWalkStarted:-900,POI_WALK_MS:170,poiWalkViewX:0,poiWalkViewZ:0,poiWalkFromX:0,poiWalkFromZ:0,
  poiWalkX:0,poiWalkZ:0,poiWalkLevel:0,poiWalkFacing:facing,poiCreekPlayerHeight:()=>0,poiWalkActionStarted:0,
  poiEquippedWeapon:()=>armed,EQUIPMENT_IDS:['equipWoodSword'],
  upload:m=>m,performance:{now:()=>0}};
 vm.createContext(x);
 x.deco=(m,id,px,py,pz)=>{heldCalls++;x.cube(m,px,py,pz,.15,1.4,.1,[.5,.3,.2]);m.p.push(px,py+.25,pz);m.n.push(0,1,0);m.c.push(.5,.3,.2);x.propVertices=m.p.length};
 vm.runInContext(grab('function tri(','function addPart(')+grab('function naturalBranch(','function naturalCrown(')+grab('function characterHuman(','function roundStack(')+grab('function poiWalkPunchPose(','function poiMonsterRender('),x);
 return {scope:x,sample:t=>{x.poiWalkAvatar(t);return x.poiWalkMesh},held:()=>heldCalls};
}

test('bare hands contact on press, follow through, return, and keep both feet planted',()=>{
 const {sample}=avatar(),idle=sample(300),hit=sample(0),follow=sample(42),returning=sample(114),done=sample(270);
 // The first two production mesh cubes are the feet/legs, before any
 // moving arms. This avoids misclassifying a dropped fist as a leg.
 const lower=m=>m.p.slice(0,2*36*3).filter((_v,i)=>m.p[i-i%3+1]<.20);
 const front=m=>Math.max(...m.p.filter((v,i)=>i%3===2));
 assert(front(hit)>front(idle)+.32);assert(front(follow)>front(hit)-.03);
 assert(front(returning)<front(hit)-.12);assert.deepEqual(idle.p,done.p);
 assert.deepEqual(lower(hit),lower(idle));assert(hit.n.every(Number.isFinite));
 const west=avatar(null,3);assert(Math.min(...west.sample(0).p.filter((v,i)=>i%3===0))<.13);
});
test('held sword and bare hands retain attack snapshot when equipment changes',()=>{
 const {scope,sample,held}=avatar('equipWoodSword');
 const wind=sample(62),done=sample(270);
 assert(held()>=2);assert(wind.p.length===done.p.length);
 vm.runInContext("poiWalkActionWeapon=null",scope);
 const previouslyHeld=held();
 const bare=sample(62);
 assert.equal(held(),previouslyHeld,'in-progress unarmed snapshot does not render newly equipped tool');
 assert.notDeepEqual(bare.p,wind.p);
 assert.equal(sample(270).p.length,wind.p.length);
 assert.equal(held(),previouslyHeld+1,'current equipment resumes after the existing attack pose');
});

test('the sword traces a high windup, front contact and low cross-body follow-through in every direction',()=>{
 const local=(x,z,f)=>f===0?[1-x,1-z]:f===1?[1-z,x]:f===2?[x,z]:[z,1-x];
 for(let facing=0;facing<4;facing++){
  const {sample,scope}=avatar('equipWoodSword',facing);
  const frame=t=>{
   const m=sample(t),first=m.p.length-scope.propVertices,p=m.p.slice(first),points=[];
   const grip=m.p.slice(-3);
   let near=Infinity;
   for(let i=0;i<first;i+=3)near=Math.min(near,Math.hypot(grip[0]-m.p[i],grip[1]-m.p[i+1],grip[2]-m.p[i+2]));
   assert(near<.12,'weapon grip must stay inside the moving right hand');
   for(let i=0;i<p.length-3;i+=3){
    const [x,z]=local(p[i],p[i+2],facing);points.push([x,p[i+1],z]);
   }
   return {mesh:m,maxY:Math.max(...points.map(q=>q[1])),front:Math.max(...points.map(q=>q[2])),
    left:Math.min(...points.map(q=>q[0]))};
  };
  const ready=frame(300),wind=frame(52),hit=frame(108),follow=frame(158),rest=frame(270);
  assert(wind.maxY>ready.maxY+.25,'lift over shoulder');
  assert(hit.front>wind.front+.4,'blade crosses toward the attack cell');
  assert(follow.left<hit.left-.24&&follow.maxY<wind.maxY-.35,'momentum carries downward and across');
  assert.equal(wind.mesh.p.length,ready.mesh.p.length);
  assert.deepEqual(rest.mesh.p,ready.mesh.p);
 }
});
