const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||path.join(__dirname,'../world-editor.html'),'utf8');
function harness(saved=null){
 const uis={poiPartyHud:{},poiPlayerHp:{},poiPlayerHpValue:{},poiHotbar:{}};
 const slots=Array.from({length:6},(_,i)=>({
  dataset:{hotbarSlot:String(i)},icon:{},count:{},attrs:{},
  querySelector(k){return k==='.hotbar-icon'?this.icon:this.count},
  setAttribute(k,v){this.attrs[k]=v},removeAttribute(k){delete this.attrs[k]}
 }));
 const log=[];
 const x=vm.createContext({
  $:key=>uis[key]||null,poiWalkActive:true,pineAIActive:false,facilitySite:{id:'base'},poiPlayerHP:100,
  POI_PLAYER_MAX_HP:100,POI_PLAYER_ATTACK:20,poiWalkAvatar:()=>{},
  document:{querySelectorAll:()=>slots},toast:s=>log.push(s),localStorage:{
   getItem:k=>{assert.equal(k,'world-workshop-hotbar-v1');return saved;},
   setItem:(k,v)=>{assert.equal(k,'world-workshop-hotbar-v1');saved=v;}
  }
 });
 const a=html.indexOf('const POI_HOTBAR_KEY'),b=html.indexOf('function poiResetCombat(',a);
 assert(a>=0&&b>a,'quick inventory runtime exists');
 const c=html.indexOf('function poiCombatHud('),d=html.indexOf('function poiDamageNumber(',c);
 const run=s=>vm.runInContext(s,x);
 run(html.slice(a,b)+html.slice(c,d));
 return {run,uis,slots,log,stored:()=>JSON.parse(saved)};
}
test('six slots show sword and three recovery potions, begin unarmed, and update numeric HP',()=>{
 const {run,uis,slots,stored}=harness();
 run('poiCombatHud();poiHotbarRender()');
 assert.equal(uis.poiPlayerHpValue.textContent,'100/100');
 assert.equal(slots[0].attrs['aria-pressed'],'true');
 assert.equal(slots[1].attrs['aria-label'],'木の剣');
 assert.equal(slots[2].count.textContent,'3');
 assert(slots.slice(3).every(s=>s.attrs['aria-disabled']==='true'));
 assert.equal(stored(),null);
 run('poiPlayerHP=42;poiCombatHud()');
 assert.equal(uis.poiPlayerHpValue.textContent,'42/100');
});
test('heal is capped, cannot be wasted at full HP, retains the selected sword and persists separately',()=>{
 const {run,uis,slots,stored}=harness();
 run('poiHotbarUse(1);poiHotbarUse(2)');
 assert.deepEqual(stored(),{version:1,weapon:'equipWoodSword',potions:3});
 assert.equal(run('poiEquippedWeapon()'),'equipWoodSword');
 assert.equal(run('poiPlayerAttackDamage()'),28);
 run('poiPlayerHP=84;poiHotbarUse(2)');
 assert.equal(uis.poiPlayerHpValue.textContent,'100/100');
 assert.equal(slots[2].count.textContent,'2');
 assert.equal(slots[1].attrs['aria-pressed'],'true');
 assert.deepEqual(stored(),{version:1,weapon:'equipWoodSword',potions:2});
 run('poiHotbarUse(0)');assert.equal(run('poiPlayerAttackDamage()'),20);
});
test('no kit leakage outside Game World or actions while AI/editor, and malformed state stays safe',()=>{
 const {run,slots,stored}=harness('{"version":1,"weapon":"illegal","potions":99}');
 run('facilitySite={id:"inn"};poiHotbarRender();poiPlayerHP=50;poiHotbarUse(2)');
 assert.equal(run('poiEquippedWeapon()'),null);
 assert.equal(slots[2].attrs['aria-disabled'],'true');
 run('facilitySite={id:"base"};pineAIActive=true;poiHotbarUse(2);pineAIActive=false;poiWalkActive=false;poiHotbarUse(1)');
 assert.equal(run('poiPlayerHP'),50);
 assert.equal(stored().potions,99);
 run('poiWalkActive=true;poiHotbarRender()');assert.equal(slots[2].count.textContent,'3');
});
test('loads valid empty stock, does not heal or spend extra, and supports reselecting bare hands',()=>{
 const {run,uis,slots,stored}=harness('{"version":1,"weapon":"equipWoodSword","potions":0}');
 run('poiCombatHud();poiHotbarRender();poiPlayerHP=35;poiHotbarUse(2)');
 assert.equal(run('poiPlayerHP'),35);
 assert.equal(slots[2].count.textContent,'0');
 assert.equal(slots[2].attrs['aria-disabled'],'true');
 assert.equal(slots[1].attrs['aria-pressed'],'true');
 run('poiHotbarUse(0);poiCombatHud()');
 assert.equal(uis.poiPlayerHpValue.textContent,'35/100');
 assert.deepEqual(stored(),{version:1,weapon:null,potions:0});
});
