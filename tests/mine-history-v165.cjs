const assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const oldLength=5677,addedLength=158;
const exactMine='64584a1eb89a0d25dc48b080cc0f8332cb9040a31d835e870973030efe49eb47';
// Reinsert only the four historically documented cut walls; all old
// authored records and their ordering stay covered by the v189 digest.
function beforeMineDepths(world){
 const cutoff=5832;
 const restored=Array.from(world.slice(0,cutoff));
 assert.equal(restored.at(-1).type,'mineSurveyMarker');
 assert(world.length>cutoff&&world.length<6105);
 for(const [i,x,z,type] of [[5774,115,58,'mosswall'],[5776,113,60,'mosswall'],
  [5799,121,50,'stonewall'],[5828,115,57,'mosswall']])restored.splice(i,0,{x,z,y:-1,type,rot:0});
 return restored;
}
function beforeMinePrep(site){
 if(!site.mine?.prep)return site;
 const {prep,preBossSupply,...mine}=site.mine,world=Array.from(site.map.world.slice(0,7356));
 assert.deepEqual({...world[5975]},{x:97,z:61,y:-1,type:'ruinDoorBroken',rot:1});
 world[5975]={x:97,z:61,y:-1,type:'mosswall',rot:0};
 assert.equal(createHash('sha256').update(JSON.stringify(world)).digest('hex'),
  'd869940ace969d8698a3257054a6d95fe19253e9f618bffba5cc561e2e23e114','exact v205 map before the western mine prep loop');
 return {...site,mine:{...mine,bounds:{...prep.originalBounds}},map:{...site.map,world}};
}
function beforeChapelWest(site){
 site=beforeMinePrep(site);
 if(!site.chapel?.expansion)return site;
 const {expansion,...realm}=site.chapel,world=Array.from(site.map.world.slice(0,7160));
 for(const [i,x,z,type,rot] of [[6474,75,87,'mosswall',0],[6506,74,80,'mosswall',0],
   [6523,74,87,'mosswall',0],[6529,75,87,'poiWallSconce',3]])world[i]={x,z,y:-1,type,rot};
 assert.equal(createHash('sha256').update(JSON.stringify(world)).digest('hex'),
  'dddcb6c5946c92b6de0e766b8df416dae20f34babaaf1f9608422a163e7cada4','exact v203 map before the western chapel loop');
 return {...site,chapel:{...realm,bounds:{...expansion.originalBounds}},map:{...site.map,world}};
}
function beforeOtherworldDepths(site){
 site=beforeChapelWest(site);
 if(!site.otherworld?.expansion)return site;
 const {expansion,...realm}=site.otherworld,world=Array.from(site.map.world.slice(0,6925));
 for(const [i,x,z] of [[6249,102,86],[6270,108,81]]){
  assert.deepEqual({...world[i]},{x,z,y:-1,type:'ruinDoorBroken',rot:1});
  world[i]={x,z,y:-1,type:'stonewall',rot:0};
 }
 assert.equal(createHash('sha256').update(JSON.stringify(world)).digest('hex'),
  '5c40eaaa2b700df4feddfd119254753e342aca5a74da8f4c5e56ead7b2e5ab1c','exact v201 map after restoring only the two cut doorway walls');
 return {...site,otherworld:{...realm,bounds:{...expansion.originalBounds}},map:{...site.map,world}};
}
function beforeWayfarer(site){
 site=beforeOtherworldDepths(site);
 if(!site.northTrail?.wayfarer)return site;
 const {wayfarer,regions,...trail}=site.northTrail,world=site.map.world.slice(0,6874);
 assert.equal(createHash('sha256').update(JSON.stringify(world)).digest('hex'),
  'ec7a5a436973075aa9d6a83b0a76e51f4e483fd9fa820cd4c630f2d798a2d511','exact v198 world before the appended travelers well');
 return {...site,northTrail:{...trail,regions:regions.slice(0,7)},map:{...site.map,world}};
}
function beforePondMarsh(site){
 site=beforeWayfarer(site);
 if(!site.northTrail?.marsh)return site;
 const {marsh,regions,...trail}=site.northTrail,world=site.map.world.slice(0,6778);
 assert.equal(createHash('sha256').update(JSON.stringify(world)).digest('hex'),
  '8367f3ea14d25876d953cb9ac071db34fa42f596607bae4aeb73248a9b5aa40a','exact v197 world before the appended marsh pond');
 return {...site,northTrail:{...trail,regions:regions.slice(0,5)},map:{...site.map,world}};
}
function beforeForestWatchPost(site){
 site=beforePondMarsh(site);
 if(!site.northTrail?.watchPost)return site;
 const {continuation,watchPost,lowland,regions,...trail}=site.northTrail,world=site.map.world.slice(0,6644);
 assert.equal(createHash('sha256').update(JSON.stringify(world)).digest('hex'),
  'bad04384077f1629ed83dca8dac11192d82742e0b267e895f1e66486b466fe94','exact v196 world before the appended forest watch post');
 return {...site,northTrail:{...trail,regions:regions.slice(0,2)},map:{...site.map,world}};
}
function beforeNorthTrail(site){
 site=beforeForestWatchPost(site);
 if(!site.northTrail)return site;
 const {northTrail,...old}=site,world=old.map.world.slice(0,6557);
 assert.equal(createHash('sha256').update(JSON.stringify(world)).digest('hex'),
  '28255ef5ee8d7fcaa6e9b6e710d239e3d352647d02bbcc2db8cc427fcabce0cd','exact v195 world before the appended north forest road');
 return {...old,map:{...old.map,world}};
}
function beforeArmedEncounters(site){
 site=beforeNorthTrail(site);
 if(!site.armedEncounters)return site;
 const {armedEncounters,...old}=site;
 return {...old,map:{...old.map,world:old.map.world.slice(0,6551)}};
}
function beforeChapel(site){
 site=beforeArmedEncounters(site);
 if(!site.chapel)return site;
 const {chapel,...old}=site,world=old.map.world.slice(0,6368);
 assert.equal(createHash('sha256').update(JSON.stringify(world)).digest('hex'),
  '1a843d4e31ae48c3b8fa9bacf93b738ea308fc54aa3483a6a273b495628b15fb','exact v192 map before appended flooded chapel');
 return {...old,map:{...old.map,world}};
}
function beforeMineEntry(site){
 site=beforeChapel(site);
 if(!site.mine?.earlyRoom)return site;
 const {earlyRoom,...mine}=site.mine,world=Array.from(site.map.world.slice(0,6327));
 world.splice(5774,0,{x:118,z:59,y:-1,type:'stonewall',rot:0});
 world.splice(5775,0,{x:118,z:60,y:-1,type:'mosswall',rot:0});
 assert.equal(createHash('sha256').update(JSON.stringify(world)).digest('hex'),
  '169c2280301a6aaf1e934a86ea9e3e07356af95bd79ad374c36b634aa543cd1c','exact v191 otherworld and entire prior map');
 assert.equal(createHash('sha256').update(JSON.stringify(mine)).digest('hex'),
  'e4e8eacbd4188d894ddf3f945e7783aff1b64dd9b51c3920474b15f496b11614','exact previous mine metadata except named early room');
 return {...site,mine,map:{...site.map,world}};
}
function beforeOtherworld(site){
 site=beforeMineEntry(site);
 if(!site.otherworld)return site;
 const {otherworld,...old}=site,world=old.map.world.slice(0,6091);
 assert.equal(createHash('sha256').update(JSON.stringify(world)).digest('hex'),
  'dda620340a5bffcba1a41d548c9acee30b5d7b5a0413258c942f8d3b42eb52f8','v190 authored world is exact, before the v191 suffix');
 return {...old,map:{...old.map,world}};
}
function beforeAbandonedMine(site){
 site=beforeOtherworld(site);
 if(!site.mine)return site;
 const {mine,map:{world,...map},...other}=site;
 const suffix=(mine.vault?beforeMineDepths(world):Array.from(world)).slice(oldLength);
 assert.equal(suffix.length,addedLength+1,'the only extra records are the mine and its one survey marker');
 assert.deepEqual({...suffix.pop()},{x:119,z:59,y:-1,type:'mineSurveyMarker',rot:2},
  'only the exact wall-mounted v189 survey record is exempted from the existing mine digest');
 const digest=createHash('sha256').update(JSON.stringify(suffix)).digest('hex');
 assert.equal(digest,exactMine,'only the exact v167 mine records are exempt; untouched v166 mine records are pinned separately');
 return {...other,map:{...map,world:world.slice(0,oldLength)}};
}
module.exports={beforeMinePrep,beforeChapelWest,beforeAbandonedMine,beforeMineDepths,beforeOtherworld,beforeMineEntry,beforeChapel,beforeArmedEncounters,beforeNorthTrail,beforeForestWatchPost,beforePondMarsh,beforeWayfarer,beforeOtherworldDepths};
