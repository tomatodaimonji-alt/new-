const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {test} = require('node:test');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const source=html.match(/const FACILITY_SITES[\s\S]*?(?=function facilityNavigate\()/)?.[0];
assert(source,'authored facility script not found');
const {FACILITY_SITES,buildFacilitySite}=vm.runInNewContext(source+'\n;({FACILITY_SITES,buildFacilitySite})');
const ids=['lodging','kitchen','workshop','artisan','stable','homes','toolshop','base'];
const buildingIds=['lodging','kitchen','workshop','artisan','stable','cottage','rowhouse','gardener','toolshop','townGuild'];
const key=(x,z,y)=>[x,z,y].join(',');
const floorIds=/^(?:woodfloor(?:Dark|Light)?|stone|brickfloor|road(?:Cobble|CutStone|Gravel)Full|earth|plasterfloor|grass(?:Wild|Trampled|Flowers|Patch))$/;
const door=t=>/Door$/.test(t);
const walkable=t=>floorIds.test(t)||door(t)||['lantern','chairWood','chairClassic','stoolRound','benchWood','guildFacadeSign','poiCanalQuay','flowerField','bushFlower','guildStairUp','guildStairDown'].includes(t);
const dirs=[[0,1],[-1,0],[0,-1],[1,0]];
const sort=a=>a.map(o=>Array.isArray(o)?o.join(','):String(o)).sort().join(';');
function explore({map,spawn}){
 const indexed=new Map();
 for(const o of map.world){
  const k=key(o.x,o.z,o.y);
  if(!indexed.has(k))indexed.set(k,[]);
  indexed.get(k).push(o.type);
 }
 const start=[spawn.x,spawn.z,0],reachable=new Set([key(...start)]),q=[start];
 function step(x,z,y){
  const k=key(x,z,y),types=indexed.get(k)||[];
  if(x<0||z<0||x>=map.width||z>=map.height||reachable.has(k))return;
  if(y!==0&&!types.some(t=>floorIds.test(t)||['guildStairUp','guildStairDown'].includes(t)))return;
  if(types.some(t=>!walkable(t)))return;
  reachable.add(k);q.push([x,z,y]);
 }
 while(q.length){
  const [x,z,y]=q.pop();
  for(const [dx,dz] of dirs)step(x+dx,z+dz,y);
  const types=indexed.get(key(x,z,y))||[];
  if(types.includes('guildStairUp'))step(x,z,y+1);
  if(types.includes('guildStairDown'))step(x,z,y-1);
 }
 return reachable;
}
test('eight deterministic site IDs and exact and varied building footprints',()=>{
 assert.deepEqual(Array.from(FACILITY_SITES,s=>s.id),ids);
 assert.equal(buildFacilitySite('__proto__'),null);
 for(const id of ids){
  const site=buildFacilitySite(id);
  assert.equal(JSON.stringify(site),JSON.stringify(buildFacilitySite(id)));
  if(id==='base'){
   assert.equal(site.map.width,108);assert.equal(site.map.height,68);
   assert.ok(site.map.world.length<5380);
   assert.deepEqual(Array.from(site.buildings,b=>b.id),buildingIds);
  }else{
   assert.ok(site.map.width<=48&&site.map.height<=38&&site.map.world.length<2200);
   assert.equal(site.buildings.length,id==='homes'?3:1);
  }
  for(const b of site.buildings){
   const fac=b.id;
   const w=b.x2-b.x1+1,d=b.z2-b.z1+1;
   if(['cottage','rowhouse','gardener'].includes(fac))assert.ok(w===7&&d===7,fac+' is compact');
   if(fac==='lodging')assert.ok(b.footprint.length<w*d-3);
   else if(fac==='rowhouse'||fac==='gardener')assert.ok(b.footprint.length<w*d,fac+' has a fitted setback');
   else assert.equal(b.footprint.length,w*d,fac+' has a simple rectangular outline');
   assert.equal(sort(Array.from(b.footprint,p=>[p.x,p.z])),sort(Array.from(b.floorFootprints['0'],p=>[p.x,p.z])));
   assert.equal(b.footprint.length,new Set(Array.from(b.footprint,p=>key(p.x,p.z,0))).size);
   for(const p of b.footprint)assert.ok(p.x>=b.x1&&p.x<=b.x2&&p.z>=b.z1&&p.z<=b.z2);
   for(const o of site.map.world.filter(o=>o.y>0&&o.x>=b.x1&&o.x<=b.x2&&o.z>=b.z1&&o.z<=b.z2&&(/^roof/.test(o.type)||o.type==='chimney'))){
    assert.ok(b.footprint.some(p=>p.x===o.x&&p.z===o.z));
    assert.ok(!b.floorFootprints[String(o.y)]?.some(p=>p.x===o.x&&p.z===o.z), 'no roof through rooms');
   }
  }
 }
});
test('toilets can be walked to, stairs are paired, and indoor routes start from paved or service entries',()=>{
 const expected={lodging:['0','1'],kitchen:['-1','0'],townGuild:['0','1','2']};
 const assets={lodging:['bed','chest','wardrobe'],kitchen:['kitchenStove','kitchenCounter','kitchenSink','roundTableWood'],
  workshop:['table','displayShelf','counterWood'],artisan:['bed','kitchenStove','counterWood','poiLedgerPapers'],
  stable:['fenceWood','sack','crate','displayShelf'],cottage:['bed','fireplace','wardrobe'],
  rowhouse:['bed','table','poiLedgerPapers'],gardener:['bed','poiPottedPlant','basketProduce'],
  toolshop:['displayShelf','counterLuxury','poiLedgerPapers'],townGuild:['guildFacadeSign','guildWallQuestBoard','bookshelf']};
 for(const id of ids){
  const site=buildFacilitySite(id),reachable=explore(site);
  for(const b of site.buildings){
   const fac=b.id;
   assert.deepEqual(Object.keys(b.floorFootprints).sort(),expected[fac]||['0']);
   const occupied=(o,y=o.y)=>b.floorFootprints[String(y)]?.some(p=>p.x===o.x&&p.z===o.z);
   const objs=site.map.world.filter(o=>occupied(o));
   if(fac!=='stable')assert.ok(objs.some(o=>o.type==='guildLatrine'&&dirs.some(([dx,dz])=>
      occupied({x:o.x+dx,z:o.z+dz,y:o.y})&&reachable.has(key(o.x+dx,o.z+dz,o.y)))),fac+' private toilet navigable');
   const entry=objs.find(o=>o.y===0&&door(o.type)&&o.x===b.entrance.x&&o.z===b.entrance.z);
   assert.ok(entry,fac+' front door');
   const [dx,dz]=dirs[entry.rot];
   assert.ok(reachable.has(key(entry.x-dx,entry.z-dz,0)),fac+' has passable entry');
   assert.ok(site.map.world.some(o=>o.x===entry.x+dx&&o.z===entry.z+dz&&o.y===0&&
    (o.type.startsWith('road')||(fac==='stable'&&o.type==='earth'))),fac+' has an explicit approach');
   for(const stair of objs.filter(o=>o.type==='guildStairUp'||o.type==='guildStairDown')){
    const up=stair.type==='guildStairUp';
    assert.ok(reachable.has(key(stair.x,stair.z,stair.y)));
    assert.ok(objs.some(o=>o.x===stair.x&&o.z===stair.z&&o.y===stair.y+(up?1:-1)&&o.type===`guildStair${up?'Down':'Up'}`));
   }
   for(const name of assets[fac])assert.ok(objs.some(o=>o.type===name),fac+' '+name);
   if(fac==='stable'){
    assert.ok(objs.filter(o=>o.y===0&&door(o.type)&&o.z===entry.z).length>=2,'two passable tiles under the single loading bay');
    assert.ok(site.map.world.some(o=>o.type==='handcartLoaded'&&o.y===0&&
       o.x>=b.x1-5&&o.x<=b.x2+5&&o.z>=b.z1-5&&o.z<=b.z2+5&&!occupied(o)),'stable has receiving yard');
   }
   if(fac==='lodging')assert.ok(objs.some(o=>o.type==='bed'&&o.y===1));
   if(fac==='kitchen')assert.ok(objs.some(o=>o.type==='barrel'&&o.y===-1));
  }
 }
});
test('base stamps are exact rotations and it has a well, signed inn and outdoor street lamps',()=>{
 const b=buildFacilitySite('base');
 assert.equal(b.buildings.length,10);
 const bWorld=b.map.world;
 assert.ok(bWorld.some(o=>o.type==='wellStone'));
 assert.ok(bWorld.some(o=>o.type==='poiInnSign'&&o.y===0));
 const streetLamps=bWorld.filter(o=>o.type==='poiStreetLamp');
 assert.ok(streetLamps.length>=3);
 assert.ok(streetLamps.every(o=>o.y===0&&!b.buildings.some(c=>c.footprint.some(p=>p.x===o.x&&p.z===o.z))));
 for(const id of ids.filter(id=>id!=='base'))for(const src of buildFacilitySite(id).buildings){
  const single=buildFacilitySite(id),dst=b.buildings.find(x=>x.id===src.id);
  assert.ok(dst,'base counterpart: '+src.id);
  const w=src.x2-src.x1+1,d=src.z2-src.z1+1;
  const stamp=(map,region)=>Array.from(map.world.filter(o=>region.footprint.some(p=>p.x===o.x&&p.z===o.z)),
    o=>[o.x-region.x1,o.z-region.z1,o.y,o.type,o.rot]);
  const turns=[(x,z)=>[x,z],(x,z)=>[d-1-z,x],(x,z)=>[w-1-x,d-1-z],(x,z)=>[z,w-1-x]];
  assert.ok(turns.some((turn,r)=>sort(stamp(single.map,src).map(([x,z,y,t,q])=>[...turn(x,z),y,t,(q+r)%4]))===sort(stamp(b.map,dst))),id);
 }
});
test('interior route lighting is wall-mounted and street lamps stay outside',()=>{
 for(const id of ids){
  const {map,buildings}=buildFacilitySite(id);
  const guild=buildings.find(b=>b.id==='townGuild');
  assert.ok(map.world.filter(o=>o.type==='lantern').every(o=>
   guild&&o.x>=guild.x1&&o.x<=guild.x2&&o.z>=guild.z1&&o.z<=guild.z2+1));
  const sconces=map.world.filter(o=>o.type==='poiWallSconce');
  assert.ok(sconces.length>=(id==='base'?25:id==='homes'?6:3),id);
  for(const s of sconces){
   const b=buildings.find(x=>x.floorFootprints[s.y]?.some(p=>p.x===s.x&&p.z===s.z));
   const [dx,dz]=dirs[s.rot];
   assert.ok(b?.floorFootprints[s.y]?.some(p=>p.x===s.x+dx&&p.z===s.z+dz),id+' mount points inside');
   assert.ok(map.world.some(o=>o.x===s.x&&o.z===s.z&&o.y===s.y&&/^(?:wood|stone|plaster|moss|brick)wall$/.test(o.type)),id+' mount has a solid supporting wall at '+key(s.x,s.z,s.y));
  }
 }
 assert.ok(buildFacilitySite('kitchen').map.world.some(o=>o.type==='poiWallSconce'&&o.y===-1));
});
for(const [id,index,x,z,y] of [['kitchen',1,8,4,-1],['workshop',2,9,3,0]]){
 test('walk all the way into the '+id+' annex',()=>{
  for(const scope of [id,'base']){
   const site=buildFacilitySite(scope),b=site.buildings[scope==='base'?index:0];
   const [gx,gz]=scope!=='base'?[b.x1+x,b.z1+z]:id==='kitchen'?[b.x1+z,b.z2-x]:[b.x2-z,b.z1+x];
   assert.ok(explore(site).has(key(gx,gz,y)),scope+' can reach '+id+' end of east annex at '+gx+','+gz+','+y);
  }
 });
}
function groundInn(scope){
 const site=buildFacilitySite(scope),b=site.buildings[0];
 const local=site.map.world.filter(o=>o.x>=b.x1&&o.x<=b.x2&&o.z>=b.z1&&o.z<=b.z2)
  .map(o=>({...o,x:o.x-b.x1,z:o.z-b.z1}));
 return {local,b,reachable:explore(site),at:(x,z,y=0)=>local.filter(o=>o.x===x&&o.z===z&&o.y===y)};
}
test('inn 1F walls have no diagonal-only joints',()=>{
 for(const scope of ['lodging','base']){
  const {at}=groundInn(scope);
  const wall=(x,z)=>at(x,z).some(o=>/wall(?:Door|Window)?$/.test(o.type));
  for(let x=0;x<10;x++)for(let z=0;z<9;z++){
   const a=wall(x,z),b=wall(x+1,z),c=wall(x,z+1),d=wall(x+1,z+1);
   assert.ok(!((a&&d&&!b&&!c)||(b&&c&&!a&&!d)),'diagonal-only 2×2 joint at '+x+','+z);
  }
 }
});
test('inn public washroom preserves 2×2 clear area and no tub; private owner water room is separate',()=>{
 for(const scope of ['lodging','base']){
  const {b,at,local,reachable}=groundInn(scope);
  for(const [x,z] of [[1,6],[2,6],[1,7],[2,7]]){
   assert.ok(at(x,z).some(o=>floorIds.test(o.type))&&at(x,z).every(o=>floorIds.test(o.type)));
   assert.ok(reachable.has(key(b.x1+x,b.z1+z,0)));
  }
  assert.ok(at(1,5).some(o=>o.type==='guildLatrine')&&at(2,5).some(o=>o.type==='kitchenSink'));
  assert.deepEqual(Array.from(local.filter(o=>o.y===0&&o.type==='bathWood'),o=>[o.x,o.z]),[[8,3]]);
 }
});
test('inn has a matched edge stair, accessible counter and wall-backed hearth with aligned chimney',()=>{
 for(const scope of ['lodging','base']){
  const {b,at,local,reachable}=groundInn(scope);
  const has=(x,z,y,t)=>at(x,z,y).some(o=>o.type===t);
  const visit=(x,z,y)=>reachable.has(key(b.x1+x,b.z1+z,y));
  assert.ok(has(8,5,0,'fireplace')&&has(8,5,2,'chimney')&&has(8,4,0,'woodwall'));
  assert.ok(has(10,6,0,'guildStairUp')&&has(10,6,1,'guildStairDown')&&has(11,6,0,'plasterwall'));
  assert.ok(visit(10,5,1)&&visit(10,7,1)&&visit(10,6,0)&&visit(10,6,1));
  assert.equal(local.filter(o=>o.y===0&&o.type==='counterWood').length,2);
  for(const x of [4,5])assert.ok(has(x,8,0,'counterWood')&&visit(x,7,0)&&visit(x,9,0));
  const bench=at(8,8).find(o=>o.type==='benchWood');
  assert.ok(bench&&bench.rot===0&&visit(8,9,0)&&at(8,9).every(o=>floorIds.test(o.type)));
 }
});
test('all built-in facility floors use cardinal wall joins and rooms of at least four tiles',()=>{
 for(const id of ids){
  const a=buildFacilitySite(id);
  for(const [i,b] of a.buildings.entries())for(const [level,tiles] of Object.entries(b.floorFootprints)){
   const wall=new Set(a.map.world.filter(o=>o.y===+level&&/wall(?:Door|Window)?$/.test(o.type)
      &&o.x>=b.x1&&o.x<=b.x2&&o.z>=b.z1&&o.z<=b.z2).map(o=>key(o.x,o.z,level)));
   const has=(x,z)=>wall.has(key(x,z,level));
   for(let x=b.x1;x<b.x2;x++)for(let z=b.z1;z<b.z2;z++){
    const k=has(x,z),m=has(x+1,z),n=has(x,z+1),p=has(x+1,z+1);
    assert.ok(!((k&&p&&!m&&!n)||(m&&n&&!k&&!p)),id+' '+i+' '+level+' diagonal '+x+','+z);
   }
   const available=new Map(Array.from(tiles,o=>[key(o.x,o.z,level),o]).filter(([k])=>!wall.has(k)));
   while(available.size){
    const first=available.keys().next().value,queue=[available.get(first)];
    available.delete(first);
    for(let idx=0;idx<queue.length;idx++){
     const {x,z}=queue[idx];
     for(const [dx,dz] of dirs){
      const k=key(x+dx,z+dz,level);
      if(available.has(k)){queue.push(available.get(k));available.delete(k);}
     }
    }
    assert.ok(queue.length>=4,id+' '+i+' '+level+' room size '+queue.length+' at '+queue[0].x+','+queue[0].z);
   }
  }
 }
});
test('the new store and washrooms each retain four navigable indoor positions after furnishing',()=>{
 const interiors=[['kitchen',1,1,6,2,8],['workshop',2,7,1,9,3],['workshop',2,7,5,9,7]];
 for(const [id,i,x1,z1,x2,z2] of interiors)for(const scope of [id,'base']){
  const site=buildFacilitySite(scope),b=site.buildings[scope==='base'?i:0],reachable=explore(site);
  const point=(x,z)=>scope!== 'base'?[b.x1+x,b.z1+z]:id==='kitchen'?[b.x1+z,b.z2-x]:[b.x2-z,b.z1+x];
  let walkCount=0;
  for(let z=z1;z<=z2;z++)for(let x=x1;x<=x2;x++)if(reachable.has(key(...point(x,z),0)))walkCount++;
  assert.ok(walkCount>=4,scope+' '+id+' interior '+[x1,z1]+' walk count '+walkCount);
 }
});

test('each compact home has four clear washroom cells in standalone neighborhood and town',()=>{
 const boxes={cottage:[1,1,2,3],rowhouse:[4,1,5,3],gardener:[4,3,5,5]};
 for(const id of ['homes','base']){
  const site=buildFacilitySite(id),reachable=explore(site);
  for(const b of site.buildings.filter(b=>Object.hasOwn(boxes,b.id))){
   const turns=[(x,z)=>[x,z],(x,z)=>[6-z,x],(x,z)=>[6-x,6-z],(x,z)=>[z,6-x]];
   const [x1,z1,x2,z2]=boxes[b.id],point=turns[b.turn];
   let clear=0;
   for(let x=x1;x<=x2;x++)for(let z=z1;z<=z2;z++){
    const [dx,dz]=point(x,z);
    if(reachable.has(key(b.x1+dx,b.z1+dz,0)))clear++;
   }
   assert.ok(clear>=4,id+': '+b.id+' has four walkable washroom cells');
  }
 }
});
