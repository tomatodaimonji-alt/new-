const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const h=fs.readFileSync(process.env.QA_HTML||'world-editor.html','utf8');
const slice=(a,b)=>{const i=h.indexOf(a),j=h.indexOf(b,i+1);assert.ok(i>=0&&j>i);return h.slice(i,j)};
const build=vm.runInNewContext(slice('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+';buildFacilitySite');
const roles=vm.runInNewContext(slice('const POI_TOWN_RESIDENT_ROLES=Object.freeze(','const POI_TOWN_INN=')+';POI_TOWN_RESIDENT_ROLES');
const key=(x,z,y)=>x+','+z+','+y,authored=build('base');
function setup(id,x,z,facing){
 const site=structuredClone(authored),world=site.map.world,role=roles.find(p=>p.id===id),actor={...role.work,role,activity:'work'};
 const g={cells:new Map()};
 const rebuild=()=>{g.cells.clear();for(const o of world){const k=key(o.x,o.z,o.y);g.cells.set(k,[...(g.cells.get(k)||[]),o.type]);}};
 rebuild();
 const c={world,facilitySite:site,poiWalkX:x,poiWalkZ:z,poiWalkLevel:0,poiWalkFacing:facing,poiTownDialogue:null,
  poiTownNpcActors:[actor],poiTownNpcActive:()=>true,poiTownNpcGraph:()=>g,poiTownNpcStance:(p,g)=>!(g.cells.get(key(p.x,p.z,p.y))||[]).includes('rock'),
  poiTownNpcKey:key,poiMonsterStates:new Map(),poiTownNpcSleeping:()=>false,poiNpcAtWork:a=>a.activity==='work',isFloor:t=>/^(?:woodfloor|stone)/.test(t)&&!t.endsWith('wall'),
  poiTownNpcNextTile:()=>null,poiTownDialogueMovingTarget:()=>Infinity,
  poiTownPlayerService:()=>id==='innkeeper'?'book':null,poiShopCheckout:()=>id==='toolkeeper'};
 vm.createContext(c);const start=h.includes('function poiTownCounterTalkReachable(')?'function poiTownCounterTalkReachable(':'function poiTownDialogueTarget(';
 vm.runInContext(slice(start,'function poiTownDialogueSnapshot(')+slice('function poiNpcToolshopCounter(','function poiNpcAtWork('),c);
 return {c,actor,world,rebuild};
}
test('all five live service counters retain guild/inn/shop talk and enable workshop/dining talk',()=>{
 for(const [id,x,z,dir] of [
  ['guildkeeper',56,29,0],['innkeeper',41,32,0],['toolkeeper',69,35,1],
  ['workshopkeeper',78,32,1],['diningkeeper',31,38,0]
 ]){
  const {c,actor}=setup(id,x,z,dir);
  const target=c.poiTownDialogueTarget(1800);assert.equal(target,actor,id);
  assert.equal(c.poiNpcMenuService(target),id==='innkeeper'?'stay':id==='toolkeeper'?'shop':null);
 }
});
test('cannot talk through a wall or table stacked at the actual service counter, from diagonal, or the wrong floor',()=>{
 const {c,world,rebuild}=setup('toolkeeper',69,35,1);
 for(const type of ['woodwall','table','tallGrass']){
  world.push({x:70,z:35,y:0,type});rebuild();
  assert.equal(c.poiTownDialogueTarget(1800),null,type);world.pop();rebuild();
 }
 c.poiWalkFacing=0;assert.equal(c.poiTownDialogueTarget(1800),null);c.poiWalkFacing=1;
 c.poiWalkLevel=1;assert.equal(c.poiTownDialogueTarget(1800),null);c.poiWalkLevel=0;
 const desk=world.find(o=>o.x===70&&o.z===35&&o.y===0&&o.type==='counterLuxury');
 desk.rot=0;assert.equal(c.poiTownDialogueTarget(1800),null,'not through the short end');desk.rot=1;
 c.poiWalkZ++;assert.equal(c.poiTownDialogueTarget(1800),null);
});
