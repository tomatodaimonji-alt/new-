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
 assert.match(between('function facilityBuildRoofs(','function facilityVisibleRoofs('),/residentialRoofGeometry\(m,group,residential,!guildRoof\)/);
 assert.match(between('function makeScene(','function upload('),/if\(!pineGuildFantasyRoof\(m,group\)\)residentialRoofGeometry\(m,group,allRoofLookup,!!facilitySite&&!facilityUsesGuildRendering\(\)\)/);
});
test('The two offline door cues have distinct textured chimes/slides, without clipping or an abrupt stop',()=>{
 const c={};vm.runInNewContext(between('function poiSurfaceFoleyPcm(','const poiSurfaceFoleyCache='),c);
 const peak=a=>Math.max(...a.map(Math.abs)),energy=a=>a.reduce((s,v)=>s+v*v,0)/a.length;
 const wood=c.poiSurfaceFoleyPcm('wood',24000),stone=c.poiSurfaceFoleyPcm('stone',24000);
 assert.equal(wood.length,4848);assert.equal(stone.length,5472);
 for(const buf of [wood,stone]){
  assert(peak(buf)>.13&&peak(buf)<.7);
  assert(energy(buf.slice(72,480))>energy(buf.slice(-240))*9,'latch transient and gentle ending');
  assert(Math.abs(buf.at(-1))<.001);
 }
 assert.notDeepEqual(wood.slice(1440,2304),stone.slice(1440,2304));
 assert.notDeepEqual(wood,c.poiSurfaceFoleyPcm('wood',24000,1));
});
test('One opening and one closing per real doorway passage, matched to current floor',()=>{
 const run=(type,doorY,playerY)=>{
  const result=[];
  const ctx=vm.createContext({
   poiChestIsOpen:()=>false,poiShopIsOpen:()=>false,poiWalkActive:true,poiWalkX:0,poiWalkZ:0,poiWalkLevel:playerY,
   poiWalkFacing:0,poiWalkNextReady:0,poiWalkStarted:0,poiWalkFromX:0,poiWalkFromZ:0,POI_WALK_MS:175,
   facilitySite:{},pineGameActive:false,performance:{now:(()=>{let t=1000;return()=>t+=200})()},
   world:[{x:1,z:0,y:doorY,type}],poiWalkCanStep:()=>true,
   poiWalkPassableDoor:t=>t.endsWith('Door')||t.endsWith('DoorOpen')||t.endsWith('Entrance'),
   facilityHasDiningStoneLeaf:()=>false,poiSound:k=>result.push(k),poiWalkRoof(){},poiWalkAvatar(){},poiWalkStatus(){},workshopResumeWrite(){}
  });
  vm.runInContext(between('function poiDungeonThemeAt(','function poiDungeonEnterEffect(')+
   between('function poiWalkStep(','function poiWalkAction(')+"poiWalkStep(1,0);poiWalkStep(1,0);",ctx);
  return result;
 };
 assert.deepEqual(run('stonewallDoor',0,0),['door-open','door-close','step']);
 assert.deepEqual(run('stonewallDoor',0,-1),['step','step']);
 assert.deepEqual(run('stonewallDoor',-1,-1),['door-open','door-close','step']);
 assert.deepEqual(run('woodwallDoorOpen',0,0),['step','step']);
});

test('The new routes share authored roof colors and the recovered Guild does not',()=>{
 const script=between('function facilityUsesGuildRendering(','function facilityHiddenRoof(')+
  between('function poiAngledRoofPart(','function poiAngledRoofHits(')+
  between('function facilityBuildRoofs(','function facilityVisibleRoofs(');
 const run=(id,fullGuild=false)=>{
  const drawn=[],roof={x:1,z:1,y:1,type:'roofSteep'};
  vm.runInNewContext(script+';facilityBuildRoofs();',{
   facilitySite:{id,buildings:[{}]},facilityRoofMeshes:[],
   world:[roof],AUTO_ROOFS:new Set(),RESIDENTIAL_ROOFS:new Set(['roofSteep']),
   facilityIsRoofPiece:()=>true,facilityRoofOwner:()=>0,residentialRoofComponents:o=>[o],mesh:()=>({p:[]}),
   pineGuildFantasyRoof(){drawn.push('special-guild');return fullGuild},
   residentialRoofGeometry(m,group,lookup,useMuted){drawn.push(useMuted)},upload:()=>({count:1}),
  });
  return drawn;
 };
 for(const id of ['lodging','kitchen','workshop','artisan','stable','homes','toolshop','base'])
  assert.deepEqual(run(id),[true],id);
 assert.deepEqual(run('guildrenewal',true),['special-guild']);
 assert.deepEqual(run('guildrenewal',false),['special-guild',false]);
 assert.deepEqual(run('guildsaved',true),['special-guild']);
 assert.deepEqual(run('guildsaved',false),['special-guild',false]);
});
