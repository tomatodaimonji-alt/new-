const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),test=require('node:test');
const h=fs.readFileSync(process.env.PRODUCT||'world-editor.html','utf8');
const a=h.indexOf('// BEGIN ORVAS REWARD CORE'),b=h.indexOf('// END ORVAS REWARD CORE',a);
test('Orvas soul is awarded once independently of slime active/captured and weapon reset bits',()=>{
 const c=vm.createContext({facilitySite:{id:'base',davidTemple:{boss:{x:24,z:104,y:0}}},poiEquipmentDurabilityMax:t=>t==='orvasSoul'?1050:100,poiInventoryOrdinarySlots:k=>k.slots||[],poiAnyChestHas:()=>false});
 vm.runInContext(h.slice(a,b),c);
 const r=x=>vm.runInContext(x,c);
 assert.equal(r("poiOrvasRewardGrant({orvasRewards:7,companionSoul:{type:'slimeSoul'}}).armedDrops[0].type"),'orvasSoul');
 assert.equal(r("poiOrvasRewardGrant({orvasRewards:7}).orvasRewards"),31);
 assert.equal(r("poiOrvasRewardGrant({orvasRewards:31,companionSoul:{type:'slimeSoul'}}).armedDrops"),undefined);
 assert.equal(r("poiOrvasRewardRestore({orvasRewards:7},{version:1,dead:{'davidTemple.david':80}},100).armedDrops[0].durability"),1050);
});
