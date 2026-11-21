const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const src=html.match(/const FACILITY_SITES[\s\S]*?(?=function facilityNavigate\()/)[0];
const api=vm.runInNewContext(src+'\n;({buildFacilitySite,sample:typeof pineGuildSampleMap==="function"?pineGuildSampleMap:null,design:typeof pineGuildDesignUpperFloors==="function"?pineGuildDesignUpperFloors:null})');
const site=api.buildFacilitySite('base'),g=site.buildings.find(b=>b.id==='townGuild');
const norm=(x)=>JSON.parse(JSON.stringify(x));
const at=(x,z,y)=>site.map.world.filter(o=>o.x===x&&o.z===z&&o.y===y);
const key=(x,z,y)=>[x,z,y].join(',');
test('built-in town guild copies and preserves each ordered stack, stair and upper roof from the exact same sample',()=>{
 assert(g,'town guild is present');
 assert.deepEqual([g.x1,g.x2,g.z1,g.z2],[72,87,3,17]);
 assert.deepEqual(norm(g.entrance),{x:79,z:17});
 assert.equal(g.name,'冒険者ギルド');
 assert.equal(site.buildings.length,10);
 assert.equal(g.footprint.length,240);
 assert.deepEqual(Object.keys(g.floorFootprints),['0','1','2']);
 const original=api.design(api.sample().world).filter(o=>o.x>=7&&o.x<=22&&o.z>=6&&o.z<=20&&
  !/^(?:grassMeadow|grassPebbles)$/.test(o.type));
 const target=site.map.world.filter(o=>o.x>=g.x1&&o.x<=g.x2&&o.z>=g.z1&&o.z<=g.z2);
 const canonical=entries=>Array.from(entries,o=>JSON.stringify([o.x,o.z,o.y,o.type,o.rot])).sort();
 assert.deepEqual(canonical(target),canonical(original.map(o=>({...o,x:o.x+65,z:o.z-3}))));
 assert.equal(target.length,new Set(canonical(target)).size);
 assert.equal(target.filter(o=>o.type==='roofHip'&&o.y===3).length,240);
 assert.equal(target.filter(o=>o.type==='guildFacadeSign').length,1);
 assert.equal(at(79,17,0).filter(o=>o.type==='stonewallDoor').length,1);
 assert.equal(at(79,9,1).length,0,'the upper atrium remains open');
 assert.deepEqual([site.map.width,site.map.height],[96,56]);
 assert.deepEqual(norm(site.spawn),{x:19,z:21});
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
 for(let x=54;x<=79;x++){assert(can(x,18,0),x+' lane blocked');assert(at(x,18,0).some(o=>o.type==='roadCutStoneFull'));}
 assert(!can(79,9,1),'cannot walk into an atrium hole');
 assert(!can(79,7,0),'reception counter stays solid');
 const start=[site.spawn.x,site.spawn.z,0],q=[start],seen=new Set([key(...start)]);
 for(let i=0;i<q.length;i++){
  const [x,z,y]=q[i],cell=occupancy.get(key(x,z,y))??[];
  const exits=[[x+1,z,y],[x-1,z,y],[x,z+1,y],[x,z-1,y]];
  if(cell.includes('guildStairUp'))exits.push([x,z,y+1]);
  if(cell.includes('guildStairDown'))exits.push([x,z,y-1]);
  for(const next of exits)if(can(...next)&&!seen.has(key(...next))){seen.add(key(...next));q.push(next);}
 }
 for(const point of [[79,18,0],[79,17,0],[79,16,0],[73,15,0],[73,15,1],[84,14,1],[84,14,2],[79,11,2]])
  assert(seen.has(key(...point)),'reachable '+point.join(','));
});
test('roof and named safe area are scoped to the destination guild',()=>{
 assert(g);
 const region=html.match(/const POI_SAFE_TOWN=[\s\S]*?(?=const poiMiniStatic=)/)[0];
 const f=vm.runInNewContext(region+';poiRegionAt');
 const base={id:'base',buildings:site.buildings};
 assert.deepEqual(norm(f(base,79,16)),{name:'冒険者ギルド',difficulty:0,stars:'☆☆☆☆☆'});
 assert.deepEqual(norm(f(base,55,18)),{name:'拠点',difficulty:0,stars:'☆☆☆☆☆'});
 assert.equal(f(base,19,46).name,'拠点');assert.equal(f(base,19,47).name,'外');
 assert.equal(f(base,78,46).name,'外');assert.equal(f(base,86,36).name,'外');
 const cut=html.match(/function pineGuildRenewalCutOwner\([\s\S]*?(?=function facilityRoofOwner\()/)[0];
 const masks=site.buildings.map(b=>({floors:new Map(Object.keys(b.floorFootprints).map(y=>[Number(y),new Set()]))}));
 const owner=site.buildings.indexOf(g);
 for(const [o,level,expected] of [[owner,0,owner],[owner,1,owner],[owner,2,null],[0,1,null],[null,0,null]]){
  const action=vm.runInNewContext(cut+';facilitySceneCutOwner',{poiWalkActive:true,facilityUsesGuildRendering:()=>false,
   facilityHiddenRoof:()=>o,facilityFloorMasks:masks,poiWalkLevel:level,facilitySite:base});
  assert.equal(action(),expected);
 }
});

test('moving between guild floors holds only one large guild cutaway while keeping other authored views',()=>{
 const a=html.indexOf('function facilityRenderScene('),b=html.indexOf('function facilityBuildRoofs(',a);
 assert(a>=0&&b>a);
 const deleted=[],c=vm.createContext({poiWalkLevel:0,facilitySite:{id:'base',buildings:[{id:'toolshop'},{id:'townGuild'}]},
  facilitySceneCutOwner:()=>1,facilityScenes:new Map([['surface:null:0',{mesh:{buf:'keep'},signs:[]}]]),
  makeScene:()=>({buf:'new'}),signProgram:false,gl:{deleteBuffer:b=>deleted.push(b)}});
 vm.runInContext(html.slice(a,b)+'\nfacilityRenderScene()',c);
 assert(c.facilityScenes.has('surface:1:0'));
 c.poiWalkLevel=1;c.facilityRenderScene();
 assert.deepEqual([...c.facilityScenes.keys()],['surface:null:0','surface:1:1']);
 assert.deepEqual(deleted,['new']);
});
