const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const s=fs.readFileSync(process.env.DAVID_CAMERA_HTML||require('node:path').join(__dirname,'../world-editor.html'),'utf8');
const get=(x,y)=>{const i=s.indexOf(x),j=s.indexOf(y,i+1);a.ok(j>i&&i>=0);return s.slice(i,j)};
const box={x:24,z:121,type:'poiDavidWallRound',y:0,rot:0},site={id:'base',davidTemple:{resumeSolid:[box]}};
const make=(ctx={})=>vm.runInNewContext(get('function facilityMineCameraArm(','// END MINE CAMERA WALL CLIP')+
 get('// BEGIN DAVID CAMERA WALL CLIP','// END DAVID CAMERA WALL CLIP')+
 ';({eligible:facilityDavidCameraEligible,walls:facilityDavidCameraWalls,clip:facilityMineCameraEye})',ctx);
test('only active authored surface arena in normal play is camera-clipped',()=>{
 const api=make({poiDavidMatch:o=>o==='authored'?{id:1}:null,poiDavidIn:(b,p)=>p.x<30&&p.z>90});
 const live={o:'authored',s:{hp:1050,david:{awake:true}}},here={x:24,z:118,y:0};
 a.equal(api.eligible(live,site,0,false,false,here),true);
 for(const [active,s,floor,ai,top,point] of [[null,site,0,false,false,here],[live,site,-1,false,false,here],[live,site,0,true,false,here],[live,site,0,false,true,here],[live,site,0,false,false,{x:24,z:89}], [{...live,o:'generic'},site,0,false,false,here]])a.equal(api.eligible(active,s,floor,ai,top,point),false);
});
test('exact stock walls only, cached; camera clears real near wall, stays exactly unchanged through open route',()=>{
 let generated=0;
 const api=make({mesh:()=>({p:[]}),terrainY:()=>0,deco:(m,t,x,y,z)=>{generated++;m.p.push(x-.5,y,z-.3,x+.5,y+7.8,z+.3)}});
 const objects=[box,{...box,x:25},{...box,x:22,type:'treePine'}],walls=api.walls(site,objects);
 a.equal(walls.length,1);a.equal(api.walls(site,objects),walls);a.equal(generated,1);
 const target=[24.5,1.1,118.5],behind=[24.5,1.5,123.7],clear=[24.5,1.6,114];
 const eye=api.clip(target,behind,walls);
 a.ok(eye[2]>target[2]&&eye[2]<121.2);a.equal(api.clip(target,clear,walls),clear);
});
