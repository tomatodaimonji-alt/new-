const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const html=fs.readFileSync(process.argv[2]||'candidate.html','utf8');
const cut=(x,y)=>{const a=html.indexOf(x),b=html.indexOf(y,a+1);assert(a>=0&&b>a,x);return html.slice(a,b);};
function boot(hp=40,gold=10,stock=2){
 const f={site:{id:'frontier'},lines:[],count:0,fail:false,clear:true};
 const actors=[{id:'human:ren',x:4,z:5,y:0,site:f.site},{id:'human:chief',x:5,z:5,y:0,site:f.site}];
 f.kit={gold:86,humanParty:[{id:'human:ren',hp,mode:'follow'},{id:'human:chief',hp:85,mode:'fight'}],
  frontierTrades:{frontierren:{gold,healingHerb:0,cannedFood:1},frontierchief:{gold:2,healingHerb:stock,cannedFood:2}}};
 const c={facilitySite:f.site,poiWalkActive:true,poiWalkLevel:0,poiWalkX:5,poiWalkZ:5,POI_ECONOMY_GOLD_MAX:99,
  POI_HUMAN_PARTY_IDS:{'human:ren':'frontierren','human:chief':'frontierchief'},frontierResident:()=>true,
  poiHotbarRead:()=>f.kit,poiHumanPartyDecode:list=>list.map(m=>({...m})),frontierVendorStock:(kit,id)=>kit.frontierTrades[id],
  frontierLifeStock:(kit,id,stock)=>({...kit,frontierTrades:{...kit.frontierTrades,[id]:stock}}),
  poiEconomyWrite:k=>{if(f.fail)return false;f.count++;f.kit=k;return true},
  poiCompanionPosition:a=>a,poiCompanionAttackClear:()=>f.clear,POI_HOTBAR_HEAL:30,
  poiTownNpcCombatNear:()=>false,poiEconomyRefresh(){}};
 const recording=new Map();
 c.frontierLifeSpeech=recording;vm.createContext(c);
 vm.runInContext(cut('function frontierLifeLine','function frontierLifeSpeechDraw')+
   cut('// BEGIN FRONTIER PARTY HERB EXCHANGE','// END FRONTIER PARTY HERB EXCHANGE')+
   cut('function frontierHumanCompanionHeal','function frontierNpcBuyHerb'),c);
 return {c,f,actors,recording,run:now=>c.frontierPartyHerbFrame(now,actors)};
}
test('near party ask then atomically paid exchange, real herb later heals only once',()=>{
 const {c,f,actors,recording,run}=boot();run(100);
 assert.match(recording.get('frontierren').text,/薬草余ってないか/);assert.equal(f.count,0);
 run(1200);assert.equal(f.count,1);assert.match(recording.get('frontierchief').text,/6G/);
 assert.deepEqual([f.kit.frontierTrades.frontierren.gold,f.kit.frontierTrades.frontierchief.gold,f.kit.gold],[4,8,86]);
 assert.deepEqual([f.kit.frontierTrades.frontierren.healingHerb,f.kit.frontierTrades.frontierchief.healingHerb],[1,1]);
 c.frontierHumanCompanionHeal(actors[0],1400);assert.equal(f.count,1);
 c.frontierHumanCompanionHeal(actors[0],3100);assert.equal(f.kit.humanParty[0].hp,70);assert.equal(f.kit.frontierTrades.frontierren.healingHerb,0);
 assert.equal(f.count,2);run(3600);assert.equal(f.count,2);
});
test('critical donation is real but free; stage cancels on wall, different floor, depleted donor or failed write',()=>{
 let q=boot(17);q.run(100);q.run(1200);
 assert.match(q.recording.get('frontierchief').text,/代金はいらん/);
 assert.deepEqual([q.f.kit.frontierTrades.frontierren.gold,q.f.kit.frontierTrades.frontierchief.gold,q.f.kit.frontierTrades.frontierren.healingHerb],[10,2,1]);
 for(const failure of ['wall','floor','depleted','write','replaced']){
  q=boot();q.run(100);
  if(failure==='wall')q.f.clear=false;
  if(failure==='floor')q.actors[1].y=-1;
  if(failure==='depleted')q.f.kit.frontierTrades.frontierchief.healingHerb=1;
  if(failure==='write')q.f.fail=true;
  if(failure==='replaced')q.actors[1]={...q.actors[1]};
  q.run(1200);assert.equal(q.f.count,0,failure);assert.equal(q.recording.has('frontierchief'),false,failure);assert.equal(q.f.kit.frontierTrades.frontierren.healingHerb,0);
 }
});
test('rare context-aware need line: rest or ask for recovery, not repeated on per-frame critical',()=>{
 const {c,f,actors,recording}=boot(19,0,1);const [a]=actors;
 c.frontierHumanCompanionHeal(a,100);const first=recording.get('frontierren');assert.match(first.text,/帰って休みたい/);
 for(let i=1;i<7;i++)c.frontierHumanCompanionHeal(a,i*3000+100);
 assert.equal(recording.get('frontierren'),first);
 f.kit.humanParty[0].mode='fight';a.attackMotion={pending:true};
 c.frontierHumanCompanionHeal(a,22000);assert.match(recording.get('frontierren').text,/回復アイテムが必要/);
 assert.equal(f.count,0);
});
