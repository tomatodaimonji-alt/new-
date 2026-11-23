const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function slice(a,b){const i=h.indexOf(a),j=h.indexOf(b,i+a.length);assert(i>=0&&j>i,a);return h.slice(i,j)}
function fixture(){
 const run=Function(`
 const poiDungeonPointIn=(b,x,z,y)=>!!b&&y===b.y&&x>=b.x1&&x<=b.x2&&z>=b.z1&&z<=b.z2;
 `+slice('function extendTownWorldNorthTrail(world){','// Dry ascent to the old southeast track')+
 slice('function poiNorthTrailRegion(','function poiNorthTrailSupply(')+
 slice('const POI_SAFE_TOWN=','// BEGIN LOCATION PANEL MOTION')+`
 const world=[],site={id:'base',townOffset:22,northTrail:extendTownWorldNorthTrail(world)};
 extendTownWorldForestWatchPost(site.northTrail,world);
 extendTownWorldPondMarsh(site.northTrail,world);
 return {world,site,region:(x,z)=>poiRegionAt(site,x,z,false,0),named:(x,z)=>poiNorthTrailRegion(site,x,z,0)};
 `)();
 return run;
}
test('ordinary field, north forest road, waterside road and both willow parcels share outdoor label and danger, not a named transition',()=>{
 const f=fixture(),outside=f.region(124,20);
 assert.deepEqual(outside,{name:'外',difficulty:1,stars:'★☆☆☆☆☆☆☆☆☆'});
 for(const [x,z] of [[39,4],[61,4],[85,2],[86,2],[113,9],[120,16],[120,17],[117,22],[121,25],[122,29]]){
  assert.equal(f.named(x,z),null,'no distinct panel at '+[x,z]);
  assert.deepEqual(f.region(x,z),outside);
 }
 assert.equal(f.region(112,9).name,'北の林道','north forest trail retains its existing overlap priority');
 assert.equal(f.region(100,7).name,'北の林道');
 assert.equal(f.region(87,2).name,'北の林道','the distinct continuation keeps its own panel');
});
test('route place names, water/pond geometry and pickup metadata remain available independently of HUD',()=>{
 const {site,world}=fixture(),{lowland,marsh,watchPost}=site.northTrail;
 assert.equal(lowland.name,'水辺の道');assert.equal(marsh.name,'柳の道');
 assert.ok(lowland.water.length&&marsh.pond.water.length&&marsh.path.length);
 assert.ok(lowland.water.every(v=>world.some(o=>o.x===v.x&&o.z===v.z&&o.y===0&&o.type==='water')));
 assert.equal(marsh.pond.guard.type,'monsterPondSkater');
 assert.equal(marsh.pond.reward.id,'north-marsh-herb');
 assert.equal(watchPost.name,'森の見張り場');
});
