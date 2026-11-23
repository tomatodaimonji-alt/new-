const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const src=html.match(/const FACILITY_SITES[\s\S]*?(?=function facilityNavigate\()/)[0];
const api=vm.runInNewContext(src+'\n;({buildFacilitySite:buildFacilitySiteLegacyFrame,sample:typeof pineGuildSampleMap==="function"?pineGuildSampleMap:null,design:typeof pineGuildDesignUpperFloors==="function"?pineGuildDesignUpperFloors:null})');
const site=api.buildFacilitySite('base'),g=site.buildings.find(b=>b.id==='townGuild');
const norm=(x)=>JSON.parse(JSON.stringify(x));
const at=(x,z,y)=>site.map.world.filter(o=>o.x===x&&o.z===z&&o.y===y);
const key=(x,z,y)=>[x,z,y].join(',');
test('built-in town guild preserves the stock shell, floors, stairs and upper layers, with new ground-level rooms',()=>{
 assert(g,'town guild is present');
 assert.deepEqual([g.x1,g.x2,g.z1,g.z2],[27,42,2,16]);
 assert.deepEqual(norm(g.entrance),{x:34,z:16});
 assert.equal(g.name,'冒険者ギルド');
 assert.equal(site.buildings.length,10);
 assert.equal(g.footprint.length,240);
 assert.deepEqual(Object.keys(g.floorFootprints),['0','1','2']);
 const original=api.design(api.sample().world).filter(o=>o.x>=7&&o.x<=22&&o.z>=6&&o.z<=20&&
  !/^(?:grassMeadow|grassPebbles)$/.test(o.type));
 const target=site.map.world.filter(o=>o.x>=g.x1&&o.x<=g.x2&&o.z>=g.z1&&o.z<=g.z2);
 const canonical=entries=>Array.from(entries,o=>JSON.stringify([o.x,o.z,o.y,o.type,o.rot])).sort();
 const protectedPart=(o,bounds)=>o.y!==0||o.x===bounds[0]||o.x===bounds[1]||o.z===bounds[2]||o.z===bounds[3]||
  /^woodfloor|^guildStair/.test(o.type);
 assert.deepEqual(canonical(target.filter(o=>protectedPart(o,[27,42,2,16]))),canonical(
  original.filter(o=>protectedPart(o,[7,22,6,20])).map(o=>({...o,x:o.x+20,z:o.z-4}))));
 assert.equal(target.length,new Set(canonical(target)).size);
 assert.equal(target.filter(o=>o.type==='roofHip'&&o.y===3).length,240);
 assert.equal(target.filter(o=>o.type==='guildFacadeSign').length,1);
 assert.equal(at(34,16,0).filter(o=>o.type==='stonewallDoor').length,1);
 assert.equal(at(34,8,1).length,0,'the upper atrium remains open');
 assert.deepEqual([site.map.width,site.map.height],[96,56]);
 assert.deepEqual(norm(site.spawn),{x:19,z:21});
 assert.equal(site.map.world.filter(o=>o.type==='guildFacadeSign').length,1);
 assert.ok(at(34,20,0).some(o=>o.type==='roadCutStoneFull'));
 const workshop=site.buildings.find(b=>b.id==='workshop');
 assert.deepEqual(norm(workshop.entrance),{x:55,z:11});
 assert.equal(workshop.turn,1);
});
test('base route can walk through the street to the guild and up both flights with furniture collisions',()=>{
 assert(g);
 const water=new Set(site.creek.deep.map(({x,z})=>x+','+z));
 const occupancy=new Map();
 for(const o of site.map.world){
  const k=key(o.x,o.z,o.y);if(!occupancy.has(k))occupancy.set(k,[]);
  occupancy.get(k).push(o.type);
 }
 const floor=/^(?:woodfloor(?:Light|Dark)?|brickfloor|stone|earth|road|grass|moss)/;
 const open=/Door$|^(?:guildStair(?:Up|Down)|lantern|chairWood|chairClassic|stoolRound|benchWood|flowerField|bushFlower|tallGrass|guildFacadeSign)$/;
 const can=(x,z,y)=>{
  if(x<0||x>=site.map.width||z<0||z>=site.map.height||y<0||y>2||y===0&&water.has(x+','+z))return false;
  const cell=occupancy.get(key(x,z,y))??[];
  return (y===0||cell.some(t=>floor.test(t)||/^guildStair/.test(t)))&&cell.every(t=>floor.test(t)||open.test(t));
 };
 for(let x=24;x<=54;x++){assert(can(x,17,0),x+' lane blocked');assert(at(x,17,0).some(o=>o.type==='roadCutStoneFull'));}
 assert(!can(34,8,1),'cannot walk into an atrium hole');
 assert(!can(34,6,0),'reception counter stays solid');
 const start=[site.spawn.x,site.spawn.z,0],q=[start],seen=new Set([key(...start)]);
 for(let i=0;i<q.length;i++){
  const [x,z,y]=q[i],cell=occupancy.get(key(x,z,y))??[];
  const exits=[[x+1,z,y],[x-1,z,y],[x,z+1,y],[x,z-1,y]];
  if(cell.includes('guildStairUp'))exits.push([x,z,y+1]);
  if(cell.includes('guildStairDown'))exits.push([x,z,y-1]);
  for(const next of exits)if(can(...next)&&!seen.has(key(...next))){seen.add(key(...next));q.push(next);}
 }
 for(const point of [[34,17,0],[34,16,0],[34,15,0],[28,14,0],[28,14,1],[39,13,1],[39,13,2],[34,10,2],[54,11,0],[55,11,0],[56,11,0]])
  assert(seen.has(key(...point)),'reachable '+point.join(','));
});
test('roof and named safe area are scoped to the destination guild',()=>{
 assert(g);
 const region=html.match(/const POI_SAFE_TOWN=[\s\S]*?(?=const poiMiniStatic=)/)[0];
 const f=vm.runInNewContext(region+';poiRegionAt');
 const base={id:'base',buildings:site.buildings};
 assert.deepEqual(norm(f(base,34,15)),{name:'冒険者ギルド',difficulty:0,stars:'☆☆☆☆☆☆☆☆☆☆'});
 assert.deepEqual(norm(f(base,53,17)),{name:'拠点',difficulty:0,stars:'☆☆☆☆☆☆☆☆☆☆'});
 assert.equal(f(base,19,46).name,'拠点');assert.equal(f(base,19,47).name,'外');
 assert.equal(f(base,79,16).name,'外');assert.equal(f(base,78,46).name,'外');assert.equal(f(base,86,36).name,'外');
 const cut=html.match(/function pineGuildRenewalCutOwner\([\s\S]*?(?=function facilityRoofOwner\()/)[0];
 const masks=site.buildings.map(b=>({floors:new Map(Object.keys(b.floorFootprints).map(y=>[Number(y),new Set()]))}));
 const owner=site.buildings.indexOf(g);
 for(const [o,level,expected] of [[owner,0,owner],[owner,1,owner],[owner,2,null],[0,1,null],[null,0,null]]){
  const action=vm.runInNewContext(cut+';facilitySceneCutOwner',{poiWalkActive:true,facilityUsesGuildRendering:()=>false,
   facilityHiddenRoof:()=>o,facilityFloorMasks:masks,poiWalkLevel:level,facilitySite:base});
  assert.equal(action(),expected);
 }
});

test('moving between guild floors holds only one legacy cutaway in an unsupported or edited world',()=>{
 const a=html.indexOf('function facilityRenderScene('),b=html.indexOf('function facilityBuildRoofs(',a);
 assert(a>=0&&b>a);
 const deleted=[],c=vm.createContext({poiWalkLevel:0,facilitySite:{id:'base',buildings:[{id:'toolshop'},{id:'townGuild'}]},
  facilitySurface:null,facilitySharedSurfaceAllowed:()=>false,facilityVisibilityOwner:()=>1,facilityScenes:new Map([['surface:null:0',{mesh:{buf:'keep'},signs:[]}]]),
  makeScene:()=>({buf:'new'}),signProgram:false,gl:{deleteBuffer:b=>deleted.push(b)}});
 vm.runInContext(html.slice(a,b)+'\nfacilityRenderScene()',c);
 assert(c.facilityScenes.has('surface:1:0'));
 c.poiWalkLevel=1;c.facilityRenderScene();
 assert.deepEqual([...c.facilityScenes.keys()],['surface:null:0','surface:1:1']);
 assert.deepEqual(deleted,['new']);
});

test('only legacy Game World checkpoints translate a former building position',()=>{
 const resume=html.match(/function workshopResumeTownPosition\([\s\S]*?(?=function workshopResumeRestore\()/);
 assert.ok(resume,'one-time position translation');
 const migrate=vm.runInNewContext(resume[0]+';workshopResumeTownPosition');
 const payload=(x,z,y,townLayout)=>({position:{x,z,y,facing:2},townLayout});
 assert.deepEqual(norm(migrate(payload(79,16,0))),{x:34,z:15,y:0,facing:2});
 assert.deepEqual(norm(migrate(payload(84,14,2))),{x:39,z:13,y:2,facing:2});
 assert.deepEqual(norm(migrate(payload(28,16,0))),{x:56,z:11,y:0,facing:2});
 for(const p of [payload(79,16,0,2),payload(30,15,0,2),payload(19,21,0),payload(78,46,0),payload(28,16,-1)])
  assert.equal(migrate(p),p.position);
 assert.equal(migrate({position:null}),null);
});

test('four streets pass through the rampart at intentional wide masonry openings',()=>{
 const perimeter=site.map.world.filter(o=>/^poiFort/.test(o.type));
 const atFort=(x,z)=>perimeter.find(o=>o.x===x&&o.z===z);
 const gates=perimeter.filter(o=>o.type==='poiFortGate');
 assert.deepEqual(norm(gates.map(({x,z,y,rot})=>[x,z,y,rot]).sort()),[[1,27,0,1],[12,0,0,2],[19,47,0,0],[62,45,0,3]]);
 assert.equal(new Set(perimeter.map(o=>key(o.x,o.z,o.y))).size,perimeter.length);
 for(const [ax,az,bx,bz] of [[1,0,46,0],[46,0,46,4],[46,4,66,4],[66,4,66,20],[62,20,66,20],[62,20,62,47],[1,47,62,47],[1,0,1,47]]){
  for(let z=az;z<=bz;z++)for(let x=ax;x<=bx;x++){
   if(z===47&&(x===18||x===20)||x===62&&(z===44||z===46)||z===0&&(x===11||x===13)||x===1&&(z===26||z===28))assert(!atFort(x,z),'open shoulder');
   else assert(atFort(x,z),x+','+z+' rampart');
  }
 }
 assert.ok(perimeter.length<230);
 assert.ok(gates.every(g=>at(g.x,g.z,0).some(o=>o.type==='roadCutStoneFull')));
 for(const id of ['lodging','workshop','kitchen','toolshop'])
  assert(!api.buildFacilitySite(id).map.world.some(o=>/^poiFort/.test(o.type)));
});
