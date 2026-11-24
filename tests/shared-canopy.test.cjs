const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),test=require('node:test');
const h=fs.readFileSync(process.env.WORLD_HTML||'world-editor.html','utf8');
test('one gentle optical transfer for resident, streamed and true far canopy; no opacity or ground override',()=>{
 const a=h.indexOf('// BEGIN SHARED CANOPY WEIGHT'),b=h.indexOf('// END SHARED CANOPY WEIGHT',a);
 assert(a>0&&b>a,'only adding far terrain is not a shared canopy treatment');
 const c=vm.createContext({facilityParams:{get:k=>k==='canopy-weight'?'1':null},
  poiSacredForestMember:o=>o.exact===true,values:[],gl:{uniform4f:(...a)=>c.values.push(a)},
  loc:{sharedCanopy:7}});
 vm.runInContext(h.slice(a,b),c);
 assert.deepEqual(Array.from(c.poiSharedCanopyBand()),[24,42]);
 assert.equal(c.poiSharedCanopyMember({id:'snowpass'},{y:0,type:'treePine'}),true);
 assert.equal(c.poiSharedCanopyMember({id:'base'},{y:0,type:'treePine',exact:true}),true);
 assert.equal(c.poiSharedCanopyMember({id:'base'},{y:0,type:'treePine'}),false);
 assert.equal(c.poiSharedCanopyMember({id:'base'},{y:0,type:'poiDavidWallTall',exact:true}),false);
 assert.equal(c.poiSharedCanopyMember({id:'snowpass'},{y:1,type:'treePine'}),false);
 c.poiSharedCanopyDraw(10,20,()=>{assert.deepEqual(c.values.at(-1),[7,10,20,24,42])});
 assert.deepEqual(c.values.at(-1),[7,0,0,0,0]);
 assert.throws(()=>c.poiSharedCanopyDraw(10,20,()=>{throw Error('frame')}));
 assert.deepEqual(c.values.at(-1),[7,0,0,0,0]);
 const shader=h.slice(h.indexOf('const FRAG='),h.indexOf('function sh('));
 assert.match(shader,/smoothstep\(uSharedCanopy\.z,uSharedCanopy\.w,length\(vLootXZ-uSharedCanopy\.xy\)\)/);
 assert.match(shader,/color=mix\(color,[^;]+\.22\*weight\);/);
 assert.match(h,/poiSharedCanopyDraw\(x,z,\(\)=>draw\(m,vp,canopy/);
 assert.match(h,/gpu\.canopyFirst=0/);
});
