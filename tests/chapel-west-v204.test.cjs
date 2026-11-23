const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{createHash}=require('node:crypto');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i+a.length);assert(i>=0&&j>i,a);return html.slice(i,j)};
const build=vm.runInNewContext(cut('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+';buildFacilitySite');
const {beforeMinePrep}=require('./mine-history-v165.cjs');
const site=beforeMinePrep(JSON.parse(JSON.stringify(build('base')))),chapel=site.chapel,world=site.map.world;
const floor=/^(?:stone|moss|water|road\w+)$/,key=(x,z)=>x+','+z;
const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
const at=(x,z)=>world.filter(o=>o.y===-1&&o.x===x&&o.z===z);
const historic=[[6474,75,87,'mosswall',0],[6506,74,80,'mosswall',0],[6523,74,87,'mosswall',0],[6529,75,87,'poiWallSconce',3]];
test('only the chapel wing and four exact junction records differ from the released world',()=>{
 assert(chapel.expansion,'west expansion present');
 const old=world.slice(0,7160);
 for(const [i,x,z,type,rot] of historic){assert.notDeepEqual(old[i],{x,z,y:-1,type,rot});old[i]={x,z,y:-1,type,rot}}
 assert.equal(createHash('sha256').update(JSON.stringify(old)).digest('hex'),'dddcb6c5946c92b6de0e766b8df416dae20f34babaaf1f9608422a163e7cada4');
 assert(world.slice(7160).every(p=>p.y===-1&&p.x>=59&&p.x<=75&&p.z>=77&&p.z<=90),'addition bounded to west of chapel');
 assert.deepEqual(chapel.expansion.originalBounds,{x1:74,x2:82,z1:73,z2:90,y:-1});
 assert.equal(chapel.difficulty,3);assert.equal(site.otherworld.difficulty,4);
 assert(!build('kitchen').chapel);
});
test('shipped collision: two dry entrances, reachable discovery, and no new way around the vault gate',()=>{
 const {expansion:e}=chapel;assert(e,'west expansion present');
 const c={world,facilitySite:{...site,id:"base"},poiWalkActive:true,poiWalkLevel:-1,facilityCreekIndex:null,
  validPos:(x,z)=>x>=0&&x<128&&z>=0&&z<96,poiIsMonster:t=>t.startsWith('monster'),poiMonsterAt:()=>null,gateOpen:false,
  isWallId:t=>/wall/i.test(t),pineSuperVehicleType:()=>false,poiChapelGateOpen:()=>c.gateOpen};
 vm.createContext(c);
 vm.runInContext([
  cut('const ROAD_BASES=','const baseRoad='),
  cut('function isFloor(','\n'),
  cut('function facilityValidLanding(','function facilityUsesGuildRendering('),
  cut('function poiWalkPassableDoor(','let facilityCreekIndex'),
  cut('function poiChapelWater(','const POI_CHAPEL_WET_MS'),
  cut('function poiOtherworldPortalAt(','function poiOtherworldUseStep('),
  cut('function poiWalkCanStep(','function poiWalkCamera(')
 ].join('\n'),c);
 const walk=(start,exclude=()=>false)=>{
  const q=[[start.x,start.z]],seen=new Set([key(start.x,start.z)]);
  for(let j=0;j<q.length;j++)for(const [dx,dz] of dirs){
   const [x,z]=q[j],xx=x+dx,zz=z+dz,k=key(xx,zz);
   if(seen.has(k)||exclude(xx,zz)||!c.poiWalkCanStep(xx,zz,x,z))continue;
   seen.add(k);q.push([xx,zz]);
  }
  return seen;
 };
 const dry=(x,z)=>at(x,z).some(o=>o.type==='water');
 const mainDoor=(x,z)=>x===74&&z===80,lowerDoor=(x,z)=>x===75&&z===87;
 const reachable=walk(chapel.dungeonStand,dry);
 assert(reachable.size>=140&&reachable.size<238,'real walkable pre-vault size, without counting shallow water');
 assert(e.cells.filter(p=>reachable.has(key(p.x,p.z))).length>=95);
 assert(walk(chapel.dungeonStand,(x,z)=>dry(x,z)||mainDoor(x,z)).has(key(e.reward.x,e.reward.z)),'lower seam accesses entire west option');
 assert(walk(chapel.dungeonStand,(x,z)=>dry(x,z)||lowerDoor(x,z)).has(key(e.reward.x,e.reward.z)),'north seam accesses the same discovery via the original dry aisle');
 assert(!walk(chapel.dungeonStand,(x,z)=>dry(x,z)||mainDoor(x,z)||lowerDoor(x,z)).has(key(e.reward.x,e.reward.z)));
 const goal=key(chapel.chestStand.x,chapel.chestStand.z);assert(!reachable.has(goal));
 c.gateOpen=true;assert(walk(chapel.dungeonStand,dry).has(goal));
 assert.equal(c.poiWalkCanStep(77,83,78,83),false,'adjacent deep water still blocks');
 assert.equal(c.poiWalkCanStep(78,83,78,84),true,'original shallow crossing still works');
});
test('boundary stone joins orthogonally and relocated/new sconces attach to walls',()=>{
 assert(chapel.expansion,'west expansion present');
 const b=chapel.bounds;
 const courtyard=world.filter(o=>o.y===-1&&o.x>=b.x1&&o.x<=b.x2&&o.z>=b.z1&&o.z<=b.z2);
 const walls=new Set(courtyard.filter(o=>/^(?:stone|moss)wall$/.test(o.type)).map(o=>key(o.x,o.z)));
 const facing=[[0,1],[-1,0],[0,-1],[1,0]];
 for(const k of walls){const [x,z]=k.split(',').map(Number);assert(!at(x,z).some(o=>floor.test(o.type)),k);
  for(const dz of [-1,1])if(walls.has(key(x+1,z+dz)))assert(walls.has(key(x+1,z))||walls.has(key(x,z+dz)),k+' diagonal');
 }
 const lights=[world[6529],...world.slice(7160).filter(o=>o.type==='poiWallSconce')];
 for(const o of lights){const [dx,dz]=facing[o.rot];assert(walls.has(key(o.x,o.z))&&at(o.x+dx,o.z+dz).some(q=>floor.test(q.type)),key(o.x,o.z))}
});
