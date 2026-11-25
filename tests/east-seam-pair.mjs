import a from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
const work=process.env.SEAM_ART??mkdtempSync(tmpdir()+'/east-pair-'),lane=fileURLToPath(new URL('./east-seam-lane.mjs',import.meta.url));
const runs={};
for(const [i,name] of ['old','next'].entries()){
 const p=spawnSync(process.execPath,[lane,process.argv[i+2]],{env:{...process.env,SEAM_ART:work+'/'+name,SEAM_COMPACT:String(i)},stdio:'inherit'});
 a.equal(p.status,0,name+': app fixture did not reach sample');
 if(!process.env.ATLAS_PARSE_ONLY)runs[name]=JSON.parse(readFileSync(work+'/'+name+'/evidence.json','utf8'));
}
if(process.env.ATLAS_PARSE_ONLY)process.exit(0);
writeFileSync(work+'/paired.json',JSON.stringify(runs,null,2));
const {old,next}=runs;
const key=o=>o.world.join(','),
 collect=(s,g,r)=>new Set(s.baseProjected.filter(p=>!r||p.role===r).flatMap(p=>p[g]).filter(o=>o.d<48&&o.screen).map(key)),
 tally=(s,q,g,r)=>[...collect(q,g,r)].filter(k=>collect(s,g,r).has(k)).length;
const oldSnow=old['snow-before'],base=next['base-settled'];
a(oldSnow.raster.waterSamples>=2&&collect(oldSnow,'trees').size>=3,'HOLD: no actual coast/canopy witness at sampled Snow pose');
a.equal(collect(old['base-settled'],'trees').size,0,'HOLD: original persistent discrepancy absent');
const phases=['snow-before','base-settled','snow-return-settled'];
const oldPhases=phases.map(k=>old[k]).concat(old.first),newPhases=phases.map(k=>next[k]).concat(next.first);
const checks=[];
for(let i=0;i<oldPhases.length;i++){
 const o=oldPhases[i],n=newPhases[i];
 a.deepEqual(n.foot,o.foot);a.deepEqual([n.yaw,n.pitch,n.dist],[o.yaw,o.pitch,o.dist]);
 const oldKeys=new Set(n.handles.map(([k])=>k));
 const missingOriginal=o.handles.filter(([k])=>!oldKeys.has(k)).map(([k])=>k);
 // A legacy parcel can bake one frame earlier on another workload. Comparison
 // of fixed steady sets is strict; first-frame equivalent checks require all
 // preexisting support and allow only legitimate asynchronous cache absence.
 if(i<3)a.deepEqual(missingOriginal,[],'HOLD: legacy lost at '+phases[i]);
 a(o.detailed.every(k=>n.detailed.includes(k)),'HOLD: original terrain support no longer submitted after matching crossing');
 for(const family of ['trees','water']){
  a(tally(n,o,family,'original')===collect(o,family,'original').size,'HOLD: original submitted role lost '+family);
 }
 if(i<3){
  const g=n.raster.guard;
  a(g?.state&&g.owners&&g.support&&g.lost===0,'HOLD: attributes or original terrain path changed');
 }
 checks.push({realm:n.realm,packed:n.packed,frames:n.warmFrames,ms:n.warmMs,tree:collect(n,'trees').size,water:collect(n,'water').size,
  raster:n.raster,missingOriginal});
}
for(const s of [base,...next.first]){
 for(const family of ['trees','water']){
  const before=collect(oldSnow,family),after=collect(s,family);
  // Require actual most visible sample through one tile of normal travel;
  // this is still a scoped corridor, never broader map parity.
  a([...before].filter(v=>after.has(v)).length>=Math.ceil(before.size*.8),'HOLD: real world-space role discontinuity '+s.realm+'/'+family);
 }
}
a(base.raster.waterSamples>=10,'HOLD: no actual retained water RGB in Base raster');
const held=new Map(next['snow-before'].compactHandles),toBase=new Map(next.first[0].compactHandles),back=new Map(next.first[1].compactHandles);
a([...held].some(([k,tag])=>toBase.get(k)===tag&&back.get(k)===tag),'HOLD: no actual compact buffer identity survived both boundaries');
console.log('paired east seam',JSON.stringify(checks));
