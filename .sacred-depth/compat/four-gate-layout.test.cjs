const {beforeSouthCreek,beforeNorthFort}=require('./mine-history-v165.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||path.join(__dirname,'../world-editor.html'),'utf8');
const a=html.indexOf('const FACILITY_SITES=Object.freeze('),b=html.indexOf('function workshopResumeDecode(',a);
const api=vm.runInNewContext(html.slice(a,b)+';({build:buildFacilitySite,old:typeof buildFacilitySiteLegacyFrame==="function"?buildFacilitySiteLegacyFrame:null})');
const clean=v=>JSON.parse(JSON.stringify(v));
const site=clean(api.build('base'));
const at=(x,z)=>site.map.world.filter(o=>o.x===x&&o.z===z&&o.y===0);
test('four wide gates connect to genuine meadows and preserve both old routes',()=>{
 assert.deepEqual([site.map.width,site.map.height,site.townOffset],[128,site.sacredDepth?.h??128,22]);
 const gates=beforeNorthFort(site).map.world.filter(o=>o.type==='poiFortGate');
 assert.deepEqual(gates.map(({x,z,rot})=>[x,z,rot]).sort(),[[23,49,1],[34,22,2],[41,69,0],[84,67,3]]);
 for(const [x,z,dx,dz] of [[34,22,0,-1],[23,49,-1,0],[41,69,0,1],[84,67,1,0]]){
  for(let side=-1;side<=1;side++)for(let forward=-1;forward<=1;forward++){
   const cell=at(x+dx*forward+dz*side,z+dz*forward+dx*side);
   assert(cell.some(o=>/^road/.test(o.type)),[x,z,side,forward]);
   assert(!cell.some(o=>/^poiFort/.test(o.type)&&o.type!=='poiFortGate'),[x,z,side,forward]);
  }
 }
 for(const [x,z] of [[34,15],[15,49]])assert(at(x,z).some(o=>o.type==='earth'||/^road/.test(o.type)));
 assert(at(25,18).some(o=>o.type==='treeBirch'));
 assert(at(16,45).some(o=>o.type==='flowerField'));
});
test('translation preserves all old frame records and nested authored hydrology, and no standalone map moves',()=>{
 assert(api.old);
 const framed=clean(api.old('base'));
 const previous=require('./town-frame-v144-projection.cjs').originalFrame(beforeSouthCreek(site));
 const seek=new Set(previous.map.world.map(o=>JSON.stringify(o)));
 for(const o of framed.map.world)assert(seek.has(JSON.stringify({...o,x:o.x+12,z:o.z+12})));
 const unshift=v=>Array.isArray(v)?v.map(unshift):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,val])=>[k,
/^(?:x|z|x1|x2|z1|z2)$/.test(k)&&typeof val==='number'?val-12:unshift(val)])):v;
 for(const k of ['spawn','buildings','creek','canal']) assert.deepEqual(unshift(previous[k]),framed[k],k);
 assert.equal(site.map.world.some(o=>o.x<0||o.z<0||o.x>=site.map.width||o.z>=site.map.height),false);
 for(const id of ['lodging','kitchen','workshop','artisan','stable','homes','toolshop'])
  assert.deepEqual(clean(api.build(id)),clean(api.old(id)),id);
});
