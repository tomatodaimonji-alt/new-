const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),test=require('node:test');
const h=fs.readFileSync(process.env.PRODUCT||'world-editor.html','utf8');
function piece(a,b){const x=h.indexOf(a),y=h.indexOf(b,x+1);assert(x>=0&&y>x,a);return h.slice(x,y)}
const script=(h.includes('// BEGIN DEFEAT CHECKPOINTS')?piece('// BEGIN DEFEAT CHECKPOINTS','// END DEFEAT CHECKPOINTS'):'')+piece('function poiPlayerDeathSpawn(', 'function poiPlayerDeathFrame(');
const setup=(x,z,y,region='base')=>{
 const site={id:region,spawn:{x:10,z:10},mine:{stairs:{x:20,z:20},bounds:{x1:16,x2:26,z1:15,z2:22,y:-1}},
  chapel:{dungeonStand:{x:40,z:39,y:-1,facing:2},bounds:{x1:36,x2:44,z1:34,z2:40,y:-1}},
  davidTemple:{boss:{},retreat:{x:28,z:30,y:0},bounds:{x1:24,x2:32,z1:32,z2:40,y:0}}};
 if(region!=='base')site.spawn={x:12,z:0};
 const c=vm.createContext({facilitySite:site,poiSpawnX:10,poiSpawnZ:10,poiWalkX:x,poiWalkZ:z,poiWalkLevel:y,poiWalkFacing:1,
 world:[{x:20,z:20,y:-1,type:'guildStairUp'}],POI_SAFE_TOWN:[],poiWildZone:(r,x,z)=>x<13&&z<13,validPos:(x,z)=>x>=0&&z>=0,
 poiWalkCanStep:(x,z)=>!c.block?.has(x+','+z),poiOtherworldPortalAt:(_s,x,z)=>x===40&&z===40,
 poiDungeonTravelKey:(s,x,z,y)=>poiPoint(s.chapel.bounds,x,z,y)?'chapel':null,
 poiDungeonPointIn:poiPoint,poiDavidTempleContains:(s,x,z,y)=>poiPoint(s.davidTemple.bounds,x,z,y)});
 vm.runInContext(script,c);
 return {c,spawn:()=>JSON.parse(vm.runInContext('JSON.stringify(poiPlayerDeathSpawn())',c))};
};
function poiPoint(b,x,z,y){return y===b.y&&x>=b.x1&&x<=b.x2&&z>=b.z1&&z<=b.z2}
test('surface starts at home, mine stays inside, genuine other dungeon uses its own landing',()=>{
 assert.deepEqual(setup(82,60,0).spawn(),{x:10,z:10,y:0,facing:1});
 assert.deepEqual(setup(24,17,-1).spawn(),{x:20,z:19,y:-1,facing:0});
 assert.deepEqual(setup(40,35,-1).spawn(),{x:40,z:39,y:-1,facing:0});
});
test('snow cold restore resolves authored entry, David explicitly uses temple forecourt; HUD subregions remain ordinary outside',()=>{
 assert.deepEqual(setup(12,12,0,'snowpass').spawn(),{x:12,z:0,y:0,facing:2});
 assert.deepEqual(setup(28,36,0).spawn(),{x:28,z:30,y:0,facing:0});
});
test('occupied default looks nearby without using portal / wrong floor and does not mutate floor',()=>{
 const {c,spawn}=setup(40,35,-1);c.block=new Set(['40,39','40,38','39,39']);
 const p=spawn();assert.deepEqual(p,{x:41,z:39,y:-1,facing:0});assert.equal(c.poiWalkLevel,-1);
});
test('actual recorded entry supersedes authored fallback and stale different map entry is ignored',()=>{
 const {c,spawn}=setup(40,35,-1);
 vm.runInContext('poiDefeatRememberEntry(41,38,-1,3)',c);
 assert.deepEqual(spawn(),{x:41,z:38,y:-1,facing:3});
 c.facilitySite={...c.facilitySite};
 assert.deepEqual(spawn(),{x:40,z:39,y:-1,facing:0});
});
test('a live door and an exit trigger are not accepted even when walkable from a directed approach',()=>{
 const {c,spawn}=setup(40,35,-1);
 c.poiWalkPassableDoor=t=>t==='door';
 c.world.push({x:40,z:39,y:-1,type:'door'});
 c.block=new Set(['40,38','39,39']);
 assert.deepEqual(spawn(),{x:41,z:39,y:-1,facing:0});
 vm.runInContext('poiDefeatRememberEntry(40,40,-1,3)',c);
 assert.deepEqual(spawn(),{x:41,z:39,y:-1,facing:0});
});
