const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||path.join(__dirname,'../world-editor.html'),'utf8');
const part=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i+1);assert(i>=0&&j>i,a);return html.slice(i,j);};
function harness(){
 const site=vm.runInNewContext(part('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+';buildFacilitySite("base")');
 const bridge=new Map([...site.creek.crossings,...site.canal.bridgePairs.flat()].map(o=>[o.x+','+o.z,o]));
 const x=vm.createContext({facilitySite:{id:'base',townOffset:site.townOffset},world:site.map.world,MAP_W:site.map.width,MAP_H:site.map.height,
  poiWalkLevel:0,facilityCreekIndex:{parts:bridge},poiMonsterStates:new Map(),terrainPassable:()=>true,
  isFloor:t=>/^(?:woodfloor(?:Light|Dark)?|plasterfloor|brickfloor|grass\w*|earth|stone|road\w+|river|moss)$/.test(t),
  isWallId:t=>/^(?:woodwall|brickwall|stonewall|plasterwall)$/.test(t),poiWalkPassableDoor:t=>/Door$/.test(t)});
 vm.runInContext(part('const POI_TOWN_RESIDENT_ROLES=','let cameraTopDown='),x);
 return {run:s=>vm.runInContext(s,x),x};
}
test('three additional daytime people each reach the city via the appropriate real gate without using any existing inn bed',()=>{
 const {run}=harness(),days=run("POI_TOWN_RESIDENT_ROLES.filter(r=>r.role==='visitor')");
 assert.equal(days.length,3);
 const gates={westpeddler:[23,49],northtraveler:[34,22],canalcourier:[84,67]};
 for(const p of days){
  assert(!p.bed);
  assert(p.arrives<p.leaves&&p.arrives>=8*60&&p.leaves<18*60);
  const route=run(`poiTownFindPath(${JSON.stringify(p.home)},${JSON.stringify(p.work)})`);
  assert(route?.length,p.id);
  const [x,z]=gates[p.id];
  assert(route.some(o=>p.id==='northtraveler'?o.z===z&&Math.abs(x-o.x)<=1:o.x===x&&Math.abs(z-o.z)<=1),p.id+' wrong gate');
  assert(run(`poiTownFindPath(${JSON.stringify(p.work)},${JSON.stringify(p.public)})`)?.length,p.id+' has no public route');
 }
 assert.equal(run("POI_TOWN_RESIDENT_ROLES.filter(r=>r.role!=='visitor').length"),8);
 assert.equal(run("POI_TOWN_INN_BEDS.filter(b=>!b.residentId).length"),1);
});
test('a newcomer walks in, leaves visibly at dusk, and returns the next day without teleporting in town',()=>{
 const {run}=harness();
 const set=minute=>run(`poiTownNpcInit({minute:${minute},absoluteMinute:${minute}})`);
 const tick=(minute,t)=>run(`for(let i=0;i<170;i++){const a=poiTownNpcActors.find(a=>a.role.id==='westpeddler');poiTownNpcRoutine(a,{minute:${minute},absoluteMinute:${minute}},${t}+i*400,{plans:2});}`);
 const one=(minute,t)=>run(`poiTownNpcRoutine(poiTownNpcActors.find(a=>a.role.id==='westpeddler'),{minute:${minute},absoluteMinute:${minute}},${t},{plans:2})`);
 const state=()=>run("poiTownNpcActors.find(a=>a.role.id==='westpeddler')");
 set(400);assert.equal(state().recessed,true);
 one(510,1);assert.equal(state().recessed,false);assert.notEqual(state().x,state().role.work.x);
 tick(510,401);assert.equal(state().activity,'visit');
 assert.equal(state().x,state().role.work.x);
 one(1050,100000);assert.equal(state().recessed,false);assert.equal(state().activity,'leaving-visit');
 tick(1050,100401);assert.equal(state().recessed,true);assert.equal(state().x,state().role.home.x);
 one(510,185001);assert.equal(state().recessed,false);assert.notEqual(state().x,state().role.work.x);
 assert.match(html,/if\(a\.recessed\|\|a\.y!==poiWalkLevel\)continue/);
});
