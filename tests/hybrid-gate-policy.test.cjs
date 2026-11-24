const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const load=()=>{
 const i=h.indexOf('// BEGIN HYBRID GATE POLICY'),j=h.indexOf('// END HYBRID GATE POLICY');
 assert(i>=0&&j>i,'provide a real shared gate tier');
 const c=vm.createContext({});vm.runInContext(h.slice(i,j),c);return c;
};
test('opaque near, simplified middle, real far through 45 and smooth fade to 48; no camera input',()=>{
 const c=load();
 for(const [d,w] of [[0,[1,0,0]],[18,[1,0,0]],[21,[.5,.5,0]],[24,[0,1,0]],[30,[0,1,0]],[36,[0,.5,.5]],
  [42,[0,0,1]],[45,[0,0,1]],[46.5,[0,0,.5]],[48,[0,0,0]],[99,[0,0,0]]])
  assert.deepEqual(Array.from(c.poiHybridGateWeights(84,67,84+d,67)),w);
});
test('skips only exact ready gate ranges; unstaged geometry and adjacent window preserve exact existing vertices',()=>{
 const c=load(),out=[];
 c.poiHybridGateClip([[3,6,'gateA'],[10,13,'gateB']],0,20,new Set(['gateB']),(a,b)=>out.push([a,b]));
 assert.deepEqual(out,[[0,10],[13,20]]);
});
test('untouched detailed built-in gate while medium and far use fewer vertices but preserve outer envelope',()=>{
 const old=fs.readFileSync(process.env.BASE_HTML||'exact-public-v320.html','utf8');
 const set=(s)=>{const a=s.indexOf('function poiFortGeometry('),b=s.indexOf('function poiCanalQuayGeometry(',a);assert(b>a);return s.slice(a,b)};
 const run=s=>{const c=vm.createContext({rot2:(x,z)=>[x,z],
  cube:(m,x,y,z,w,h,d,c)=>m.push([x-w/2,y,z-d/2,c],[x+w/2,y+h,z+d/2,c]),
  quad:(m,a,b,c,d,e)=>m.push([...a,e],[...b,e],[...c,e],[...d,e])});
  vm.runInContext(set(s),c);return c.poiFortGeometry;};
 const base=run(old),f=run(h),sample=(fn,type,lod)=>{const out=[];out.p=[];fn(out,type,84.5,0,67.5,0,lod);return out};
 const gate='poiFortGate',near=sample(f,gate,0),med=sample(f,gate,1),far=sample(f,gate,2);
 assert.deepEqual(JSON.stringify(near),JSON.stringify(sample(base,gate,0)));
 assert.deepEqual(JSON.stringify(sample(f,'poiFortWall',0)),JSON.stringify(sample(base,'poiFortWall',0)));
 assert(near.length>med.length&&med.length>far.length);
 for(const shape of [med,far])for(let k=0;k<3;k++){
  const bounds=shape=>[Math.min(...shape.map(x=>x[k])),Math.max(...shape.map(x=>x[k]))];
  assert.deepEqual(bounds(shape),bounds(near));
 }
});
