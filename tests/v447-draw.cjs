const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(process.argv[2],'utf8');
const extract=name=>{const value=src.match(new RegExp('^function '+name+'\\([^]*?^}','m'))?.[0];assert.ok(value,name);return value};
const c={facilitySite:{id:'frontier'},poiWalkActive:true,poiWalkLevel:0,poiThirdPerson:true,cameraTopDown:false,pineAIActive:false,poiOverlandDrawing:false,facilitySurface:null};
vm.createContext(c);vm.runInContext(['stockAtlasOutside','stockAtlasOmitted','stockAtlasSceneOmissions'].map(extract).join('\n'),c);
const view=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const mesh={count:12000,stockAtlasBounds:[{start:0,end:3000,bounds:[-1,-1,-1,1,1,1]},
 {start:3000,end:12000,bounds:[10,-1,1,12,1,3]}]};
assert.equal(JSON.stringify(c.stockAtlasSceneOmissions(mesh,view)),'[[3000,12000]]','Frontier Game World must skip fully offscreen static geometry');
assert.equal(c.stockAtlasSceneOmissions({...mesh,indices:{}},view),null);
c.poiWalkActive=false;assert.equal(c.stockAtlasSceneOmissions(mesh,view),null);
c.poiWalkActive=true;c.poiWalkLevel=-1;assert.equal(c.stockAtlasSceneOmissions(mesh,view),null);
c.poiWalkLevel=0;c.facilitySite.id='base';assert.equal(c.stockAtlasSceneOmissions(mesh,view),null);
c.facilitySurface=mesh;assert.equal(JSON.stringify(c.stockAtlasSceneOmissions(mesh,view)),'[[3000,12000]]');
console.log('Visible triangles kept, only offscreen frontier static triangles omitted, editor/underground unchanged');
