const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),{createHash}=require('node:crypto');
const {beforeMineDepths,beforeOtherworld}=require('./mine-history-v165.cjs');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const slice=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)+1));
const build=vm.runInNewContext(slice('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+';buildFacilitySite');
const site=beforeOtherworld(JSON.parse(JSON.stringify(build('base')))),world=site.map.world;
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const at=(x,z,y)=>world.filter(o=>o.x===x&&o.z===z&&o.y===y);
test('new mine extends the released Game World without replacing a single old record or metadata field',()=>{
 const {map,mine,...other}=site;assert(mine,'missing mine');
 assert.deepEqual([map.width,map.height,site.buildings.length],[128,96,10]);
 assert.equal(digest(other),'1fe3ca0f69ad209420343d6902ebe2567ceaf5018a0e3d3164dd30902a3e3408');
 assert.equal(digest(world.slice(0,5677)),'1c61c5eaf7e8dd919a8091ebca761b0f72b81e7157cb607f1d4de23a56ea4f82');
 assert(world.length>5677&&world.length<6105,'keep additions tightly bounded');
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
 for(const target of [[115,60],[120,56],[117,51],[117,56],[124,51],[124,56],[120,53],[116,62]])
  assert(reachable([116,62],target,[112,50,125,63]),'walkable mine route '+target);
 assert(!walk(125,55,124,55));
});
test('the mine B1 wall ring has no diagonal-only joins, without replacing its traversable floor',()=>{
 const parcel=world.slice(5677).filter(o=>o.y===-1);
 const walls=parcel.filter(o=>/^(?:stone|moss)wall$/.test(o.type)),key=(x,z)=>x+','+z;
 const byCell=new Set(walls.map(({x,z})=>key(x,z)));
 const seen=new Set(),components=[];
 for(const seed of walls){
  const root=key(seed.x,seed.z);if(seen.has(root))continue;
  seen.add(root);const queue=[[seed.x,seed.z]];
  for(let i=0;i<queue.length;i++){
   const [x,z]=queue[i];
   for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const xx=x+dx,zz=z+dz,k=key(xx,zz);
    if(byCell.has(k)&&!seen.has(k)){seen.add(k);queue.push([xx,zz])}
   }
  }
  components.push(queue);
 }
 assert.equal(components.length,2,'one external wall ring and one natural island inside the return loop');
 assert.deepEqual(components.map(c=>c.length).sort((a,b)=>a-b),[12,151]);
 for(const {x,z} of walls)for(const dz of [-1,1])
  if(byCell.has(key(x+1,z+dz)))assert(byCell.has(key(x+1,z))||byCell.has(key(x,z+dz)),
   'cardinal bridge at '+[x,z,x+1,z+dz]);
 assert(walls.every(w=>!parcel.some(o=>o.x===w.x&&o.z===w.z&&/^(?:stone|moss)$/.test(o.type))),
  'all cardinal connectors and side walls stay outside the playable floor');
});

test('the guardian room is exactly eight by six clear tiles, with the same south entrance',()=>{
 const {chamber,guardian}=site.mine;
 assert.deepEqual(chamber,{x1:117,x2:124,z1:51,z2:56});
 for(let x=chamber.x1;x<=chamber.x2;x++)for(let z=chamber.z1;z<=chamber.z2;z++){
  const cell=at(x,z,-1),floor=cell.filter(o=>/^(?:stone|moss)$/.test(o.type));
  assert.equal(floor.length,1,'authored arena floor at '+[x,z]);
  const contents=cell.filter(o=>!floor.includes(o));
  if(x===guardian.x&&z===guardian.z)assert.equal(contents[0]?.type,'monsterMineGuard');
  else assert.equal(contents.length,0,'clear walking and dodging space at '+[x,z]);
 }
 assert.deepEqual([guardian.x,guardian.z,guardian.y],[120,55,-1]);
 for(let x=chamber.x1;x<=chamber.x2;x++){
  const border=at(x,57,-1);
  if(x===120)assert(border.some(o=>/^(?:stone|moss)$/.test(o.type))&&!border.some(o=>/wall$/.test(o.type)));
  else assert(border.some(o=>/wall$/.test(o.type)),'only the original entry stays open');
 }
});

test('only the guardian chamber and its surrounding B1 walls changed',()=>{
 const old=[120,55,-1,'monsterMineGuard',0];
 assert(world.some(o=>[o.x,o.z,o.y,o.type,o.rot].join(',')===old.join(',')));
 const untouched=beforeMineDepths(world).slice(5677).filter(o=>!(o.y===-1&&o.x>=116&&o.x<=125&&o.z>=50&&o.z<=57)&&o.type!=='mineSurveyMarker');
 assert.equal(digest(untouched),'500cee7863858973829f4ea766bed79c40ad1a999a3ec151df0986e51c142216',
  'exact v166 arrival trail, portal, stair, early encounter, other lighting and corridor records');
});
test('mine survey plaque mounts on the north face of a wall beside the safe approach',()=>{
 assert.deepEqual(site.mine.survey,{x:119,z:59,y:-1,type:'mineSurveyMarker',stand:{x:119,z:58,y:-1,facing:2}});
 assert.deepEqual(beforeMineDepths(world).at(-1),{x:119,z:59,y:-1,type:'mineSurveyMarker',rot:2});
 assert(at(119,59,-1).some(o=>/wall$/.test(o.type)),'a real wall supports the plaque');
 assert.deepEqual(at(119,58,-1).map(o=>o.type),['stone'],'safe observation tile remains empty');
 assert.match(html,/case 'mineSurveyMarker':\{/);
 assert.match(html,/id:'mineSurveyMarker'[^\n]*cat:'decor'/);
});
test('three guarded-mine side rooms are reachable before the chamber and a gated vault continues north',()=>{
 const mine=site.mine;
 assert.deepEqual(mine.vault,{gate:{x:121,z:47,y:-1,type:'ironGate'},chest:{x:121,z:43,y:-1,type:'rewardChest'},stand:{x:121,z:44,y:-1,facing:0}});
 const atFloor=(x,z)=>at(x,z,-1).some(o=>/^(?:stone|moss)$/.test(o.type));
 const blocked=new Set(['119,59','114,61','117,60','121,43','121,47']);
 const reach=(opened,excludeChamber,from=[116,62],ignore=[])=>{
  const key=(x,z)=>x+','+z,q=[from],seen=new Set(q.map(p=>key(...p)));
  for(let i=0;i<q.length;i++)for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const [xx,zz]=[q[i][0]+dx,q[i][1]+dz],k=key(xx,zz),c=mine.chamber;
   if(seen.has(k)||ignore.includes(k)||!atFloor(xx,zz)||blocked.has(k)&&!(opened&&k==='121,47'))continue;
   if(excludeChamber&&xx>=c.x1&&xx<=c.x2&&zz>=c.z1&&zz<=c.z2)continue;
   if(at(xx,zz,-1).some(o=>!/^(?:stone|moss|guildStairUp|monsterSlime|monsterMineGuard|ironGate)$/.test(o.type)))continue;
   seen.add(k);q.push([xx,zz]);
  }
  return seen;
 };
 assert.equal(mine.sideFinds.length,3);
 const start=reach(false,true);
 for(const find of mine.sideFinds){
  assert(start.has(find.x+','+find.z),'side-find is reached without entering golem room: '+find.id);
  assert(at(find.x,find.z,find.y).every(o=>/^(?:stone|moss)$/.test(o.type)));
 }
 assert(start.has('119,58'),'original survey retained');
 assert(reach(false,true,[109,55],['113,60']).has('119,58'),'do not have to retreat back to west spur mouth before survey');
 assert(!reach(false,false).has('121,44'),'closed gate cannot be bypassed');
 assert(reach(true,false).has('121,44'),'open vault is reached through far side of chamber');
 assert(!reach(true,true).has('121,44'),'vault never accessible around the golem room');
 assert(at(121,47,-1).some(o=>o.type==='ironGate'&&o.rot===0));
 assert(at(121,43,-1).some(o=>o.type==='rewardChest'&&o.rot===0));
});
