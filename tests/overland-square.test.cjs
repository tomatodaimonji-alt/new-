const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),test=require('node:test');
const h=fs.readFileSync(process.env.WORLD_HTML||'world-editor.html','utf8');
function cut(a,b){const i=h.indexOf(a),j=h.indexOf(b,i+1);assert(i>=0&&j>i);return h.slice(i,j)}
const c=vm.createContext({});
vm.runInContext(cut('// BEGIN OVERLAND STREAM PLANNING','// END OVERLAND STREAM PLANNING')+
 cut('// BEGIN SNOW PASS PROTOTYPE','const poiSnowEdgeFloorCache='),c);
const value=source=>JSON.parse(JSON.stringify(vm.runInContext(source,c)));
test('real surface owns a sparse 184 square with disjoint global rows at the non-aligned snow seam',()=>{
 assert.equal(typeof c.poiOverlandSquareStatus,'function','active floor ownership must have a real square index');
 const s=value('poiOverlandSquareStatus()');
 assert.equal(s.side,184);assert.equal(s.chunk,8);assert.equal(s.side/s.chunk,23);
 assert.equal(s.tiles,16384+48*54+24*11+24*29);assert(s.slots>0&&s.slots<23**2);
 assert.deepEqual(value('poiOverlandSquareSlot(7,17)'),[
  {id:'base',rows:[255,255,255,0,0,0,0,0]},
  {id:'snowpass',rows:[0,0,0,255,255,255,255,255]}
 ]);
 assert.deepEqual(value('poiOverlandSquareSlot(22,22)'),[]);
 assert.equal(c.poiOverlandSquareOwner(127,181),null);
 assert.equal(c.poiOverlandSquareOwner(183,183),null);
});
test('actual vertex ownership exactly equals inherited Base/Snow extents, not the bounding square',()=>{
 assert.equal(typeof c.poiOverlandSquareOwner,'function');
 for(let z=0;z<184;z++)for(let x=0;x<184;x++){
  const base=x<128&&z<182&&(z<128||x<48||z<139&&x<72);
  const snow=x>=48&&x<72&&z>=139&&z<168;
  assert.equal(c.poiOverlandSquareOwner(x,z),base?'base':snow?'snowpass':null,`tile ${x},${z}`);
  assert.equal(c.poiOverlandBaseGroundOwn(x,z,128,182),base);
  assert.equal(x<c.poiOverlandBaseGroundColumns(z,128,182),base);
 }
 assert.equal(c.poiOverlandBaseGroundOwn(10,21,32,30),true,'noncanonical editor stays rectangular');
 assert.equal(c.poiOverlandBaseGroundColumns(25,32,30),32);
});
test('real link preserves exact region-local seam inputs both ways and rejects padding, slope/diagonal and B1',()=>{
 assert.match(h,/function poiSnowPassLink[\s\S]{0,620}poiOverlandSquareOwner\(/);
 assert.deepEqual(value("poiSnowPassLink('base',60,138,0,60,139)"),{region:'snowpass',x:12,z:0,y:0,facing:2});
 assert.deepEqual(value("poiSnowPassLink('snowpass',12,0,0,12,-1)"),{region:'base',x:60,z:138,y:0,facing:0});
 assert.deepEqual(value("poiSnowPassLink('base',47,150,0,48,150)"),{region:'snowpass',x:0,z:11,y:0,facing:1});
 assert.deepEqual(value("poiSnowPassLink('snowpass',0,11,0,-1,11)"),{region:'base',x:47,z:150,y:0,facing:3});
 assert.equal(c.poiSnowPassLink('base',71,138,0,72,138),null);
 assert.equal(c.poiSnowPassLink('base',60,138,-1,60,139),null);
 assert.equal(c.poiSnowPassLink('base',60,138,0,61,139),null);
 assert.equal(c.poiSnowPassLink('milda',0,0,0,1,0),null);
});
