const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{test}=require('node:test');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const source=html.match(/const FACILITY_SITES[\s\S]*?(?=function facilityNavigate\()/)?.[0];
assert(source);
const build=vm.runInNewContext(source+'\n;buildFacilitySite');
const ids=['cottage','rowhouse','gardener','artisan','toolshop'];
const scene=id=>id==='artisan'||id==='toolshop'?id:'homes';
function entry(scope,id){
 const site=build(scope),b=site.buildings.find(o=>o.id===id);assert(b,id);
 const {turn,x1,z1,x2,z2}=b,w=turn%2?z2-z1+1:x2-x1+1,d=turn%2?x2-x1+1:z2-z1+1;
 const xy=(x,z)=>turn===1?[x1+d-1-z,z1+x]:turn===2?[x1+w-1-x,z1+d-1-z]:turn===3?[x1+z,z1+w-1-x]:[x1+x,z1+z];
 const at=(x,z,y=0)=>{const[a,c]=xy(x,z);return Array.from(site.map.world.filter(o=>o.x===a&&o.z===c&&o.y===y));};
 return {at,b,d,w,xy,site};
}
test('frontages have distinct grounded details with correct rotated window orientation and no unregistered objects',()=>{
 const expected={
  cottage:[[2,6,'oldTownFlowerBox'],[1,7,'benchWood'],[6,7,'poiPottedPlant']],
  rowhouse:[[3,6,'oldTownStreetLamp'],[1,7,'poiPottedPlant'],[2,7,'roadBrickFull']],
  gardener:[[4,6,'oldTownFlowerBox'],[0,7,'cropVegetable'],[0,8,'cropVegetable'],[0,10,'stoolRound']],
  artisan:[[2,7,'oldTownShutters'],[6,7,'oldTownAwning']],
  toolshop:[[2,8,'oldTownAwning'],[5,8,'oldTownStreetLamp']]
 };
 for(const id of ids)for(const scope of [scene(id),'base']){
  const {site,at,b}=entry(scope,id);
  for(const [x,z,type] of expected[id]){
   const o=at(x,z).find(p=>p.type===type);
   assert.ok(o,id+' '+scope+' '+type);
   assert.ok(o.x>=0&&o.x<site.map.width&&o.z>=0&&o.z<site.map.height);
   assert.ok(html.includes("'"+type+"'")||html.includes('"'+type.replace('Full','')+'"'),type+' is registered');
   if(type.startsWith('oldTown'))assert.equal(o.rot,b.turn,id+' local +Z follows façade');
  }
  if(id==='cottage'||id==='gardener'){
   const x=id==='cottage'?2:4;
   assert.ok(at(x,6).some(o=>o.type.endsWith('wallWindow')),'planter shares a real window tile');
  }
  if(id==='rowhouse')assert.ok(at(1,6).every(o=>o.type!=='poiPottedPlant'),'plant no longer hidden in brick wall');
 }
});
test('every polished front leaves the original door, approach and its side steps uncluttered',()=>{
 const doorX={cottage:4,rowhouse:4,gardener:2,artisan:4,toolshop:4};
 const pass=o=>/^road|^grass|^woodfloor|^(earth|stone|brickfloor)$/.test(o.type);
 for(const id of ids)for(const scope of [scene(id),'base']){
  const {at,b,d,xy}=entry(scope,id),x=doorX[id];
  assert.deepEqual(xy(x,d-1),[b.entrance.x,b.entrance.z]);
  assert.ok(at(x,d-1).some(o=>o.type.endsWith('wallDoor')));
  assert.ok(at(x,d-2).every(o=>pass(o)||o.type.endsWith('wallDoor')),id+' interior step');
  for(const dx of [-1,0,1])assert.ok(at(x+dx,d).every(pass),id+' clear initial exterior step '+dx);
  assert.ok(at(x,d+1).every(pass),id+' clear outward approach');
 }
});
function unchangedLayoutDigest(scope){
 const site=build(scope),id=b=>b.id;
 const allowed={
  artisan:new Set(['2,7:oldTownShutters','6,7:oldTownAwning']),
  toolshop:new Set(['2,8:oldTownAwning','5,8:oldTownStreetLamp']),
  cottage:new Set(['2,6:oldTownFlowerBox']),
  rowhouse:new Set(['3,6:oldTownStreetLamp','1,6:poiPottedPlant']),
  gardener:new Set(['4,6:oldTownFlowerBox'])
 };
 const data=[];
 for(const b of site.buildings.filter(b=>b.id!=='townGuild')){
  const {at,d,w}=entry(scope,id(b));
  const owned=new Set(Array.from(b.footprint,p=>p.x+','+p.z));
  const items=[];
  for(let x=0;x<w;x++)for(let z=0;z<d;z++)for(let y=-1;y<=4;y++)for(const o of at(x,z,y)){
   if(!owned.has(o.x+','+o.z))continue;
   if(!y&&allowed[id(b)]?.has(x+','+z+':'+o.type))continue;
   items.push(JSON.stringify(o));
  }
  data.push([b,items.sort()]);
 }
 return require('node:crypto').createHash('sha256').update(JSON.stringify(data)).digest('hex');
}
test('all original footprints, doors, roofs and room contents match v114 outside allowed façade accents',()=>{
 const expected={
  artisan:'d591ec1a32a8e67774dd5b0f54c77f2a7bab5978badf3037d6d98697b2b182b8',
  toolshop:'7e5aafce84bc70d18ec9ceb49dc5b34c786ab0a6f09e8cd32d87edb005b2932f',
  homes:'01fb6230ff7a61a7440aa3d6ddbbb72be93e31556c5dc843fea18ae04b73c9ca',
  base:'34ef9441dd72f13559163f75446dd817191aaad9b5dbe7041b7a71319f4a94cc'
 };
 for(const [id,digest] of Object.entries(expected))assert.equal(unchangedLayoutDigest(id),digest,id);
});
