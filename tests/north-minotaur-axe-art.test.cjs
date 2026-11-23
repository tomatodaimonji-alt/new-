const fs=require('node:fs'),a=require('node:assert/strict'),vm=require('node:vm'),{test}=require('node:test');
const h=fs.readFileSync(process.argv[2]||process.env.HTML||'world-editor.html','utf8');
const cut=(l,r)=>{const i=h.indexOf(l),j=h.indexOf(r,i+l.length);a(i>=0&&j>i,l);return h.slice(i,j)};
function model(){
 const js='const m={p:[],n:[],c:[]};'+cut('function tri(m,','function addPart(m,')+
 cut('function naturalBranch(m,','function naturalCrown(m,')+
 cut('// BEGIN NORTH MINOTAUR REWARD AXE','// END NORTH MINOTAUR REWARD AXE')+
 ';poiNorthMinotaurAxeGeometry(m,0,0,0);m';
 return vm.runInNewContext(js);
}
const vertices=(m)=>Array.from({length:m.p.length/3},(_,i)=>({p:m.p.slice(i*3,i*3+3),rgb:m.c.slice(i*3,i*3+3)}));
const steel=(v)=>v.rgb[2]>v.rgb[0]&&v.rgb[1]>v.rgb[0];
const extent=(ps,axis)=>Math.max(...ps.map(v=>v.p[axis]))-Math.min(...ps.map(v=>v.p[axis]));
test('worn broad steel head and visibly long haft share one bounded production mesh',()=>{
 const m=model(),v=vertices(m),blade=v.filter(steel),haft=v.filter(x=>!steel(x));
 a.equal(m.p.length,m.n.length);a.equal(m.p.length,m.c.length);
 a(v.length>250&&v.length<=1250&&m.p.concat(m.n,m.c).every(Number.isFinite));
 a(extent(v,1)>2.68&&extent(blade,0)>.72&&extent(blade,2)>.13);
 a(haft.some(v=>v.p[1]<.07)&&haft.some(v=>v.p[1]>2.45));
 a(haft.some(v=>Math.abs(v.p[1]-.64)<.01&&Math.hypot(v.p[0],v.p[2])<.10));
});
test('attack key samples the actual sharpened steel crest; boss art is unchanged',()=>{
 const vs=vertices(model()),p=vs.reduce((a,b)=>b.p[1]>a.p[1]?b:a);
 a(steel(p)&&p.rgb[0]>=.65,'leading vertex is sharpened steel not shaft or attachment');
 const [x,y,z]=p.p;a(Math.abs(x-.4661)<1e-8&&Math.abs(y-2.82886)<1e-8&&Math.abs(z)<1e-8);
 a.match(h,/case 'equipNorthMinotaurAxe':\s*poiNorthMinotaurAxeGeometry\(m,x,y,z\);break/);
 a.match(h,/const shape=\[\[-\.12,\.04\],\[\.18,\.155\],\[\.395,\.177\],\[\.521,\.036\],\[\.536,-\.181\],\[\.465,-\.365\]/);
});
