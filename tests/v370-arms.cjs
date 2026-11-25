const a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.argv[2],'utf8');
const slice=(s,e)=>{let i=h.indexOf(s),j=h.indexOf(e,i+1);a(i>=0&&j>i,s);return h.slice(i,j)};
const arms=slice('// BEGIN PLAYER BARE HAND RIG','// END PLAYER BARE HAND RIG')
.replace(' const P=p=>',' observed.push(arms);\n const P=p=>');
const model=slice('function poiBuildPlayerMesh(','function poiWalkAvatar(');
const source=slice('function characterArmRotation(','function roundStack(')+slice('const FRONTIER_HUMANS=','function frontierHumanShape(')+arms+model;
const c=vm.createContext({facilitySite:{playerAppearance:'kai'},observed:[],mesh:()=>({p:[],n:[],c:[]}),frontierHumanShape(){},rot2:(x,z)=>[x,z],poiHumanGearType:()=>null,poiRoleClothingTone:()=>null,poiRoleToolGripStyle:()=>null,POI_RIGID_HELD_LEAD:{},deco(){},quad(){},tri(){}});
vm.runInContext(source,c);
function sample(w,stride,age=Infinity){c.w=w;c.stride=stride;c.age=age;return vm.runInContext('poiBuildPlayerMesh(w,w?null:poiBareFistPose(age),null,stride); observed.at(-1)',c)}
function angle({shoulder:s,elbow:e,wrist:w}){const v=e.map((x,i)=>x-s[i]),u=w.map((x,i)=>x-e[i]);return v.reduce((n,x,i)=>n+x*u[i],0)/(Math.hypot(...v)*Math.hypot(...u))}
for(const w of [null,'equipWoodSword']){
 const zero=sample(w,0),pos=sample(w,.12),neg=sample(w,-.12);
 for(const side of ['right','left']){
  for(const rig of [zero,pos,neg])a(angle(rig[side])>.99999,`elbow bends during noncombat: ${w} ${side}, cosine ${angle(rig[side])}`);
  a.deepEqual(pos[side].shoulder,zero[side].shoulder,'walking pivots at shoulder');
  a((pos[side].wrist[2]-zero[side].wrist[2])*(neg[side].wrist[2]-zero[side].wrist[2])<0,'arms swing in both directions');
  a(Math.abs(zero[side].shoulder[0])<.205,'shoulder remains attached to torso');
 }
 a((pos.right.wrist[2]-zero.right.wrist[2])*(pos.left.wrist[2]-zero.left.wrist[2])<0,'opposite swings');
}
a(angle(sample(null,.12,25).left)<.99,'attacking retains articulated left guard');
const npc=slice('function frontierHumanShape(',' const headStart=m.p.length;');
const n=vm.createContext({calls:[],poiHumanGearType:v=>v?.type??v,humanRingProfile:(m,x,y,z,rows,color)=>{n.calls.push({x,y,z,rows,color});m.p.push(1,2,3)}});
vm.runInContext(slice('const FRONTIER_HUMANS=','function frontierHumanShape(')+npc+'}\nfrontierHumanShape({p:[],townParts:{}},FRONTIER_HUMANS.sera)',n);
const center=(p,r)=>[p.x+(r[3]||0),r[0],p.z+(r[4]||0)];
for(const [skin,sleeve] of [[n.calls.at(-4),n.calls.at(-3)],[n.calls.at(-2),n.calls.at(-1)]]){
 const points=[...skin.rows.map(r=>center(skin,r)),...sleeve.rows.map(r=>center(sleeve,r))].sort((x,y)=>x[1]-y[1]);
 const v=points[0],w=points.at(-1);
 for(const p of points)for(const ax of [0,2])a(Math.abs(p[ax]-(v[ax]+(w[ax]-v[ax])*(p[1]-v[1])/(w[1]-v[1])))<1e-7,'NPC resting mesh limb shares one continuous axis');
}
console.log('Straight idle and walking arms, arm swing and retained fist guard');
