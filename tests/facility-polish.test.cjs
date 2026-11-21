const assert=require('node:assert/strict');
const test=require('node:test');
const vm=require('node:vm');
const fs=require('node:fs');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function between(start,end){
 const a=html.indexOf(start),b=html.indexOf(end,a+1);
 assert(a>=0&&b>a);
 return html.slice(a,b);
}
test('Facility-only roof treatment uses coherent muted colors without changing geometry',()=>{
 const colors=(id,authored)=>vm.runInNewContext(`
 function terrainY(){return 0}
 function terrainLevel(){return 0}
 function naturalBranch(m,ax,ay,az,bx,by,bz,w1,w2,color){m.push([[ax,ay,az,bx,by,bz],color])}
 function quad(m,a,b,c,d,col){m.push([[...a,...b,...c,...d],col])}
 function tri(m,a,b,c,col){m.push([[...a,...b,...c],col])}
 function cube(m,x,y,z,w,h,d,col){m.push([[x,y,z,w,h,d],col])}
 ${between('function roofRectangles(','const AUTO_ROOFS')}
 const map=[{x:3,z:4,y:1,rot:0,type:id}],m=[];
 residentialRoofGeometry(m,map,new Map(),authored);m`,{id,authored});
 const ids=['roofDormer','roofHip','roofThatchThick','roofLean','roofSteep','roofCross'];
 const roofColors=[];
 for(const id of ids){
  const off=colors(id,false),on=colors(id,true);
  assert(off.length>0);
  assert.equal(JSON.stringify(off.map(([p])=>p)),JSON.stringify(on.map(([p])=>p)));
  assert.notEqual(JSON.stringify(off),JSON.stringify(on));
  roofColors.push(on[0][1]);
 }
 for(let k=0;k<3;k++)assert(Math.max(...roofColors.map(c=>c[k]))-Math.min(...roofColors.map(c=>c[k]))<.15);
 assert.match(between('function facilityBuildRoofs(','function facilityVisibleRoofs('),/residentialRoofGeometry\(m,group,residential,facilitySite.id!=='guildrenewal'\)/);
 assert.match(between('function makeScene(','function upload('),/if\(!pineGuildFantasyRoof\(m,group\)\)residentialRoofGeometry\(m,group,allRoofLookup,!!facilitySite&&facilitySite.id!=='guildrenewal'\)/);
});
test('The offline wooden cue uses filtered transients, not pitched sine sweeps; other effects unchanged in routing',()=>{
 const events=[];
 const ctx=vm.createContext({poiWalkActive:true,poiAudioEnabled:true,poiAudioLevels:{master:85,se:70},
   poiAudioStart(){},poiAudioAllowed:()=>true,poiAudioContext:{state:'running',currentTime:1},
   poiAudioNoiseBurst(...args){events.push(['noise',...args]);},
   poiAudioThud(...args){events.push(['sine',...args]);},console});
 vm.runInContext(between('function poiSound(','function poiAudioSyncLifecycle(')+"poiSound('door');",ctx);
 assert(events.length>=3&&events.length<=6);
 assert(events.every(([kind,at,duration,freq,q,peak])=>kind==='noise'&&at>=1&&at+duration<1.35&&freq>70&&freq<4500&&peak<=.4));
 assert(events.some(([,at,duration,freq])=>at>=1.08&&freq<450&&duration>.055),'wood panel seating thud');
 events.length=0;
 ctx.poiAudioLevels.se=0;
 vm.runInContext("poiSound('door')",ctx);
 assert.equal(events.length,0,'respect muted sound effect bus');
 vm.runInContext("poiSound('step')",ctx);
 assert(events.some(e=>e[0]==='sine'),'ordinary footsteps retained');
});
test('One door cue per actual threshold, matched to current floor including basements',()=>{
 const run=(type,doorY,playerY)=>{
  const result=[];
  const ctx=vm.createContext({
   poiWalkActive:true,poiWalkX:0,poiWalkZ:0,poiWalkLevel:playerY,
   poiWalkFacing:0,poiWalkNextReady:0,poiWalkStarted:0,poiWalkFromX:0,poiWalkFromZ:0,POI_WALK_MS:175,
   facilitySite:{},pineGameActive:false,performance:{now:(()=>{let t=1000;return()=>t+=200})()},
   world:[{x:1,z:0,y:doorY,type}],poiWalkCanStep:()=>true,
   poiWalkPassableDoor:t=>t.endsWith('Door')||t.endsWith('DoorOpen')||t.endsWith('Entrance'),
   poiSound:k=>result.push(k),poiWalkRoof(){},poiWalkAvatar(){},poiWalkStatus(){},workshopResumeWrite(){}
  });
  vm.runInContext(between('function poiWalkStep(','function poiWalkAction(')+"poiWalkStep(1,0);poiWalkStep(1,0);",ctx);
  return result;
 };
 assert.deepEqual(run('stonewallDoor',0,0),['door','step']);
 assert.deepEqual(run('stonewallDoor',0,-1),['step','step']);
 assert.deepEqual(run('stonewallDoor',-1,-1),['door','step']);
 assert.deepEqual(run('woodwallDoorOpen',0,0),['step','step']);
});
