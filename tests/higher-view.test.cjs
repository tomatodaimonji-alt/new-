const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const h=fs.readFileSync(process.env.WORLD_HTML||'world-editor.html','utf8');
function fx(){
 const a=h.indexOf('// BEGIN OUTDOOR SKY'),b=h.indexOf('const POI_SKY_COLOR=',a);assert(a>=0&&b>a);
 const x=vm.createContext({poiWalkActive:true,poiThirdPerson:true,cameraTopDown:false,pineAIActive:false,facilitySite:{id:'base'},
  poiWalkLevel:0,poiWalkViewX:66,poiWalkViewZ:4,poiWalkIndoor:()=>x.indoor,indoor:false,dome:false,poiDavidTempleEnclosedAt:()=>x.dome});
 vm.runInContext(h.slice(a,b),x);return x;
}
test('new manual lower limit applies only to ordinary outside and the true roofed dome',()=>{
 const c=fx();
 assert.equal(c.poiOrbitPitchClamp(-2),-1.02);assert.equal(c.poiOrbitPitchClamp(2),1.15);
 c.indoor=true;assert.equal(c.poiOrbitPitchClamp(-2),.12);
 c.dome=true;assert.equal(c.poiOrbitPitchClamp(-2),-1.02);
 c.poiWalkLevel=-1;c.dome=false;assert.equal(c.poiOrbitPitchClamp(-2),.12);
 c.cameraTopDown=true;assert.equal(c.poiOrbitPitchClamp(-2),.12);
});
test('look-up beyond the low orbit aims the lens higher without translating eye, X/Z or changing a typical angle',()=>{
 const c=fx(),eye=[.5,.34,1.0],target=[.5,1.1,6.0];
 assert.equal(c.poiOrbitHigherLens(eye,target,-.16,true),target);
 assert.equal(c.poiOrbitHigherLens(eye,target,-.79,false),target);
 const n=c.poiOrbitHigherLens(eye,target,-1.02,true);
 assert.equal(n[0],target[0]);assert.equal(n[2],target[2]);assert(n[1]>target[1]+3);
 assert(Math.atan2(eye[1]-n[1],5)<-.94);
 assert.deepEqual(eye,[.5,.34,1]);
 assert.match(h,/fit\(v\.orbitPitch,-1\.02,1\.15\)/);
});
