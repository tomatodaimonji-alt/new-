const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8'),cut=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)+1));
test('held long-staff thrust points physically down the active facing at 210 ms',()=>{
 const mesh=()=>({p:[],n:[],c:[]});
 const c={mesh,characterHuman(){},deco:(m,type)=>{m.p=[0,2.18,0];m.n=[0,1,0];m.c=[.4,.3,.2]},
  poiPlayerWeaponProfile:()=>({hit:210,pose:400})};
 vm.runInNewContext(cut('function poiPlayerProfilePose(','// Visual release only:')+cut('function poiBuildPlayerMesh(','function poiWalkAvatar(')+
  cut('function characterArmRotation(','function roundStack(')+cut('function rot2(','function rotY(').split('\n')[0]+cut('function poiLongStaffGripStyle(','function poiBuildPlayerMesh('),c);
 const at=ms=>c.poiPlayerProfilePose('equipLongStaff',ms);
 assert.equal(at(210).staffThrust,1);assert(at(100).staffThrust<.8);assert(at(330).staffThrust<.65);assert.equal(at(400),null);
 for(const [r,dx,dz] of [[2,0,-1],[3,1,0],[0,0,1],[1,-1,0]]){
  const [x,y,z]=c.poiBuildPlayerMesh('equipLongStaff',at(210),null,0,r).p;
  const forward=x*dx+z*dz,lateral=x*dz-z*dx;
  assert(forward>=1.65&&forward<=1.90,JSON.stringify({r,forward}));
  assert(Math.abs(lateral)<.14&&y>=.6&&y<=1.1);
 }
 assert(c.poiBuildPlayerMesh('equipLongStaff',null,null,0,0).p[1]>1.40,'loftier visible idle staff');
});
test('native prop has visibly longer calibrated silhouette while combat constants remain unchanged',()=>{
 assert.match(html,/equipLongStaff:\{range:2,damage:20,hit:210,ready:510,pose:400\}/);
 const calls=[],c={cube:(_m,x,y,z,w,h,d)=>calls.push(y+h),naturalBranch:(_m,x,y,z,u,v,w)=>calls.push(Math.max(y,v))};
 vm.runInNewContext(cut('function poiFantasyEquipmentGeometry(','const POI_ARMED_MONSTER_ART='),c);
 c.poiFantasyEquipmentGeometry({},'equipLongStaff',0,0,0);
 assert(Math.max(...calls)>=2.16);
});
