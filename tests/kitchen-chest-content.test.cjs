const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function snippet(a,b){const i=html.indexOf(a),j=html.indexOf(b,i+1);assert(i>=0&&j>i,'missing '+a);return html.slice(i,j)}
test('one canonical chest is reachable in the game-world cellar and never alters the standalone kitchen',()=>{
 const build=vm.runInNewContext(snippet('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+';buildFacilitySite');
 const level=build('base').map.world.filter(o=>o.y===-1);
 const chest=level.filter(o=>o.type==='kitchenChest');assert.equal(chest.length,1);
 assert.deepEqual({...chest[0]},{x:27,z:32,y:-1,type:'kitchenChest',rot:3});
 for(const [x,z] of [[25,33],[25,34],[26,34],[27,34],[28,34],[28,33],[28,32]]){
  const types=level.filter(o=>o.x===x&&o.z===z).map(o=>o.type);
  assert(types.includes('brickfloor'));assert(types.every(t=>t==='brickfloor'||t==='guildStairUp'));
 }
 assert(!build('kitchen').map.world.some(o=>o.type==='kitchenChest'));
});
test('static item art, open-lid variant, shared icon generator, and recorded steel with distinct knife fallbacks are narrow',()=>{
 for(const id of ['kitchenChest','kitchenChestOpen','kitchenKnife','cannedFood'])assert(html.includes("case '"+id+"'"));
 assert.match(html,/function poiLootContentIcon\(type\)/);
 assert.match(html,/kitchenKnife:\s*\{playerBlade:true,material:'kitchenKnife',recordedSteel:true\}/); 
 assert.match(html,/if\(player&&kind==='hit'&&sound\.playerBlade\)[\s\S]{0,130}poiTryRecordedFoley\('playerSteelCut',contact,\.57\)/);
 assert.match(html,/if\(sound\.recordedSteel&&[\s\S]{0,150}poiTryRecordedFoley\(kind==='attack'\?'steelSwing':'steelImpact'/);
 assert.match(html,/poiPlayImpactBuffer\(poiKitchenKnifeBuffer\('hit'\),contact,/);
 assert.match(html,/poiPlayImpactBuffer\(poiKitchenKnifeBuffer\('attack'\),now\+\.05,/);
 const c=vm.createContext({});
 vm.runInContext(snippet('function poiKitchenKnifePcm(','const poiKitchenKnifeCache='),c);
 const swing=Array.from(c.poiKitchenKnifePcm('attack',24000)),hit=Array.from(c.poiKitchenKnifePcm('hit',24000));
 assert(swing.length<hit.length&&hit.length<=6000&&swing.length>1500);
 for(const samples of [swing,hit]){
  assert(samples.every(Number.isFinite));assert(Math.max(...samples.map(Math.abs))<.85);
  assert(Math.max(...samples.map(Math.abs))>.11);
  assert(Math.abs(samples[0])<.002&&Math.abs(samples.at(-1))<.002);
 }
});
test('opening variants evict only the cellar cache once and keep independent scene buffers',()=>{
 const cellar={mesh:{buf:'cellar'},signs:[{buf:'sign-a'},{buf:'sign-b'}]},surface={mesh:{buf:'surface'},signs:[]};
 const removed=[],facilityScenes=new Map([['cellar:-1',cellar],['surface:0:0',surface]]);
 const c=vm.createContext({sceneMesh:cellar.mesh,signOverlays:cellar.signs,facilityScenes,gl:{deleteBuffer:b=>removed.push(b)}});
 vm.runInContext(snippet('function poiChestInvalidateModel()','function facilityRenderScene()'),c);
 c.poiChestInvalidateModel();c.poiChestInvalidateModel();
 assert.deepEqual(removed,['cellar','sign-a','sign-b']);assert.equal(c.sceneMesh,null);
 assert.equal(facilityScenes.get('surface:0:0'),surface);assert(!facilityScenes.has('cellar:-1'));
 assert.match(html,/name:'厨房のチェスト'/);assert.match(html,/name:'包丁'/);
});
