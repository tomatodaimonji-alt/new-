const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),{createHash}=require('node:crypto');
const {beforeArtisanPlant,beforeSouthRoad}=require('./mine-history-v165.cjs');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const build=vm.runInNewContext(h.slice(h.indexOf('const FACILITY_SITES=Object.freeze('),h.indexOf('function workshopResumeDecode('))+';buildFacilitySite');
const s=beforeSouthRoad(JSON.parse(JSON.stringify(build('base')))),w=s.map.world,at=(x,z)=>w.filter(o=>o.x===x&&o.z===z&&o.y===0);
test('signed dry path leaves the old southeastern trail and reaches the existing ruined chapel stair',()=>{
 const c=s.chapel,a=c.approach;
 assert.deepEqual(a.waymark,{x:119,z:84,y:0,type:'ruinStonePost'});
 assert(at(119,84).some(o=>o.type===a.waymark.type&&o.rot===0));
 assert.deepEqual(a.path[0],{x:117,z:85});assert.deepEqual(a.path.at(-1),{x:124,z:81});
 assert.deepEqual(c.entrance,{x:124,z:81,y:0,type:'guildStairDown'});
 for(let i=0;i<a.path.length;i++){
  const {x,z}=a.path[i],p=a.path[i-1];
  if(p)assert.equal(Math.abs(p.x-x)+Math.abs(p.z-z),1);
  assert(at(x,z).length&&at(x,z).every(({type})=>/^(?:grassTrampled|roadMossFull|roadGravelFull|stone|guildStairDown)$/.test(type)),[x,z]);
 }
 assert.equal(a.path.length,12);
});
test('old v206 world and all earlier placements stay byte-identical, route only extends the dry bank',()=>{
 const old=beforeArtisanPlant(s).map.world.slice(0,7443),prior=new Set(old.map(o=>o.x+','+o.z+','+o.y));
 assert.equal(createHash('sha256').update(JSON.stringify(old)).digest('hex'),'250d2f15c06fdd980d391bab89529757446c365e8266c77ec5fe71d8a3c6aa57');
 assert(w.length>7443&&w.length<7462);
 for(const o of w.slice(7443)){
  assert.equal(o.y,0);assert(o.x>=119&&o.x<=124&&o.z>=82&&o.z<=86);
  assert(!prior.has(o.x+','+o.z+','+o.y));
 }
 assert(!build('kitchen').chapel);
});
