const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),{createHash}=require('node:crypto');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8'),cut=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)+1));
const build=vm.runInNewContext(cut('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+';buildFacilitySite');
const {beforePondMarsh}=require('./mine-history-v165.cjs');
const site=beforePondMarsh(JSON.parse(JSON.stringify(build('base')))),world=site.map.world;
const at=(x,z)=>world.filter(o=>o.x===x&&o.z===z&&o.y===0);
const floor=/^(?:earth|stone|road\w+|grassTrampled|grassPebbles)$/;
test('the eastward continuation is dry and continuous with the exact old Game World left in place',()=>{
 assert.equal(createHash('sha256').update(JSON.stringify(world.slice(0,6644))).digest('hex'),'bad04384077f1629ed83dca8dac11192d82742e0b267e895f1e66486b466fe94');
 assert.deepEqual([site.map.width,site.map.height],[128,96]);assert(!build('lodging').northTrail);
 const t=site.northTrail,r=t.continuation;
 assert.deepEqual(r[0],{x:85,z:2});assert.deepEqual(r.at(-1),{x:117,z:9});
 for(let i=0;i<r.length;i++){
  const {x,z}=r[i],o=r[i-1];assert(z>0);
  if(o)assert.equal(Math.abs(x-o.x)+Math.abs(z-o.z),1);
  assert(at(x,z).length&&at(x,z).every(o=>floor.test(o.type)));
 }
 assert(t.lowland.water.length>=7);
 for(const {x,z,y} of t.lowland.water){assert.equal(y,0);assert(at(x,z).some(o=>o.type==='water'))}
 assert(world.slice(6644).length<135);
});
test('the signposted ruin is optional, open to the sky and walkable to its own guard and can',()=>{
 const t=site.northTrail,p=t.watchPost;
 assert.equal(p.name,'森の見張り場');assert.equal(p.difficulty,2);
 assert.deepEqual(p.waymark,{x:100,z:6,y:0,type:'ruinStonePost'});
 assert(at(100,6).some(o=>o.type===p.waymark.type));
 assert.deepEqual(p.guard,{x:102,z:13,y:0,type:'monsterSkelWarrior'});
 assert(at(102,13).some(o=>o.type===p.guard.type));
 assert.deepEqual(p.reward,{id:'north-watchpost-find',type:'cannedFood',count:1,x:100,z:14,y:0});
 assert.deepEqual(at(100,14).map(o=>o.type),['stone']);
 const reserved=[[101,5],[101,6],[101,7],[101,8],[101,9],[101,10],[101,11],[101,12],[101,13],[101,14],[100,14]];
 for(const [x,z] of reserved)assert(at(x,z).length&&at(x,z).every(o=>floor.test(o.type)||x===101&&z===10&&o.type==='ruinDoorBroken'),'clear accessible path '+x+','+z);
 for(const {x,z,type} of world.slice(6644).filter(o=>o.x>=98&&o.x<=104&&o.z>=10&&o.z<=15)){
  assert(!/roof/i.test(type));assert(oGuardLeash(p,x,z)||/^(?!monster)/.test(type));
 }
 const {bounds:b}=p,w=new Set();
 for(let x=b.x1;x<=b.x2;x++)for(let z=b.z1;z<=b.z2;z++){
  if(x!==b.x1&&x!==b.x2&&z!==b.z1&&z!==b.z2||x===101&&z===10)continue;
  assert(at(x,z).some(o=>/^ruinWall/.test(o.type)));w.add(x+','+z);
 }
 for(const k of w){const [x,z]=k.split(',').map(Number);assert([[0,1],[0,-1],[1,0],[-1,0]].some(([dx,dz])=>w.has((x+dx)+','+(z+dz))))}
});
function oGuardLeash(p,x,z){const b=p.leash;return x>=b.x1&&x<=b.x2&&z>=b.z1&&z<=b.z2}
