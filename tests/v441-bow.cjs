const fs=require('node:fs'),vm=require('node:vm'),a=require('node:assert/strict'),{test}=require('node:test');
const h=fs.readFileSync(process.env.WORKSHOP_HTML||'candidate.html','utf8'),old=fs.readFileSync('../workshop-frontier-v440/candidate.html','utf8');
const cut=(s,b,e)=>{const i=s.indexOf(b),j=s.indexOf(e,i+b.length);a(i>=0&&j>i,b);return s.slice(i,j)};
const bow=t=>['equipWoodBow','equipBlackwingBow'].includes(t);
function rig(){
 const render=[], c=vm.createContext({poiHumanPartySpec:()=>({type:'humanVillager'}),poiCompanionPosition:a=>a,poiRegnaChantVisual:a=>a.chant,
  poiRegnaChantHand:()=>{},facilitySite:{id:'frontier'},frontierWalkSurface:()=>0,poiBowType:bow,poiSpearType:t=>t==='equipIronSpear',
  poiPlayerWeaponProfile:()=>({hit:325,pose:525}),poiPlayerProfilePose:(w,age)=>age<525?{bowDraw:.5}:null,
  poiBuildPlayerMesh:(...x)=>{render.push(x);return {}},poiWorldMeleePlan:()=>{throw Error('bow treated as melee')}});
 vm.runInContext(cut(h,'function poiHumanBowHeading(','function poiHumanPartyMesh(')+
  cut(h,'function poiFrontierResidentRigidWeapon(','// Render-only idle weight shift:'),c);
 return {check:s=>vm.runInContext(s,c),render};
}
test('party bow forward matches authoritative arrow through draw, release and beyond old 400ms limit',()=>{
 const {check}=rig();
 for(const [dx,dz] of [[1,0],[0,1],[-1,0],[0,-1],[.23,-.91],[-.56,.84]]){
  for(const now of [112,425,555]){
   const q={start:10,dx,dz,type:'equipWoodBow',profile:{pose:525},pending:now<425,arrow:now>=425?{end:570}:null};
   const actor={id:'human:frontierregna',x:0,y:0,z:0,humanHeading:0,humanSidestepHold:600,freeDx:-dx,freeDz:-dz,attackMotion:q};
   const p=check('poiHumanPartyWorldPose('+JSON.stringify(actor)+','+now+')'), len=Math.hypot(dx,dz);
   a(Math.abs(-Math.sin(p.heading)-dx/len)<1e-12&&Math.abs(Math.cos(p.heading)-dz/len)<1e-12);
  }
 }
 a.equal(check(`poiHumanPartyWorldPose({attackMotion:{type:'equipWoodBow',start:10,dx:1,dz:0,pending:true},chant:{heading:1},x:0,y:0,z:0},100).heading`),1);
});
test('resident wood and Blackwing bow preserve exact fractional heading instead of cardinal body direction',()=>{
 const {check,render}=rig();
 for(const weapon of ['equipWoodBow','equipBlackwingBow']){
  check('poiFrontierResidentRigidWeapon('+JSON.stringify({role:{appearance:'regna'},weapon,frontierBowHeading:2.394,swingAt:5})+',150,4,1,7,0,0)');
  a.equal(render.at(-1)[8],2.394);a(bow(render.at(-1)[0]));
 }
 a(h.includes("poiSpearType(a.weapon)||a.weapon==='equipMithrilSword'||poiBowType(a.weapon)||POI_HELD_AXE_EDGE[a.weapon]"));
 a(h.includes('if(poiBowType(a.weapon))a.frontierBowHeading=poiHumanBowHeading(target.s.x-a.x,target.s.z-a.z);'));
 a.equal(cut(h,'function poiCompanionResolve(','// BEGIN COMPANION'),cut(old,'function poiCompanionResolve(','// BEGIN COMPANION'));
});
test('existing rendered nock/tip track the actual forward world vector for both bows',()=>{
 const flight=[],c=vm.createContext({poiDrawPlayerBlockArms(){},poiPlayerBlockArm:()=>({}),naturalBranch(){},
  poiAimUnit:(x,z)=>{const n=Math.hypot(x,z);return {x:x/n,z:z/n}},
  poiWeaponArrowGeometry:(m,x,y,z,dx,dz)=>flight.push([x,y,z,dx,dz])});
 vm.runInContext(cut(h,'function poiBowAimPoints(','function poiLongStaffGripStyle('),c);
 const draw=vm.runInContext('poiBuildBowAim',c);
 for(const type of ['equipWoodBow','equipBlackwingBow'])for(const [dx,dz]of [[1,0],[0,1],[-1,0],[0,-1],[.71,-.34]]){
  const angle=Math.atan2(-dx,dz),cos=Math.cos(angle),sin=Math.sin(angle),l=Math.hypot(dx,dz);
  draw({}, {bowDraw:.85,twist:-.3},0,4,2,9,(x,z)=>[x*cos-z*sin,x*sin+z*cos],{},type);
  const [x,,z,a1,b1]=flight.at(-1);
  a(Math.abs(a1-dx/l)<1e-12&&Math.abs(b1-dz/l)<1e-12);
  a((x-4)*a1+(z-9)*b1>.5);
 }
});
