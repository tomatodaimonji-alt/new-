const a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.argv[2],'utf8');
for(const m of h.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
const fn=name=>h.match(new RegExp('^function '+name+'\\([^]*?^}','m'))?.[0]||'';
const ctx={facilitySite:{id:'frontier'},poiWalkActive:true,poiWalkLevel:0,poiThirdPerson:true,cameraTopDown:false,pineAIActive:false,poiOverlandDrawing:false,facilitySurface:null,poiFieldHazeActive:true,
 poiFieldHazeFrame:{id:'frontier',world:[100,-10]}};
vm.createContext(ctx);vm.runInContext(['frontierHazeDrawOrigin','frontierHorizonOutside','stockAtlasOutside','stockAtlasOmitted','stockAtlasSceneOmissions'].map(fn).join('\n'),ctx);
const vp=[.005,0,0,0,0,.005,0,0,0,0,.005,0,0,0,0,1];
const m={count:40000,stockAtlasBounds:[
 {start:0,end:10000,bounds:[98,-.5,-8,105,5,5]},
 {start:10000,end:20000,bounds:[138,-.5,19,160,5,25]}, // diagonal 47.5 near corner stays
 {start:20000,end:35000,bounds:[139,-.5,21,160,5,34]}, // diagonal >49.6 to nearest corner
 {start:35000,end:40000,bounds:null}
]};
a.equal(JSON.stringify(ctx.stockAtlasSceneOmissions(m,vp)),'[[20000,35000]]',
 'omit fully beyond-48-tile material while preserving edge-straddling and unknown groups');
ctx.poiFieldHazeActive=false;
a.equal(ctx.stockAtlasSceneOmissions(m,vp),null,'do not apply when the active shader would have rendered the scene');
ctx.poiFieldHazeActive=true;ctx.facilitySite.id='base';ctx.facilitySurface=m;
a.equal(ctx.stockAtlasSceneOmissions(m,vp),null,'do not change base-world draw policy');
ctx.facilitySite.id='frontier';ctx.poiWalkLevel=-1;
a.equal(ctx.stockAtlasSceneOmissions(m,vp),null,'do not change cave draw policy');
console.log('PASS 48-tile shader horizon matched conservatively at diagonal and parcel edges');
