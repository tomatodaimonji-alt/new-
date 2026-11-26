const a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),h=fs.readFileSync(process.argv[2],'utf8');
const s=h.slice(h.indexOf('const FRONTIER_RUINS=(()=>{'),h.indexOf('function frontierRuinsGeometry(){'));
const R=vm.runInNewContext(s+'\nFRONTIER_RUINS');
a(R.ARENA,'required combat room');
const key=(x,z)=>x+','+z,within=(x,z)=>x>=R.ARENA.x1&&x<=R.ARENA.x2&&z>=R.ARENA.z1&&z<=R.ARENA.z2;
const start=[32,29],boss=key(R.BOSS.x,R.BOSS.z),chest=key(R.CHEST.x,R.CHEST.z);
function visit(noArena,noGate) {
 const q=[start],d=new Map([[key(...start),0]]);
 for(const [x,z] of q) for(const [dx,dz] of [[0,1],[0,-1],[1,0],[-1,0]]){
  const u=x+dx,v=z+dz,k=key(u,v);
  if(d.has(k)||noArena&&within(u,v)||noGate&&u===R.GATE.x&&v===R.GATE.z)continue;
  if(!R.cells.has(k)&&!(u>=10&&u<32&&v>=27&&v<32))continue;
  d.set(k,d.get(key(x,z))+1);q.push([u,v]);
 }
 return d;
}
a.equal((R.ARENA.x2-R.ARENA.x1+1)*(R.ARENA.z2-R.ARENA.z1+1),48);
const open=visit(false,false),closed=visit(false,true),without=visit(true,false);
a.equal(closed.get(boss),62);a.equal(open.get(chest),73);a(!closed.has(chest));a(!without.has(boss));
for(const p of R.LOOT)a(without.has(key(p.x,p.z)));
a.equal(R.ARENA_MOBS.length,6);
a.equal(new Set(R.ARENA_MOBS.map(p=>key(p.x,p.z))).size,6);
a.equal(R.ARENA_MOBS.filter(p=>p.type==='monsterSlime').length,3);
a.equal(R.ARENA_MOBS.filter(p=>p.type==='monsterGoblin').length,3);
a(R.ARENA_MOBS.every(p=>within(p.x,p.z)&&R.cells.has(key(p.x,p.z))));
for(const m of h.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
console.log('PASS 8x6 required mob room, optional loot paths, original boss and locked chest distances');
