const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8'),cut=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)+1));
test('held long-staff downstroke reaches its original two-tile contact in each cardinal world facing',()=>{
 const mesh=()=>({p:[],n:[],c:[]});
 const c={mesh,characterHuman(){},deco:(m,type)=>{m.p=[0,2.18,0];m.n=[0,1,0];m.c=[.4,.3,.2]},
  poiPlayerWeaponProfile:()=>({range:2,hit:210,pose:400})};
 vm.runInNewContext(cut('function tri(m,','function addPart(m,')+cut('function poiHumanGearType(','function poiRoleClothingGeometry(')+cut('// BEGIN WORLD MELEE REACH','// Visual release only:')+cut('function poiBuildPlayerMesh(','function poiWalkAvatar(')+
  cut('function characterArmRotation(','function roundStack(')+cut('function rot2(','function rotY(').split('\n')[0]+cut('function poiLongStaffGripStyle(','function poiBuildPlayerMesh(')+cut('function poiRoleToolGripStyle(','function poiStarterGearGeometry('),c);
 const at=ms=>c.poiPlayerProfilePose('equipLongStaff',ms);
 assert.equal(at(210).staffPhase,'down');assert.equal(at(100).staffPhase,'hold');assert.equal(at(330).staffPhase,'recover');assert.equal(at(400),null);
 for(const [r,dx,dz] of [[2,0,-1],[3,1,0],[0,0,1],[1,-1,0]]){
  const pose=at(210);pose.meleeReach=c.poiWorldMeleePlan('equipLongStaff',c.poiPlayerWeaponProfile(),210);
  const [x,y,z]=c.poiBuildPlayerMesh('equipLongStaff',pose,null,0,r,0,0,0,null,true).p.slice(-3);
  const forward=x*dx+z*dz,lateral=x*dz-z*dx;
  assert(Math.abs(forward-2)<.001,JSON.stringify({r,forward}));
  assert(Math.abs(lateral)<.001&&Math.abs(y-.74)<.001);
 }
 assert(c.poiBuildPlayerMesh('equipLongStaff',null,null,0,0).p.at(-2)>1.40,'loftier visible idle staff');
});
test('native prop has visibly longer calibrated silhouette while combat constants remain unchanged',()=>{
 const runtime=vm.runInNewContext(cut('// BEGIN PLAYER WEAPON PROFILES','function poiPlayerWeaponCancel(')+';poiPlayerWeaponProfile("equipLongStaff")');
 assert.deepEqual([runtime.range,runtime.damage,runtime.hit,runtime.ready,runtime.pose],[2,20,210,510,400]);
 const calls=[],c={cube:(_m,x,y,z,w,h,d)=>calls.push(y+h),naturalBranch:(_m,x,y,z,u,v,w)=>calls.push(Math.max(y,v)),
  tri:(_m,a,b,c)=>calls.push(Math.max(a[1],b[1],c[1]))};
 const carved=html.includes('// BEGIN LONG HARDWOOD STAFF ART')?cut('// BEGIN LONG HARDWOOD STAFF ART','// END LONG HARDWOOD STAFF ART'):'';
 vm.runInNewContext(carved+cut('function poiFantasyEquipmentGeometry(','const POI_ARMED_MONSTER_ART='),c);
 c.poiFantasyEquipmentGeometry({},'equipLongStaff',0,0,0);
 assert(Math.max(...calls)>=2.16);
});

