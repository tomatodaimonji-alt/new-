const a=require('node:assert/strict'),h=require('node:fs').readFileSync(process.argv[2],'utf8');
const begin=h.indexOf('// BEGIN WORLD PLAYER SPEAR'),end=h.indexOf('function poiBuildWorldSpear(',begin);
const f=new Function(h.slice(begin,end)+`return {line:poiWorldSpearLine,pose:poiWorldSpearPose,length:POI_WORLD_SPEAR_LENGTH};`)();
const range=Number(h.match(/equipWoodSpear:\{range:([.\d]+)/)[1]);a(range>3,'wooden spear needs longer reach');
for(const t of [0,140,240,330,410]){
 const p=f.pose({range,hit:240,pose:410},t),g={x:.18,y:.53,z:.13};
 const q=f.line(p,g);a(Math.abs(Math.hypot(...q.tip.map((v,i)=>v-q.rear[i]))-f.length)<1e-9,'fixed physical length');
 if(t===240){
  a.equal(q.tip[2],range,'fully extended tip agrees with the gameplay radius');
  const wall=f.line({...p,spearVisual:{originX:0,originZ:0,dx:0,dz:1,reach:2.2}},g);
  a.equal(wall.tip[2],2.2,'wall truncates the reach without changing shaft length');
 }
}
console.log('PASS rigid longer spear, matching full extension and wall limit');
