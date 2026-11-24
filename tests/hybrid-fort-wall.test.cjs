const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const c=()=>{const a=h.indexOf('// BEGIN HYBRID FORT WALL POLICY'),b=h.indexOf('// END HYBRID FORT WALL POLICY');assert(a>=0&&b>a,'register ordinary opaque fort walls as a ready shared class');const c=vm.createContext({});vm.runInContext(h.slice(a,b),c);return c};
test('only real ordinary ground fort wall, not culverts, entrance, window, corner or underground shapes',()=>{
 const q=c(),site={id:'base',canal:{culverts:[{x:45,z:45}]}},wall={x:44,z:45,y:0,type:'poiFortWall'};
 assert(q.poiHybridWallOrdinary(site,wall));
 for(const p of [{x:45},{y:-1},{type:'poiFortBoundary'},{type:'poiFortGate'},{type:'stonewallWindow'},{type:'woodwallDoor'}])
  assert(!q.poiHybridWallOrdinary(site,{...wall,...p}));
 assert(!q.poiHybridWallOrdinary({id:'custom'},wall));
});
test('world-foot values give complementary weights and actual bounded instance spans',()=>{
 const q=c();
 for(const d of [0,18,21,24,30,36,42,45,46,48]){
  const w=q.poiHybridWallBands([d===21?.5:0,d===21?.5:1,0]);
  assert(w.every((p,i)=>p[1]>=0&&p[2]<=1&&p[2]>p[1]&&(!i||p[1]>=w[i-1][2])));
 }
});
