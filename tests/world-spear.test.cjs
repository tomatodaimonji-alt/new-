const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.argv[2]||process.env.HTML||'world-editor.html','utf8');
const cut=(l,r)=>{const i=h.indexOf(l),j=h.indexOf(r,i+l.length);a(i>=0&&j>i,l);return h.slice(i,j)};
function get(){
 const source='function mesh(){return {p:[],c:[],n:[]}};'+cut('function tri(m,','function addPart(m,')+
 cut('function naturalBranch(m,','function naturalCrown(m,')+
 cut('// BEGIN WORLD PLAYER SPEAR','// END WORLD PLAYER SPEAR');
 return vm.runInNewContext(source+';({pose:poiWorldSpearPose,line:poiWorldSpearLine,build:poiBuildWorldSpear,mesh})');
}
const p={range:3,hit:240,pose:410};
const near=(x,y,epsilon=1e-6)=>a(Math.abs(x-y)<epsilon,x+' vs '+y);
test('world-only pole is over three tiles; animation hits its measured contact key at original 240 ms',()=>{
 const {pose,line}=get(),g={x:.272,y:.868,z:.39};
 const idle=line(null,g);
 near(Math.hypot(...idle.tip.map((n,i)=>n-idle.rear[i])),3.24);
 a(idle.tip[1]-idle.rear[1]>1.85);
 const last=line(pose(p,240),g),early=line(pose(p,200),g),hold=line(pose(p,263),g),after=line(pose(p,390),g);
 near(last.tip[2],3);near(hold.tip[2],3);a(early.tip[2]<2.60);a(after.tip[2]<2.20);
});
test('actual final mesh blade apex reaches three committed tiles even after oblique yaw and samples the enemy at torso height',()=>{
 const {pose,line,build,mesh}=get(),g={x:.272,y:.868,z:.39},d={x:.6,z:.8},x=10.5,y=1.4,z=14.5;
 const angle=Math.atan2(-d.x,d.z),ro=(x,z)=>[x*Math.cos(angle)-z*Math.sin(angle),x*Math.sin(angle)+z*Math.cos(angle)];
 const local=pose(p,240);
 local.spearVisual={originX:10.46,originZ:14.52,dx:d.x,dz:d.z,reach:3,point:{x:10.46+1.76*d.x+.18*d.z,y:1.4+.51,z:14.52+1.76*d.z-.18*d.x}};
 const m=mesh(),coords=build(m,local,g,ro,x,y,z);
 a(m.n.length===m.p.length&&m.c.length===m.p.length&&m.p.every(Number.isFinite));
 a.deepEqual([...m.p.slice(-3)],[...coords.tip]);
 const [hx,hz]=ro(g.x,g.z),P=local.spearVisual.point,T=coords.tip,H=[x+hx,y+g.y,z+hz];
 const target=P.x*d.x+P.z*d.z,D=(T[0]-H[0])*d.x+(T[2]-H[2])*d.z;
 const t=(target-H[0]*d.x-H[2]*d.z)/D;
 near(H[0]+(T[0]-H[0])*t,P.x);near(H[1]+(T[1]-H[1])*t,P.y);near(H[2]+(T[2]-H[2])*t,P.z);
 near((T[0]-10.46)*d.x+(T[2]-14.52)*d.z,3);
});
test('live shot snapshots its contact before HP resolution, while compact catalog/inventory remain untouched',()=>{
 a.match(h,/equipWoodSpear:\{range:3,damage:24,tipLength:\.75,shaftScale:\.75,hit:240,ready:540,pose:410/);
 a.match(h,/else if\(id==='equipWoodSpear'\)\{\s*b\(0,\.03,0,\.068,1\.17/);
 a.match(h,/poiDrawPaperDoll\(view,poiBuildPlayerMesh\(weapon,null,gear\)\)/);
 a.match(h,/function poiPlayerWeaponResolve[\s\S]{0,700}poiWorldSpearContact\(shot,line,now\)[\s\S]{0,1400}poiPlayerDamageTarget\(/);
 a.match(h,/function poiBuildPlayerMesh\([^\n]+worldSpear=false\)/);
});
test('poiWalkAvatar uploads a 240ms-contact thrust using exact locked yaw even if a slow frame arrives after pose expiry',()=>{
 const origin={x:10.44,z:8.52},player={x:10.5,z:8.5},heading=Math.atan2(-.6,.8),now=1570;
 const c={poiWalkMesh:null,poiWalkActive:true,poiWalkActionStarted:1000,poiWalkActionWeapon:'equipWoodSpear',
  poiWalkAttackPosePending:false,poiCombatLockRenderedHeading:null,poiCombatLockHeading:null,poiPlayerWeaponProfile:()=>p,
  poiAimAttack:{started:1000,y:0,heading,spearVisual:{originX:origin.x,originZ:origin.z,dx:.6,dz:.8,reach:3,point:null,clock:now}},
  EQUIPMENT_IDS:['equipWoodSpear'],poiWalkStarted:950,POI_WALK_MS:180,poiWalkLevel:0,poiWalkFacing:0,
  poiWalkViewX:player.x-.5,poiWalkViewZ:player.z-.5,poiWalkFromX:10,poiWalkFromZ:8,poiWalkX:10,poiWalkZ:8,
  poiCreekPlayerHeight:()=>0,poiEquippedWeapon:()=> 'equipWoodSpear',poiWalkSwordPose:()=>null,
  poiRoleToolGripStyle:()=>null,characterHuman(){},deco(){throw Error('world spear should not use compact art')},
  upload:m=>m};
 const src='function mesh(){return {p:[],n:[],c:[]}};'+cut('function tri(m,','function addPart(m,')+
  cut('function naturalBranch(m,','function naturalCrown(m,')+cut('function characterArmRotation(','function roundStack(')+
  cut('// BEGIN WORLD PLAYER SPEAR','// END WORLD PLAYER SPEAR')+
  cut('// BEGIN PLAYER SHARED BLOCK ARMS','// END PLAYER SHARED BLOCK ARMS')+cut('function poiHumanGearType(','function poiRoleClothingGeometry(')+cut('function poiBuildPlayerMesh(','const POI_MONSTER_BREAK_MS=')+
  ';function poiPlayerProfilePose(type,ms){return poiWorldSpearPose(poiPlayerWeaponProfile(type),ms)};poiWalkAvatar(1570);poiWalkMesh.p.slice(-3);';
 const tip=vm.runInNewContext(src,c);
 near((tip[0]-origin.x)*.6+(tip[2]-origin.z)*.8,3);
 a.equal(c.poiWalkAttackPosePending,true);
});
