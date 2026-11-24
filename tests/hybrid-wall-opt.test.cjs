const fs=require('node:fs'),vm=require('node:vm'),a=require('node:assert/strict'),{test}=require('node:test');
const s=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const runt=()=>{const x=s.indexOf('// BEGIN OPTIMIZED FORT POLICY'),y=s.indexOf('// END OPTIMIZED FORT POLICY');
 a(x>=0&&y>x,'bounded exact rotation and actual gate tier residency are required');
 const c=vm.createContext({});vm.runInContext(s.slice(x,y),c);return c};
test('only actual positive gate tiers are required at 18/30/45 and in true crossover',()=>{
 const r=runt(),chk=(p,q)=>a.deepEqual(Array.from(r.poiHybridGateResidentTiers(p)),q);
 chk([1,0,0],[0]);chk([0,1,0],[1]);chk([0,0,.98],[2]);chk([.5,.5,0],[0,1]);chk([0,.4,.6],[1,2]);chk([0,0,0],[]);
});
test('rotation table and per-world-axis bake multipliers preserve original directional masonry shade',()=>{
 const r=runt(),t=[{c:1,s:0},{c:0,s:1},{c:-1,s:0},{c:0,s:-1}];
 for(let i=0;i<4;i++)a.deepEqual(JSON.parse(JSON.stringify(r.poiHybridWallRot(i))),t[i]);
 for(const [normal,expected] of [[[0,1,0],1.08],[[0,0,1],1],[[0,0,-1],.72],[[-1,0,0],.88],[[1,0,0],.83]])
  a.equal(r.poiHybridWallFaceShade(...normal),expected);
});
