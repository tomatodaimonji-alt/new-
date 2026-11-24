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
test('real validPos keeps canonical Play ground-only and does not enlarge editor or independent facilities',()=>{
 const ctx=vm.createContext({poiWalkActive:false,pineAIActive:false,poiWalkLevel:0,MAP_W:128,MAP_H:182,
  facilitySite:{id:'base',map:{width:128,height:182},davidTemple:{depth:1}}});
 vm.runInContext(src('// BEGIN SQUARE FIELD','// END SQUARE FIELD')+
  src('function poiSnowSleeveOwn(','function poiOverlandBaseGroundOwn(')+src('const validPos=','const safeColor=')+';this.valid=validPos',ctx);
 assert.equal(ctx.valid(183,183),false);
 ctx.poiWalkActive=true;assert.equal(ctx.valid(183,183),true);assert.equal(ctx.valid(184,183),false);
 assert.equal(ctx.valid(59,145),false,'Base must not claim Snow local coordinates through its old array dimensions');
 ctx.poiWalkLevel=-1;assert.equal(ctx.valid(183,183),false);assert.equal(ctx.valid(45,155),true);
 ctx.poiWalkLevel=0;ctx.pineAIActive=true;assert.equal(ctx.valid(183,183),false);
 ctx.pineAIActive=false;ctx.facilitySite={id:'toolshop',map:{width:128,height:182}};
 assert.equal(ctx.valid(183,183),false);
});
test('same authored Snow parcel receives matching shared-corner material and exposure at all four real edges',()=>{
 const c=vm.createContext({smoothSurfaceNoise:()=>.5});
 vm.runInContext(src('function poiSnowFrostAmount(','function poiSacredTunnelLight('),c);
 for(const [x,z] of [[48,150],[60,139],[72,150],[60,168]]){
  const base=c.poiSnowGroundEdgeTint('base',x,z,'grass',null)(x,z,[.3,.5,.4]);
  const snow=c.poiSnowGroundEdgeTint('snowpass',x-48,z-139,'poiSnowGround',null)(x-48,z-139,[.86,.91,.96]);
  assert.deepEqual(base,snow);
 }
 for(const [x,z] of [[-.5,15],[12,-.5],[23.5,15],[12,28.5]])assert.equal(c.poiSnowBiomeLightWeight(x,z),0);
 assert.equal(c.poiSnowBiomeLightWeight(12,14),1);
});
