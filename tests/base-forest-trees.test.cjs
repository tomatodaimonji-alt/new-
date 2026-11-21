const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const block=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i+1);assert(i>=0&&j>i,'missing '+a);return html.slice(i,j)};
const ids=['treeBirch','treeOak','treePine','treeCedar','treeWillow'];
const scope={facilitySite:{id:'base'},terrainY:()=>.4};
vm.createContext(scope);
vm.runInContext(block('function tri(','function addPart(')+block('function naturalBranch(','function naturalCrown(')+
 block('function surfaceNoise(','function roadConnections(')+block('const PINE_BASE_TREE_PROFILES=','function pineDrawEastNature('),scope);
const make=()=>({p:[],n:[],c:[]});
const draw=(type,x=73,z=34)=>{const m=make();assert.equal(scope.pineDrawBaseTree(m,{x,z,y:0,type,rot:0}),true);return m};
test('five base plants have stable distinct geometry, grounded roots and bounded detailed canopy',()=>{
 const hash=new Set();
 for(const id of ids){
  const m=draw(id),p=m.p,c=m.c,y=p.filter((v,i)=>i%3===1),triangles=p.length/9;
  assert.equal(m.n.length,p.length);assert.equal(c.length,p.length);
  assert(triangles>=130&&triangles<=350,[id,triangles]);
  assert(y.every(Number.isFinite)&&m.n.every(Number.isFinite)&&c.every(v=>v>=0&&v<=1));
  assert.equal(Math.min(...y),.4);assert(Math.max(...y)>.4+2.15,id);
  const foot=new Set(p.filter((v,i)=>i%3===0&&p[i+1]<.51).map(v=>v.toFixed(3)));
  assert(foot.size>=8,id+' has a splayed root and faceted ground junction');
  assert.equal(new Set(c.filter((v,i)=>i%3===1).map(v=>v.toFixed(3))).size>13,true,id+' has varied leaf and bark tone');
  assert.deepEqual(m,draw(id),id+' is coordinate deterministic');
  assert.notDeepEqual(m.c,draw(id,75,36).c,id+' naturally varies by tree');
  hash.add(JSON.stringify(y.map(v=>v.toFixed(2))));
 }
 assert.equal(hash.size,ids.length);
});
test('tree appearance upgrade leaves non-base, raised and unsupported asset IDs alone',()=>{
 for(const [site,o] of [[{id:'base'},{y:1,type:'treeOak'}],[{id:'base'},{y:0,type:'treeRound'}],
  [{id:'workshop'},{y:0,type:'treePine'}],[null,{y:0,type:'treeBirch'}]]){
  scope.facilitySite=site;const m=make();
  assert.equal(scope.pineDrawBaseTree(m,{x:73,z:34,rot:0,...o}),false);assert.equal(m.p.length,0);
 }
});
test('cedar packs at least six overlapping whorls, with pine higher and broader',()=>{
 scope.facilitySite={id:'base'};
 const profile=(id)=>{
  const m=draw(id),ring=[],faces=[];
  for(let i=0;i<m.p.length;i+=3)if(m.c[i+1]-m.c[i]>.075)
   ring.push([m.p[i+1]-.4,Math.hypot(m.p[i]-73.5,m.p[i+2]-34.5)]);
  const max=Math.max(...ring.map(p=>p[0])),min=Math.min(...ring.map(p=>p[0]));
  for(let i=0;i<m.p.length;i+=9)if(m.c[i+1]-m.c[i]>.075){
   const ys=[1,4,7].map(k=>m.p[i+k]-.4);
   const rs=[0,3,6].map(k=>Math.hypot(m.p[i+k]-73.5,m.p[i+k+2]-34.5));
   if(Math.min(...rs)<.54&&Math.max(...rs)>.14)faces.push([Math.min(...ys),Math.max(...ys)]);
  }
  return {ring,max,min,faces};
 };
 const c=profile('treeCedar'),p=profile('treePine');
 assert(c.min<p.min+.04);
 const widest=o=>Math.max(...o.ring.map(p=>p[1]));
 assert(widest(p)>widest(c)+.08);
 assert(c.ring.length>p.ring.length,'cedar has an extra whorl');
 for(const [id,{faces,max,min}] of [['cedar',c],['pine',p]]){
  for(let y=min+.34;y<max-.20;y+=.10)
   assert(faces.some(([a,b])=>y>=a-.045&&y<=b+.045),id+' has a continuous inner crown at '+y.toFixed(2));
 }
});
