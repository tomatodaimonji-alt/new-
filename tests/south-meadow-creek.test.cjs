const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||path.join(__dirname,'../world-editor.html'),'utf8');
const a=html.indexOf('const FACILITY_SITES=Object.freeze('),b=html.indexOf('function workshopResumeDecode(',a);
const build=(id)=>JSON.parse(JSON.stringify(vm.runInNewContext(html.slice(a,b)+';buildFacilitySiteLegacyFrame('+JSON.stringify(id)+')')));
const site=build('base'),{creek,map}=site,key=(x,z)=>x+','+z;
const water=new Set(creek.deep.map(p=>key(p.x,p.z)));
const dirs=[[1,0],[0,1],[-1,0],[0,-1]];
function route(points){
 let [x,z]=points[0];const out=[[x,z]];
 for(const [xx,zz] of points.slice(1)){
  assert(x===xx||z===zz);
  while(x!==xx||z!==zz){x+=Math.sign(xx-x);z+=Math.sign(zz-z);out.push([x,z]);}
 }
 return out;
}
test('downstream continues naturally through the eastern meadow and completely leaves the old south boundary',()=>{
 assert.deepEqual([map.width,map.height,map.terrainHeights],[96,56,[]]);
 const reached=new Set(),todo=[[75,53]];
 while(todo.length){
  const [x,z]=todo.pop(),k=key(x,z);
  if(!water.has(k)||reached.has(k))continue;
  reached.add(k);
  for(const [dx,dz] of dirs)todo.push([x+dx,z+dz]);
 }
 assert.equal(reached.size,water.size);
 assert(!creek.deep.some(p=>p.z===55));
 assert.deepEqual(creek.deep.filter(p=>p.x===95).map(p=>p.z),[52,53]);
 assert(water.has('84,50')&&water.has('80,53')&&water.has('89,54'));
 assert(water.size<90);
 for(const {x,z} of creek.deep)assert.deepEqual(map.world.filter(o=>o.x===x&&o.z===z&&o.y===0).map(o=>o.type),
  (z===38&&(x===68||x===69))?['river','bridgeStoneEnd']:['river']);
});
test('gravel appears in the inside bends, with a clear optional bank loop back to both existing trail sections',()=>{
 const dry=new Set(['earth','grassTrampled','grassPebbles','tallGrass','bushFlower','flowerField']);
 const featured=route([[81,44],[83,44],[83,48],[84,48],[84,49],[90,49],[90,42],[87,42],[87,39],[86,39]]);
 for(const [x,z] of featured){
  assert(!water.has(key(x,z)),[x,z]);
  const objects=map.world.filter(o=>o.x===x&&o.z===z&&o.y===0);
  assert(objects.length&&objects.every(o=>dry.has(o.type)),[x,z,objects]);
 }
 for(const [x,z] of [[86,50],[87,51],[88,51],[81,53],[82,52]]){
  assert(!water.has(key(x,z)));
  assert(map.world.some(o=>o.x===x&&o.z===z&&o.y===0&&o.type==='grassPebbles'));
  assert(dirs.some(([dx,dz])=>water.has(key(x+dx,z+dz))));
 }
});
