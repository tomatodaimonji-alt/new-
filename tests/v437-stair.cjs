const a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const h=fs.readFileSync(process.argv[2]||path.join(__dirname,'stair-well-candidate.html'),'utf8');
for(const hit of h.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(hit[1]);
const from=h.indexOf('// BEGIN FRONTIER SOUTH RUINS'),to=h.indexOf('let frontierSouthStairGpu=',from);
const context=vm.createContext({mesh:()=>({p:[],c:[],n:[]}),cube:(m,...v)=>m.push(v),
  quad:(m,...v)=>m.p.push(...v.slice(0,4).flat())});
vm.runInContext(h.slice(from,to)+`;globalThis.api={
 stair:frontierSouthStairArt,lamps:frontierSouthLanternMounts,ramp:frontierSouthRampHeight,
 slope:frontierSouthSlopeLevel,ceiling:frontierSouthCeilingMesh,
}`,context);
const f=context.api,m=[];f.stair(m);a.equal(m.length,60);
a.ok(m.every(([,y,, ,height])=>y+height<=.0060000001));
const steps=m.filter(([x,y,z,w])=>w===4);
a.equal(steps.length,20);
for(let i=0;i<20;i++){
 const [x,y,z,w,hh,d]=steps[i];
 a.equal(x,161);a.equal(z,76+(i+.5)*.25);a.ok(Math.abs(y+hh-f.ramp(x,z))<1e-9);
}
for(const side of [159,163]){
 const wall=m.filter(([x,y,z,w])=>w===.16&&Math.abs(x-side)<.081);
 a.equal(wall.length,20);a.ok(wall.every(([x,y,z,w,hh])=>Math.abs(y+hh-.006)<1e-8));
 const lamp=f.lamps().find(m=>m.stair&&m.x===side);
 a.ok(lamp);a.ok(lamp.y+.32<0);
 a.ok(wall.some(([x,y,z,w,hh,d])=>Math.abs(lamp.z-z)<d*.5&&lamp.y>y&&lamp.y<y+hh));
}
a.equal(f.slope(160,79,160,78,0),-1);a.equal(f.slope(160,78,160,79,-1),0);
const preview=f.ceiling(true).p.filter((_,i)=>i%3===1),full=f.ceiling().p.filter((_,i)=>i%3===1);
a.ok(preview.length>0&&full.length>preview.length);a.ok(preview.every(y=>y<=.00500001));a.ok(full.some(y=>y>=3.5));
console.log('PASS ramp stops at flush slab, no raised stair mesh, lanterns still wall-mounted below grade, uninterrupted movement, capped upper view');
