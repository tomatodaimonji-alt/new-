const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function span(a,b){const i=h.indexOf(a),j=h.indexOf(b,i+a.length);assert(i>=0&&j>i);return h.slice(i,j)}
const load=()=>vm.runInNewContext(span('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+';({build:buildFacilitySite,sample:pineGuildSampleMap})');
const sign={x:56,z:38,y:0,type:'guildFacadeSign',rot:0};
function visibility(site){
 const c={facilitySite:site,level:0,poiWalkLevel:0,poiWalkActive:true,facilityVisibilityOwner:()=>null,
  facilityIsRoofPiece:()=>false,facilityRoofOwner:()=>null,facilityUsesGuildRendering:()=>false,facilityFloorOwner:()=>null};
 return vm.runInNewContext(span('function facilityViewLevel()','function poiChestInvalidateModel()')+';facilityObjectVisible',c);
}
test('the pictured Game World facade board is omitted from normal and cached full-surface rendering',()=>{
 const {build}=load(),site=build('base');
 // Canonical authored furniture and floor layout must remain byte-for-byte
 // intact. Visually hiding this one plaque should not rewrite stored layout.
 const authored=site.map.world.filter(o=>o.type==='guildFacadeSign');
 assert.deepEqual(JSON.parse(JSON.stringify(authored)),[sign]);
 const visible=visibility({...site,id:'base'});
 assert.equal(visible(authored[0]),false);
 assert.equal(visible(authored[0],null),false,'full surface uses the same predicate');
 const sceneStart=h.indexOf('(localBatch||world).filter(o=>{');
 const sceneEnd=h.indexOf('if(facilitySite&&!facilityObjectVisible(o,cut))return false;',sceneStart);
 assert.ok(sceneStart>=0&&sceneEnd>sceneStart&&sceneEnd-sceneStart<420,'shared and local scene paths retain the same visibility predicate');
 assert.match(h,/!groups\.has\(o\.type\)\|\|\(facilitySite&&!facilityObjectVisible\(o\)\)/,'label overlay uses the same predicate');
});
test('same frontage door, other signs, sample guild and guild name stay intact',()=>{
 const {build,sample}=load(),site=build('base'),visible=visibility({...site,id:'base'});
 const entry=site.buildings.find(o=>o.id==='townGuild');
 assert.equal(entry.name,'冒険者ギルド');
 assert.equal(entry.entrance.x,56);assert.equal(entry.entrance.z,38);
 const door=site.map.world.find(o=>o.x===56&&o.z===38&&o.y===0&&/Door$/.test(o.type));
 assert(door&&visible(door));
 assert.equal(visible({...sign,type:'guildSign'}),true);
 assert.equal(visible({...sign,x:57}),true);
 assert.equal(visibility({id:'guildsaved',buildings:[]})(sign),true);
 assert(sample().world.some(o=>o.x===14&&o.z===20&&o.type==='guildFacadeSign'));
});

