const {test}=require('node:test'),a=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(x,y)=>{const i=h.indexOf(x),j=h.indexOf(y,i+x.length);a(i>=0&&j>i,x);return h.slice(i,j)};
function setup(world=[]){
 let builds=0;const c={world,facilitySite:{id:'base'},poiWalkLevel:0,poiWalkDoorOpen:null,poiWalkActive:true,poiThirdPerson:true,cameraTopDown:false,pineAIActive:false,
  terrainY:()=>0,isWallId:t=>t==='stonewall',mesh:()=>({p:[]})};
 c.cube=(m,x,y,z,w,h,d)=>{
  const A=[x-w/2,y,z-d/2],B=[x+w/2,y,z-d/2],C=[x+w/2,y,z+d/2],D=[x-w/2,y,z+d/2];
  const E=[A[0],y+h,A[2]],F=[B[0],y+h,B[2]],G=[C[0],y+h,C[2]],H=[D[0],y+h,D[2]];
  for(const [a,b,c,d] of [[A,B,F,E],[B,C,G,F],[C,D,H,G],[D,A,E,H],[E,F,G,H],[A,B,C,D]])m.p.push(...a,...b,...c,...a,...c,...d);
 };
 c.deco=(m,type)=>{
  builds++;
  if(type==='towerWindow'){c.cube(m,-.38,0,.4,.23,1.4,.2);c.cube(m,.38,0,.4,.23,1.4,.2);return;}
  if(type==='poiFortGate'){c.cube(m,0,1.9,0,2.9,.7,.7);c.cube(m,1.32,0,0,.30,1.9,.7);c.cube(m,-1.32,0,0,.30,1.9,.7);return;}
  c.cube(m,0,0,0,1,2.4,.7);
 };
 const marker='// BEGIN SHARED THIRD PERSON WALL ARM';
 const shared=h.includes(marker)?cut(marker,'// END SHARED THIRD PERSON WALL ARM'):'';
 const f=vm.runInNewContext(shared+';typeof facilitySharedWallCameraEye==="function"?facilitySharedWallCameraEye:null',c);
 return {c,f,builds:()=>builds};
}
test('same physical wall prevents look-back crossing from either side in any location and cave floor',()=>{
 for(const {x,z,y} of [{x:107,z:61,y:0},{x:25,z:73,y:0},{x:24,z:120,y:0},{x:118,z:64,y:-1}]){
  const {c,f}=setup([{x,z,y,type:'stonewall'}]);a(f,'shared arm missing');
  c.poiWalkLevel=y;
  for(const sign of [-1,1]){
   const h=y*1.4+1.10,at=[x+.5,h,z+.5+sign*1.1],to=[x+.5,h+.05,z+.5-sign*4],eye=f(at,to);
   a.notEqual(eye,to);a(Math.abs(eye[0]-at[0])<1e-9,'no azimuth flip');
   a((eye[2]-(z+.5))*sign>.49,JSON.stringify({at,to,eye}));
  }
 }
});
test('real aperture geometry passes through a clean open arch and ignores unrelated floor; sealed leaves still block',()=>{
 const o={x:20,z:20,y:0,type:'poiFortGate'},d={x:22,z:20,y:0,type:'stonewallDoor'};
 const {c,f,builds}=setup([o,d]);a(f,'shared arm missing');
 const arch=[20.5,1.1,22.5],clear=[20.5,1.11,18.5];
 a.equal(f(arch,clear),clear);a.equal(f(arch,clear),clear);a.equal(builds(),2,'local shape reused');
 const at=[22.5,1.1,22.5],to=[22.5,1.11,18.5];
 a.notEqual(f(at,to),to);
 c.poiWalkDoorOpen={x:22,z:20,y:0};a.equal(f(at,to),to);
 c.poiWalkLevel=-1;a.equal(f(at,to),to,'other floor cannot clip');
 c.poiWalkLevel=0;c.poiThirdPerson=false;a.equal(f(at,to),to);
 c.poiThirdPerson=true;c.cameraTopDown=true;a.equal(f(at,to),to);
});
test('the real third-person projection uses one shared physical arm instead of a special room selector',()=>{
 const fn=cut('function parameters(){','function cursorAt(');
 a.match(fn,/facilitySharedWallCameraEye\(target,desired\)/);
 a.doesNotMatch(fn,/facilityDavidCameraEye|facilityWatchtowerCameraEye|facilityMineCameraEye/);
});
