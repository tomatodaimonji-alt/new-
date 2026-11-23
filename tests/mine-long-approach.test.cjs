const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),{createHash}=require('node:crypto');
const {beforeMineLongApproach}=require('./mine-history-v165.cjs');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const build=vm.runInNewContext(h.slice(h.indexOf('const FACILITY_SITES=Object.freeze('),h.indexOf('function workshopResumeDecode('))+';buildFacilitySite');
const base=JSON.parse(JSON.stringify(build('base'))),{mine}=base,w=base.map.world;
const key=(x,z)=>x+','+z,by=new Map();
for(const o of w.filter(o=>o.y===-1)){const k=key(o.x,o.z); if(!by.has(k))by.set(k,[]);by.get(k).push(o.type)}
const floor=t=>/^(?:stone|moss|roadw+)$/.test(t);
function route(start,goal,blocked=[]){
 const q=[start],prev=new Map([[key(...start),null]]),block=new Set(blocked.map(p=>key(...p)));
 const pass=records=>records?.some(floor)&&records.every(t=>floor(t)||/^monster/.test(t)||['guildStairUp','ruinDoorBroken','benchWood','stoolRound','poiWallSconce'].includes(t));
 for(let i=0;i<q.length;i++){
  const [x,z]=q[i],here=key(x,z);
  if(here===key(...goal)){const a=[];for(let k=here;k;k=prev.get(k))a.unshift(k);return a}
  for(const [xx,zz] of [[x-1,z],[x+1,z],[x,z-1],[x,z+1]]){
   const k=key(xx,zz);
   if(block.has(k)||prev.has(k)||!pass(by.get(k)))continue;
   prev.set(k,here);q.push([xx,zz]);
  }
 }
 return null;
}
test('only the right slime remains; west storeroom route is the sole connection to guardian and not a vault bypass',()=>{
 assert.equal(mine.early,null);
 assert.deepEqual(mine.earlyRoom.slimes,[{x:120,z:62,y:-1,type:'monsterSlime'}]);
 assert.deepEqual(w.filter(p=>p.y===-1&&p.type==='monsterSlime'&&(p.x===115||p.x===120)&&p.z>=59&&p.z<=62).map(p=>[p.x,p.z]),[[120,62]]);
 for(const x of [115,120]){
  assert(by.get(key(x,57)).some(t=>/wall$/.test(t)));
  assert(route([116,62],[x,58]),'retreat and resume fallback available');
 }
 const spine=route([116,62],[120,55]);
 assert(spine&&spine.length>=24,'extended walk before combat');
 for(const p of [[113,60],[109,58],[113,55],[113,54],[114,54],[115,54],[116,54],[117,54]])
  assert(spine.includes(key(...p)),String(p));
 assert.equal(route([116,62],[120,55],[[116,54]]),null);
 assert.equal(route([116,62],[121,44]),null,'closed iron gate still blocks vault');
 assert(route([116,62],[119,58]),'survey stand accessible before boss');
});

test('restoring two seals, two cuts and one slime reproduces prior authored map and metadata',()=>{
 const previous=beforeMineLongApproach(base),{world,...map}=previous.map;
 const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
 assert.equal(world.length,7572);
 assert.equal(hash({...previous,map}),'e8ab4d8b17343d9b1aab81a79bcad5420b421ff11cc25e5de7970459ff64c722');
 assert.deepEqual(mine.approach.closed,[115,120].map(x=>({x,z:57,y:-1,fallback:{x,z:58,y:-1}})));
 for(let x=112;x<=116;x++)assert(by.get(key(x,53)).some(t=>/wall$/.test(t)),x+' joins the new north wall orthogonally');
});
