const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(process.env.WORLD_HTML||'world-editor.html','utf8');
const cut=(a,b)=>{const x=src.indexOf(a),y=src.indexOf(b,x+1);assert.ok(y>x);return src.slice(x,y)};
const c=vm.createContext({});
vm.runInContext(cut('function tri(m,a,b,c,col){','function rot2(x,z,r)')+cut('// BEGIN STONE DAVID VISUAL','// END STONE DAVID VISUAL'),c);
const mesh=(phase,progress,kind='beam')=>JSON.parse(vm.runInContext(`(()=>{const m={p:[],n:[],c:[]};const rig=poiDavidGeometry(m,0,0,0,${JSON.stringify({phase,progress,kind})});return JSON.stringify({m,rig})})()`,c));
const eyeR=frame=>Math.max(...frame.m.c.filter((_,i)=>i%3===0&&frame.m.p[i+1]>4.72&&frame.m.p[i+1]<4.78&&frame.m.p[i+2]>.276));
test('real eye mesh ramps red progressively before first beam; adjacent brow receives restrained local spill',()=>{
 const samples=[0,.20,.42,.65,.86,1].map(t=>mesh('windup',t));
 const red=samples.map(eyeR);
 assert.ok(red.every((n,i)=>i===0||n>red[i-1]),red.join(','));
 assert.ok(red[0]<.93&&red.at(-1)>1.75,red.join(','));
 const [start,finish]=[samples[0],samples.at(-1)];
 assert.equal(start.m.p.length,finish.m.p.length,'no change to draw budget');
 const face=f=>f.m.p.flatMap((x,i)=>i%3===0&&Math.abs(x)<.58&&f.m.p[i+1]>4.4&&f.m.p[i+1]<5.2&&Math.abs(f.m.p[i+2])<.42?[...f.m.p.slice(i,i+3)]:[]);
 assert.deepEqual(face(start),face(finish),'carved face geometry stays fixed');
 const tint=start.m.c.reduce((a,v,i)=>(i%3===0&&finish.m.c[i]>v+.07?a.concat(i):a),[]);
 assert.ok(tint.length>12&&tint.length<=42,'eye and existing nearby carved stone only');
 assert.ok(tint.every(i=>finish.m.p[i+1]>=4.60&&finish.m.p[i+1]<=4.855));
 assert.ok(finish.m.p.length<=6900);
});
test('sustained and sweep beams do not strobe; recovery fades and other actions preserve original colors',()=>{
 const hit=eyeR(mesh('impact',0));
 for(const phase of ['beam-hold','beam-tell','beam-sweep'])assert.equal(eyeR(mesh(phase,.9)),hit);
 assert.ok(eyeR(mesh('recover',.42))<hit);assert.equal(eyeR(mesh('recover',1)),1);
 for(const phase of ['ready','return','windup','impact','recover'])assert.equal(eyeR(mesh(phase,.95,phase==='ready'||phase==='return'?null:'stomp')),1);
 assert.ok(eyeR(mesh('dormant',1,null))<.9);
});
