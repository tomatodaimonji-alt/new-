const fs=require('fs'),a=require('node:assert/strict'),vm=require('vm');
const source=fs.readFileSync(process.argv[2]||'workshop-frontier-v366/candidate.html','utf8');
const cut=source.slice(source.indexOf('function pineDrawFrontierTree('),source.indexOf('function pineDrawEastNature('));
const tri=(m,a,b,c,col)=>m.push([a,b,c,col]);
const quad=(m,a,b,c,d,col)=>{tri(m,a,b,c,col);tri(m,a,c,d,col)};
const context=vm.createContext({tri,quad,facilitySite:{id:'frontier'},frontierSampleHeight:(x,z)=>2+.12*(x-22.5),surfaceNoise:(x,z)=>(Math.sin(x*40.2+z*19.3)+1)/2});
const draw=vm.runInContext(cut+'\npineDrawFrontierTree',context);
const data={};
for (const type of ['treeBirch','treePine','treeCedar']){
 const o={type,x:22,z:19,y:0,rot:0},m=[],q=[];
 a.equal(draw(m,o),true);a.equal(draw(q,o),true);a.deepEqual(m,q);
 const height=Math.max(...m.flatMap(t=>t.slice(0,3).map(p=>p[1])))-2;
 a.ok(height>4.3&&height<6.6);a.ok(m.length*3<=420);
 for(const t of m)for(const p of t.slice(0,3))a.ok(p[1]+.12>=context.frontierSampleHeight(p[0],p[2])-1e-9);
 data[type]=m;
}
const leaves=m=>m.filter(t=>t[3][1]>t[3][0]&&t[3][1]>t[3][2]);
function span(m,axis){const p=m.flatMap(t=>t.slice(0,3).map(v=>v[axis]));return Math.max(...p)-Math.min(...p)}
const birch=leaves(data.treeBirch),pine=leaves(data.treePine),cedar=leaves(data.treeCedar);
a.ok(span(birch,0)>2.8&&span(birch,2)>2.8,'birch broad spreading canopy');
a.ok(span(pine,0)>span(cedar,0)*1.38,'pine branches extend across a much wider canopy than cedar');
a.ok(span(cedar,1)>span(pine,1)*1.6,'cedar has a much deeper needle crown than the layered horizontal pine');
a.ok(Math.min(...birch.map(t=>t[3][0]))>Math.min(...cedar.map(t=>t[3][0]))*1.5,'distinct green/gold and cool dark palettes');
context.facilitySite={id:'base'};const old=[];a.equal(draw(old,{type:'treeBirch',x:2,z:2,y:0}),false);a.deepEqual(old,[]);
if(process.argv[3])fs.writeFileSync(process.argv[3],JSON.stringify(data));
console.log('3 deterministic species, physical local roots, orthogonal silhouette contrasts, 420 vertices max; old maps declined');
