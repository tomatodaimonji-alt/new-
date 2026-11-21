const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const frag=(a,b)=>{const x=html.indexOf(a),y=html.indexOf(b,x+a.length);assert(x>=0&&y>x,a);return html.slice(x,y)};
const geom=frag('function tri(','function addPart(')+
 frag('const WALL_MATERIAL_IDS=','const MATCHED_OPENING_IDS=')+
 frag('function surfaceNoise(','const ROAD_BASES=')+
 frag('function pineDrawTownGuildFloor(','function makeScene(');
const code=vm.runInNewContext(geom+';({wallBlock,pineTownGuildRelief,pineDrawTownGuildFloor})');
const mesh=()=>({p:[],n:[],c:[]});
test('single visible guild wall skips hidden masonry without changing dimensions or adding geometry outside',()=>{
 for(const [mat,max] of [['stonewall',48],['woodwall',96]]){
  const dense=mesh(),light=mesh(),onlyFront=[true,false,false,false];
  code.wallBlock(dense,mat,0,0,0,0,onlyFront,onlyFront);
  code.wallBlock(light,mat,0,0,0,0,onlyFront,onlyFront,true);
  assert(light.p.length<=max*9,mat+' detail budget');
  assert(light.p.length<dense.p.length*.30,mat+' at least 70% fewer triangles');
  for(let i=0;i<light.p.length;i+=3){
   const [x,y,z]=light.p.slice(i,i+3);
   assert(Math.abs(x)<=.52&&y>=0&&y<=1.41);
   assert(y===1.4||z>=.501,mat+' no relief emitted on the three hidden directions');
  }
 }
});
test('scoped face relief preserves rotated outward normals and legacy tonal shading',()=>{
 const cols=[.5,.6,.7],tones=[1,.88,.72,.83],dirs=[[0,0,1],[-1,0,0],[0,0,-1],[1,0,0]];
 for(let d=0;d<4;d++){
  const m=mesh();code.pineTownGuildRelief(m,0,0,0,d,0,.2,.4,.53,cols);
  assert.equal(m.p.length,18);
  assert(m.n.slice(0,3).every((n,i)=>Math.abs(n-dirs[d][i])<1e-10));
  assert(m.c.slice(0,3).every((c,i)=>Math.abs(c-cols[i]*tones[d])<1e-10));
 }
});
test('guild board mesh retains the authored height/material variation and shapes at 14 triangles per tile',()=>{
 const means=[];
 for(const material of ['woodfloorDark','woodfloor','woodfloorLight']){
  const m=mesh();code.pineDrawTownGuildFloor(m,0,0,material);
  assert.equal(m.p.length/9,14);
  assert(m.p.every((v,i)=>i%3!==1||v===0||v===.13));
  assert(m.c.every(v=>v>=.02&&v<=1));
  means.push(m.c.reduce((a,b)=>a+b,0)/m.c.length);
 }
 assert(means[0]<means[1]&&means[1]<means[2]);
});
