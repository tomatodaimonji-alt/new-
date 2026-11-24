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
// The temple owns only the verified final v270 map suffix and one building.
function beforeDavidTemple(site){
 if(!site.davidTemple)return site;
 const {davidTemple,...historic}=site,{index,count}=davidTemple.authored;
 assert.equal(index,8984,'temple begins after all v270 records');
 assert(Number.isInteger(count)&&count>0&&index+count===site.map.world.length,'remove only the exact declared temple suffix');
 assert.equal(site.buildings.at(-1)?.id,'davidTemple');
 assert.equal(site.buildings.at(-1)?.name,davidTemple.name);
 const world=site.map.world.slice(0,index),prior={...historic,buildings:site.buildings.slice(0,-1),map:{...site.map,world}};
 const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
 assert.equal(digest(world),'15535689893b8a631827467885930d45d786e0d3b559b74d6a2544267d03439a','all ordered v270 object records stay exact');
 assert.equal(digest(prior),'b5f7eafccb90cb882df71e05f1c036e08966a4b06d57ced7430c20f2bb57386e','all v270 site metadata stays exact');
 return prior;
}
// Project only the new final forest parcel out of older historical checks.
function beforeSouthForest(site){
 site=beforeDavidTemple(site);
 if(!site.southForest)return site;
 const {southForest,...historical}=site,{index,count}=southForest.authored;
 assert.equal(southForest.name,'潮風の森');
 assert.equal(index,8832,'forest starts after the entire v265 world');
 assert(Number.isInteger(count)&&count>0&&index+count===site.map.world.length,
  'only the declared forest records are removed, and they are the exact final suffix');
 const world=site.map.world.slice(0,index),prior={...historical,map:{...site.map,world}};
 const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
 assert.equal(digest(world),
  'ea2d84b74e1014e92d3dd9bf218944f6f1dde29374f1dfc83f9edf43c4344813','v265 world order survives unchanged');
 const historicName=prior.southPort.name==='セルネア'?{...prior,southPort:{...prior.southPort,name:'潮待ちの港'}}:prior;
 assert.equal(digest(historicName),
  '2a465c61949d8b27bb374e32e19d71e8e2dae181161f625013e36c72a73de4ac','v265 full site is unchanged except the appended forest');
 return prior;
}
// Drop only the authored southern-port suffix; the whole live v261 input
// before it (world order, map size, building and encounter metadata) is fixed.
function beforeSouthPort(site){
 site=beforeSouthForest(site);
 if(!site.southPort)return site;
 const {southPort,...historical}=site;
 const {index,count}=southPort.authored;
 assert.equal(index,8473,'port starts after the entire v261 world');
 assert(Number.isInteger(count)&&count>0&&index+count===site.map.world.length,'port records are the exact final world suffix');
 const world=site.map.world.slice(0,index);
 const prior={...historical,map:{...site.map,world}};
 const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
 assert.equal(digest(world),
  '49466e43ba72fa3d8ce839bbbd5083a37d086e3542c4a103426b883aff3027c2','v261 world is unchanged before the port');
 assert.equal(digest(prior),
  'ae7ebaaf64266ed5cf398afa0027f1720fe1869e01ca6c9aa46ed2faabfbcfdf','v261 full site is unchanged except the appended port');
 return prior;
}
function beforeNorthFort(site){
 site=beforeSouthPort(site);
 if(!site.northFort)return site;
 const {northFort,...historical}=site;
 const {scoutCamp,...northTrail}=site.northTrail;
 const world=site.map.world.slice(0,8170);
 assert(site.map.world.length>8170&&northFort.name==='北の古砦'&&scoutCamp.stand.x===67);
 assert.equal(createHash('sha256').update(JSON.stringify(world)).digest('hex'),
  'dc6b535632af6dab2004f7cba1015fad5fdebc4d4873cf2b3a535103b3e4e8b6','exact v241 authored world before northern expansion');
 return {...historical,northTrail,map:{...site.map,world}};
}
function beforeSouthTown(site){
 site=beforeNorthFort(site);
 if(!site.southRoad?.town)return site;
 const {town,...southRoad}=site.southRoad,world=site.map.world.slice(0,7656);
 assert.deepEqual(Array.from(site.buildings.slice(-2),b=>b.id),['southMarket','southInn']);
 assert.equal(createHash('sha256').update(JSON.stringify(world)).digest('hex'),
  '2fa9160b2c99b8b4fe6a9764ddc2a767bbf5e03b4dee0c978cde9d4eef9ea2ed','exact river-only Game World before distant town');
 return {...site,southRoad,buildings:site.buildings.slice(0,-2),map:{...site.map,world}};
}
function beforeSouthCreek(site){
 site=beforeSouthTown(site);
 if(!site.southRoad?.creek)return site;
 const {creek,...southRoad}=site.southRoad,world=Array.from(site.map.world.slice(0,7578));
 for(const z of [104,105]){
  const i=world.findIndex(o=>o.x===101&&o.z===z&&o.y===0&&o.type==='river'&&o.rot===0);
  assert(i>=0,'known native crossing substrate '+z);
  world[i]={...world[i],type:'roadGravelFull'};
 }
 assert.equal(createHash('sha256').update(JSON.stringify(world)).digest('hex'),
  '8fe11e1cf6f3fb771d952c85cbe32d78bf72d0632515637bf4c7c8a2869d21d4','exact v211 Game World before the south creek');
 return {...site,southRoad,map:{...site.map,world}};
}
function beforeMineLongApproach(site){
 site=beforeSouthCreek(site);
 if(!site.mine?.approach)return site;
 const {approach,...mine}=site.mine,world=Array.from(site.map.world.slice(0,-7));
 const early={x:115,z:59,y:-1,type:'monsterSlime'};
 world.splice(5813,0,{...early,rot:0});
 for(const [i,x,z,type,restored] of [[5723,120,57,'mosswall','stone'],[5803,116,54,'stone','mosswall'],
   [5909,115,57,'mosswall','stone'],[6017,113,55,'stone','stonewall']]){
  assert.deepEqual({...world[i]},{x,z,y:-1,type,rot:0});
  world[i]={x,z,y:-1,type:restored,rot:0};
 }
 assert.equal(createHash('sha256').update(JSON.stringify(world)).digest('hex'),
  'b2a465823a0f57e60d520f890e17b01c67c1264b3ab2a81868acba7ebe6dc379','exact v209 world before mine approach revision');
 return {...site,mine:{...mine,early,earlyRoom:{...mine.earlyRoom,slimes:[early,...mine.earlyRoom.slimes]}},map:{...site.map,world}};
}
function beforeSouthRoad(site){
 site=beforeMineLongApproach(site);
 if(!site.southRoad)return site;
 const {southRoad,...old}=site,world=site.map.world.slice(0,7456);
 assert.equal(createHash('sha256').update(JSON.stringify(world)).digest('hex'),
  '94aec8afd4ce646ea255d19d5bd90b71a5ad93de0a9197285d49323b4ad76b3c','exact v208 world before the south road');
 return {...old,map:{...site.map,height:96,world}};
}
// Undo only the v208 town-facing artisan plant relocation before checking old hashes.
function beforeArtisanPlant(site){
 site=beforeSouthRoad(site);
 const live=site.map.world[3695];
 if(live?.x!==66||live.z!==52||live.y!==0||live.type!=='poiPottedPlant')return site;
 const world=Array.from(site.map.world);
 world[3695]={...live,x:71};
 return {...site,map:{...site.map,world}};
}
function beforeChapelApproach(site){
 site=beforeArtisanPlant(site);
 if(!site.chapel?.approach)return site;
 const {approach,...chapel}=site.chapel,world=site.map.world.slice(0,7443);
 assert.equal(createHash('sha256').update(JSON.stringify(world)).digest('hex'),
  '250d2f15c06fdd980d391bab89529757446c365e8266c77ec5fe71d8a3c6aa57','exact v206 world before the chapel approach');
 return {...site,chapel,map:{...site.map,world}};
}
function beforeMinePrep(site){
 site=beforeChapelApproach(site);
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
module.exports={beforeDavidTemple,beforeSouthForest,beforeSouthPort,beforeNorthFort,beforeSouthTown,beforeSouthCreek,beforeMineLongApproach,beforeSouthRoad,beforeArtisanPlant,beforeChapelApproach,beforeMinePrep,beforeChapelWest,beforeAbandonedMine,beforeMineDepths,beforeOtherworld,beforeMineEntry,beforeChapel,beforeArmedEncounters,beforeNorthTrail,beforeForestWatchPost,beforePondMarsh,beforeWayfarer,beforeOtherworldDepths};
