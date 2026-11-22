const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),{createHash}=require('node:crypto');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const slice=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)+1));
const build=vm.runInNewContext(slice('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+';buildFacilitySite');
const site=JSON.parse(JSON.stringify(build('base'))),world=site.map.world;
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const at=(x,z,y)=>world.filter(o=>o.x===x&&o.z===z&&o.y===y);
test('new mine extends the released Game World without replacing a single old record or metadata field',()=>{
 const {map,mine,...other}=site;assert(mine,'missing mine');
 assert.deepEqual([map.width,map.height,site.buildings.length],[128,96,10]);
 assert.equal(digest(other),'1fe3ca0f69ad209420343d6902ebe2567ceaf5018a0e3d3164dd30902a3e3408');
 assert.equal(digest(world.slice(0,5677)),'1c61c5eaf7e8dd919a8091ebca761b0f72b81e7157cb607f1d4de23a56ea4f82');
 assert(world.length>5677&&world.length<5840,'keep additions tightly bounded');
 assert.equal(new Set(world.map(o=>JSON.stringify(o))).size,world.length);
 for(const scope of ['kitchen','lodging','homes'])assert(!build(scope).mine);
});
test('the east gate and the original bridge connect to a real stair pair, early encounter and flankable guardian chamber',()=>{
 const mine=site.mine;assert(mine);
 const isFloor=t=>/^(?:road|stone$|moss$|earth$|grass|river$|water$|brickfloor$|woodfloor)/.test(t);
 const creature=t=>t==='monsterSlime'||t==='monsterMineGuard';
 const bridges=[...site.creek.crossings,...(site.canal?.bridgePairs||[]).flat()];
 const ctx=vm.createContext({facilitySite:{...site,id:'base'},world,poiWalkActive:true,poiWalkLevel:0,
  facilityCreekIndex:{water:new Set([...site.creek.deep,...(site.canal?.water||[])].map(p=>p.x+','+p.z)),
   parts:new Map(bridges.map(p=>[p.x+','+p.z,world.find(o=>o.x===p.x&&o.z===p.z&&o.y===0&&o.type===p.type)])),
   terrace:new Set(),shallows:new Map()},poiMonsterAt:()=>null,poiIsMonster:creature,isFloor,
  validPos:(x,z)=>x>=0&&x<128&&z>=0&&z<96,pineSuperVehicleType:()=>false,isWallId:t=>/wall/i.test(t),facilityFloorOwner:()=>null});
 vm.runInContext(slice('function poiWalkPassableDoor(','let facilityCreekIndex=')+
  slice('function poiWalkCanStep(','function poiWalkCamera(')+slice('function facilityValidLanding(','function facilityUsesGuildRendering('),ctx);
 const walk=(x,z,xx,zz)=>ctx.poiWalkCanStep(x,z,xx,zz);
 function reachable(start,target,bounds){
  const key=(x,z)=>x+','+z,seen=new Set([key(...start)]),q=[start];
  for(let i=0;i<q.length;i++){
   const [x,z]=q[i];if(x===target[0]&&z===target[1])return true;
   for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const xx=x+dx,zz=z+dz,k=key(xx,zz);
    if(seen.has(k)||xx<bounds[0]||xx>bounds[2]||zz<bounds[1]||zz>bounds[3]||!walk(xx,zz,x,z))continue;
    seen.add(k);q.push([xx,zz]);
   }
  }
  return false;
 }
 assert(reachable([84,67],[116,62],[84,54,124,69]));
 assert(at(116,64,0).some(o=>o.type==='mineEntrance'));
 assert(at(116,62,0).some(o=>o.type==='guildStairDown'&&o.rot===2));
 assert(at(116,62,-1).some(o=>o.type==='guildStairUp'&&o.rot===2));
 ctx.poiWalkLevel=-1;
 assert(at(115,59,-1).some(o=>o.type==='monsterSlime'));
 assert(at(120,55,-1).some(o=>o.type==='monsterMineGuard'));
 for(const target of [[115,60],[120,56],[118,54],[122,54],[120,53],[116,62]])
  assert(reachable([116,62],target,[112,52,123,63]),'walkable mine route '+target);
 assert(!walk(124,55,123,55));
});
