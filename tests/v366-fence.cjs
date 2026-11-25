const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),test=require('node:test');
const h=fs.readFileSync(process.argv[2]||'workshop-frontier-v366/fence-candidate.html','utf8');
const s=h.indexOf('function frontierVillageGeometry(){'),e=h.indexOf('let frontierVillageMesh=',s);
const f=h.indexOf('const FRONTIER_VILLAGE='),g=h.indexOf('function frontierVillageTrack(',f);
const branches=[],c=vm.createContext({
 mesh:()=>({}),cube:()=>{},naturalBranch:(m,...p)=>branches.push(p),frontierSampleHeight:(x,z)=>.24*Math.sin(x*.32+z*.27)
});
vm.runInContext(h.slice(f,g)+h.slice(s,e)+'; frontierVillageGeometry();',c);
test('substantial close-set log upright silhouette, not just spaced rail posts',()=>{
 const trunks=branches.filter(([x,y,z,u,w,v])=>Math.hypot(x-u,z-v)<.18&&w-y>2.09);
 assert.ok(trunks.length>=200,`only ${trunks.length} full-height uprights`);
 let variability=new Set(trunks.map(q=>Math.round((q[4]-q[1])*30)));
 assert.ok(variability.size>=12);
 const roots=trunks.map(q=>q[1]);assert.ok(Math.max(...roots)-Math.min(...roots)>.35);
});
test('both gate beams clear the road and openings remain unchanged',()=>{
 const beams=branches.filter(([x,y,z,u,w,v])=>Math.abs(v-z)>3.2&&Math.abs(x-u)<.12);
 assert.equal(beams.length,2);assert.ok(beams.every(q=>Math.min(q[1],q[4])>3));
 assert.equal(c.frontierVillageFence(32,30),false);assert.equal(c.frontierVillageFence(56,30),false);
 assert.ok(c.frontierVillageFence(44,42)&&c.frontierVillageFence(44,18));
});
test('static wood primitives stay bounded, finite, and deterministically tinted',()=>{
 assert.ok(branches.length<650);
 assert.ok(branches.every(q=>q.slice(0,8).every(Number.isFinite)&&q[8].every(Number.isFinite)));
});
