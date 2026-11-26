const assert=require('node:assert/strict'), fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.argv[2],'utf8');
for(const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
function fn(name){
 const a=html.indexOf('function '+name+'(');
 assert.ok(a>=0,name);
 return html.slice(a,html.indexOf('\n}',a)+2);
}
const c=vm.createContext({});
vm.runInContext(['frontierSmooth','frontierRefineGroundTile','frontierMeadowNoise','frontierMeadowPaint'].map(fn).join('\n'),c);
const r=vm.runInContext(`(()=>{
 const t={p:[64,0,30,64,0,31,65,0,31,64,0,30,65,0,31,65,0,30],c:new Array(18).fill(.25),n:new Array(18).fill(1)};
 const tint=(x,z)=>[.25+.1*Math.sin(Math.PI*z)**2,.25,.25];
 frontierRefineGroundTile(t,tint,(x,z)=>x!==64);
 const points=t.p.map((v,i)=>i%3===0?[v,t.p[i+1],t.p[i+2],t.c[i]]:null).filter(Boolean);
 const road=Array.from({length:17},(_,i)=>frontierMeadowPaint(123+i/8,30.5,0,1,0,.3));
 return {inner:points.filter(([x,y,z])=>x===65&&y===0&&z===30.5),seam:points.filter(([x,y,z])=>x===64&&y===0&&z===30.5),road};
})()`,c);
assert.ok(r.inner.length && r.inner.every(p=>Math.abs(p[3]-.35)<1e-9),'road edges need a shared half-tile sample to erase big triangular smears');
assert.ok(r.seam.length && r.seam.every(p=>p[3]===.25),'unsplit neighbours retain the original linear colour');
assert.ok(r.road.every(p=>p[0]>p[1]&&p[1]>p[2]),'readable earth colour');
console.log('Road refinement, matching at tile edges, and earth palette pass');
