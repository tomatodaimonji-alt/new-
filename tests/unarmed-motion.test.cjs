const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function cut(start,end){
 const i=h.indexOf(start),j=h.indexOf(end,i+start.length);
 a(i>=0&&j>i,start);return h.slice(i,j)+'\n';
}
const m=()=>({p:[],n:[],c:[]});
const c=vm.createContext({mesh:m,POI_AIM_RADIUS:.34,poiHumanGearType:()=>null,poiRoleClothingTone:()=>null,
 naturalBranch(m,...args){m.branches.push(args)},cube(m,...args){m.blocks.push(args)}});
vm.runInContext((h.includes('// BEGIN PLAYER BARE HAND RIG')?cut('// BEGIN PLAYER BARE HAND RIG','// END PLAYER BARE HAND RIG'):'')+
 cut('function poiWalkPunchPose(','function poiWalkSwordPose(')+
 cut('function poiWorldInstantPose(','function poiWorldInstantContact(')+';const POI_INSTANT_WOOD_WEAPONS=new Set();',c);
const d=(x,y)=>Math.hypot(...x.map((v,i)=>v-y[i]));
const num=(x,y,eps=1e-6)=>a.ok(Math.abs(x-y)<eps,JSON.stringify([x,y]));
const p=(ms,side=1,reach=null,stride=0)=>c.poiBareFistRig(c.poiBareFistPose(ms),stride,reach,side);
test('real instant hit renderer dispatches new linked pose without moving the contact key',()=>{
 const actual=c.poiWorldInstantPose(null,0,1);
 a.equal(actual.bareFist,true,'first existing instantaneous contact frame must use new rig');
 a.equal(actual.phase,'contact');
 num(actual.fistReach.forward,.66);
 a(!c.poiWorldInstantPose(null,-1,1),'no motion before genuine action starts');
 a(!c.poiWorldInstantPose(null,260,1),'settle before the existing instant action interval ends');
});
test('torso commits at contact, linked arms give natural support and smooth return without stretching',()=>{
 const hit=p(0),follow=p(45),withdraw=p(112),rest=p(260),walking=p(260,1,null,.12);
 num(hit.right.upper,.225);num(hit.right.lower,.242);
 for(let ms=0;ms<=260;ms++){
  const q=p(ms);
  for(const side of ['left','right']){
   const arm=q[side];
   num(d(arm.shoulder,arm.elbow),arm.upper);
   num(d(arm.wrist,arm.elbow),arm.lower);
   if(ms>0){const prev=p(ms-1)[side];a(d(arm.wrist,prev.wrist)<.02,'smooth wrist '+ms+side);a(d(arm.elbow,prev.elbow)<.025,'smooth elbow '+ms+side);}
  }
 }
 a(hit.right.wrist[2]>rest.right.wrist[2]+.40,'real extension forward');
 a(follow.right.wrist[2]>=hit.right.wrist[2]-.02,'held beat following instant contact');
 a(withdraw.right.wrist[2]<hit.right.wrist[2]-.12);
 a(hit.right.shoulder[2]>rest.right.shoulder[2]+.10,'shoulder travels with the shifted torso');
 a(hit.left.wrist[1]>rest.left.wrist[1]+.10,'opposite hand visibly guards, not stretched alongside');
 a(Math.abs(walking.left.wrist[2]-walking.right.wrist[2])>.08,'the ordinary lower-body walk can accompany arm recovery');
 a.deepEqual(p(259).right.wrist.map(x=>Math.round(x*100)),rest.right.wrist.map(x=>Math.round(x*100)));
});
test('authored mirrored stance is symmetrical and a near wall retracts physically without tearing',()=>{
 for(const ms of [0,45,96,185,259]){
  const a1=p(ms,1),a2=p(ms,-1);
  for(const key of ['shoulder','elbow','wrist']){
   num(a1.right[key][0],-a2.left[key][0]);num(a1.right[key][1],a2.left[key][1]);num(a1.right[key][2],a2.left[key][2]);
   num(a1.left[key][0],-a2.right[key][0]);num(a1.left[key][1],a2.right[key][1]);num(a1.left[key][2],a2.right[key][2]);
  }
 }
 const open=p(0,1,{forward:.66,side:0,mix:1}),tight=p(0,1,{forward:.16,side:0,mix:1});
 a(tight.right.wrist[2]<open.right.wrist[2]-.18&&tight.right.wrist[2]<.18,
  'visual wrist retracts instead of appearing through a close obstacle');
});
