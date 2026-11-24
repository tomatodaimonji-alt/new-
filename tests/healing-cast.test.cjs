const t=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const part=(a,b)=>{const i=h.indexOf(a),j=h.indexOf(b,i+1);assert(i>=0&&j>i,a);return h.slice(i,j)};
t('item uses converge on timed resolve; walk continues and released flight is not destroyed',()=>{
 const env={now:100,world:{},facilitySite:{},poiWalkLevel:0,poiDungeonEntranceSerial:0,poiOtherworldTravelSerial:0,
  poiWalkActive:true,pineAIActive:false,poiPlayerHP:17,POI_PLAYER_MAX_HP:100,POI_CANNED_HEAL:55,POI_HOTBAR_HEAL:30,
  POI_FIRE_WAND:'wand',POI_INVENTORY_HERB:'herb',POI_CANNED:'can',poiPlayerWeaponPending:{phase:'windup'},
  document:{hidden:false},performance:{now:()=>env.now},poiAudioAllowed:()=>!env.document.hidden,poiPlayerDying:()=>false,
  poiInventoryAllowed:()=>true,poiStorageActionResult:(reason=null)=>({ok:!reason,reason}),
  poiInventorySlots:kit=>kit.slots,poiHotbarRead:()=>env.kit,kit:{slots:[{type:'herb',count:2},{type:'can',count:1}]},
  poiEconomyWrite:kit=>{if(env.fail)return false;env.kit=kit;env.writes++;return true},
  poiInventoryEdited:(kit,slots)=>({...kit,slots}),poiPlayerWeaponCancel:keep=>{assert(keep);env.poiPlayerWeaponPending=null},
  poiCombatHud(){},poiEconomyRefresh(){},poiHealPlayerFeedback:n=>env.sounds.push(n),toast(){},
  writes:0,sounds:[]};
 vm.createContext(env);
 vm.runInContext(part('// BEGIN HEALING ITEM CAST','// END HEALING ITEM CAST')+part('function poiUseStorageConsumable','function poiUseBagItem')+
 ';globalThis.api={use:poiUseStorageConsumable,frame:poiHealingCastFrame,clear:poiHealingCastCancel,active:poiHealingCastActive};',env);
 const {use,frame,active}=env.api,begin=i=>use(env.kit,i);
 assert(begin(0).ok);assert(active());assert.equal(env.poiPlayerWeaponPending,null);
 assert.equal(env.writes,0);assert.equal(env.poiPlayerHP,17);assert.equal(begin(1).reason,'healing');
 frame(1549);assert.equal(env.writes,0);
 frame(1550);frame(1600);assert.equal(env.writes,1);assert.equal(env.poiPlayerHP,47);assert.equal(env.kit.slots[0].count,1);
 env.now=2000;env.poiPlayerWeaponPending={phase:'flight'};assert(begin(1).ok);assert.equal(env.poiPlayerWeaponPending.phase,'flight');
 frame(3450);assert.equal(env.poiPlayerHP,100);assert.deepEqual(env.sounds,[30,53]);assert.equal(begin(0).reason,'healthy');
 for(const fail of ['scene','hidden','swap','storage','healthy']){
  env.now+=2000;env.poiPlayerHP=30;assert(begin(0).ok);
  if(fail==='scene')env.poiWalkLevel++;
  if(fail==='hidden')env.document.hidden=true;
  if(fail==='swap')env.kit.slots[0]={type:'can',count:2};
  if(fail==='storage')env.fail=true;
  if(fail==='healthy')env.poiPlayerHP=100;
  frame(env.now+1500);assert(!active());assert.equal(env.writes,2);
  env.document.hidden=false;env.fail=false;
 }
 assert(h.includes("poiHealingCastFrame(now);"));assert(h.includes("poiHealingCastActive())return {ok:false,reason:'healing'};"));
 assert(h.includes("id=\"poiHealingCastGauge\""));assert(h.includes("poiHealingCastDraw(now,p.vp)"));
});
