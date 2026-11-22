const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),{createHash}=require('node:crypto');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)+1));
const build=vm.runInNewContext(cut('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+';buildFacilitySite');
const site=JSON.parse(JSON.stringify(build('base'))),{world}=site.map;
const at=(x,z,y)=>world.filter(o=>o.x===x&&o.z===z&&o.y===y);
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
test('otherworld is an exact appended base-only parcel with registry-bound open portals',()=>{
 const {map,otherworld,...old}=site;
 assert.equal(digest(world.slice(0,6091)),'dda620340a5bffcba1a41d548c9acee30b5d7b5a0413258c942f8d3b42eb52f8');
 assert.equal(digest(old),'a73eb6f9506ac652064697319e91d90faca5ed2ef5393a7518c0edb84db5c8c1');
 assert.equal(otherworld.name,'星蝕の回廊');assert.equal(otherworld.difficulty,4);
 for(const [anchor,stand] of [['entrance','surfaceStand'],['exit','dungeonStand']]){
  const p=otherworld[anchor],q=otherworld[stand];
  assert(at(p.x,p.z,p.y).some(o=>o.type==='otherworldPortal'&&o.rot===2));
  assert(at(p.x,p.z,p.y).some(o=>o.type==='stone'||o.type.startsWith('road')));
  assert.equal(p.x,q.x);assert.equal(p.z,q.z+1);assert.equal(p.y,q.y);assert.equal(q.facing,2);
 }
 assert(!build('lodging').otherworld);
 assert.match(html,/id:'otherworldPortal'[^\n]*cat:'decor'/);
 assert.match(html,/"number":"343","id":"otherworldPortal"/);
});
test('B1 arrival is safe, foes have dodge lanes, and the elite gate wholly controls the treasure path',()=>{
 const p=site.otherworld,B=p.bounds,extra=world.slice(6091).filter(o=>o.y===-1),keys=(x,z)=>x+','+z;
 assert(extra.every(o=>o.x>=B.x1&&o.x<=B.x2&&o.z>=B.z1&&o.z<=B.z2));
 const F=new Set(extra.filter(o=>o.type==='stone'||o.type.startsWith('road')).map(o=>keys(o.x,o.z)));
 const W=new Set(extra.filter(o=>o.type==='stonewall').map(o=>keys(o.x,o.z)));
 const dirs=[[0,1],[0,-1],[1,0],[-1,0]],stops=new Set(extra.filter(o=>!/^(stone|road|otherworldPortal|monster|ironGate)/.test(o.type)).map(o=>keys(o.x,o.z)));
 const step=(x,z,open)=>F.has(keys(x,z))&&!stops.has(keys(x,z))&&(open||keys(x,z)!==keys(p.gate.x,p.gate.z));
 const area=open=>{
  const q=[[p.dungeonStand.x,p.dungeonStand.z]],seen=new Set(q.map(p=>keys(...p)));
  for(let i=0;i<q.length;i++)for(const [dx,dz] of dirs){
   const x=q[i][0]+dx,z=q[i][1]+dz,k=keys(x,z);
   if(step(x,z,open)&&!seen.has(k)){seen.add(k);q.push([x,z])}
  }return seen;
 };
 const closed=area(false),opened=area(true);
 assert(closed.has(keys(p.exit.x,p.exit.z)),'safe vestibule retreat is always available');
 assert(!closed.has(keys(p.chestStand.x,p.chestStand.z))&&opened.has(keys(p.chestStand.x,p.chestStand.z)));
 assert(at(p.gate.x,p.gate.z,-1).some(o=>o.type==='ironGate'));
 assert(at(p.chest.x,p.chest.z,-1).some(o=>o.type==='rewardChest'));
 const mobs=extra.filter(o=>o.type.startsWith('monster'));
 assert.deepEqual(mobs.map(o=>o.type),['monsterGoblin','monsterSkeleton','monsterDragon']);
 for(const {x,z} of mobs){
  assert(Math.hypot(x-p.dungeonStand.x,z-p.dungeonStand.z)>7.5);
  assert(closed.has(keys(x,z)));assert(dirs.every(([dx,dz])=>step(x+dx,z+dz,false)));
 }
 assert.deepEqual(p.elite,{x:101,z:79,y:-1,type:'monsterDragon'});
 const facing=[[0,1],[-1,0],[0,-1],[1,0]];
 for(const o of extra.filter(o=>o.type==='poiWallSconce')){
  const [dx,dz]=facing[o.rot];assert(W.has(keys(o.x,o.z))&&F.has(keys(o.x+dx,o.z+dz)),'sconce attached and facing actual floor');
 }
 assert(F.size>90&&extra.length<245);
 for(const k of W){
  assert(!F.has(k));const [x,z]=k.split(',').map(Number);
  for(const dz of [-1,1])if(W.has(keys(x+1,z+dz)))assert(W.has(keys(x+1,z))||W.has(keys(x,z+dz)));
 }
});
