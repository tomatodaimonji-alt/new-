const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||path.join(__dirname,'../world-editor.html'),'utf8');
function load(s){
 const a=s.indexOf('const FACILITY_SITES=Object.freeze('),b=s.indexOf('function workshopResumeDecode(',a);
 return vm.runInNewContext(s.slice(a,b)+';buildFacilitySite');
}
const original=html.replace(/  \/\/ Open grassland outside the rampart\.[\s\S]*?(?=  spawn=\{x:19,z:21\};)/,'');
const outside=(x,z)=>z>47||x<1||x>66||z>20&&x>62||z<4&&x>46;
const record=o=>JSON.stringify(o);
const clean=s=>JSON.parse(JSON.stringify(s));
test('meadow replaces most exterior canopy only; all roads, water, gates, ruins, town and other POIs are unmodified',()=>{
 const build=load(html),before=load(original),a=before('base'),b=build('base');
 assert.notEqual(original,html,'scoped meadow stamping missing');
 assert.deepEqual(clean([a.buildings,a.creek,a.canal,a.map.terrainHeights,a.spawn]),clean([b.buildings,b.creek,b.canal,b.map.terrainHeights,b.spawn]));
 for(const id of ['lodging','kitchen','workshop','homes','stable','toolshop','artisan'])
  assert.deepEqual(clean(build(id)),clean(before(id)),id);
 const ar=new Set(a.map.world.map(record)),br=new Set(b.map.world.map(record));
 const removed=a.map.world.filter(o=>!br.has(record(o))),added=b.map.world.filter(o=>!ar.has(record(o)));
 assert(removed.filter(o=>/^tree/.test(o.type)).length>=16);
 assert(removed.every(o=>o.y===0&&outside(o.x,o.z)&&/^(?:tree|grassForest)/.test(o.type)));
 assert(added.length<=28&&added.every(o=>o.y===0&&outside(o.x,o.z)&&/^(?:flowerField|tallGrass|grassMeadow)$/.test(o.type)));
 const trees=b.map.world.filter(o=>outside(o.x,o.z)&&/^tree/.test(o.type));
 assert(trees.length>=5&&trees.length<=10);
 assert(!trees.some(o=>o.x>=15&&o.x<=39&&o.z>=48));
 assert(trees.some(o=>o.x===88&&o.z===41),'watchtower still has distant silhouette trees');
});
