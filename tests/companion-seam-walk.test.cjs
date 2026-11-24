const {test}=require('node:test'),a=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
test('shared directed edge and coordinates round-trip; no non-adjacent, disconnected or cold seam handoff',()=>{
 const i=h.indexOf('// BEGIN COMPANION SEAM WALK'),j=h.indexOf('// END COMPANION SEAM WALK');
 a(i>0&&j>i);
 const c=vm.createContext({poiOverlandGlobal:(id,x,z)=>id==='base'?[x,z]:[x+48,z+139],
  poiOverlandLocal:(id,x,z)=>id==='base'?[x,z]:[x-48,z-139],
  poiSnowPassLink:(id,x,z,y,nx,nz)=>id==='base'&&x===60&&z===138&&nx===60&&nz===139?{region:'snowpass',x:12,z:0,y:0}:id==='snowpass'&&x===12&&z===0&&nx===12&&nz===-1?{region:'base',x:60,z:138,y:0}:null});
 vm.runInContext(h.slice(i,j),c);
 const plain=v=>JSON.parse(JSON.stringify(v));
 a.deepEqual(plain(c.poiCompanionSeamEdge('base',{region:'snowpass',x:12,z:0,facing:2})),{x:60,z:138,nx:60,nz:139});
 a.deepEqual(plain(c.poiCompanionSeamEdge('snowpass',{region:'base',x:60,z:138,facing:0})),{x:12,z:0,nx:12,nz:-1});
 a.equal(c.poiCompanionSeamEdge('base',{region:'snowpass',x:12,z:0,facing:1}),null);
 a.equal(c.poiCompanionSeamEdge('base',{region:'snowpass',x:12,z:2,facing:2}),null);
});
