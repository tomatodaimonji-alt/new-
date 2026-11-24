const a=require('node:assert/strict'),{test}=require('node:test'),vm=require('node:vm'),fs=require('node:fs');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(x,y)=>{const i=h.indexOf(x),j=h.indexOf(y,i+x.length);a(i>=0&&j>i,x);return h.slice(i,j)};
function bind(){
 const c={quad(m,...p){m.push(p.slice(0,4));},poiHumanGearType:()=>null,poiRoleClothingTone:()=>null};
 const start=h.indexOf('// BEGIN PLAYER SHARED BLOCK ARMS');
 const engine=start<0?'':cut('// BEGIN PLAYER SHARED BLOCK ARMS','// END PLAYER SHARED BLOCK ARMS');
 return vm.runInNewContext(cut('function characterArmRotation(','function ') +engine+
  cut('function poiBowAimPoints(','function poiBuildBowAim(')+cut('function poiBareFistPose(','function poiDrawBareFistRig(').split('// BEGIN PLAYER SHARED BLOCK')[0]+
  ';({rot:characterArmRotation,bow:poiBowAimPoints,fist:poiBareFistRig,pose:poiBareFistPose,arm:typeof poiPlayerBlockArm==="function"?poiPlayerBlockArm:null,hands:typeof poiPlayerWeaponHands==="function"?poiPlayerWeaponHands:null,draw:typeof poiDrawPlayerBlockArms==="function"?poiDrawPlayerBlockArms:null,fistRig:typeof poiPlayerPlannedFist==="function"?poiPlayerPlannedFist:null})',c);
}
const len=(p,q)=>Math.hypot(...p.map((n,i)=>n-q[i]));
test('shared block forearm/upper lengths and shape do not change across bare, held equipment, and bow poses',()=>{
 const api=bind();a(api.arm);
 const check=(x)=>{a(Math.abs(len(x.shoulder,x.elbow)-.238)<1e-7);a(Math.abs(len(x.elbow,x.wrist)-.267)<1e-7);};
 for(const n of [0,18,45,70,150,240,300]){
  const fist=api.fist(api.pose(n),.11),common=api.fistRig(fist);
  a.equal(len(common.right.wrist,fist.right.wrist),0);check(common.right);check(common.left);
 }
 for(const pose of [null,{strike:.9,sweep:-.20,twist:.31},{strike:1.8,sweep:.92,twist:-.4,guard:.8}]){
  const v=api.hands(pose,.12),t=pose?.twist||0,c=Math.cos(t),s=Math.sin(t);
  const [x,y,z]=api.rot(pose?.strike||0,pose?.sweep||0)(0,.55-.965,.028);
  const d=z-(pose?0:.12*.36);
  a(len(v.right.wrist,[(.272+x)*c-d*s,(.965+y)*.90,d*c+(.272+x)*s])<1e-8,'same legacy weapon socket');
  check(v.right);check(v.left);
 }
 for(const d of [0,.33,.67,1,.56,.15])for(const released of [false,true]){
  const p=api.bow({bowDraw:d,bowReleased:released,twist:-.38*d}),v=api.arm(p.left,p.front,-1,p.leftElbow),
   n=api.arm(p.right,p.draw,1,p.rightElbow);
  a.equal(len(v.wrist,p.front),0,'bow grip never shifts');check(v);
  a.equal(len(n.wrist,p.draw),0,'draw hand and arrow nock stay registered');check(n);
 }
 const geom=[],v=api.hands(null,.12);api.draw(geom,v,null,(x,z)=>[x,z],0,0,0);
 a.equal(geom.length,48,'four six-faced fixed rectangular blocks per arm');
 const blockWidths=[];
 for(let i=0;i<24;i+=6){const first=geom[i];blockWidths.push(len(first[0],first[1]));}
 for(const [i,w] of [.142,.122,.108,.132].entries())a(Math.abs(blockWidths[i]-w)<1e-7);
});
test('live/saved player routes submit the same arm renderer without changing old weapon tip/pivot scale formulas',()=>{
 const m=cut('function poiBuildPlayerMesh(','function poiWalkAvatar('),b=cut('function poiBuildBowAim(','function poiLongStaffGripStyle(');
 a.match(m,/poiDrawBareFistRig\(m,poiBareFistRig/);
 a.match(m,/poiDrawPlayerBlockArms\(m,arms,gear,rotate,x,y,z\)/);
 a.match(b,/poiDrawPlayerBlockArms\(m,/);
 a.match(m,/poiBuildWorldSpear\(m,pose,\{x:gx,y:gy,z:gz\}/);
 a.match(m,/scaleX=roleTool\?\.scaleX\?\?\.58,scaleZ=roleTool\?\.scaleZ\?\?\.53/);
 a.match(m,/poiRigidHeldRotation\(key,\{x:gx,y:gy,z:gz\},lead,\[gripX,gripY,0\],\[scaleX,scaleY,scaleZ\],wrist\)/);
});
