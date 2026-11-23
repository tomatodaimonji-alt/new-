const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.argv[2]||process.env.HTML||'world-editor.html','utf8');
const cut=(l,r)=>{const i=html.indexOf(l),j=html.indexOf(r,i+l.length);a(i>=0&&j>i,l);return html.slice(i,j)};
function mesh(){
 const source="const m={p:[],n:[],c:[]};"+cut('function tri(m,','function cube(m,')+
  cut('// BEGIN LONG HARDWOOD STAFF ART','// END LONG HARDWOOD STAFF ART')+";poiLongWoodStaffGeometry(m,0,0,0);m";
 return vm.runInNewContext(source);
}
const vertices=(m)=>Array.from({length:m.p.length/3},(_,i)=>m.p.slice(i*3,i*3+3));
function bounds(points){
 a(points.length>0);
 return [0,1,2].map(n=>[Math.min(...points.map(p=>p[n])),Math.max(...points.map(p=>p[n]))]);
}
test('shared staff model is a thick gently crooked wooden branch with the old 2.18 contact height',()=>{
 const m=mesh(),p=vertices(m),b=bounds(p);
 a(m.p.length===m.n.length&&m.p.length===m.c.length&&m.p.length/3<1300);
 a(m.p.concat(m.n,m.c).every(Number.isFinite));
 a(Math.abs(b[1][1]-2.18)<1e-8&&b[1][0]>=0);
 a(b[0][1]-b[0][0]>.38,'gently bends across its thickness');
 a(b[2][1]-b[2][0]>.29,'model is genuinely 3D');
 for(const y of [.34,.64]){
  const p2=p.filter(v=>Math.abs(v[1]-y)<1e-6),[[lo,hi]]=bounds(p2);
  a(hi-lo>.18&&hi-lo<.27&&Math.abs((lo+hi)/2)<.027,'centered grip, visibly wider than old .122');
 }
 const top=p.filter(v=>Math.abs(v[1]-2.18)<1e-8);
 a(top.every(q=>Math.abs(q[0]+.016)<.001&&Math.abs(q[2]-.02)<.001),'preserve leading attack apex');
 a.match(html,/id==='equipLongStaff'\)\{\s*poiLongWoodStaffGeometry\(m,x,y,z\);/);
});
test('material palettes remain woody and grain gives contrast at miniature size',()=>{
 const m=mesh(),cs=Array.from({length:m.c.length/3},(_,i)=>m.c.slice(i*3,i*3+3));
 a(cs.every(([r,g,b])=>r>g&&g>b&&r<1));
 a(Math.max(...cs.map(c=>c[0]))-Math.min(...cs.map(c=>c[0]))>.28);
 a(new Set(cs.map(c=>c.map(v=>v.toFixed(3)).join(','))).size>=7);
});
