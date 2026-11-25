const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(u,v)=>{const i=h.indexOf(u),j=h.indexOf(v,i+u.length);a(i>=0&&j>i,u);return h.slice(i,j)};
const real=vm.runInNewContext(cut('const FACILITY_SITES=','function workshopResumeDecode(')+';buildFacilitySite("base")');
function setup(){
 const ctx={facilitySite:real,world:real.map.world,poiWalkActive:true,poiThirdPerson:true,cameraTopDown:false,pineAIActive:false,
  poiWalkLevel:0,rot2:(x,z)=>[x,z],performance:{now:()=>1000},facilityFloorMasks:real.buildings.map(b=>({floors:new Map(Object.entries(b.floorFootprints).map(([k,v])=>[+k,new Set(v.map(p=>p.x+','+p.z))]))})),facilityVisibleRoofs:()=>[],
  poiWallCameraCandidates:()=>[],isWallId:t=>t==='brickwall',poiWallCameraTriangles:()=>Infinity,poiDavidTempleEnclosedAt:()=>false,poiAngledRangeMerge:r=>r};
 vm.createContext(ctx);
 vm.runInContext(cut('function poiAngledWallSides(','function poiAngledWallRecord(')+cut('function facilityFloorOwner(','function facilityValidLanding(')+cut('function poiWallCameraSlab(','function poiWallCameraTriangles(')+
  cut('// BEGIN ORDINARY HOME CAMERA ARM','// END SHARED THIRD PERSON WALL ARM')+';this.getArm=()=>poiLowRoomCameraFrame;',ctx);
 return ctx;
}
test('actual one-storey portraits include the base counter and interior doorway but never the neighboring outdoors or high temple',()=>{
 const c=setup(),b=real.buildings.find(x=>x.id==='toolshop'),home=real.buildings.find(x=>x.id==='cottage');
 const low=(x,z,y=0)=>c.poiLowRoomCameraArea(real,x,z,y);
 a.equal(low(b.x1+4,b.z1+6)?.b.id,'toolshop');
 a.equal(low(home.entrance.x,home.entrance.z-.20)?.b.id,'cottage');
 a.equal(low(home.entrance.x,home.entrance.z+.28),null);
 a.equal(low(b.x1+4,b.z1+6,1),null);
 const temple=real.davidTemple.boss;a.equal(low(temple.x,temple.z),null);
});
test('a near foreground wall can soften only within its measured span; a neighbor stays solid and rear wall remains full',()=>{
 const c=setup(),b=real.buildings.find(x=>x.id==='toolshop'),target=[b.x1+4.5,1.05,b.z2+.15],desired=[target[0],1.22,target[2]+4];
 const front={x:b.x1+4,y:0,z:b.z2,type:'brickwall'},rear={x:b.x1+4,y:0,z:b.z1,type:'brickwall'};
 const shape={min:[-.5,0,-.08],max:[.5,1.4,.08]};
 const row=(o,z)=>({s:shape,x:target[0],y:0,z,o});
 c.sceneMesh={wallFade:[{owner:b.id,x:front.x,z:front.z,y:0,type:'brickwall',start:4,end:8},
  {owner:b.id,x:rear.x,z:rear.z,y:0,type:'brickwall',start:12,end:16}]};
 c.poiWallCameraCandidates=()=>[row(front,target[2]+.45),row(rear,target[2]-1),row({...front,x:front.x+10},target[2]+1.81)];
 const eye=c.facilitySharedWallCameraEye(target,desired),frame=c.getArm();
 a(eye[2]-target[2]>=1.3&&eye[2]-target[2]<1.81);
 a.equal(eye[0],target[0],'camera preserves yaw');
 a.deepEqual(JSON.parse(JSON.stringify(c.poiLowRoomCameraSpans(frame,c.sceneMesh))),[[4,8]]);
 const outside=[target[0],target[1],b.z2+.8];
 c.facilitySharedWallCameraEye(outside,desired);
 a.equal(c.getArm(),null,'outdoor cannot reuse room cut');
});
test('only the foreground draws with alpha; the intact roof and rear mesh submissions remain opaque',()=>{
 const c=setup(),s=c.facilitySite,room=s.buildings.find(b=>b.id==='toolshop'),owner=s.buildings.indexOf(room);
 const front={x:room.x1+3,y:0,z:room.z2,type:'brickwall'};
 let current=0,mask=true,blending=false,alpha=0;
 const passes=[];
 Object.assign(c,{
  facilityRoofMeshes:s.buildings.map(()=>({count:100})),poiWalkViewX:room.x1+4,poiWalkViewZ:room.z2-.25,
  facilityHiddenRoof:()=>owner,poiOcclusionFrame:{},
  stockAtlasSceneOmissions:()=>null,loc:{p:0,n:1,c:2,mvp:3,occlusionInfo:4},
  gl:{uniform4f:(_q,_a,_b,_c,k)=>{current=k},enable:()=>{blending=true},disable:()=>{blending=false},depthMask:on=>{mask=on},blendFunc:()=>{},blendColor:(_a,_b,_c,k)=>{alpha=k},bindBuffer:()=>{},enableVertexAttribArray:()=>{},vertexAttribPointer:()=>{},
   uniformMatrix4fv:()=>{},drawArrays:(_mode,a,n)=>passes.push([a,n,current,mask,blending,alpha])},
  sceneMesh:{count:36,wallFade:[{owner:room.id,...front,start:9,end:15}]},draw:()=>passes.push(['whole',current]),
 });
 vm.runInContext(cut('function poiDrawSceneOcclusion(','function poiDrawWalkAvatar(')+
  cut('function poiOcclusionBegin(','function poiOcclusionEnd(')+cut('function facilityVisibleRoofs(','function facilityCollectEntranceGuides(')+
  '\npoiLowRoomCameraFrame={room:{b:facilitySite.buildings['+owner+']},touched:[sceneMesh.wallFade[0]]};',c);
 c.poiOcclusionBegin({},1000);c.poiDrawSceneOcclusion(c.sceneMesh,[]);
 a.deepEqual(passes,[[0,9,0,true,false,0],[15,21,0,true,false,0]]);
 c.poiDrawLowRoomForeground([]);
 a.deepEqual(passes.at(-1),[9,6,0,false,true,.033]);
 a(mask&&!blending&&alpha===0&&current===0);
 a(c.facilityVisibleRoofs().includes(owner));
});
