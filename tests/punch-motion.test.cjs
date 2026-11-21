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
 x.deco=(m,id,px,py,pz)=>{heldCalls++;x.cube(m,px,py,pz,.15,1.4,.1,[.5,.3,.2]);m.p.push(px,py+.25,pz);m.n.push(0,1,0);m.c.push(.5,.3,.2)};
 vm.runInContext(grab('function tri(','function addPart(')+grab('function characterHuman(','function roundStack(')+grab('function poiWalkPunchPose(','function poiMonsterRender('),x);
 return {scope:x,sample:t=>{x.poiWalkAvatar(t);return x.poiWalkMesh},held:()=>heldCalls};
}

test('bare hands wind up, extend along facing, return, and keep both feet planted',()=>{
 const {sample}=avatar(),idle=sample(300),wind=sample(62),hit=sample(114),returning=sample(195),done=sample(270);
 const lower=m=>m.p.filter((v,i)=>i%3!==1&&m.p[i-i%3+1]<.44);
 const right=m=>m.p.filter((v,i)=>i%3===2&&m.p[i-2]>.72&&m.p[i-1]>.47);
 const front=m=>Math.max(...right(m)),back=m=>Math.min(...right(m));
 assert(back(wind)<back(idle)-.12);assert(front(hit)>front(idle)+.32);
 assert(front(returning)<front(hit)-.06);assert.deepEqual(idle.p,done.p);
 assert.deepEqual(lower(hit),lower(idle));assert(hit.n.every(Number.isFinite));
 const west=avatar(null,3);assert(Math.min(...west.sample(114).p.filter((v,i)=>i%3===0))<.13);
});
test('held sword and bare hands retain attack snapshot when equipment changes',()=>{
 const {scope,sample,held}=avatar('equipWoodSword');
 const wind=sample(62),done=sample(270);
 assert(held()>=2);assert(wind.p.length===done.p.length);
 vm.runInContext("poiWalkActionWeapon=null",scope);
 const bare=sample(62);
 assert(bare.p.length<wind.p.length);
 assert.equal(sample(270).p.length,wind.p.length);
});

test('the sword traces a high windup, front contact and low cross-body follow-through in every direction',()=>{
 const local=(x,z,f)=>f===0?[1-x,1-z]:f===1?[1-z,x]:f===2?[x,z]:[z,1-x];
 for(let facing=0;facing<4;facing++){
  const {sample}=avatar('equipWoodSword',facing),bare=avatar(null,facing).sample(300);
  const frame=t=>{
   const m=sample(t),p=m.p.slice(bare.p.length),points=[];
   const grip=m.p.slice(-3);
   let near=Infinity;
   for(let i=0;i<bare.p.length;i+=3)near=Math.min(near,Math.hypot(grip[0]-m.p[i],grip[1]-m.p[i+1],grip[2]-m.p[i+2]));
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
