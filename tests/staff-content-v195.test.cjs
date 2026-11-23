const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),{createHash}=require('node:crypto');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8'),cut=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)+1));
const build=vm.runInNewContext(cut('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+';buildFacilitySite');
const {beforeNorthTrail}=require('./mine-history-v165.cjs');
const site=beforeNorthTrail(JSON.parse(JSON.stringify(build('base')))),world=site.map.world;
test('two secluded staff skeletons append without changing any old cell',()=>{
 assert.equal(createHash('sha256').update(JSON.stringify(world.slice(0,6555))).digest('hex'),'16e5a8246ac2b1c88a4d949cc290dbc74e90fe06a353a212542172cb7d9c13d6');
 assert.deepEqual(world.slice(6555),[
  {x:40,z:88,y:0,type:'monsterSkelMage',rot:0},
  {x:43,z:7,y:0,type:'monsterSkelLongStaff',rot:0}
 ]);
 assert.deepEqual(site.armedEncounters.slice(4).map(p=>p.leash),[{x1:38,x2:43,z1:86,z2:92},{x1:40,x2:47,z1:5,z2:10}]);
 assert(!build('lodging').armedEncounters);
});
test('both staff models are real wooden assets, the long staff visibly extends beyond plain',()=>{
 const calls=[],span={},c={cube:(_m,x,y,z,w,h,d)=>calls.push([y,y+h]),naturalBranch:(_m,x,y,z,u,v,w)=>calls.push([y,v]),
  tri:(_m,a,b,c)=>calls.push([a[1],b[1],c[1]])};
 vm.runInNewContext(cut('// BEGIN LONG HARDWOOD STAFF ART','// END LONG HARDWOOD STAFF ART')+
  cut('function poiFantasyEquipmentGeometry(','function decoBase('),c);
 for(const id of ['equipPlainStaff','equipLongStaff']){
  calls.length=0;c.poiFantasyEquipmentGeometry({},id,0,0,0);
  assert(calls.length>=4);span[id]=Math.max(...calls.flat());
 }
 assert(span.equipLongStaff>span.equipPlainStaff+.50);
 assert.equal(c.poiArmedMonsterArt('monsterSkelMage').weapon,'equipPlainStaff');
 assert.equal(c.poiArmedMonsterArt('monsterSkelLongStaff').weapon,'equipLongStaff');
 assert.match(html,/"number":"357","id":"monsterSkelLongStaff"/);
});
