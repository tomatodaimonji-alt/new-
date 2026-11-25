const a=require('node:assert/strict'),{test}=require('node:test'),vm=require('node:vm'),fs=require('node:fs');
const h=fs.readFileSync('world-editor.html','utf8');
const cut=(s,e)=>{const i=h.indexOf(s),j=h.indexOf(e,i+1);a(i>=0&&j>i,s);return h.slice(i,j)};
const context=vm.createContext({poiOverlandBaseGroundColumns:(z,width)=>z<8?width:5,poiFieldHazeFrame:{id:'base'},poiThirdPerson:true});
vm.runInContext(cut('function* stockGradeWalk(','function stockAtlasUpload(')+cut('function stockAtlasOutside(','function stockAtlasOmitted(')+`
 const draws=[],draw=(m,vp,start=0,count=m.count)=>draws.push([start,count]);
 const I=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
`,context);
const run=s=>JSON.parse(vm.runInContext('JSON.stringify('+s+')',context));
test('each reachable grade tile emitted exactly once with original coordinate ownership',()=>{
 const [a1,b]=run('[false,true].map(f=>[...stockGradeWalk(16,14,f)].map(([x,z])=>x+","+z).sort())');
 a.deepEqual(a1,b);a.equal(new Set(a1).size,a1.length);
});
test('real triangle bounds cull only entirely offscreen ground; always keep tail and preserve order',()=>{
 const r=run(`(()=>{
  const m={count:30,parcels:[{start:0,end:9,bounds:[-.5,0,-.5,1.1,.6,.4]},
   {start:9,end:21,bounds:[1.2,0,-.8,2,.5,.4]},{start:21,end:27,bounds:[-.5,0,-.5,1,.5,.4]}]};
  stockGradeDraw(m,I);const normal=draws.splice(0);
  poiFieldHazeFrame=null;stockGradeDraw(m,I);
  return [normal,draws];
 })()`);
 a.deepEqual(r,[[[0,9],[21,9]],[[0,30]]]);
});
test('range bounds match real mesh vertex coordinates, not a guessed height',()=>{
 const o=run(`(()=>{const q=[];stockGradeRange({p:[7,-1,4,8,2,9,8,0,3]},0,3,q);return q;})()`);
 a.deepEqual(o,[{start:0,end:3,bounds:[7,-1,3,8,2,9]}]);
});
