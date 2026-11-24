const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{test}=require('node:test');
const text=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const src=(a,b)=>{const i=text.indexOf(a),j=text.indexOf(b,i+1);assert(i>=0&&j>i);return text.slice(i,j)};
const c=vm.createContext({MAX_MAP:128,MAX_LEVEL:9,POI_SACRED_DEPTH_H:182,POI_SACRED_DEPTH_W:48,
 isFloor:s=>/^(road|grass|sea|water)/.test(s)});
vm.runInContext(src('// BEGIN OVERLAND STREAM PLANNING','// END OVERLAND STREAM PLANNING')+
 src('// BEGIN SNOW PASS PROTOTYPE','function poiSnowPassMap(')+
 src('function workshopResumeDecode(','function workshopResumePermitted('),c);
const p=v=>JSON.parse(JSON.stringify(v));
test('actual Base fill owns complement of the unchanged Snow rectangle, no extra floor objects',()=>{
 assert.equal(typeof c.poiSquareFieldAt,'function','the square must physically fill previously unused slots');
 let fill=0,snow=0,base=0;
 for(let z=0;z<185;z++)for(let x=0;x<185;x++){
  const id=c.poiOverlandSquareOwner(x,z);
  if(x===184||z===184)assert.equal(id,null);
  else if(x>=48&&x<72&&z>=139&&z<168){assert.equal(id,'snowpass');snow++}
  else{assert.equal(id,'base');base++}
  if(c.poiSquareFieldAt(x,z))fill++;
 }
 assert.deepEqual([fill,base,snow],[13920,33160,696]);
 assert.equal(c.poiOverlandBaseGroundColumns(138,128,182),72,'legacy stock ground stays sparse and fixed width');
 assert.equal(c.poiOverlandBaseGroundColumns(150,128,182),48);
});
test('new east and south Snow edges reach physical synthetic Base but water/blocked neighbors do not become passable',()=>{
 assert.equal(typeof c.poiSquareFieldAt,'function');
 assert.deepEqual(p(c.poiSnowPassLink('snowpass',23,10,0,24,10)),{region:'base',x:72,z:149,y:0,facing:1});
 assert.deepEqual(p(c.poiSnowPassLink('base',59,168,0,59,167)),{region:'snowpass',x:11,z:28,y:0,facing:0});
 assert.deepEqual(p(c.poiSnowPassLink('base',60,138,0,60,139)),{region:'snowpass',x:12,z:0,y:0,facing:2});
 assert(c.poiSnowEdgeWalkable([],72,149,'base'));
 assert(!c.poiSnowEdgeWalkable([{x:72,z:149,y:0,type:'sea'}],72,149,'base'));
 assert(!c.poiSnowEdgeWalkable([{x:23,z:10,y:0,type:'grass'},{x:23,z:10,y:0,type:'barrel'}],23,10,'snowpass'));
 assert(!c.poiSnowEdgeWalkable([],72,149,'snowpass'));
});
test('same version-one resume shape, extended only for play in canonical Base on ground, no legacy shift',()=>{
 const old={version:1,route:'facility',id:'base',play:true,townLayout:5,townMapHeight:182,templeDepth:1};
 const at=(x,z,y=0,opts={})=>p(c.workshopResumeDecode(JSON.stringify({...old,...opts,position:{x,z,y,facing:2}})));
 assert.deepEqual(at(183,183).position,{x:183,z:183,y:0,facing:2});
 assert.deepEqual(at(131,170).position,{x:131,z:170,y:0,facing:2});
 assert.deepEqual(at(59,138).position,{x:59,z:138,y:0,facing:2});
 assert.deepEqual(at(59,140).position,null,'snow global coordinate cannot restore as Base');
 assert.deepEqual(at(12,1,0,{region:'snowpass',regionHp:71}).position,{x:12,z:1,y:0,facing:2});
 for(const bad of [at(184,183),at(183,183,-1),at(183,183,1),at(183,183,0,{play:false}),at(183,183,0,{townMapHeight:128}),at(183,183,0,{route:'map-play'})])assert.equal(bad.position,null);
});
test('expanded survey indexes are dense only for new 13,920 cells and use existing 128-wide bit storage',()=>{
 assert.equal(typeof c.poiSquareFieldRank,'function');
 const ranks=new Set();
 for(let z=0;z<184;z++)for(let x=0;x<184;x++){
  const q=c.poiSquareFieldRank(x,z);if(c.poiSquareFieldAt(x,z)){assert(q>=0&&q<13920);ranks.add(q)}else assert.equal(q,-1);
 }
 assert.equal(ranks.size,13920);assert.match(text,/base:0:outerfield/);assert.match(text,/nearest|poiSquareFieldNear/);
});
