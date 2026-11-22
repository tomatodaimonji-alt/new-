const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)+1));
const build=vm.runInNewContext(cut('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+';buildFacilitySite');
const {beforeMineEntry,beforeChapel}=require('./mine-history-v165.cjs');
const site=beforeChapel(JSON.parse(JSON.stringify(build('base')))),{world}=site.map;
const at=(x,z)=>world.filter(o=>o.x===x&&o.z===z&&o.y===-1);
test('mine has two encounter slimes beyond, not inside, the safe original landing',()=>{
 const {mine}=site,room=mine.earlyRoom;
 assert.deepEqual(mine.stairs,{x:116,z:62,y:0});
 assert.deepEqual(room.slimes.map(({x,z,y,type})=>[x,z,y,type]),[[115,59,-1,'monsterSlime'],[120,62,-1,'monsterSlime']]);
 for(const s of room.slimes)assert(at(s.x,s.z).some(o=>o.type===s.type));
 assert(!room.cells.some(c=>c.x===mine.survey.stand.x&&c.z===mine.survey.stand.z));
 const floor=(x,z)=>at(x,z).some(o=>/^(?:stone|moss)$/.test(o.type));
 const stops=(x,z)=>at(x,z).some(o=>/^(?:stonewall|mosswall|barrel|crate)$/.test(o.type));
 for(const [x,z] of [[116,62],[116,61],[116,60],[115,60],[116,59],[116,58],[117,58],[118,58],[119,58],[117,59],[118,59],[118,60],[119,60],[119,61],[119,62],[121,62],[120,63]])
  assert(floor(x,z)&&!stops(x,z),'walkable room/escape tile '+[x,z]);
});
test('both physical slimes ignore the landing, survey, and rooms outside their leash',()=>{
 const c={facilitySite:{...site,id:'base'}};
 vm.runInNewContext(cut('function poiMineEarlyMayMove(','function poiMobFrame('),c);
 for(const slime of site.mine.earlyRoom.slimes){
  for(const [x,z] of [[115,60],[116,60],[116,61],[116,62],[114,62],[119,58],[120,57],[107,65]])assert.equal(c.poiMineEarlyMayMove(slime,x,z),false);
  for(const [x,z] of [[116,59],[118,59],[118,60],[119,60],[120,62],[121,63]])assert.equal(c.poiMineEarlyMayMove(slime,x,z),true);
 }
 assert(c.poiMineEarlyMayMove({type:'monsterSlime',x:41,z:71,y:0},116,62),'unrelated actors unaffected');
 const begin=cut('function poiEnemyBeginPlayer(','function poiEnemyCancelPlayer('),loop=cut('function poiMobFrame(','const POI_TOWN_RESIDENT_ROLES=');
 for(const source of [begin,loop])assert.match(source,/!poiMineEarlyMayMove\(obj,poiWalkX,poiWalkZ\)/);
});

test('mine entrance extension changes no older geometry except two exact attached cut walls',()=>{
 const prior=beforeMineEntry(site);assert.equal(prior.map.world.length,6329);
 const extra=world.slice(6327);
 assert(extra.length>=32&&extra.length<=44&&extra.every(o=>o.y===-1&&o.x>=118&&o.x<=123&&o.z>=58&&o.z<=65));
 const W=new Set(world.filter(o=>o.y===-1&&/^(?:stone|moss)wall$/.test(o.type)&&o.x>=112&&o.z>=56&&o.z<=66).map(o=>o.x+','+o.z));
 const F=new Set(world.filter(o=>o.y===-1&&/^(?:stone|moss)$/.test(o.type)).map(o=>o.x+','+o.z));
 const bounds=site.mine.earlyRoom.safe;
 for(let x=bounds.x1;x<=bounds.x2;x++)for(let z=bounds.z1;z<=bounds.z2;z++)
  assert(F.has(x+','+z)&&!W.has(x+','+z));
 for(const k of W){
  assert(!F.has(k));const [x,z]=k.split(',').map(Number);
  for(const dz of [-1,1])if(W.has((x+1)+','+(z+dz)))assert(W.has((x+1)+','+z)||W.has(x+','+(z+dz)));
 }
});
