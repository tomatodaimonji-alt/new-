const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(s,e)=>{const i=h.indexOf(s),j=h.indexOf(e,i+s.length);a.ok(i>=0&&j>i,s);return h.slice(i,j)+'\n'};
const mesh=()=>({p:[],n:[],c:[]});
const tri=(m,...rows)=>{const c=rows.pop();for(const p of rows){m.p.push(...p);m.n.push(.44,.68,.58);m.c.push(...c)}};
const fake=(m)=>tri(m,[0,.25,0],[.22,.25,.11],[-.07,1.48,.05],[.4,.4,.4]);
const c=vm.createContext({mesh,tri,quad:tri,poiRoleToolGripStyle:()=>null,POI_SWORD_HALF_WIDTH:1.5,
 characterHuman(){},deco:(m,k)=>k==='equipLongStaff'?c.poiLongWoodStaffGeometry(m,0,0,0):
 k==='equipNorthMinotaurAxe'?c.poiNorthMinotaurAxeGeometry(m,0,0,0):fake(m)});
vm.runInContext(cut('function poiLongWoodStaffGeometry(','\nfunction ')+cut('function poiNorthMinotaurAxeGeometry(','\nfunction ')+
 cut('// BEGIN WORLD MELEE REACH','// END WORLD MELEE REACH')+
 cut('function poiLongStaffGripStyle(','function poiWalkAvatar(')+cut('function characterArmRotation(','function roundStack('),c);
const axe='equipNorthMinotaurAxe',staff='equipLongStaff';
const xyz=(m,i)=>m.p.slice(i,i+3);
const distance=(m,i,j)=>Math.hypot(...xyz(m,i).map((v,k)=>v-m.p[j+k]));
test('world avatar mesh of every rigid melee weapon preserves size across wind-up, contact, moving wall hit and recovery',()=>{
 for(const [k,range,hit,pose,sweep] of [
  [staff,2,210,400],[axe,2.55,300,670],['equipWoodSword',1.3,108,296,true],['equipBoneSword',1.55,108,296,true],
  ['equipIronSword',2,108,296,true],['kitchenKnife',1,80,190],['equipStoneMace',1,380,620],
  ['equipPlainStaff',1,140,300],['equipStick',1,0,152],['equipClub',1,0,152],['equipStoneSword',1,0,152]]){
  const idle=c.poiBuildPlayerMesh(k,null,null,0,0,0,0,0,.83,true);
  const props=[{range,hit,pose,sweep,frontArc:k===axe},hit?hit*.72:0];
  const reach=ms=>hit?c.poiWorldMeleePlan(k,props[0],ms):{mix:.7,side:0,forward:1,height:.75};
  for(const [ms,mix,side,forward] of [[props[1]], [hit],[hit,.48,.11,.42], [hit+(pose-hit)*.55]]){
   const q=reach(ms);if(q&&mix!==undefined)Object.assign(q,{mix,side,forward});
   const moving=c.poiBuildPlayerMesh(k,{strike:1.53,sweep:-.23,twist:.1,edgeTilt:1.40,meleeReach:q},null,.111,0,8,1,15,-.37,true);
   a.equal(moving.p.length,idle.p.length,k);
   const end=idle.p.length-3,step=Math.max(3,Math.floor(end/21)*3);
   for(let i=0;i<end;i+=step){
    const before=distance(idle,i,end),now=distance(moving,i,end);
    a.ok(Math.abs(before-now)<1e-6,`${k} changed dimensions at ${ms}ms: ${before}→${now}`);
   }
  }
 }
});
test('the long wooden staff is substantially longer at idle than the old catalog wrist transform',()=>{
 const maxPair=m=>{let max=0;for(let i=0;i<m.p.length;i+=15)for(let j=0;j<m.p.length;j+=15)max=Math.max(max,distance(m,i,j));return max};
 const idle=c.poiBuildPlayerMesh(staff,null,null,0,0,0,0,0,0,true);
 const catalogue=c.poiBuildPlayerMesh(staff,null,null,0,0,0,0,0,0,false);
 a.ok(maxPair(idle)>=maxPair(catalogue)*1.35);
});
function apexIndex(type){
 const m=mesh();c.deco(m,type);
 let tip=0;
 for(let i=3;i<m.p.length;i+=3)if(m.p[i+1]>m.p[tip+1])tip=i;
 return tip;
}
test('ordinary contact reaches the original boundary with the real branch and axe; close walls lift their fixed blades',()=>{
 for(const [id, range,height,hit,pose,poseFor] of [[staff,2,.74,210,400,()=>({strike:-4.85,sweep:-.09,twist:.10,edgeTilt:Math.PI/2,edgeYaw:.14})],
  [axe,2.55,.83,300,670,()=>({strike:1.54,sweep:-.15,twist:.04,edgeTilt:1.57,edgeYaw:0})]]){
  const q=c.poiWorldMeleePlan(id,{range,hit,pose,frontArc:id===axe},hit);
  const build=q=>c.poiBuildPlayerMesh(id,{...poseFor(),meleeReach:q},null,0,0,0,0,0,0,true);
  const full=build(q),tip=apexIndex(id),[x,y,z]=xyz(full,tip);
  a.ok(Math.hypot(x,y-height,z-range)<.015,`${id} usual stationary tip at actual range: ${[x,y,z]}`);
  const wall=build({...q,forward:.74,wall:true}),wt=xyz(wall,tip);
  a.ok(Math.hypot(wt[0],wt[2]-.74)<1e-8&&wt[1]>y+.4,`${id} fixed blade lifts before wall: ${wt}`);
 }
});
test('actual axe crest first through the committed arc; rotation preserves tip direction and grip',()=>{
 const src=mesh();c.deco(src,axe);
 let crest=0;for(let i=0;i<src.p.length;i+=3)if(src.c[i]===.735&&src.p[i]>src.p[crest])crest=i;
 a.ok(src.p[crest]>.62);
 const g={x:.21,y:.85,z:.40},grip=[0,.64,0],lead=xyz(src,apexIndex(axe));
 const scale=[.58,1,.53],wrist=(...p)=>p;
 const plan=t=>c.poiWorldMeleePlan(axe,{range:2.55,hit:300,pose:670,frontArc:true},t);
 for(const t of [235,275,300,355,415]){
  const p=plan(t),pre=plan(t-1),post=plan(t+1),orient=c.poiRigidHeldRotation(p,g,lead,grip,scale,wrist);
  const point=p=>orient(...p.map((n,i)=>(n-grip[i])*scale[i]));
  const front=point(xyz(src,crest)),heel=point([-.14,src.p[crest+1],src.p[crest+2]]);
  const dot=(front[0]-heel[0])*(post.side-pre.side)+(front[2]-heel[2])*(post.forward-pre.forward);
  a.ok(dot>0,'sharp positive model X still faces direction of travel');
  a.ok(Math.hypot(...point(grip))<1e-9);
 }
});
