const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),test=require('node:test');
const html=fs.readFileSync(process.env.PRODUCT||'world-editor.html','utf8');
function grab(start,end){const i=html.indexOf(start),j=html.indexOf(end,i+1);return i>=0&&j>i?html.slice(i,j):''}
function fixture(){
 const data={kit:{potions:2},writes:[],poiWalkActive:true,pineAIActive:false,poiWalkLevel:0,poiDungeonSpawnId:o=>o.authored?'davidTemple.david':null,
  poiHotbarRead:()=>data.kit,poiDungeonPopulationMinute:()=>100,poiDungeonPopulationDecode:(p)=>p,
  poiTownClockSave(){},poiEquipmentDurabilityMax:()=>80,poiInventoryOrdinarySlots:k=>k.slots||[],poiAnyChestHas:()=>false};
 data.poiEconomyWrite=k=>{if(data.denied)return false;data.kit=k;data.writes.push(k);return true;};
 const script=grab('// BEGIN ORVAS REWARD CORE','// END ORVAS REWARD CORE')+grab('function poiDungeonRememberDefeat(', 'function poiDungeonArrive(');
 vm.createContext(data);vm.runInContext(script,data);
 return {data,eval:code=>vm.runInContext(code,data)};
}
test('only authored defeat atomically grants both confirmed weapons once, including failed write retry',()=>{
 const {data,eval:e}=fixture();
 assert.equal(e("poiDungeonRememberDefeat({type:'monsterStoneDavid',y:0},{hp:0})"),false);
 data.denied=true;
 assert.equal(e("poiDungeonRememberDefeat({type:'monsterStoneDavid',authored:true,y:0},{hp:0})"),false);
 assert.equal(data.kit.armedDrops,undefined);
 data.denied=false;
 assert.equal(e("poiDungeonRememberDefeat({type:'monsterStoneDavid',authored:true,y:0},{hp:0})"),true);
 assert.deepEqual(Array.from(data.kit.armedDrops||[],d=>d.type),['equipOrvasHead','equipOrvasGreatsword','equipOrvasTwinGreatswords']);
 assert.equal(data.kit.dungeonPopulation.dead['davidTemple.david'],100);
 assert.equal(e("poiDungeonRememberDefeat({type:'monsterStoneDavid',authored:true,y:0},{hp:0})"),false);
 assert.equal(data.writes.length,1);
});
test('legacy genuine dead timestamp grants, corrupt/future timestamp never grants, marked consumption never regenerates',()=>{
 const {eval:e}=fixture();
 const raw=()=>e("poiOrvasRewardRestore({potions:2},{version:1,dead:{'davidTemple.david':50}},100)");
 assert.equal(raw().armedDrops.length,3);
 assert.equal(e("poiOrvasRewardRestore({potions:2},{version:1,dead:{'davidTemple.david':300}},100).armedDrops"),undefined);
 assert.equal(e("poiOrvasRewardRestore({potions:2,orvasRewards:7},{version:1,dead:{'davidTemple.david':50}},100).armedDrops"),undefined);
 const owned=e("poiOrvasRewardRestore({slots:[{type:'equipOrvasHead'}]},{version:1,dead:{'davidTemple.david':50}},100)");
 assert.deepEqual(Array.from(owned.armedDrops,d=>d.type),['equipOrvasGreatsword','equipOrvasTwinGreatswords']);
});
