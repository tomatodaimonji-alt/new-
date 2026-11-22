const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),{createHash}=require('node:crypto');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8'),cut=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)+1));
const build=vm.runInNewContext(cut('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+';buildFacilitySite');
const {beforeForestWatchPost}=require('./mine-history-v165.cjs');
const site=beforeForestWatchPost(JSON.parse(JSON.stringify(build('base')))),world=site.map.world;
const at=(x,z)=>world.filter(o=>o.x===x&&o.z===z&&o.y===0);
test('the walkable north road extends the old trail and bypasses the old staff encounter',()=>{
 const t=site.northTrail,r=t.route;
 assert.deepEqual([site.map.width,site.map.height],[128,96]);
 assert.equal(createHash('sha256').update(JSON.stringify(world.slice(0,6557))).digest('hex'),'28255ef5ee8d7fcaa6e9b6e710d239e3d352647d02bbcc2db8cc427fcabce0cd');
 assert(!build('lodging').northTrail);
 assert(r.length>=40&&r.length<=53);
 assert.deepEqual(r[0],{x:39,z:4});assert.deepEqual(r.at(-1),{x:85,z:2});
 for(let i=0;i<r.length;i++){
  const {x,z}=r[i],old=r[i-1];assert(z<=4&&z>=2);
  if(old)assert.equal(Math.abs(x-old.x)+Math.abs(z-old.z),1);
  assert(at(x,z).length>0&&at(x,z).every(o=>/^(?:earth|grassTrack|grassTrampled|roadGravelFull|roadMossFull)$/.test(o.type)),'path surface only at '+[x,z]);
 }
});
test('forest and discoveries are small, no prior tiles overlap, camp ground find has a clear trail',()=>{
 const t=site.northTrail,ext=world.slice(6557),old=new Set(world.slice(0,6557).map(o=>o.x+','+o.z+','+o.y));
 assert(ext.every(o=>o.y===0&&o.x>=39&&o.x<=86&&o.z<=9&&!old.has(o.x+','+o.z+','+o.y)));
 assert(ext.length<92&&ext.filter(o=>o.type.startsWith('tree')).length<=11);
 assert.deepEqual(t.supply,{id:'north-trail-camp',type:'healingHerb',count:2,x:61,z:7,y:0});
 for(let z=4;z<=7;z++){assert(at(61,z).length>0);assert(at(61,z).every(o=>/^(?:grassTrampled|earth|roadGravelFull)$/.test(o.type)))}
 assert(at(t.waymark.x,t.waymark.z).some(o=>o.type===t.waymark.type));
 assert(t.regions.every(o=>o.difficulty===1));
});
