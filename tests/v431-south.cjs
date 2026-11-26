const a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.argv[2]||'candidate.html','utf8');
for(const m of h.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
const start=h.indexOf('// BEGIN FRONTIER SOUTH RUINS');a.ok(start>=0);
const c=vm.createContext({});
vm.runInContext(h.slice(start,h.indexOf('// END FRONTIER SOUTH RUINS',start))+';globalThis.t={frontierSouthOwn,frontierSouthRuinsOwn,frontierSouthEnemyRecords,frontierSouthRecordId,frontierSouthMarkEncounter,frontierSouthDefeatsDecode,FRONTIER_SOUTH_EXPEDITION_ROUTE,frontierSouthPopulate};',c);
const t=c.t;
let count=0;for(let z=0;z<=129;z++)for(let x=0;x<256;x++)if(t.frontierSouthOwn(x,z))count++;
a.equal(count,4096);
a.ok(t.frontierSouthOwn(160,64));a.ok(!t.frontierSouthOwn(127,64));a.ok(!t.frontierSouthOwn(160,128));
for(let x=158;x<=162;x++)for(let z=78;z<=82;z++)a.ok(t.frontierSouthRuinsOwn(x,z));
const cells=new Set(['160,77']),q=[[160,77]];
for(let i=0;i<q.length;i++)for(const [dx,dz] of [[0,1],[0,-1],[1,0],[-1,0]]){
 const [x,z]=q[i],u=x+dx,v=z+dz,k=u+','+v;
 if(t.frontierSouthRuinsOwn(u,v)&&!cells.has(k)){cells.add(k);q.push([u,v])}
}
a.ok(cells.size>=350);a.ok(cells.has('160,122'));for(const p of t.FRONTIER_SOUTH_EXPEDITION_ROUTE)if(p.y===-1)a.ok(cells.has([p.x,p.z].join(',')));
const enemies=t.frontierSouthEnemyRecords();a.equal(new Set(enemies.map(e=>e.type)).size,3);a.ok(enemies.length>=8);
a.ok(enemies.every(e=>cells.has([e.x,e.z].join(','))&&t.frontierSouthRecordId(e)));
const placed=[];t.frontierSouthPopulate((x,z,type,rot,y)=>placed.push({x,z,type,rot,y}));
a.equal(placed.filter(o=>o.type==='guildStairDown'&&o.y===0).length,1);
a.equal(placed.filter(o=>o.type==='guildStairUp'&&o.y===-1).length,1);
const next=t.frontierSouthMarkEncounter({},enemies.slice(0,2));
a.equal(next.southDefeats.length,2);a.equal(t.frontierSouthMarkEncounter(next,enemies.slice(0,2)),next);
a.equal(t.frontierSouthDefeatsDecode(['bad',...next.southDefeats]).length,2);
console.log('PASS 64×64 south ownership, continuous five-wide underground route, stairs, distinct enemy placements and defeat ledger');
