const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const game=fs.readFileSync(process.argv[2]??'world-editor.html','utf8');
const cut=(a,b)=>game.slice(game.indexOf(a),game.indexOf(b,game.indexOf(a)+1));
const boot=cut('// BEGIN SOUTH FOREST LOCAL','// END SOUTH FOREST LOCAL');
function run(code){
 const c=vm.createContext({URLSearchParams});
 return JSON.parse(vm.runInContext(`
 let t=0, poiWalkX=93,poiWalkZ=114,poiWalkViewX=93,poiWalkViewZ=114,poiWalkLevel=0,
  poiWalkActive=true,cameraTopDown=false,pineAIActive=false,facilitySurfaceEdited=false,poiOverlandDrawing=false;
 const events=[],picks=[],deleted=[],sites=[], POI_SESSIONS={},facilityStairOpenings=new Set();
 const point=(type,x,z)=>({type,x,z,y:0});
 const world=[point('treeCedar',81,106),point('treePine',79,108),point('treeBirch',76,106),point('treeCedar',74,108),
  point('treePine',71,106),point('fallenLog',80,109)];
 const facilitySite={id:'base',southForest:{areas:[{x1:60,x2:82,z1:106,z2:115,y:0}],props:world.slice()}};
 const facilityVisibilityOwner=()=>null;
 let poiFacilityLocalBuild=null,poiOutdoorFarBytes=0,poiAddGroundBytes=0,poiSeamRoleBytes=0,nearBytes=3500000;
 const poiOverlandMeshes=new Map([['leased',{bytes:3500000}]]),POI_OVERLAND_GPU_LIMIT=4194304;
 const performance={now:()=>t},gl={deleteBuffer:b=>deleted.push(b)},mesh=()=>({p:[],n:[],c:[],objects:[]});
 const validPos=()=>true,poiSquareFieldSite=s=>s===facilitySite,poiOverlandSquareLocalOwn=()=>true,
  facilityObjectVisible=()=>true,poiDavidTempleEnclosedAt=()=>false;
 const pineDrawBaseTree=(m,o)=>{picks.push(o.x);m.objects.push(o.x);m.p.push(0,0,0);return true;};
 let serial=0;
 const upload=m=>({buf:++serial,count:m.objects.length,objects:m.objects.slice()});
 const makeScene=()=>upload({objects:poiFacilityLocalBuild.map(o=>o.x)});
 const draw=(m)=>{events.push({t,x:poiWalkX,objects:m.objects.slice(),born:m.revealBorn});};
 const poiStreamPropDraw=draw;
 ${boot}
 const frame=(x=93)=>{poiWalkX=poiWalkViewX=x;t+=50;facilityDrawForestScene({});};
 const result=()=>{
  ${code}
  return {events,picks,deleted};
 };
 JSON.stringify(result());
 `,c));
 }
test('near original tree cohort appears before stock entrance and never doubles at the handoff',()=>{
 const d=run('for(let i=0;i<5;i++)frame();frame(92);frame(92);');
 const pre=d.events.filter(e=>e.x===93),post=d.events.filter(e=>e.x===92);
 assert(pre.length>0,'no draw for any original nearby tree before full Forest activation');
 assert.deepEqual(pre.at(-1).objects,[81,79,76,74]);
 const first=post.filter(e=>e.t===post[0].t).flatMap(e=>e.objects);
 assert.deepEqual([...first].sort((a,b)=>a-b),[71,74,76,79,80,81]);
 assert(post.some(e=>e.born===pre.at(-1).born),'first original cohort must retain reveal age');
 assert.deepEqual(d.picks,[81,79,76,74],'at most one small cohort; no background duplicate rebuild');
});
test('no early spare or diagnostic mode: unchanged full renderer, no extra work',()=>{
 for(const old of ["poiOverlandMeshes.get('leased').bytes=4194304;","poiOverlandDrawing=true;"]){
  const d=run(old+'for(let i=0;i<6;i++)frame();frame(92);');
  assert.equal(d.events.filter(e=>e.x===93).length,0);
  assert.deepEqual(d.picks,[]);
  assert.deepEqual(d.events.at(-1).objects,[81,79,76,74,71,80]);
 }
});
test('optional preflight eviction under pressure cannot erase original trees after entrance',()=>{
 const d=run("for(let i=0;i<5;i++)frame();poiForestFrontReserve(4194304,0,0);frame(92);");
 assert.equal(d.deleted.length,1);
 assert.deepEqual(d.events.at(-1).objects,[81,79,76,74,71,80]);
});

test('leaving the facility renderer releases an admitted early buffer even with no full mesh',()=>{
 const d=run('for(let i=0;i<5;i++)frame();facilityClearForestScene();facilityClearForestScene();');
 assert.deepEqual(d.deleted,[1]);
});
test('default tree prewarm has no test-mode marker',()=>{
 assert.doesNotMatch(game,/__earlyForestQA|POI_FOREST_FRONT_QA/);
});
