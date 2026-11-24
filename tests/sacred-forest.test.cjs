const a=require('node:assert/strict'),{test}=require('node:test'),vm=require('node:vm'),fs=require('node:fs'),crypto=require('node:crypto');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(p,q)=>{const i=h.indexOf(p),j=h.indexOf(q,i+p.length);a(i>=0&&j>i,p);return h.slice(i,j)};
const s=vm.runInNewContext(cut('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+';buildFacilitySite("base")');s.id='base';
const f=s.sacredForest,w=s.map.world,k=o=>[o.x,o.z,o.y].join(',');
test('large named western woodland leaves historic stock contours unchanged and continues to the relocated temple',()=>{
 a.ok(f,'actual stock western woodland manifest');
 a.match(f.name,/聖林/);a.equal(s.map.width,128);a.equal(s.map.height,182);
 a.deepEqual([s.davidTemple.entrance.x,s.davidTemple.entrance.z,s.davidTemple.boss.x,s.davidTemple.boss.z],[24,128,24,158]);
 const prior=w.slice(0,f.authored.index),fresh=w.slice(f.authored.index);
 if(process.env.BASELINE_HASH)a.equal(crypto.createHash('sha256').update(JSON.stringify(prior)).digest('hex'),process.env.BASELINE_HASH);
 const original=new Set(prior.map(k));a.equal(fresh.length,f.authored.count);
 a(fresh.every(o=>!original.has(k(o))), 'never overlays a stock tile');
 a.equal(new Set(fresh.map(k)).size,fresh.length,'at most one new authored record per blank square');
 a(f.coverage.reduce((n,b)=>n+(b.x2-b.x1+1)*(b.z2-b.z1+1),0)>2000);
 a(f.trees.length>=72&&f.trees.length<=96);a(fresh.length<=430);
 a(f.trees.every(o=>o.y===0&&Math.hypot(o.x-24,o.z-158)>19.5));
 a(f.trees.every(o=>Math.hypot(o.x-f.reveal.x,o.z-f.reveal.z)>=6),'final orbit clearing has no large near trees');
});
test('authored route is real four-neighbor walking, with no new obstacles in legacy east approaches',()=>{
 a.ok(f);
 const coords=p=>[p.x,p.z];
 a.deepEqual(coords(f.route[0]),[12,49]);a.deepEqual(coords(f.route.at(-1)),[24,125]);a(f.route.length>=100);
 a(f.routes.length>=3,'authored side loops are real routes instead of decoration labels');
 for(const route of f.routes) {
  for(let i=1;i<route.length;i++)a.equal(Math.abs(route[i].x-route[i-1].x)+Math.abs(route[i].z-route[i-1].z),1);
  for(const p of route)a(!w.some(o=>k(o)===k(p)&&! /^(?:grass|road|earth|flowerField$)/.test(o.type)),k(p));
 }
 for(const p of [...s.davidTemple.approach,{x:41,z:84,y:0}])a(!f.trees.some(o=>k(o)===k(p)));
});
test('weather covers the real woods, leaves a readable short corridor and clears at temple, other towns and other floors',()=>{
 const c=vm.createContext({});
 vm.runInContext(cut('// BEGIN SACRED FOREST LOCAL','// END SACRED FOREST LOCAL'),c);
 const levels=[[13,77],[13,99],[18,109]].map(([x,z])=>c.poiSacredFogStrength(s,x,z,0));
 a(levels[0]>.03&&levels[0]<.12);a(levels[1]>.6&&levels[1]<.9);a(levels[2]>.96);
 for(const [x,z,y] of [[24,128,0],[24,143,0],[12,66,0],[17,82,-1],[24,49,0],[89,117,0],[110,24,0]])a.equal(c.poiSacredFogStrength(s,x,z,y),0,[x,z,y]);
 a(c.poiSacredFogStrength(s,13,69,0)===0);
 a.match(h,/smoothstep\(5\.1,25\.5,length\(vLootXZ-uSacredFog\.xy\)\)/);
 a.match(h,/gl\.clearColor\(c\[0\]\*fog,c\[1\]\*fog,c\[2\]\*fog,fog\)/);
});
test('real new trunks use bounded cheap geometry, affect only their own obstructed old saves',()=>{
 const world=w.slice(),c=vm.createContext({facilitySite:s,world,poiWalkLevel:-1,terrainY:()=>0,
  tri:(m,p,q,r)=>m.p.push(...p,...q,...r),quad:(m,p,q,r,t)=>m.p.push(...p,...q,...r,...p,...r,...t),
  poiWalkCanStep(x,z){return !f.trees.some(o=>o.x===x&&o.z===z)}});
 vm.runInContext(cut('// BEGIN SACRED FOREST LOCAL','// END SACRED FOREST LOCAL'),c);
 const m={p:[]};for(const o of f.trees)c.poiSacredTreeGeometry(m,o);
 a(m.p.length/3<=96*180&&m.p.length>15000,'full-map geometry is hard bounded');a(m.p.every(Number.isFinite));
 const save={x:f.trees[10].x,z:f.trees[10].z,y:0,facing:3},fixed=c.poiSacredRecoverPosition(save);
 a.equal(Math.abs(fixed.x-save.x)+Math.abs(fixed.z-save.z),1);
 a.equal(fixed.y,0);a.equal(fixed.facing,3);a.equal(c.poiWalkLevel,-1);
 const old={x:29,z:88,y:0,facing:2};a.equal(c.poiSacredRecoverPosition(old),old);
 world.splice(world.findIndex(o=>k(o)===k(save)),1);a.equal(c.poiSacredRecoverPosition(save),save,'if tree removed, preserve save origin');
});
