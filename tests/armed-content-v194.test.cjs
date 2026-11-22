const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),{createHash}=require('node:crypto');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8'),cut=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)+1));
const build=vm.runInNewContext(cut('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+';buildFacilitySite');
const {beforeOtherworldDepths}=require('./mine-history-v165.cjs');
const site=beforeOtherworldDepths(JSON.parse(JSON.stringify(build('base')))),world=site.map.world;
test('the four newly armed encounters are placed without changing the previous 6551 records',()=>{
 assert.equal(createHash('sha256').update(JSON.stringify(world.slice(0,6551))).digest('hex'),'978a97126a60dac8279feaebd4d53b1b4065fe3fbc2e842f73ac7f3c424f2c43');
 const placed=site.armedEncounters.slice(0,4);assert.deepEqual(placed.map(({type,x,z,y})=>[type,x,z,y]),[
 ['monsterSkelSpearman',101,61,-1],['monsterSkelWarrior',110,56,-1],
 ['monsterSkelKnight',106,78,-1],['monsterSkelArcher',105,86,0]]);
 for(const {type,x,z,y,leash} of placed){
  assert(x>=leash.x1&&x<=leash.x2&&z>=leash.z1&&z<=leash.z2);
  assert.deepEqual(world.slice(6551).filter(o=>o.x===x&&o.z===z&&o.y===y),[{x,z,y,type,rot:0}]);
  const below=world.slice(0,6551).filter(o=>o.x===x&&o.z===z&&o.y===y);
  assert(below.every(o=>/^(?:stone|moss|road.*)$/.test(o.type)));
 }
 assert(!build('lodging').armedEncounters);
});
test('all new equipment and monster art IDs have registered names and exact weapon visuals',()=>{
 const ids=['equipWoodBow','equipWoodSpear','equipStoneMace','equipBoneSword','armorIronTorso','fireWand',
  'monsterSkelWarrior','monsterSkelKnight','monsterSkelArcher','monsterSkelSpearman'];
 for(const id of ids){
  assert.match(html,new RegExp("id:'"+id+"'"));
  assert.match(html,new RegExp('"id":"'+id+'"'));
 }
 const c={poiChapelEliteMatch:o=>o.x===79&&o.z===78&&o.y===-1};
 vm.runInNewContext(cut('const POI_ARMED_MONSTER_ART=','function decoBase('),c);
 assert.deepEqual({...c.poiArmedMonsterArt('monsterSkelKnight')},{weapon:'equipIronSword',armor:'armorIronTorso'});
 assert.equal(c.poiArmedMonsterArt('monsterSkelArcher').weapon,'equipWoodBow');
 assert.equal(c.poiMonsterRenderType({type:'monsterSkeleton',x:79,z:78,y:-1}),'monsterChapelWardenVisual');
 assert.equal(c.poiMonsterRenderType({type:'monsterSkeleton',x:97,z:82,y:-1}),'monsterSkeleton');
});
