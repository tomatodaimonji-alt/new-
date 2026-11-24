const a=require('node:assert/strict'),{test}=require('node:test'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(p,q)=>{const i=h.indexOf(p),j=h.indexOf(q,i+p.length);a(i>=0&&j>i,p);return h.slice(i,j)};
test('same authored maximum durability; existing distinct ownership and mode codec can switch without resetting HP',()=>{
 const c=vm.createContext({POI_MONSTER_STATS:{monsterStoneDavid:{hp:1050}}});
 vm.runInContext(cut('const POI_COMPANION_SPEC','function poiCompanionReconcile('),c);
 const spec=c.poiCompanionType('orvasSoul');
 a(spec,'actual Orvas profile registered');a.equal(spec.enemy,'monsterStoneDavid');a.equal(spec.name,'オルヴァスの魂');a.equal(spec.hp,1050);a.equal(spec.roll,0);
 const record=c.poiCompanionDecode({version:1,pending:'slimeSoul',active:'orvasSoul',mode:'fight'});
 a.equal(record.pending,'slimeSoul');a.equal(record.active,'orvasSoul');a.equal(record.mode,'fight');
});
test('the Orvas actor routes to its isolated native combat rather than the old miniature swing',()=>{
 a.match(h,/a\.id==='orvasSoul'[^\n]*poiOrvasAllyResolve\(a,now,mode\)/);
 a.match(h,/\(distance<=POI_ORVAS_ALLY_TETHER\|\|(?:latch|liveOrvasBoss)\)\?poiOrvasAllyEngage\(a,now\)/);
 const runtime=cut('// BEGIN ORVAS ALLY BOSS RUNTIME','// END ORVAS ALLY BOSS RUNTIME');
 a.doesNotMatch(runtime,/poiDavidActive\s*=/);
});
test('the original model keeps full scale at a doorway; allied shatter cache never mutates original material',()=>{
 const c=vm.createContext({facilitySite:{buildings:[{id:'toolshop'}]},facilityFloorOwner:(x,z)=>x===16&&z===8?0:null});
 vm.runInContext(cut('// BEGIN ORVAS COMPANION GEOMETRY','// END ORVAS COMPANION GEOMETRY'),c);
 a.equal(c.poiCompanionOrvasScale({x:13,z:8,y:0}),1);
 a.equal(c.poiCompanionOrvasScale({x:15,z:8,y:0}),1);
 a.equal(c.poiCompanionOrvasScale({x:2,z:4,y:-1}),1);
 const old=[{cx:1,cy:2,cz:3,part:{p:[1,2,3],n:[0,1,0],c:[.9,.1,.1]}}];
 const scaled=c.poiCompanionScaledFragments(old,1);
 a.equal(scaled[0].cy,2);a.equal(scaled[0].part.p[2],3);
 a.equal(scaled[0].part.c[2],.1);a.equal(old[0].part.p[2],3);
 a.equal(c.poiCompanionScaledFragments(old,1),scaled);
});
test('the guaranteed ground soul adds its own visible geometry at the real loot coordinate',()=>{
 const c=vm.createContext({tri:(m,...v)=>m.p.push(...v.slice(0,3).flat())});
 vm.runInContext(cut('// BEGIN ORVAS COMPANION GEOMETRY','// END ORVAS COMPANION GEOMETRY'),c);
 const m={p:[]};c.poiDrawOrvasSoulDrop(m,24.5,.05,105.5);
 a(m.p.length>=72);
 a(Math.max(...m.p.filter((_,i)=>i%3===1))>.35);
 a.match(h,/d\.type==='orvasSoul'[^\n]*poiDrawOrvasSoulDrop\(m,x,y,z\)/);
});
test('real cold hotbar decoder reads the authored death ledger and every physical drop without altering stored data',()=>{
 const cells=Array(27).fill(null);cells[0]={type:'equipWoodSword',count:1,durability:150};cells[1]={type:'slimeSoul',count:1,durability:29};
 const seed={version:1,weaponDurabilityVersion:2,weapon:null,potions:0,slots:cells,orvasRewards:15,
  companionSoul:{version:1,active:'slimeSoul',pending:null},dungeonPopulation:{version:1,dead:{'davidTemple.david':450},questEntries:{}},
  armedDrops:[{id:'orvas-head',type:'equipOrvasHead',x:24,z:103,y:0,durability:100},
   {id:'orvas-greatsword',type:'equipOrvasGreatsword',x:25,z:104,y:0,durability:220},
   {id:'orvas-twin-greatswords',type:'equipOrvasTwinGreatswords',x:23,z:104,y:0,durability:210},
   {id:'orvas-soul',type:'orvasSoul',x:24,z:105,y:0,durability:1050}]};
 const data=new Map([['world-workshop-hotbar-v1',JSON.stringify(seed)],
  ['world-workshop-town-clock-v1','{"version":1,"gameMs":240000}']]),writes=[];
 const c=vm.createContext({POI_MONSTER_STATS:{monsterStoneDavid:{hp:1050}},MAX_MAP:128,poiDavidDepthGroundPoint:d=>d.x===24&&d.z===159,facilitySite:{id:'base'},poiWalkActive:true,pineAIActive:false,
  poiWalkLevel:0,poiWalkX:24,poiWalkZ:102,world:[],poiMonsterStates:new Map(),document:{hidden:false},
  localStorage:{getItem:key=>data.get(key)??null,setItem:(key,value)=>writes.push([key,value])}});
 vm.runInContext(cut('function poiDungeonThemeAt(','function poiDungeonEnterEffect(')+
  cut('const POI_TOWN_CLOCK_KEY=','function poiTownClockSuspend(')+cut('// BEGIN MONSTER COMPANION CORE','function poiResetCombat('),c);
 const read=JSON.parse(vm.runInContext('JSON.stringify(poiHotbarRead())',c));
 a.equal(read.orvasRewards,31);a.deepEqual(read.armedDrops.slice(0,3),seed.armedDrops.slice(0,3).map(d=>({...d,z:d.z+54})));
 a.deepEqual(read.soulDrops,[{type:'orvasSoul',x:24,z:159,y:0,durability:1050}]);
 a.deepEqual(read.armedDrops[3],{id:'orvas-waistcloth',type:'armorOrvasWaistcloth',x:25,z:159,y:0,durability:96});
 a.equal(read.dungeonPopulation.dead['davidTemple.david'],450);
 a.deepEqual(read.slots[1],cells[1]);a.equal(read.companionSoul.active,'slimeSoul');
 a.equal(writes.length,0);
});
