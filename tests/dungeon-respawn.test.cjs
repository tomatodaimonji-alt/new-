const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||require('node:path').join(__dirname,'../world-editor.html'),'utf8');
function setup(){
 const start=html.indexOf('// BEGIN DUNGEON POPULATION'),end=html.indexOf('// END DUNGEON POPULATION');
 assert.ok(start>=0&&end>start,'population implementation exists');
 const f={early:{x:115,z:59,y:-1,type:'monsterSlime'},mine:{x:120,z:62,y:-1,type:'monsterSlime'},boss:{x:120,z:55,y:-1,type:'monsterMineGuard'},chapel:{x:76,z:79,y:-1,type:'monsterSlime'},unknown:{x:120,z:62,y:0,type:'monsterSlime'}};
 const c=vm.createContext({facilitySite:{id:'base'},world:Object.values(f),poiWalkActive:true,pineAIActive:false,poiMonsterStates:new Map(),poiMonsterMeshDirty:false,poiWalkLevel:-1,minute:1440*2+1439,kit:{quests:['mine-survey'],gold:19,mineTreasureChest:{keep:1}},writes:0,clockWrites:0,failed:false,
  poiHotbarRead(){return c.kit},poiEconomyWrite(k){if(c.failed)return false;c.kit=k;c.writes++;return true},poiTownClockRead(){},poiTownClockSave(){c.clockWrites++},poiTownClockSnapshot(){return {absoluteMinute:c.minute}},poiDungeonThemeAt(s,x,z,y){return y<0?(z<70?'mine':'chapel'):null},
  poiMineVaultGateOpen(){return !!c.kit.mineGateCleared},poiChapelGateOpen(){return false},poiOtherworldGateOpen(){return false},poiQuestProgress(){return c.kit.mineSurvey||'accepted'},poiCombatActorMake(o){return {hp:100,x:o.x,z:o.z}}});
 vm.runInContext(html.slice(start,end),c);
 return {c,f,run:(str,obj)=>{c.o=obj;return vm.runInContext(str,c)}};
}
test('dead cooldown uses stable authored actor, exact seven days, and no global B1 resets',()=>{
 const {c,f,run}=setup(),dead={hp:0,x:122,z:63};c.s=dead;
 assert.equal(run('poiDungeonRememberDefeat(o,s)',f.mine),true);
 assert.equal(c.clockWrites,1);
 assert.equal(run('poiDungeonActorAbsent(o)',f.mine),true);
 assert.equal(run('poiDungeonActorAbsent(o)',f.chapel),false);
 assert.equal(run('poiDungeonActorAbsent(o)',f.unknown),false);
 c.kit={...JSON.parse(JSON.stringify(c.kit)),mineSurvey:'reported'};
 c.minute+=7*1440-1;
 run('poiDungeonArrive(116,62,0,-1)');
 assert.equal(c.poiMonsterStates.has(f.mine),false);
 c.minute++;
 run('poiDungeonArrive(116,62,0,-1)');
 assert.equal(c.poiMonsterStates.get(f.mine).hp,100);
 c.poiMonsterStates.get(f.mine).hp=15;
 run('poiDungeonArrive(116,62,0,-1)');
 assert.equal(c.poiMonsterStates.get(f.mine).hp,15);
});
test('only first actual accepted quest entry in mine refreshes that realm, including after reload',()=>{
 const {c,f,run}=setup();c.s={hp:0};
 run('poiDungeonRememberDefeat(o,s)',f.mine);
 run('poiDungeonRememberDefeat(o,s)',f.chapel);
 run('poiDungeonArrive(78,84,0,-1)');
 assert.equal(c.kit.dungeonPopulation.questEntries['mine-survey@1'],undefined);
 c.failed=true;
 run('poiDungeonArrive(116,62,0,-1)');
 assert.equal(c.poiMonsterStates.has(f.mine),false);
 c.failed=false;
 run('poiDungeonArrive(116,62,0,-1)');
 assert.equal(c.kit.dungeonPopulation.questEntries['mine-survey@1'],true);
 assert.equal(c.poiMonsterStates.get(f.mine).hp,100);
 assert.equal(run('poiDungeonActorAbsent(o)',f.chapel),true);
 assert.deepEqual(c.kit.mineTreasureChest,{keep:1});assert.equal(c.kit.gold,19);
 c.poiMonsterStates.get(f.mine).hp=0;
 run('poiDungeonRememberDefeat(o,s)',f.mine);
 c.kit=JSON.parse(JSON.stringify(c.kit));
 run('poiDungeonArrive(116,62,0,-1)');
 assert.equal(c.poiMonsterStates.get(f.mine).hp,0);
});
test('empty first visit is consumed; malformed, foreign and future ledger entries are ignored',()=>{
 const {c,f,run}=setup();
 c.kit={...c.kit,dungeonPopulation:{version:1,dead:{'mine.side-slime':c.minute+100,'chapel.slime':-1,'mine.golem':'7','otherworld.wrong':5},questEntries:{'mine-survey@1':'yes',evil:true}}};
 assert.equal(run('poiDungeonActorAbsent(o)',f.mine),false);
 assert.equal(run('poiDungeonPopulationDecode(poiHotbarRead().dungeonPopulation,minute)'),null);
 assert.equal(c.writes,0);
 run('poiDungeonArrive(116,62,0,-1)');
 assert.equal(c.kit.dungeonPopulation.questEntries['mine-survey@1'],true);
 assert.deepEqual(JSON.parse(JSON.stringify(c.kit.dungeonPopulation.dead)),{});
});
test('boss death with a locked gate is not persisted; granted gates/chest survive regeneration',()=>{
 const {c,f,run}=setup();c.s={hp:0};
 assert.equal(run('poiDungeonRememberDefeat(o,s)',f.boss),false);
 c.kit={...c.kit,mineGateCleared:true,claimedCaches:['mine-guardian']};
 assert.equal(run('poiDungeonRememberDefeat(o,s)',f.boss),true);
 run('poiDungeonArrive(116,62,0,-1)');
 assert.equal(c.kit.mineGateCleared,true);assert.deepEqual(c.kit.claimedCaches,['mine-guardian']);
 assert.equal(c.poiMonsterStates.get(f.boss).hp,100);
});
