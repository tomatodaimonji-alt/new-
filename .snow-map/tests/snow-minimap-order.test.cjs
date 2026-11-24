const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const begin=h.indexOf('function poiSnowPassApply('),end=h.indexOf('function poiSnowPassVeil(',begin);
a(begin>=0&&end>begin);
for(const onBase of [true,false])test('minimap is built exactly once across '+(onBase?'entry to snow':'return to base'),()=>{
 const trace=[];let cache='previous',count=0;
 const status=()=>{trace.push('status');if(cache!==c.facilitySite.id){cache=c.facilitySite.id;count++}};
 const d={region:onBase?'snowpass':'base',x:onBase?12:49,z:onBase?0:127,facing:onBase?2:0};
 const incoming={id:d.region,spawn:{x:d.x,z:d.z}},base={site:{id:'base'},initial:'old',edited:false,spawn:{x:1,z:2},warm:true,monsters:new Map};
 const c={poiPlayerHP:77,poiAttackReady:0,facilitySite:{id:onBase?'base':'snowpass'},poiWalkActive:true,POI_WALK_MS:190,poiOtherworldTravelSerial:0,poiSnowPassSwitches:0,
  poiMiniInvalidate(){trace.push('invalidate');cache=null},poiWalkReset(){trace.push('reset');status()},
  poiWalkStatus:status,poiCombatHud(){},poiHotbarRender(){},poiWalkAvatar(){},poiWalkCamera(){},poiWalkFrameNoRegionRemote(){},
  facilityBuildRoofs(){trace.push('roof')},facilityPrepareFloorMasks(){trace.push('mask')},facilityLoadMap(){trace.push('place')},
  poiSnowPassRestoreBaseMap(){trace.push('place')},data:()=>({}),$:()=>({})};
 vm.runInNewContext(h.slice(begin,end),c);
 a.equal(c.poiSnowPassApply(d,500,false,{onBase,base,incoming,map:{}}),true);
 a.equal(count,1,JSON.stringify(trace));
 a(trace.indexOf('place')<trace.indexOf('invalidate')&&trace.indexOf('invalidate')<trace.indexOf('reset'));
 a.equal(trace.filter(t=>t==='status').length,2,'both existing status callbacks still fire');
 a.equal(c.poiPlayerHP,77);
});
