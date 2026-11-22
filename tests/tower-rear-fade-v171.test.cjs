const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function span(a,b){const i=html.indexOf(a),j=html.indexOf(b,i+1);assert(i>=0&&j>i);return html.slice(i,j)}
function fixture(){
 const c=vm.createContext({facilitySite:{id:'base',townOffset:22,buildings:[{id:'hall',x1:12,x2:15,z1:10,z2:14}]},
  poiWalkActive:true,poiThirdPerson:false,cameraTopDown:false,pineAIActive:false,poiWalkLevel:0,
  poiWalkViewX:107,poiWalkViewZ:55,yaw:.15,poiCreekPlayerHeight:()=>0,POI_OCCLUSION_OPACITY:.16});
 vm.runInContext(span('function poiAngledRoofPart(','// END ANGLED ROOF SURFACES')+
  span('// BEGIN ANGLED WALL OCCLUSION','// END ANGLED WALL OCCLUSION'),c);
 const rec=(owner,x,z,side,y=0,type='stonewall',s=1)=>({owner,x,z,y,side,type,min:[x,y*1.4,z],max:[x+1,(y+1)*1.4,z+.25],start:s*12,end:s*12+12});
 return {c,rec,mask:()=>c.poiAngledWallOcclusion({elev:.86},0)};
}
test('107,55 outside actual lookout tower uses only first ray-hit rear wall, preserving the known interior front cut',()=>{
 const {c,rec,mask}=fixture();
 c.sceneMesh={wallFade:[rec('watchtower',107,56,'north',0,'stonewall',1),rec('watchtower',107,56,'north',1,'stonewall',2),
  rec('watchtower',106,56,'north',1,'stonewall',3),rec('watchtower',107,60,'south',2,'towerBattlement',4)]};
 const m=mask();assert.equal(m.wall.rear,true);assert.equal(m.wall.owner,'watchtower');
 assert.deepEqual(Array.from(m.wall.cells,p=>[p.x,p.z,p.y]),[[107,56,0],[107,56,1]]);
 c.poiWalkViewZ=59;c.yaw=0;
 c.sceneMesh={wallFade:[...c.sceneMesh.wallFade,rec('watchtower',107,60,'south',0,'stonewall',5)]};
 const front=mask();assert.equal(front.wall.rear,undefined);assert(front.wall.cells.every(p=>p.z===60));
});
test('other known tall facades need a solid actual hit and never fade a rear wall merely for being close',()=>{
 const {c,rec,mask}=fixture();c.poiWalkViewX=13;c.poiWalkViewZ=9;c.yaw=0;
 c.sceneMesh={wallFade:[rec('hall',13,10,'north',0,'stonewallWindow')]};
 assert.equal(mask().active,false,'tiny openings remain untouched without exact hit geometry');
 c.sceneMesh={wallFade:[rec('hall',13,10,'north',0,'stonewall')]};
 assert.equal(mask().wall.rear,true);
 c.poiWalkViewX=10;
 assert.equal(mask().active,false,'same owner does not fade without a direct ray hit');
});
test('a sampled rendered aperture does not fade until the player rays actually hit its jamb',()=>{
 const {c,rec,mask}=fixture();
 const wall=rec('watchtower',107,56,'north',0,'towerWindow');
 const face=(a,b)=>({min:wall.min,max:wall.max,surface:[a,0,56,a,1.4,56,b,1.4,56,a,0,56,b,1.4,56,b,0,56]});
 c.sceneMesh={wallFade:[{...wall,rearGeometry:face(107,107.3)}]};
 assert.equal(mask().active,false);
 c.sceneMesh={wallFade:[{...wall,rearGeometry:face(107.5,107.74)}]};
 assert.equal(mask().wall.rear,true);
 c.poiWalkViewZ=56.25;c.sceneMesh={wallFade:[{...wall,z:57,min:[107,0,57],max:[108,1.4,57.25]}]};
 assert.equal(mask().active,false,'new rear mode never selects the same owning interior');
});
