const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),test=require('node:test');
const h=fs.readFileSync(process.env.WORLD_HTML||'world-editor.html','utf8');
test('only authored interior becomes natural grade in both modes, whilst the boss remains non-targetable outside the encounter',()=>{
 const a=h.indexOf('// BEGIN SACRED INTERIOR PRESENTATION'),b=h.indexOf('function poiSacredInteriorClear(',a);
 assert(a>0&&b>a,'shared stock, stream and monster rendering contract must exist');
 const inside=(x,z,y)=>x===24&&z===128&&y===0;
 const site={id:'base',davidTemple:{depth:1,boss:{type:'monsterStoneDavid',x:24,z:158,y:0},interiorFloors:new Set(['24,128'])}};
 const c=vm.createContext({facilitySite:site,poiWalkActive:true,poiWalkViewX:24,poiWalkViewZ:127.4,poiWalkLevel:0,
  pineAIActive:false,cameraTopDown:false,poiDavidTempleEnclosedAt:(s,x,z,y)=>inside(Math.round(x),Math.round(z),y)});
 vm.runInContext(h.slice(a,b),c);
 assert.equal(c.poiSacredInteriorGrade(site,24,128,'roadRoyalFull',true),'grass');
 assert.equal(c.poiSacredInteriorGrade(site,24,127,'roadRoyalFull',true),'roadRoyalFull','do not erase the exterior route');
 assert.equal(c.poiSacredInteriorGrade(site,24,128,'roadRoyalFull',false),'roadRoyalFull','true editor remains authored');
 assert.equal(c.poiSacredInteriorGrade({id:'snowpass'},24,128,'roadRoyalFull',true),'roadRoyalFull');
 assert.equal(c.poiSacredInteriorHostileVisible(site.davidTemple.boss),false);
 assert.equal(c.poiSacredInteriorHostileVisible({type:'monsterStoneDavid',x:26,z:150,y:0}),true,'do not hide unrelated models or authored replicas');
 c.poiWalkViewZ=128;
 assert.equal(c.poiSacredInteriorHostileVisible(site.davidTemple.boss),true);
 assert.match(h,/poiSacredInteriorGrade\(region\.layout,x,z/);
 assert.match(h,/poiSacredInteriorGrade\(facilitySite,x,z/);
 assert.match(h,/poiSacredInteriorDraw\(p\.vp,sacredPeek\)/);
 assert.match(h,/poiSacredInteriorHostileVisible\(o\)/);
});
