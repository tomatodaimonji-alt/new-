const test=require('node:test'), a=require('node:assert/strict'), vm=require('node:vm'), fs=require('node:fs');
const h=fs.readFileSync(process.env.WORLD_HTML||'world-editor.html','utf8');
const cut=(x,y)=>{const i=h.indexOf(x),j=h.indexOf(y,i+1);a(i>=0&&j>i,x);return h.slice(i,j)};
function camera({clip=false,map='base',indoor=false,floor=0,ai=false,top=false,third=true}={}){
 let on=false;const style=new Map();
 const c=vm.createContext({
  layout:()=>({aspect:2}),zoom:1,MAP_W:128,MAP_H:128,panX:0,panZ:0,cameraTopDown:top,
  poiWalkActive:true,poiThirdPerson:third,pineAIActive:ai,poiWalkIndoor:()=>indoor,
  facilitySite:{id:map},poiWalkLevel:floor,worldMaxLevel:0,terrainHeights:new Map([]),TERRAIN_STEP:.25,TERRAIN_MAX:4,
  poiWalkViewX:28,poiWalkViewZ:95,poiCreekPlayerHeight:()=>0,poiCameraPitch:.14,poiCameraYaw:0,poiCameraDistance:5.5,
  facilitySharedWallCameraEye:(target,desired)=>clip?[target[0],target[1]+.54,target[2]-1.70]:desired,
  facilityWatchtowerCloseFov:()=>1.30,performance:{now:()=>1000},poiTownClockGameMs:120*500,POI_TOWN_MINUTE_MS:500,
  perspective:()=>null,ortho:()=>null,look:()=>null,mult:()=>null,
  $:()=>({style:{setProperty:(k,v)=>style.set(k,v)},toggleAttribute:(_,v)=>{on=v}}),yaw:0,hideUpper:false,level:0
 });
 const read=vm.runInContext((h.includes('// BEGIN ORDINARY HOME CAMERA ARM')?cut('// BEGIN ORDINARY HOME CAMERA ARM','// END ORDINARY HOME CAMERA ARM'):'')+cut('// BEGIN OUTDOOR SKY','function cursorAt(')+';()=>{const p=parameters();poiSkyBackdrop(p);return p}',c);
 return {read,c,style,active:()=>on};
}
test('a camera-shortened above-ground outdoor view keeps time palette and projects the real clipped eye pitch',()=>{
 const a1=camera(),a2=camera({clip:true});
 const clear=a1.read(),clipped=a2.read();
 a(a1.active());a(a2.active(),'the pale editor background must not replace nighttime sky when the wall arm shortens');
 a.equal(a2.style.get('--poi-sky-top'),'rgb(16 29 62)');
 const expected=50-50/Math.tan(1.30/2)*(.54/1.70);
 a(Math.abs(clipped.skyHorizon-expected)<1e-10);
 a(Math.abs(clear.skyHorizon-clipped.skyHorizon)>5);
 a2.c.poiTownClockGameMs=720*500;a2.read();a.notEqual(a2.style.get('--poi-sky-top'),a1.style.get('--poi-sky-top'));
});
test('indoor, mine, editor top and snow keep their original backdrop path',()=>{
 for(const scenario of [{indoor:true},{floor:-1},{ai:true},{top:true},{third:false},{map:'snow'}]){
  const t=camera({...scenario,clip:true});a.equal(t.read().skyHorizon,undefined);a.equal(t.active(),false);
 }
});
