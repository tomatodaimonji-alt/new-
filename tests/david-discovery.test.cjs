const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../world-editor.html'),'utf8');
const take=(start,end)=>{const i=html.indexOf(start),j=html.indexOf(end,i+1);a.ok(i>=0&&j>i,start);return html.slice(i,j)};
const evalAPI=ctx=>vm.runInNewContext(take('const POI_DAVID_AWAKENING=','const POI_DAVID_PATTERNS=') .split('\n').slice(0,2).join('\n')+'\n'+
 take('const POI_DAVID_LEAP_LOAD=','const poiDavidLeapClamp=')+
 take('function poiDavidMobFrame(','function poiDavidBegin(')+
 take('function poiDavidLeapTick(','function poiDavidLeapPose(')+
 take('function poiDavidCuePairs(','function poiDavidCueGeometry(')+
 ';({wake:poiDavidMobFrame,land:poiDavidLeapTick,cue:poiDavidCuePairs,wakeMs:POI_DAVID_WAKE_MS,radius:POI_DAVID_LEAP_RADIUS})',ctx);
test('true authored two-tile distance, arena and sight gate; awakening duration unchanged',()=>{
 const b={x:24,z:104,y:0},o={type:'monsterStoneDavid'},s=()=>({x:b.x,z:b.z,hp:1050});
 const c={poiDavidActive:null,poiMonsterMeshDirty:false,poiDavidMatch:()=>b,poiDavidIn:(b,p)=>p.y===0,
  poiDavidLine:()=>c.clear!==false,poiDavidHidden:()=>false,poiEnemyThreatEnabled:()=>true,poiAimOrigin:()=>c.p};
 const api=evalAPI(c);
 c.p={x:25.5,z:105.5,y:0};a.equal(api.wake(o,s(),100),false);
 c.p={x:24,z:106.0001,y:0};a.equal(api.wake(o,s(),100),false);
 c.p={x:24,z:106,y:1};a.equal(api.wake(o,s(),100),false);
 c.p={x:24,z:106,y:0};c.clear=false;a.equal(api.wake(o,s(),100),false);
 c.clear=true;const state=s();a.equal(api.wake(o,state,100),true);
 a.equal(api.wakeMs,2440);a.equal(state.david.next,2540);a.equal(state.david.wakeDone,false);
});
test('actual leap contact and warning use 7-tile disk; ordinary stomp warning is still 6, and walls block',()=>{
 let damaged=0,line=true;
 const c={poiMonsterMeshDirty:false,poiDavidIn:()=>true,poiDavidLine:()=>true,poiMonsterCanMove:()=>true,
 poiAimWall:()=>()=>true,poiDavidArena:()=>null,poiDavidRoomRay:(q,b,v,len)=>line?len:Math.min(len,3),
 poiMobHitPlayer:(o,t,damage)=>{damaged+=damage;return false},poiDavidCease:()=>{throw Error('static test landing legal')}};
 const api=evalAPI(c),b={x:0,z:0,y:0,room:{minX:-10,maxX:10,minZ:-10,maxZ:10}};
 const land=(x,z)=>{
  const q={kind:'leap',cursor:0,leap:{x:0,z:0,x0:-3,z0:0,land:0,route:[{x:0,z:0}]}},
   state={david:{trail:[]}};
  api.land({},state,b,{x,z,y:0},q,50);
  a.equal(q.executed,1);return q.landed;
 };
 a.equal(api.radius,7);
 a.equal(Math.max(...api.cue({kind:'leap',dx:1,dz:0,sx:0,sz:0,y:0},b).map(v=>v.hi)),7);
 a.equal(Math.max(...api.cue({kind:'stomp',dx:1,dz:0,sx:0,sz:0,y:0},b).map(v=>v.hi)),6);
 a.equal(land(7,0),1);a.equal(land(7,1),undefined);a.equal(damaged,43);
 line=false;a.equal(land(7,0),undefined);a.equal(damaged,43);
});
