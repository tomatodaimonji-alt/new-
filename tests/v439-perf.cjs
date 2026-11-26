const fs=require('node:fs'),vm=require('node:vm'),a=require('node:assert/strict');
const html=fs.readFileSync(process.argv[2]||'candidate.html','utf8');
for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
const fn=name=>{const m=html.match(new RegExp('^function '+name+'\\([^]*?^}','m'));a.ok(m,name);return m[0]};
const batches=[],c={poiThirdPerson:true,poiFieldHazeFrame:{id:'frontier',world:[100,0]},draw:(m,vp,first=0,count=m.count)=>batches.push([first,count])};
vm.createContext(c);
vm.runInContext(['stockAtlasOutside','frontierStaticDraw','stockGradeDraw'].map(fn).join('\n'),c);
const parcels=[
 {start:0,end:300,bounds:[0,-1,0,2,1,2]},
 {start:300,end:600,bounds:[99,-1,0,102,1,2]},
 {start:600,end:900,bounds:[146,-1,0,151,1,2]},
 {start:900,end:1200,bounds:[151,-1,0,155,1,2]}
];
const vp=[.005,0,0,0,0,.005,0,0,0,0,.005,0,0,0,0,1],m={count:1260,parcels,frontierSpatial:true};
c.stockGradeDraw(m,vp);
a.deepEqual(batches,[[300,600],[1200,60]]);
batches.length=0;c.poiFieldHazeFrame=null;
c.stockGradeDraw(m,vp);
a.deepEqual(batches,[[0,1260]],'when shader has no 48 tile limit, do not use that limit for culling');
batches.length=0;c.frontierStaticDraw({count:1260,stockAtlasBounds:parcels},vp,null);
a.deepEqual(batches,[[0,1260]],'below ground, no radial cap');
batches.length=0;c.frontierStaticDraw({count:1260,stockAtlasBounds:parcels},[...vp.slice(0,12),-3,0,0,1],null);
a.deepEqual(batches,[[1200,60]],'preserve unindexed tail even when all indexed batches are off camera');
console.log('PASS full terrain ranges retained and only GPU-invisible spans culled');
