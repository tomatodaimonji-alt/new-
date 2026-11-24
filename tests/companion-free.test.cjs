const {test}=require('node:test'),a=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function rig(block=()=>false){
 const cut=(x,y)=>{const i=h.indexOf(x),j=h.indexOf(y,i+1);a(i>=0&&j>i,x);return h.slice(i,j)};
 const c=vm.createContext({poiWalkX:6,poiWalkZ:6,poiWalkLevel:0,poiCompanionCell:(x,z)=>!block(x,z),poiCompanionPlan:()=>null});
 vm.runInContext(cut('// BEGIN FREE MOVEMENT SOLVER','// END FREE MOVEMENT SOLVER')+
  cut('// BEGIN COMPANION FRACTIONAL FOLLOW','// END COMPANION FRACTIONAL FOLLOW'),c);
 const body={x:0,z:0,y:0,freeAt:0};
 return {c,body,advance:(x,z,ms)=>c.poiCompanionAdvance(body,{x,z},ms,0)};
}
test('continuous diagonal commits real fractional world coordinates before any tile crossing',()=>{
 const f=rig();f.advance(4,4,42);
 a(f.body.px>0&&f.body.px<.5);a(f.body.pz>0&&f.body.pz<.5);a(Math.abs(f.body.px-f.body.pz)<1e-7);
 a.deepEqual([f.body.x,f.body.z],[0,0]);f.advance(4,4,101);f.advance(4,4,157);
 a(f.body.px>.5&&f.body.pz>.5);a.deepEqual([f.body.x,f.body.z],[1,1]);
});
test('uses swept radius to prevent diagonal clipping between two touching walls',()=>{
 const f=rig((x,z)=>x===1&&z===0||x===0&&z===1);
 for(let t=30;t<=400;t+=30)f.advance(4,4,t);
 a(f.body.px<.35&&f.body.pz<.35,JSON.stringify(f.body));a.deepEqual([f.body.x,f.body.z],[0,0]);
});
test('actual body clip may arrest the allied movement without modifying player input or occupancy',()=>{
 const f=rig();f.c.poiTownNpcPlayerBodyBlocks=()=>true;
 f.advance(4,4,48);a.equal(f.body.px,0);a.equal(f.body.pz,0);
 a.equal(f.c.poiWalkX,6);a.equal(f.c.poiWalkZ,6);
});
