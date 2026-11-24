const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function harness(){
 const i=h.indexOf('// BEGIN MONSTER COMPANION CORE'),j=h.indexOf('// END MONSTER COMPANION CORE');
 a.ok(i>=0&&j>i,'real companion core is present');
 let kit={slots:Array(27).fill(null)},write=true;
 const ctx={facilitySite:{id:'base'},poiWalkActive:true,poiWalkLevel:0,poiWalkX:20,poiWalkZ:20,pineAIActive:false,
  POI_HOTBAR_SIZE:9,POI_BAG_UNLOCKED:9,
  world:[],poiMonsterStates:new Map(),document:{hidden:false,querySelector:()=>null},
  poiHotbarHasKit:()=>true,poiHotbarRead:()=>kit,poiInventorySlots:k=>k.slots,poiGoldHotbarSlot:()=>null,
  poiInventoryEdited:(k,slots)=>({...k,slots}),poiEconomyRefresh(){},
  poiEconomyWrite:k=>{if(write)kit=JSON.parse(JSON.stringify(k));return write},
  sounds:[],messages:[],poiSound:(...arg)=>ctx.sounds.push(arg),toast:m=>ctx.messages.push(m),
  poiAimOrigin:()=>({x:20,z:20,y:0}),poiPlayerRayClear:()=>true,poiAimWall:()=>null,poiAimWallLimit:(_o,_d,r)=>r,
  poiWalkCanStep:()=>true,poiMonsterAt:()=>null,poiMonsterStatsAt:()=>({attack:7}),terrainY:()=>0};
 const c=vm.createContext(ctx);const run=s=>vm.runInContext(s,c);run(h.slice(i,j));
 const kill=(now=1000,r=.05)=>run(`(()=>{let o={type:'monsterSlime',x:21,z:20,y:0},s={hp:0};poiMonsterStates.set(o,s);return poiCompanionMonsterDefeated(o,s,${now},{x:21.5,z:20.5,floor:0,start:${now}},()=>${r})})()`);
 return {run,ctx,kill,get kit(){return kit},set kit(v){kit=v},storage:v=>{write=v}};
}
test('eligible kill reserves once, visible flight commits one inventory soul and pickup only upon durable success',()=>{
 const f=harness();
 a.equal(f.kill(1000,.9),false);a.equal(f.kill(),true);a.equal(f.kill(),false);
 a.equal(f.kit.companionSoul.pending,'slimeSoul');a.equal(f.run('poiCompanionSoulFlight().arrives'),3420);
 f.run('poiCompanionTick(3419)');a.equal(f.kit.slots[9],null);f.storage(false);
 f.run('poiCompanionTick(3420)');a.equal(f.kit.slots[9],null);a.equal(f.ctx.sounds.length,0);
 f.storage(true);f.run('poiCompanionTick(4540)');f.run('poiCompanionTick(5700)');
 a.deepEqual(f.kit.slots[9],{type:'slimeSoul',count:1,durability:36});a.equal(f.kit.companionSoul?.pending??null,null);
 a.deepEqual(f.ctx.sounds,[['item-pickup','slimeSoul']]);
});
test('full bag retains reserved soul through room changes and retries only when a real slot opens',()=>{
 const f=harness();for(let i=0;i<18;i++)f.kit.slots[i]={type:'healingHerb',count:1};
 a.equal(f.kill(),true);f.ctx.facilitySite={id:'snowpass'};
 f.run('poiCompanionTick(3500)');a.equal(f.kit.companionSoul.pending,'slimeSoul');
 f.run('poiCompanionTick(4400)');a.equal(f.ctx.sounds.length,0);
 f.kit.slots[12]=null;f.run('poiCompanionTick(5500)');
 a.equal(f.kit.slots[12].type,'slimeSoul');a.equal(f.ctx.sounds.length,1);
});
test('actual own HP persists through resummon; committed legal covered attack wears token, zero atomically removes it',()=>{
 const f=harness();a.ok(f.kill());f.run('poiCompanionTick(3500)');
 a.ok(f.run("poiCompanionUse(poiHotbarRead(),9).ok"));
 f.run('poiCompanionTick(4000)');const p=JSON.parse(f.run('JSON.stringify(poiCompanionActor)'));
 a.ok(p&&(p.x!==20||p.z!==20));
 f.run(`poiCompanionEnemyContact({obj:{type:'monsterSlime',x:22,z:20,y:0},sx:${p.x+1},sz:${p.z},y:0,x:${p.x},z:${p.z}}, {},4100)`);
 a.equal(f.kit.slots[9].durability,29);
 f.run('poiCompanionUse(poiHotbarRead(),9);poiCompanionUse(poiHotbarRead(),9);poiCompanionTick(4600)');
 a.equal(f.kit.slots[9].durability,29);
 f.storage(false);a.equal(f.run('poiCompanionHurt(29,4800)'),false);a.equal(f.kit.slots[9].durability,29);
 f.storage(true);a.equal(f.run('poiCompanionHurt(29,4900)'),true);a.equal(f.kit.slots[9],null);a.equal(f.kit.companionSoul?.active??null,null);
});
test('assistance chases only recorded hostile intent, resolves real battle damage, and never silently crosses a wall or resets on area change',()=>{
 const f=harness();a.ok(f.kill());f.run('poiCompanionTick(3500);poiCompanionUse(poiHotbarRead(),9);poiCompanionTick(4000);');
 f.ctx.poiPlayerDamageTarget=(hit,x,z,amount,weapon,now,silent,contact,source)=>{
  a.equal(silent,true);a.equal(contact,true);a.equal(source.companion,true);hit[1].hp-=amount;
 };
 f.run("this.o={type:'monsterGoblin',x:18,z:20,y:0};this.s={x:18,z:20,hp:31};poiMonsterStates.set(o,s);");
 f.run('poiCompanionTick(4650)');a.equal(f.ctx.s.hp,31);
 f.run('poiCompanionPlayerContact(o,s,4700)');
 f.ctx.poiAimWallLimit=()=>0;
 f.run('poiCompanionTick(4820)');a.equal(f.ctx.s.hp,31,'a wall blocks even an adjacent hostile');
 f.ctx.poiAimWallLimit=(_o,_d,r)=>r;
 f.run('poiCompanionTick(5100)');a.equal(f.ctx.s.hp,25);
 a.equal(f.run("poiCompanionHurt(5,5150)"),true);
 f.ctx.poiWalkLevel=-1;f.run('poiCompanionTick(5250)');
 a.equal(f.kit.slots[9].durability,31);a.equal(f.kit.companionSoul.active,'slimeSoul');
 a.equal(f.run('poiCompanionSnapshot(5250).actor.y'),-1);
});
test('no award from a town-owned sparring actor or duplicate failed claims; one resolved strike cannot wear the same soul twice',()=>{
 const f=harness();
 a.equal(f.run("this.o={type:'monsterSlime',x:22,z:20,y:0};this.s={hp:0,townOwned:true};poiMonsterStates.set(o,s);poiCompanionMonsterDefeated(o,s,10,null,()=>0)"),false);
 a.ok(f.kill());f.run('poiCompanionTick(3500);poiCompanionUse(poiHotbarRead(),9);poiCompanionTick(4000);');
 f.run("this.contact={obj:{type:'monsterSlime',x:18,z:20,y:0},sx:18,sz:20,x:19,z:20,y:0};");
 a.equal(f.run('poiCompanionEnemyContact(contact,{},4100)'),true);
 a.equal(f.run('poiCompanionEnemyContact(contact,{},4101)'),false);
 a.equal(f.kit.slots[9].durability,29);
});
test('actual hotbar codec and atomic save retain the exact soul HP, unique adjacent gear, worn armor, stock and other weapon',()=>{
 const make=raw=>{
  let text=JSON.stringify(raw),fail=false;
  const c=vm.createContext({MAX_MAP:128,poiPlayerHP:100,POI_PLAYER_MAX_HP:100,facilitySite:{id:'base'},poiWalkActive:true,
   pineAIActive:false,poiWalkLevel:0,poiWalkX:4,poiWalkZ:5,poiWalkFacing:0,world:[],poiMonsterStates:new Map(),
   poiWalkAvatar(){},toast(){},$(){return null},document:{hidden:false,querySelectorAll:()=>[]},performance:{now:()=>10},
   localStorage:{getItem:()=>text,setItem:(_key,value)=>{if(fail)throw Error('quota');text=value}}});
  const cut=(a,b)=>{const i=h.indexOf(a),j=h.indexOf(b,i+1);assertRange(i,j,a);return h.slice(i,j)};
  vm.runInContext(cut('function poiDungeonThemeAt(','function poiDungeonEnterEffect(')+
   cut('const POI_TOWN_CLOCK_KEY=','function poiTownClockSuspend(')+
   cut('// BEGIN MONSTER COMPANION CORE','function poiResetCombat('),c);
  return {c,raw:()=>JSON.parse(text),run:code=>vm.runInContext(code,c),fail:v=>{fail=v}};
 };
 function assertRange(i,j,mark){a.ok(i>=0&&j>i,mark)}
 const slots=Array(27).fill(null);
 slots[0]={type:'equipWoodSword',count:1,durability:90};slots[2]={type:'equipIronSword',count:1,durability:88};
 slots[9]={type:'slimeSoul',count:1,durability:27};slots[10]={type:'starterTunic',count:1,durability:41};
 const initial={version:1,weaponDurabilityVersion:2,weapon:'equipWoodSword',potions:0,gold:3,slots,
  worn:{head:'starterCap',torso:'armorMerchantCoat',legs:'starterTrousers',feet:'starterBoots'},wornDurability:{torso:43},
  companionSoul:{version:1,active:'slimeSoul',pending:null},toolshopSupply:{version:1,stock:5,delivered:0,cargo:0}};
 const keep=r=>{
  a.equal(r.worn.torso,'armorMerchantCoat');a.equal(r.wornDurability.torso,43);a.equal(r.toolshopSupply.stock,5);
  a.deepEqual(r.slots[2],initial.slots[2]);a.ok(r.slots.some(s=>s?.type==='starterTunic'&&s.durability===41));
 };
 let box=make(initial);
 a.equal(box.run("poiInventoryMove({zone:'bag',index:0},{zone:'bag',index:1}).ok"),true);
 const moved=box.raw();keep(moved);a.equal(moved.slots[10].durability,27);
 box=make(moved);
 a.equal(box.run("poiCompanionSnapshot(500).hp"),27);
 a.equal(box.run("poiCompanionUse(poiHotbarRead(),10).ok"),true);a.equal(box.raw().companionSoul,undefined);
 a.equal(box.run("poiCompanionUse(poiHotbarRead(),10).ok"),true);keep(box.raw());
 box.run("poiCompanionActor={id:'slimeSoul'};");
 box.fail(true);a.equal(box.run('poiCompanionHurt(27,600)'),false);a.equal(box.raw().slots[10].durability,27);
 box.fail(false);a.equal(box.run('poiCompanionHurt(27,605)'),true);
 const dead=box.raw();keep(dead);a.equal(dead.companionSoul,undefined);a.ok(!dead.slots.some(s=>s?.type==='slimeSoul'));
 const checked=make(dead);a.equal(checked.run('poiCompanionSnapshot(0).token'),null);
 const bad=JSON.parse(JSON.stringify(initial));bad.slots[9].durability=999;
 const clean=make(bad);
 a.equal(clean.run('poiCompanionSnapshot(0).token'),null);a.equal(clean.run('poiCompanionSnapshot(0).active'),null);
 const sanitized=JSON.parse(clean.run("JSON.stringify(poiHotbarRead())"));keep(sanitized);
 a.deepEqual(clean.raw(),bad,'loading does not overwrite a prior save');
});
