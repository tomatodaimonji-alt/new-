const a=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs'),{createServer}=require('node:http');
const mark="if(facilityParams.get('test')==='1')window.__editorTest={";
let h=fs.readFileSync('world-editor.html','utf8');a.equal(h.split(mark).length,2);
h=h.replace(mark,mark+`
 qa421:{
  ready:()=>facilitySite?.id==='frontier'&&poiWalkActive&&poiTownNpcActors.length>3,
  setup:()=>{
   const k=poiHotbarRead(),slots=poiInventorySlots(k).slice();
   slots[0]={type:'healingHerb',count:2};slots[1]={type:'cannedFood',count:2};
   const save={...poiInventoryEdited(k,slots),gold:0,frontierClothesGift:true};
   if(!poiEconomyWrite(save))throw Error('seed');
   poiEconomyRefresh();poiPlayerHP=10;poiCombatHud();
   if(!workshopResumeRestorePosition({x:102,z:25,y:0,facing:0,cave:false}))throw Error('position');
  },
  status:()=>{const kit=poiHotbarRead();return {hp:poiPlayerHP,food:poiPlayerSatiety(kit),cells:poiInventorySlots(kit).slice(0,2),use:poiHealingCastActive(),icon:!!poiLootContentIcon('cannedFood'),name:poiInventoryItemName('cannedFood')}},
  guard:()=>{
   const s=poiTownNpcActors.find(a=>a.role.id==='frontiersugimoto'),m=poiTownNpcActors.find(a=>a.role.id==='frontiermiyamoto');
   const model=mesh();deco(model,'equipIronAxe',0,0,0,0);
   const migrated=frontierLifeDecode({frontiermiyamoto:{hp:170,items:[],worn:{weapon:{type:'equipIronSpear',count:1,durability:100}}}}).frontiermiyamoto.worn.weapon;
   const before=[poiTownNpcStatus(s).weapon,poiTownNpcStatus(m).weapon,poiTownNpcAttackPower(m)],ok=poiHumanPartyRecruit(m,performance.now()).ok;
   return {before,ok,party:poiHumanPartySpec('human:frontiermiyamoto')?.weapon,migrated,mesh:model.p.length>100};
  }
 },
`);
const server=createServer((_,r)=>{r.setHeader('Content-Type','text/html;charset=utf-8');r.end(h)});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true}),errors=[];
 p.on('pageerror',e=>{errors.push(String(e));console.error(e.stack)});
 await p.goto('http://127.0.0.1:'+server.address().port+'/?test=1',{waitUntil:'domcontentloaded'});
 await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:40000});
 await p.waitForFunction(()=>window.__editorTest?.qa421?.ready(),null,{timeout:30000});
 await p.evaluate(()=>window.__editorTest.qa421.setup());
 const status=()=>p.evaluate(()=>window.__editorTest.qa421.status());
 const state=await status();a.equal(state.name,'ポーション');a.equal(state.icon,true);a.equal(state.hp,10);
 for(const [slot,hp] of [[0,30],[1,70]]){
  await p.locator('#poiHotbar [data-hotbar-slot="'+slot+'"]').tap();
  await p.waitForFunction(hp=>window.__editorTest.qa421.status().hp===hp,hp,{timeout:8000});
 }
 const after=await status();a.equal(after.food,state.food);a.equal(after.use,false);
 a.deepEqual(after.cells.map(x=>x.count),[1,1]);console.log('healing:',after);
 await p.locator('#poiWalkAction').tap();
 const tap=id=>p.locator('[data-npc-action="'+id+'"]:visible').tap();
 await tap('buy');await tap('trade:armorLeatherShoes');
 const speech=p.locator('#poiNpcTradeSpeech');await speech.waitFor({state:'visible'});
 a.match(await speech.innerText(),/ミナ.*革の靴.*18G/);
 const blocked=p.locator('#poiNpcTradeDetail');a.match(await blocked.innerText(),/金貨が足りません/);a.doesNotMatch(await blocked.innerText(),/参考価格/);
 a.equal(await p.locator('#poiMessagePanel').evaluate(el=>getComputedStyle(el).visibility),'hidden');
 await tap('back');await tap('back');await tap('back');
 const guard=await p.evaluate(()=>window.__editorTest.qa421.guard());console.log('guard:',guard);
 a.deepEqual(guard.before,['equipIronSpear','equipIronAxe',30]);a.equal(guard.ok,true);a.equal(guard.party,'equipIronAxe');
 a.deepEqual(guard.migrated,{type:'equipIronAxe',count:1,durability:94});a.equal(guard.mesh,true);
 a.deepEqual(errors,[]);console.log('PASS real hotbar tap recovery, foreground shop dialogue, guard and migration');
}finally{await b?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
