const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function setup(){
 const a=html.indexOf('// BEGIN MINE CAMERA WALL CLIP'),b=html.indexOf('// END MINE CAMERA WALL CLIP');
 assert(a>=0&&b>a,'mine-specific camera safety');
 return Function(html.slice(a,b)+';return {eye:facilityMineCameraEye,clip:facilityMineCameraArm,walls:facilityMineCameraWalls}')();
}
const target=[109.5,-.3,60.5],desired=[109.5,.36,65.96];
const wall={x:109,z:61,y:-1,start:50,owner:'abandoned-mine',type:'stonewall',min:[109,-1.4,61],max:[110,0,62]};
const model={wallFade:[wall,{...wall,side:'south'}, {...wall,start:51,owner:'flooded-chapel'}, {...wall,start:52,trim:true}]};
test('B1 corridor wall cannot occupy the third-person eye; retaining yaw leaves orbit touch intuitive',()=>{
 const p=setup(),walls=p.walls(model);
 assert.deepEqual(walls,[wall]);assert.equal(p.walls(model),walls,'no rebuilding wall records per camera frame');
 const original=desired.map((v,i)=>v-target[i]);assert(p.clip(target,original,walls)<1);
 const view=p.eye(target,desired,walls);
 assert(view[0]===target[0]&&view[2]>target[2]);
 assert(Math.hypot(...view.map((v,i)=>v-target[i]))>=1.75,'a cramped corridor raises same-side arm instead of engulfing avatar');
 assert.equal(p.clip(target,view.map((v,i)=>v-target[i]),walls),1,'adjusted line does not cross the wall');
});
test('empty space and unobstructed angles preserve requested camera, unrelated walls excluded',()=>{
 const p=setup();
 assert.equal(p.eye(target,desired,p.walls({wallFade:[{...wall,owner:'flooded-chapel'}]})),desired);
 const along=[114,.36,60.5];
 assert.equal(p.eye(target,along,p.walls(model)),along);
});
test('authored B1 fixture is the storeroom corridor in the screenshot, with a southern wall',()=>{
 const a=html.indexOf('function extendTownWorldMine(site){'),b=html.indexOf('// Four-sided exterior extension;',a);
 assert(a>=0&&b>a);
 const site={map:{world:[]}},load=Function(html.slice(a,b)+';return extendTownWorldMine;')();
 const mine=load(site);
 assert(mine.sideFinds.some(f=>f.x===109&&f.z===55&&f.type==='cannedFood'));
 assert(site.map.world.some(o=>o.x===109&&o.z===60&&o.y===-1&&/^(?:stone|moss)$/.test(o.type)));
 assert(site.map.world.some(o=>o.x===109&&o.z===61&&o.y===-1&&/^(?:stone|moss)wall$/.test(o.type)));
});
