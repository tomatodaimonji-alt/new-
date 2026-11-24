const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm'),{test}=require('node:test');
const html=fs.readFileSync(process.env.WORLD_HTML||'world-editor.html','utf8');
const start=html.indexOf('// BEGIN ORDINARY HOME CAMERA ARM'),end=html.indexOf('// END SHARED THIRD PERSON WALL ARM',start);
assert(start>=0&&end>start);
const c=vm.createContext({
 world:[],Math,performance:{now:()=>c.tick},tick:0,poiWalkActive:true,poiThirdPerson:true,cameraTopDown:false,pineAIActive:false,poiWalkLevel:0,
 facilitySite:{id:'base',buildings:[{id:'cottage',x1:68,x2:74,z1:57,z2:63,entrance:{x:72,z:63}},{id:'gardener',x1:76,x2:82,z1:56,z2:62},{id:'watchtower',x1:105,x2:111,z1:60,z2:66}]},
 poiWallCameraCandidates:()=>[{s:{},x:0,y:0,z:0}],
 poiWallCameraSlab:(_s,_o,_d,max)=>Math.min(c.hit,max)
});
vm.runInContext(html.slice(start,end),c);
const local=[75.5,1.1,60.5],wanted=[70.3,3.0,60.5],length=eye=>Math.hypot(...eye.map((x,i)=>x-local[i]));
const tilt=eye=>Math.atan2(eye[1]-local[1],Math.hypot(eye[0]-local[0],eye[2]-local[2]));
test('exact footprint catches cottage, pictured alley and no mine/tower/sacred cases',()=>{
 assert(c.poiHomeCameraZone(c.facilitySite,75,60,0));assert(c.poiHomeCameraZone(c.facilitySite,72,64,0));
 assert(!c.poiHomeCameraZone(c.facilitySite,75,60,-1));assert(!c.poiHomeCameraZone(c.facilitySite,107,61,0));
 assert(!c.poiHomeCameraZone(c.facilitySite,24,101,0));
 assert(!c.poiHomeCameraZone({...c.facilitySite,id:'snowpass'},75,60,0));
});
test('same-pitch true obstruction, gently extending and never exceeding active hard ray',()=>{
 c.tick=0;c.hit=.71;
 const clipped=c.facilitySharedWallCameraEye(local,wanted);
 assert(length(clipped)<.71);assert(Math.abs(tilt(clipped)-tilt(wanted))<1e-10);
 c.tick=43;c.hit=10;
 const opening=c.facilitySharedWallCameraEye(local,wanted);
 assert(length(opening)>length(clipped));assert(length(opening)-length(clipped)<=.42);
 c.tick=86;c.hit=.64;
 const shorter=c.facilitySharedWallCameraEye(local,wanted);
 assert(length(shorter)<.64);assert(Math.abs(tilt(shorter)-tilt(wanted))<1e-10);
 for(let i=1;i<=18;i++){c.tick=86+i*43;c.hit=10;c.facilitySharedWallCameraEye(local,wanted);}
 c.tick=900;assert.equal(c.facilitySharedWallCameraEye(local,wanted),wanted);
});

test('both sides of the physical doorway share the same conservative arm allowance',()=>{
 const t=z=>c.poiHomeCameraDoorCap(c.facilitySite,72,z);
 assert.equal(t(63),.43);assert.equal(t(62.5),t(63.5));assert(t(62)>t(62.5));assert(t(61)>t(62));
});
