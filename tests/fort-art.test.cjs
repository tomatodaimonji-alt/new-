const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||path.join(__dirname,'../world-editor.html'),'utf8');
function geometry(){
 const cut=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i+1);assert(i>=0&&j>i,a);return html.slice(i,j);};
 return vm.runInNewContext(cut('function tri(','function diamond(')+cut('function rot2(','function addPart(')+
  cut('const POI_FORT_PARTS=','function deco(')+`;((id,rot)=>{const m={p:[],n:[],c:[]};poiFortGeometry(m,id,0,0,0,rot);return m})`,{mesh:()=>({p:[],n:[],c:[]})});
}
test('fort modules are registered and the open south-facing gate does not need upper-floor objects',()=>{
 const draw=geometry();
 for(const id of ['poiFortWall','poiFortCorner','poiFortGate'])assert.match(html,new RegExp("id:'"+id+"'"));
 assert.match(html,/if\(POI_FORT_PARTS\.has\(id\)\)\{poiFortGeometry\(m,id,x,y,z,r\);return\}/);
 const gate=draw('poiFortGate',0),rot=draw('poiFortGate',1);
 const xyz=Array.from({length:gate.p.length/3},(_,i)=>gate.p.slice(i*3,i*3+3));
 assert(xyz.some(([x,y,z])=>x<-1.43)&&xyz.some(([x,y,z])=>x>1.43));
 assert(xyz.some(([,y])=>y>3));
 assert(xyz.every(([x,y,z])=>Math.abs(x)<=1.58&&y>=0&&Math.abs(z)<.72));
 assert(!xyz.some(([x,y,z])=>Math.abs(x)<1.18&&y<1.66),'gate opening clears a broad two-sided path');
 assert.equal(gate.p.length,rot.p.length);
 assert.equal(gate.p.length/9>100,true);
 assert(gate.p.length/9<450);
 const key=p=>p.map(v=>Math.round(v*1e6)).join(',');
 const west=new Set(xyz.map(([x,y,z])=>key([-z,y,x])));
 for(let i=0;i<rot.p.length;i+=3)assert(west.has(key(rot.p.slice(i,i+3))));

});
test('fort wall meets its neighbor and preserves a compact geometry budget',()=>{
 const draw=geometry(),wall=draw('poiFortWall',0);
 assert(wall.p.length/9<86);
 const xs=wall.p.filter((_,i)=>i%3===0);assert(Math.min(...xs)<=-.5&&Math.max(...xs)>=.5);
 const pier=draw('poiFortCorner',0);
 const zs=pier.p.filter((_,i)=>i%3===2);assert(Math.min(...zs)<=-.5&&Math.max(...zs)>=.5);
 const boundary=draw('poiFortBoundary',2).p.filter((_,i)=>i%3===2);
 assert(Math.max(...boundary)<-.24,'outside-offset north boundary leaves most of the logical square open');

});
test('fort parts append stable IDs to both AI diagram registries',()=>{
 const source=require('node:fs').readFileSync(require('node:path').join(__dirname,'../world-editor.html'),'utf8');
 const live=JSON.parse(source.match(/const pineAINumberEntries=(\[[^\n]+\]);/)[1]);
 const registry=require('../src/editor/ai-object-numbers.json').objects;
 require('node:assert/strict').deepEqual(live,registry);
 require('node:assert/strict').deepEqual(live.slice(331,335).map(({id,number})=>[id,number]),
  [['poiFortWall','332'],['poiFortBoundary','333'],['poiFortCorner','334'],['poiFortGate','335']]);
});
