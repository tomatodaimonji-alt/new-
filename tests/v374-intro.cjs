const a=require('node:assert/strict'),fs=require('node:fs');
const h=fs.readFileSync(process.argv[2],'utf8');
const open=h.slice(h.indexOf('function poiTownDialogueAction(now)'),h.indexOf('// BEGIN SPEECH PLACEMENT'));
const tutorial=h.slice(h.indexOf('function frontierNpcTutorial('),h.indexOf('function poiTownDialogueHasNext'));
const menu=h.slice(h.indexOf('function poiNpcMenuRows('),h.indexOf(" if(d.page==='quest')return [...quests"));
a(!menu.includes("['talk','status'"),'no second Talk button on root');
a.match(open,/frontierNpcTutorial\(actor.role\)/,'greeting grants on initial action');
const simulate=new Function(`
const gear={torso:'starterTunic',legs:'starterTrousers',feet:'armorLeatherShoes'};
const facilitySite={id:'frontier'},frontierIntroVillager=()=>true,frontierDressed=()=>false,FRONTIER_FITTED_GEAR=gear;
let kit={slots:[]},allow=false;
const poiHotbarRead=()=>kit,poiArmorWorn=()=>({}),poiInventorySlots=k=>k.slots,poiAnyChestHas=()=>false,poiInventoryAccept=(k,t)=>({accepted:1,slots:[...k.slots,{type:t}]}),
poiInventoryEdited=(k,slots)=>({...k,slots}),poiEconomyWrite=k=>allow?(kit=k,true):false;
${tutorial}
const failed=frontierNpcTutorial({id:'frontiersera'});
if(kit.slots.length||failed.gift?.length)throw Error('failed save appeared granted');
allow=true;const first=frontierNpcTutorial({id:'frontiersera'}),second=frontierNpcTutorial({id:'frontierren'});
return {first,second,kit};`);
const r=simulate();a.equal(r.kit.slots.length,3);a.equal(r.first.gift.length,3);a(!r.second.gift);console.log('PASS on-open gift at most once, after successful save');
