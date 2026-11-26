const a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(process.argv[2],'utf8');
const code=['frontierSmooth','frontierBurrowFloor','frontierBurrowRise','frontierBurrowRoofY','frontierBurrowGeometry'].map(name=>{
 const x=source.indexOf('function '+name+'('),y=source.indexOf('\n}',x),e=source.indexOf('\n',x);
 return source.slice(x,source[e-1]==='}'?e:y+2);
}).join('\n');
const walls=[];
vm.runInNewContext(code+'\nfrontierBurrowGeometry()',{
 mesh:()=>({}),quad:(m,...q)=>walls.push(q.slice(0,4)),surfaceNoise:()=>.5,frontierHeight:()=>1.75,
 naturalBranch:()=>{},cube:()=>{}
});
const at=(y,z)=>walls.some(q=>q.every(p=>Math.abs(p[0]-25)<1e-8)&&q.some(p=>p[1]<y)&&q.some(p=>p[1]>y)&&q.some(p=>p[2]<z)&&q.some(p=>p[2]>z));
for(const z of [26.98,32.02])for(const y of [-3,-2,-1.3])a.ok(at(y,z),'portal has a hole at '+[y,z]);
for(const y of [-3,-2,-1.3])a.equal(at(y,29.5),false,'passage stays open down the middle');
console.log('both open side seams are backed; the ramp and center sight line remain open');
