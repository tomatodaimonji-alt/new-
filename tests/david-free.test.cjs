const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const s=fs.readFileSync(require('node:path').join(__dirname,'../world-editor.html'),'utf8');
const cut=(a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)+1));
const plain=x=>JSON.parse(JSON.stringify(x));
function load(extra={}){
 const ctx={POI_ACTOR_RADIUS:.21,POI_FREE_STEP:.12,POI_FREE_EPS:1e-5,
  poiDavidIn:(b,p)=>p.x>=0&&p.x<=5&&p.z>=0&&p.z<=5,
  poiActorSameGrade:()=>true,poiTownNpcActorOccupied:()=>false,poiMonsterCanMove:()=>true,
  poiMonsterActorActive:new Map(),poiMonsterMeshDirty:false,
  poiActorHeading:(x,z)=>Math.atan2(x,z),poiDavidHidden:()=>false,poiWalkLevel:0,poiDavidArrive:s=>{s.david=null},
  ...extra};
 const inc=vm.runInNewContext("const poiFreeCell=x=>Math.floor(x+.5);"+
  cut('function poiFreeAdvance(','function poiPlayerNpcBodyClip(')+
  cut('function poiMonsterActorPoint(','function poiMonsterActorSync(')+
  cut('// BEGIN DAVID FREE MOTION','// END DAVID FREE MOTION')+
  ';({plan:poiDavidFreePlan,approach:poiDavidFreeApproach,point:poiDavidGroundPoint,back:poiDavidFreeReturn})',ctx);
 return inc;
}
test('real two-axis movement follows fractional line and returns without endpoint snap',()=>{
 const api=load(),o={y:0},s={x:0,z:0,david:{trail:[{x:0,z:0}]}},b={x:0,z:0,y:0};
 a.equal(api.approach(o,s,b,{x:3,z:4},10),true);
 const start=api.point(s,10),center=api.point(s,127.5),end=api.point(s,245);
 a.deepEqual(plain(start),{x:0,z:0,t:0});
 a.ok(Math.abs(center.x-.3)<1e-6&&Math.abs(center.z-.4)<1e-6);
 a.ok(Math.abs(end.x-.6)<1e-6&&Math.abs(end.z-.8)<1e-6&&end.t===1);
 a.equal(api.approach(o,s,b,{x:3,z:4},190),false);
 api.back(o,s,b,260);a.deepEqual(plain(api.point(s,260)),{x:.6,z:.8,t:0});
 api.back(o,s,b,620);a.equal(s.david,null);a.equal(s.x,0);a.equal(s.z,0);
});
test('swept diagonal cannot cut solid corner and blocked fallback does not snap',()=>{
 const api=load({poiMonsterCanMove:(x,z)=>x<=1||z<=1}),o={y:0},s={x:1,z:1,david:{trail:[{x:1,z:1}]}};
 a.equal(api.plan(o,s,{},s,1.8,1.8),null);
 a.equal(api.approach(o,s,{}, {x:4,z:4},0),true);
 const e=api.point(s,235);a.ok(e.x===1||e.z===1);a.ok(Math.hypot(e.x-1,e.z-1)>.99);
});
