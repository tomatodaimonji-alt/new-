const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const ctx=()=>{
 const a=html.indexOf('// BEGIN UNIFORM CONSTRUCTION'),b=html.indexOf('// END UNIFORM CONSTRUCTION');
 assert(a>=0&&b>a,'stock and stream need the same exterior classification');
 const c=vm.createContext({POI_UNIFORM_SHELL:false,poiSacredTempleVisualMember:(_,o)=>/^poiDavid/.test(o.type)});
 vm.runInContext(html.slice(a,b),c);return c;
};
test('ordinary solid gate and roof share the exterior class but indoor/hidden or unrecognized props do not',()=>{
 const c=ctx(),base={id:'base'},snow={id:'snowpass'};
 for(const s of [base,snow]){
  assert(c.poiUniformBuildMember(s,{type:'poiFortGate',x:5,z:6,y:0}));
  assert(c.poiUniformBuildMember(s,{type:'poiFortWall',x:5,z:6,y:0}));
  assert(!c.poiUniformBuildMember(s,{type:'poiFortGate',x:5,z:6,y:-1}));
  assert(!c.poiUniformBuildMember(s,{type:'poiDavidWallRound',x:5,z:6,y:0}));
  assert(!c.poiUniformBuildMember(s,{type:'chest',x:5,z:6,y:0}));
 }
});
test('contiguous tagged atlas spans collapse without changing position or reading new vertex arrays',()=>{
 const c=ctx(),ranges=[];
 c.poiUniformBuildRange(ranges,3,6);c.poiUniformBuildRange(ranges,6,12);
 c.poiUniformBuildRange(ranges,18,21);c.poiUniformBuildRange(ranges,21,21);
 assert.deepEqual(JSON.parse(JSON.stringify(ranges)),[[3,12],[18,21]]);
});
