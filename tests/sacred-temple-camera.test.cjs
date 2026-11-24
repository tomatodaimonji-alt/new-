const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(x,y)=>{const i=h.indexOf(x),j=h.indexOf(y,i+1);a(i>=0&&j>i,x);return h.slice(i,j)};
const site=vm.runInNewContext(cut('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+";buildFacilitySite('base')");
site.id='base';
const c={world:site.map.world,facilitySite:site,terrainY:()=>0,isWallId:t=>t==='stonewall',mesh:()=>({p:[],n:[],c:[]}),
 poiWalkLevel:0,poiThirdPerson:true,poiWalkDoorOpen:null,poiWalkActive:true,pineAIActive:false,cameraTopDown:false};
const install=cut('function tri(m,a,b,c,col){','function addPart(')+cut('// BEGIN ROUND DAVID TEMPLE ART','// END ROUND DAVID TEMPLE ART')+
 cut('// BEGIN SACRED TEMPLE ART','// END SACRED TEMPLE ART')+cut('function poiDavidTempleEnclosedAt(','function poiDavidTempleContains(')+
 `function deco(m,t,x,y,z,r){if(t==='poiDavidSacredRoof')return poiDavidSacredRoofGeometry(m,x,z);
  if(t==='poiDavidWallWingTall')return poiDavidWingGeometry(m,x,y,z,r,true);
  if(t==='poiDavidWallRound')return poiDavidRoundWall(m,x,y,z);
  if(t==='poiDavidWallWing')return poiDavidWingGeometry(m,x,y,z,r);
  if(t==='poiDavidGatePier')return;
  poiDavidTunnelArt(m,t,x,y,z,r);
 }`+cut('// BEGIN SHARED THIRD PERSON WALL ARM','// END SHARED THIRD PERSON WALL ARM')+';facilitySharedWallCameraEye';
const f=vm.runInNewContext(install,c);
test('real tunnel masonry blocks both level side rays and actual low ceiling leaves the player under it',()=>{
 const near=[24.5,1.1,129.5],west=[20.5,1.3,129.5],upper=[24.6,7.8,129.6];
 const lateral=f(near,west),ceil=f(near,upper);
 a(lateral[0]>23.00&&lateral[0]<24.5,JSON.stringify(lateral));
 a(ceil[1]>1.1&&ceil[1]<3.19,JSON.stringify(ceil));
 const belowHeader=f([24.5,1.12,126.5],[24.5,1.15,129.1]);
 a(belowHeader[2]>128.6,'a real open gate below the high fascia remains passable by the camera');
});
test('whole roof broad phase includes the physical chamber away from center and keeps an old angled mode visibly inside',()=>{
 const near=[13.5,1.1,157.5],over=[13.65,13,157.65];
 c.poiThirdPerson=true; c.cameraTopDown=false;
 const bound=([x,,z])=>{
  const r=Math.hypot(x-site.davidTemple.ring.x-.5,z-site.davidTemple.ring.z-.5);
  return 7.62+5.81*Math.sqrt(Math.max(0,1-(r/18.22)**2));
 };
 const eye=f(near,over);
 a(eye[1]>4&&eye[1]<bound(eye)&&eye[1]<over[1]-.08,JSON.stringify(eye));
 c.poiThirdPerson=false; c.cameraTopDown=true;
 const inside=f(near,over);
 a(inside[1]>4&&inside[1]<bound(inside)&&inside[1]<over[1]-.08,JSON.stringify(inside));
 const scene=cut('function parameters(){','function cursorAt(');
 a.match(scene,/poiThirdPerson\|\|sacredView/);
 a.match(scene,/facilitySharedWallCameraEye\(target,desired\)/);
 a.match(scene,/yaw\+Math.PI/);
});
