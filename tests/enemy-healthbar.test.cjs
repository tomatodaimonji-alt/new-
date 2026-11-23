const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function setup(project){
 const a=html.indexOf('// BEGIN ENEMY HEALTH GEOMETRY'),b=html.indexOf('// END ENEMY HEALTH GEOMETRY');
 assert(a>=0&&b>a,'a geometry-based model anchor exists for enemy health only');
 return Function('poiWorldToScreen',`
 const POI_ENEMY_HEAD_HEIGHT={};let builds=0;
 const mesh=()=>({p:[]});
 function deco(m,type){builds++;const h=type==='tall'?2.7:.7;m.p.push(0,0,0,.45,h,.6);}
 `+html.slice(a,b)+';return {model:poiEnemyHealthEnvelope,anchor:poiEnemyHealthAnchor,builds:()=>builds}') (project);
}
test('derive and cache exact height and horizontal extent per rendered variant',()=>{
 const p=setup();
 assert.deepEqual(p.model('tall'),{top:2.7,radius:.75});
 assert.deepEqual(p.model('low'),{top:.7,radius:.75});
 assert.equal(p.model('tall'),p.model('tall'));
 assert.equal(p.builds(),2);
});
test('horizontal silhouette and animated lift preserve breathing room overhead and at an angle',()=>{
 const tall={top:2.7,radius:.75},pose={x:5,y:2,z:4};
 // Synthetic projected screen, first overhead then oblique; x tracks the center.
 const overhead=setup((_vp,x,y,z)=>({x:x*10,y:100+z*10}));
 assert.equal(overhead.anchor(null,pose,tall).x,50);
 assert(overhead.anchor(null,pose,tall).y<140-7);
 const angled=setup((_vp,x,y,z)=>({x:x*10,y:100+z*10-y*20}));
 const base=angled.anchor(null,pose,tall),strike=angled.anchor(null,{...pose,y:2.2,attack:{width:1.2,squash:1.4,pitch:.15}},tall);
 assert(strike.y+15<base.y);
});
test('visual meter is smaller and restrained without changing separate torso reticle',()=>{
 assert.match(html,/width:clamp\(25px,6.8vw,34px\);height:5px/);
 assert.match(html,/const POI_ENEMY_BAR_GAP=13/);
 assert.match(html,/POI_COMBAT_TORSO_HEIGHT\[lock.id.type\]/);
});
