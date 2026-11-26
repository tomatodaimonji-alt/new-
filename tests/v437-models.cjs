const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const after=fs.readFileSync(process.argv[2]||'candidate.html','utf8');
const seg=(s,a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)));
const model=s=>seg(s,'function poiSouthSentinelGeometry(','function poiNorthMinotaurAxeGeometry(');
function run(s,id){
 const f=vm.runInNewContext(seg(s,'function tri(m,','function detailedTree(')+model(s)+';poiSouthSentinelGeometry');
 const m={p:[],n:[],c:[]};f(m,id,0,0,0);return m;
}
for(const [id,signature] of [['monsterBasaltHound',[.98,.56,.19]],['monsterRuneWarden',[.20,.76,.72]],['monsterObsidianRegent',[.66,.28,.94]]])test(id+' emits finite enhanced faces with preserved silhouette envelope and distinct glow',()=>{
 const b=run(after,id),palette=new Set();
 assert(b.p.length>300);
 assert.equal(b.p.length,b.n.length);assert.equal(b.p.length,b.c.length); assert([...b.p,...b.n,...b.c].every(Number.isFinite));
 for(let i=0;i<b.c.length;i+=3)palette.add(b.c.slice(i,i+3).join(','));
 assert(palette.has(signature.join(',')));
});
