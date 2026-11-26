const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const h=fs.readFileSync(process.argv[2]||path.join(__dirname,'south-fixture-candidate.html'),'utf8');
for(const hit of h.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(hit[1]);
const a=h.indexOf('// BEGIN FRONTIER SOUTH RUINS'),b=h.indexOf('let frontierSouthStairGpu=',a);
const smooth=(a,b,t)=>{const n=Math.min(1,Math.max(0,(t-a)/(b-a)));return n*n*(3-2*n)};
const c=vm.createContext({frontierSmooth:smooth,frontierHeight:()=>0,
  quad:(m,...args)=>m.quads.push(args.slice(0,4)),
  cube:(m,...args)=>m.cubes.push(args)});
vm.runInContext(h.slice(a,b)+`;globalThis.api={
grade:frontierSouthGrade, vestibule:frontierSouthVestibuleArt, ramp:frontierSouthRampCell,mounts:frontierSouthLanternMounts,
lantern:frontierSouthMountedLanternArt,room:frontierSouthRuinsOwn, cells:frontierSouthVestibuleCell,lamps:FRONTIER_SOUTH_LAMPS
}`,c);
const f=c.api,m={quads:[],cubes:[]};f.vestibule(m);
for(let z=74;z<=82;z++)for(let x=155;x<=165;x++){
 const p=m.quads.filter(q=>q[0][0]>=x&&q[0][0]<x+1&&q[0][2]>=z&&q[0][2]<z+1);
 assert.equal(p.length,f.ramp(x,z)?0:2);
 assert.equal(f.grade(x+.8,z+.8),0);
}
assert.ok(m.quads.every(quad=>quad.every(v=>v[1]===.006||v[1]===.012)));
const mounts=f.mounts();assert.equal(mounts.length,f.lamps.length);
assert.equal(new Set(mounts.map(q=>q.x+':'+q.z)).size,mounts.length);
assert.equal(mounts.filter(q=>q.stair).length,2);
for(const q of mounts){
 const inside=[Math.floor(q.x+.1*q.dx),Math.floor(q.z+.1*q.dz)],outside=[Math.floor(q.x-.1*q.dx),Math.floor(q.z-.1*q.dz)];
 assert.equal(Math.abs(q.dx)+Math.abs(q.dz),1);
 if(q.stair){assert.ok(f.ramp(...inside)&&!f.ramp(...outside));}
 else {assert.ok(f.room(...inside)&&!f.room(...outside)&&!f.ramp(...outside));}
 m.cubes=[];f.lantern(m,q);assert.ok(m.cubes.length>6);
 assert.ok(m.cubes.every(c=>[c[0],c[1],c[2],c[3],c[4],c[5]].every(Number.isFinite)));
 assert.ok(Math.abs(m.cubes[0][0]-q.x)<.04&&Math.abs(m.cubes[0][2]-q.z)<.04);
}
assert.ok(h.includes("||frontierSouthVestibuleCell(wx,wz))continue"));
assert.ok(h.includes("o.type==='lantern'&&frontierSouthAuthoredLamp(o.x,o.z))return false"));
assert.ok(h.includes("frontierSouthMountedLanternArt(lamp.stair?stair:cellar,lamp)"));
console.log('PASS flat vestibule stone floor, staircase opening cutout, all authored lanterns uniquely fastened to actual wall faces');
