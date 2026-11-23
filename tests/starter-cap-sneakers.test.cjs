const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const line=(start,end)=>h.slice(h.indexOf(start),h.indexOf(end,h.indexOf(start)));
const meshSource=line('function tri(','function cube(')+h.match(/^function cube\([^]*?^}/m)[0]+line('function poiStarterGearGeometry(','// Expansion assets:');
const draw=vm.runInNewContext(meshSource+';poiStarterGearGeometry');
const points=id=>{const m={p:[],n:[],c:[]},v=[];draw(m,id,0,0,0);
 for(let i=0;i<m.p.length;i+=3)v.push([...m.p.slice(i,i+3),...m.c.slice(i,i+3)]);
 assert(m.p.length>0&&m.p.length<=9*145&&m.p.every(Number.isFinite));return v;
};
test('cap really has a short forward-projecting visor, not a symmetrical travel hat',()=>{
 const v=points('starterCap'),front=v.filter(p=>p[2]>.265);
 assert(front.length>0);
 assert(front.every(p=>p[1]<1.40),'only the brim projects forward');
 assert(v.filter(p=>p[1]>1.49).length>0,'raised crown');
 assert(Math.min(...v.map(p=>p[2]))>-.235,'no rear brim');
});
test('sneakers sit low with two pale soles and cloth laces',()=>{
 const v=points('starterBoots'),light=p=>p[3]>.65&&p[4]>.65&&p[5]>.59;
 assert(Math.max(...v.map(p=>p[1]))<=.133,'low shoe clears original trouser cuff');
 for(const sign of [-1,1]){
  const shoe=v.filter(p=>p[0]*sign>.025);
  assert(shoe.some(p=>p[1]<.04&&light(p)),'light sole');
  assert(shoe.some(p=>p[1]>.09&&p[2]>.032&&light(p)),'light laces');
  assert(shoe.some(p=>p[2]>.168),'shaped toe projects ahead');
 }
});
