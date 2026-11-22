const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),{createHash}=require('node:crypto');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8'),cut=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)+1));
const build=vm.runInNewContext(cut('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+';buildFacilitySite');
const site=JSON.parse(JSON.stringify(build('base'))),world=site.map.world;
const key=(x,z)=>x+','+z,at=(x,z)=>world.filter(o=>o.x===x&&o.z===z&&o.y===-1);
const floor=/^(?:stone|road\w+)$/;
test('two large new accessible galleries join the old realm through only two exact cuts',()=>{
 const p=site.otherworld, ext=p.expansion, old=world.slice(0,6925);
 for(const [i,x,z] of [[6249,102,86],[6270,108,81]]){
  assert.deepEqual(old[i],{x,z,y:-1,type:'ruinDoorBroken',rot:1});
  old[i]={x,z,y:-1,type:'stonewall',rot:0};
 }
 assert.equal(createHash('sha256').update(JSON.stringify(old)).digest('hex'),'5c40eaaa2b700df4feddfd119254753e342aca5a74da8f4c5e56ead7b2e5ab1c');
 assert.deepEqual(ext.originalBounds,{x1:95,z1:72,x2:108,z2:92,y:-1});
 assert(p.bounds.x2>=124);
 assert(ext.cells.length>=110);
 const floorCount=world.filter(o=>o.y===-1&&floor.test(o.type)&&o.x>=p.bounds.x1&&o.x<=p.bounds.x2&&o.z>=p.bounds.z1&&o.z<=p.bounds.z2).length;
 assert(floorCount>212,'four-star dungeon now larger than the old mine');
 assert(world.slice(6925).every(o=>o.y===-1&&o.z>=77&&o.x<=124));
 assert(!build('kitchen').otherworld);
});
test('optional east loop, separate guards and supply are reachable; gated stash cannot be bypassed',()=>{
 const w=site.otherworld,e=w.expansion,extra=world.slice(6925);
 const occupied=new Set(extra.filter(o=>!floor.test(o.type)&&!/^(?:monster|poiWallSconce)/.test(o.type)).map(o=>key(o.x,o.z)));
 const blocked=new Set(world.filter(o=>o.y===-1&&(/^(?:stonewall|rewardChest|brokenPillar|rockBasalt|rockCluster)$/.test(o.type))).map(o=>key(o.x,o.z)));
 const hasFloor=(x,z)=>at(x,z).some(o=>floor.test(o.type));
 const can=(x,z)=>(!occupied.has(key(x,z))&&!blocked.has(key(x,z))&&hasFloor(x,z)&&key(x,z)!==key(w.gate.x,w.gate.z));
 const area=(x,z)=>{
  const todo=[[x,z]],seen=new Set([key(x,z)]);
  for(let i=0;i<todo.length;i++)for(const [dx,dz] of [[0,1],[0,-1],[1,0],[-1,0]]){
   const [xx,zz]=[todo[i][0]+dx,todo[i][1]+dz],k=key(xx,zz);
   if(!seen.has(k)&&can(xx,zz)){seen.add(k);todo.push([xx,zz]);}
  }return seen;
 };
 for(const [x,z] of [[102,86],[103,86],[104,86],[110,86],[113,86],[114,86],[115,86],[115,81],[108,81],[107,81]])assert(can(x,z),'loop connection '+[x,z]);
 const seen=area(w.dungeonStand.x,w.dungeonStand.z);
 assert(e.cells.filter(p=>seen.has(key(p.x,p.z))).length>=110);
 assert(!seen.has(key(w.chestStand.x,w.chestStand.z)));
 for(const g of e.guard)assert(seen.has(key(g.x,g.z))&&at(g.x,g.z).some(o=>o.type===g.type));
 assert.deepEqual(e.reward,{id:'otherworld-east-supply',type:'cannedFood',count:1,x:121,z:84,y:-1});
 assert(seen.has(key(e.reward.x,e.reward.z)));
 assert.deepEqual(at(e.reward.x,e.reward.z).map(o=>o.type),['stone']);
});

test('new B1 walls meet cardinally and sconces all attach to real walls facing walkable floor',()=>{
 const w=site.otherworld,b=w.bounds;
 const indoor=world.filter(o=>o.y===-1&&o.x>=b.x1&&o.x<=b.x2&&o.z>=b.z1&&o.z<=b.z2);
 const wall=new Set(indoor.filter(o=>o.type==='stonewall').map(o=>key(o.x,o.z)));
 const floors=new Set(indoor.filter(o=>floor.test(o.type)).map(o=>key(o.x,o.z)));
 for(const k of wall){const [x,z]=k.split(',').map(Number);assert(!floors.has(k));
  for(const dz of [-1,1])if(wall.has(key(x+1,z+dz)))assert(wall.has(key(x+1,z))||wall.has(key(x,z+dz)));
 }
 const dirs=[[0,1],[-1,0],[0,-1],[1,0]];
 for(const o of world.slice(6925).filter(o=>o.type==='poiWallSconce')){
  const [dx,dz]=dirs[o.rot];assert(wall.has(key(o.x,o.z))&&floors.has(key(o.x+dx,o.z+dz)));
 }
});
