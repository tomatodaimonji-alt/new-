const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function game(){
 const start=h.indexOf('// BEGIN FACILITY LOCAL SCENE'),end=h.indexOf('// END FACILITY LOCAL SCENE',start);
 a.ok(start>=0&&end>start,'local add-on scene reducer');
 const log=[],c={poiWalkActive:true,poiWalkX:40,poiWalkZ:41,poiWalkLevel:0,
  facilitySite:{id:'base',southPort:{bounds:{x1:73,x2:92,z1:109,z2:127,y:0},
   props:[{x:84,z:116,y:0,type:'poiPortFishStall'}],water:[{x:76,z:118,y:0},{x:72,z:118,y:0}],
   dock:{route:[{x:73,z:118,y:0},{x:74,z:118,y:0}]},approach:[{x:91,z:123,y:0}]}},
  poiWalkCanStep:(x,z)=>!c.blocked?.has(x+','+z),
  world:[{x:84,z:116,y:0,type:'poiPortFishStall'},{x:84,z:116,y:0,type:'stone'},{x:70,z:109,y:0,type:'treePine'}],
  isFloor:type=>type==='stone'||type==='sea',makeScene:()=>{log.push(c.build());return {count:24,buf:log.length}},
  poiWalkViewX:40,poiWalkViewZ:41,performance:{now:()=>1000},loc:{streamPropReveal:0},
  gl:{deleteBuffer:b=>log.push('delete '+b),uniform3f(){}},draw:()=>log.push('draw')};
 const aa=h.indexOf('// BEGIN STREAM PROP REVEAL'),bb=h.indexOf('// END STREAM PROP REVEAL',aa);
 vm.createContext(c);vm.runInContext(h.slice(aa,bb)+h.slice(start,end)+';this.build=()=>poiFacilityLocalBuild',c);
 return {c,log};
}
test('cold base neither compiles nor draws port, a near scene uses local objects only and detaches after hysteresis',()=>{
 const {c,log}=game();
 a.equal(c.facilityLocalSceneStatus().active,null);c.facilityDrawLocalScene(null);a.deepEqual(log,[]);
 c.poiWalkX=104;c.poiWalkZ=112;c.facilityDrawLocalScene(null);
 a.equal(c.facilityLocalSceneStatus().active,'southPort');a.equal(c.facilityLocalSceneStatus().builds,1);
 a.equal(log[0].length,1);a.equal(log[0][0].type,'poiPortFishStall');
 c.poiWalkX=109;c.facilityDrawLocalScene(null);a.equal(c.facilityLocalSceneStatus().active,'southPort');
 c.poiWalkX=110;c.facilityDrawLocalScene(null);a.equal(c.facilityLocalSceneStatus().active,null);
 a.equal(log.at(-1),'delete 1');
 c.facilityDrawLocalScene(null);a.equal(c.facilityLocalSceneStatus().draws,2);
 c.poiWalkX=105;c.facilityDrawLocalScene(null);a.equal(c.facilityLocalSceneStatus().builds,2);
 c.poiWalkLevel=-1;c.facilityDrawLocalScene(null);a.equal(c.facilityLocalSceneStatus().vertices,0);
});
test('local path neighborhoods and sea policy respect floor, metadata and dry docks',()=>{
 const {c}=game();c.poiWalkX=84;c.poiWalkZ=115;
 a.equal(c.poiSouthPortNear(),true);
 a.equal(c.poiSouthPortWaterBlocked(76,118,0,[{type:'sea'}]),true);
 a.equal(c.poiSouthPortWaterBlocked(76,118,0,[{type:'roadAncientFull'}]),false);
 a.equal(c.poiSouthPortWaterBlocked(72,118,0,[{type:'sea'}]),true,'authored water beyond land bounds also blocked');
 a.equal(c.poiSouthPortWaterBlocked(70,118,0,[{type:'sea'}]),false);
 a.equal(c.poiSouthPortWaterBlocked(76,118,-1,[{type:'sea'}]),false);
 c.poiWalkX=94;a.equal(c.poiSouthPortNear(),false);a.equal(c.poiSouthPortNear(3),true);
 c.facilitySite.id='lodging';a.equal(c.poiSouthPortNear(3),false);
});
test('only old exact now-sea checkpoints recover to the nearest dry reachable dock without changing facing',()=>{
 const {c}=game();
 const old={x:72,z:118,y:0,facing:3},dry={x:84,z:115,y:0,facing:1},underground={...old,y:-1};
 c.world.push({x:72,z:118,y:0,type:'sea'});
 c.blocked=new Set(['73,118']);c.poiWalkLevel=-1;
 a.deepEqual({...c.poiSouthPortRecoverPosition(old)},{x:74,z:118,y:0,facing:3});
 a.equal(c.poiWalkLevel,-1);
 a.equal(c.poiSouthPortRecoverPosition(dry),dry);a.equal(c.poiSouthPortRecoverPosition(underground),underground);
 a.match(h,/p=poiSouthPortRecoverPosition\(p\)/);
});
test('whole-map AI/top inspection shows the port remotely even though ordinary player walking never does',()=>{
 const {c}=game();
 c.pineAIActive=true;c.facilityDrawLocalScene(null);
 a.equal(c.facilityLocalSceneStatus().active,'southPort');
 c.pineAIActive=false;c.facilityDrawLocalScene(null);
 a.equal(c.facilityLocalSceneStatus().active,null);
 c.cameraTopDown=true;c.facilityDrawLocalScene(null);
 a.equal(c.facilityLocalSceneStatus().active,'southPort');
});
