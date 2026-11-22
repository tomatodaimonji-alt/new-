const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),{createHash}=require('node:crypto');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8'),cut=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)+1));
const build=vm.runInNewContext(cut('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+';buildFacilitySite');
const {beforeOtherworldDepths}=require('./mine-history-v165.cjs');
const site=beforeOtherworldDepths(JSON.parse(JSON.stringify(build('base')))),world=site.map.world;
const at=(x,z)=>world.filter(o=>o.x===x&&o.z===z&&o.y===0);
const oldCount=6874, floor=/^(?:earth|stone|road\w+|grassTrampled)$/;
test('the hill road links old willow and southeast tracks through 29 dry steps without overwrites',()=>{
 assert.equal(createHash('sha256').update(JSON.stringify(world.slice(0,oldCount))).digest('hex'),'ec7a5a436973075aa9d6a83b0a76e51f4e483fd9fa820cd4c630f2d798a2d511');
 assert.deepEqual([site.map.width,site.map.height],[128,96]);assert(!build('lodging').northTrail);
 const p=site.northTrail.wayfarer.path;
 assert.equal(p.length,30);assert.deepEqual(p[0],{x:121,z:28});assert.deepEqual(p.at(-1),{x:121,z:51});
 for(let i=0;i<p.length;i++){
  const {x,z}=p[i],prev=p[i-1];
  assert(at(x,z).length&&at(x,z).every(o=>floor.test(o.type)),'clear old/new road '+[x,z]);
  if(prev)assert.equal(Math.abs(x-prev.x)+Math.abs(z-prev.z),1);
 }
 assert(world.length-oldCount<60);
});
test('the covered well is an optional lit dry approach outside the main walk',()=>{
 const w=site.northTrail.wayfarer;
 assert.deepEqual(w.stand,{x:120,z:44,y:0,facing:3});
 assert.deepEqual(w.well,{name:'旅人の井戸',x:119,z:44,y:0,type:'wayfarerWell',bounds:{x1:118,x2:121,z1:43,z2:46,y:0}});
 assert(at(119,44).some(o=>o.type==='wayfarerWell'));
 for(const x of [120,121,122])assert(at(x,44).length&&at(x,44).every(o=>floor.test(o.type)));
 for(const p of [w.stand,w.well,{x:121,z:44}]){
  const region=site.northTrail.regions.find(({bounds:b})=>p.x>=b.x1&&p.x<=b.x2&&p.z>=b.z1&&p.z<=b.z2);
  assert.equal(region.name,w.well.name);assert.equal(region.difficulty,0);
 }
 assert.match(html,/"number":"359","id":"wayfarerWell"/);
 assert.match(html,/if\(covered\)\{[\s\S]{0,1100}quad\(/);
});
