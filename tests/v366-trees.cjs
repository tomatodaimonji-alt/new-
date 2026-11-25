const fs=require('fs'),a=require('node:assert/strict'),vm=require('vm');
const s=fs.readFileSync(process.argv[2]||'workshop-frontier-v365/candidate.html','utf8');
const start=s.indexOf('function pineDrawFrontierTree(');
a.ok(start>=0,'frontier-specific geometry is missing');
const end=s.indexOf('function pineDrawEastNature(',start);
let y=3;
const triangle=(m,...p)=>m.p.push(...p.slice(0,3).flat());
const quad=(m,a,b,c,d,col)=>{triangle(m,a,b,c,col);triangle(m,a,c,d,col)};
const ctx=vm.createContext({facilitySite:{id:'frontier'},frontierSampleHeight:(x,z)=>y,tri:triangle,quad,surfaceNoise:(x,z)=>(Math.sin(x*40.2+z*19.3)+1)/2});
const draw=vm.runInContext(s.slice(start,end)+'\npineDrawFrontierTree',ctx);
const shapes=[];
for(const type of ['treeBirch','treePine','treeCedar']){
 const o={type,x:29,z:14,y:0,rot:2},m={p:[]},n={p:[]};
 a.equal(draw(m,o),true);a.equal(draw(n,o),true);a.deepEqual(m.p,n.p);
 const h=m.p.filter((_,i)=>i%3===1);
 a.ok(Math.min(...h)<=y&&Math.min(...h)>=y-.22);
 a.ok(Math.max(...h)-y>=4.4);
 a.ok(m.p.length/3<=420);
 shapes.push(m.p.length+':'+Math.max(...h));
}
a.equal(new Set(shapes).size,3);
a.equal(draw({p:[]},{type:'treeOak',x:29,z:14,y:0}),false);
ctx.facilitySite={id:'base'};const old={p:[]};
a.equal(draw(old,{type:'treeBirch',x:29,z:14,y:0}),false);a.equal(old.p.length,0);
a.ok(s.includes('!pineDrawFrontierTree(m,o)&&!pineDrawBaseTree'));
