const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
test('only durable lethal ally damage shatters once at the sampled live world position',()=>{
 const start=html.indexOf('function poiCompanionHurt('),end=html.indexOf('function poiCompanionEnemyContact(',start);
 a.ok(start>=0&&end>start);
 const ally={id:'slimeSoul',x:21,z:18,y:-1},pose={x:21.37,z:18.76,y:-1.2,facing:2};
 let kit={slots:[{type:'slimeSoul',durability:7},{type:'equipWoodSword',durability:55}],companionSoul:{active:'slimeSoul'}},writes=true;
 const log=[],c=vm.createContext({poiCompanionActor:ally,poiCompanionTarget:{},poiHotbarRead:()=>kit,
  poiInventorySlots:k=>k.slots,poiInventoryEdited:(k,slots)=>({...k,slots}),poiCompanionType:()=>({enemy:'monsterSlime',hp:36}),
  poiEconomyWrite:k=>{if(!writes)return false;kit=k;return true},poiEconomyRefresh(){},poiCompanionWorldPose:(actor,now)=>{a.equal(actor,ally);a.equal(now,110);return pose},
  poiMonsterBreak:(obj,state,now,rng,options)=>{a.equal(kit.slots[0],null);a.equal(c.poiCompanionActor,null);log.push({obj,state,now,options});}});
 vm.runInContext(html.slice(start,end),c);
 a(c.poiCompanionHurt(1,100));a.equal(kit.slots[0].durability,6);a.equal(log.length,0);
 writes=false;a.equal(c.poiCompanionHurt(6,101),false);a.equal(kit.slots[0].durability,6);a.equal(c.poiCompanionActor,ally);a.equal(log.length,0);
 writes=true;a(c.poiCompanionHurt(6,110));a.equal(log.length,1);
 const e=log[0];a.equal(e.obj.type,'monsterSlime');a.equal(e.obj.y,-1);a.equal(e.state.facing,2);a.equal(e.options.pose,pose);a.equal(e.options.actor,undefined);
 a.equal(c.poiCompanionHurt(6,110),false);a.equal(log.length,1);a.equal(kit.slots[1].durability,55);
});

