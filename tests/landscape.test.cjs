const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const test=require('node:test');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const marker='  // Expand the countryside to the east and south, not the town itself.';
const markerStart=html.indexOf(marker),end=html.indexOf('  spawn={x:19,z:21};',markerStart);
assert(markerStart>=0&&end>markerStart,'missing authored nature section');
const orig=html.slice(0,markerStart)+html.slice(end);
function build(text,id){
 const i=text.indexOf('const FACILITY_SITES=Object.freeze('),j=text.indexOf('function workshopResumeDecode(',i);
 assert(i>=0&&j>i);
 return JSON.parse(JSON.stringify(vm.runInNewContext(text.slice(i,j)+';buildFacilitySite('+JSON.stringify(id)+')')));
}
const before=build(orig,'base'),after=build(html,'base');
const keys=before.map.world.map(o=>JSON.stringify(o)),original=new Set(keys),changed=new Set(after.map.world.map(o=>JSON.stringify(o)));
const extra=after.map.world.filter(o=>!original.has(JSON.stringify(o)));
const terrain=new Set(['earth','grass','grassForest','grassWild','grassMeadow','grassTrampled','grassDry','grassFlowers','grassPebbles','grassPatch','stone','moss','woodfloor','woodfloorLight','woodfloorDark','brickfloor','roadGravelFull','roadCobbleFull','roadCutStoneFull']);
const nonSolid=new Set(['flowerField','bushFlower','tallGrass','lantern','chairWood','chairClassic','stoolRound','benchWood']);
const point=(x,z)=>x+','+z;
test('landscape does not move or replace any authored town placement',()=>{
 assert.deepEqual([after.map.width,after.map.height],[72,56]);
 assert.deepEqual(after.spawn,before.spawn);assert.deepEqual(after.buildings,before.buildings);
 for(const k of keys)assert(changed.has(k),k);
 for(const id of ['lodging','kitchen','workshop','homes','stable','toolshop','artisan'])
  assert.deepEqual(build(html,id),build(orig,id),id);
});
test('landscape adds groves and field paths with a small editable budget and has no perimeter wall',()=>{
 const trees=extra.filter(o=>/^tree/.test(o.type));
 const nonTerrain=extra.filter(o=>!terrain.has(o.type));
 assert(trees.length>=20&&trees.length<=30);
 assert(nonTerrain.length<=45&&extra.length-nonTerrain.length<=120,[nonTerrain.length,extra.length-nonTerrain.length]);
 assert(trees.some(o=>o.z<=5)&&trees.some(o=>o.x>=64)&&trees.some(o=>o.z>=50&&o.x<16));
 assert(extra.some(o=>o.x===19&&o.z===51&&o.type==='earth'));
 assert(extra.some(o=>o.x===66&&o.z===45&&o.type==='earth'));
 assert(!extra.some(o=>/wall|fence/i.test(o.type)));
 assert(!nonTerrain.some(o=>o.x>=24&&o.x<=45&&o.z>=51&&o.z<=54&&/^tree/.test(o.type)));
});
test('continuous outdoor collision routes connect the town to wide meadow and forest openings',()=>{
 const walls=new Set();
 for(const b of after.buildings)for(const p of b.footprint)walls.add(point(p.x,p.z));
 for(const o of after.map.world)if(o.y===0&&!terrain.has(o.type)&&!nonSolid.has(o.type))walls.add(point(o.x,o.z));
 const start=after.spawn, q=[start], reached=new Set([point(start.x,start.z)]);
 for(let i=0;i<q.length;i++)for(const [dx,dz] of [[0,1],[0,-1],[1,0],[-1,0]]){
  const x=q[i].x+dx,z=q[i].z+dz,k=point(x,z);
  if(x<0||z<0||x>=after.map.width||z>=after.map.height||reached.has(k)||walls.has(k))continue;
  reached.add(k);q.push({x,z});
 }
 for(const k of ['19,54','34,53','43,53','67,45','68,35','60,3','32,3','1,49'])assert(reached.has(k),k);
 assert(reached.size>2450,reached.size);
});
test('ambient color is scoped to implicit grade-only base grass and leaves scatter unchanged',()=>{
 assert.match(html,/function pineBaseNatureTint\(/);
 assert.match(html,/facilitySite\?\.id==='base'&&!floors\.has\(x\+','\+z\)\?pineBaseNatureTint\(x,z\):null/);
 assert.match(html,/kind==='grass'\? \(n>\.72\?1:0\)/);
});
