import a from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
let html=readFileSync('world-editor.html','utf8');
const marker="if(facilityParams.get('test')==='1')window.__editorTest={";
a.equal(html.split(marker).length,2);
html=html.replace(marker,marker+`
 outfitQA:{
  info:()=>{const k=poiHotbarRead();return {where:facilitySite.id,slots:poiInventorySlots(k).filter(Boolean),weapon:k.weapon,potions:k.potions,
    armor:poiArmorWorn(k),money:poiWalletGold(k),view:$('poiThirdView').textContent,
    residents:poiTownNpcActors.map(a=>{const stat=poiTownNpcStatus(a),m=poiTownNpcModel(a.role.type,a);
     return {id:a.role.id,look:a.role.appearance,equipment:stat.equipment,def:stat.defense,held:!!m.townParts.held,boots:m.townParts.soles.length};
    }),
    shoe:{name:poiInventoryItemName('armorLeatherShoes'),durability:poiEquipmentDurabilityMax('armorLeatherShoes'),icon:!!poiArmorContentIcon('armorLeatherShoes')}
   }},
  seed:()=>{const kit=poiHotbarRead(),slots=poiInventorySlots(kit).slice();slots[10]={type:'armorLeatherShoes',count:1,durability:28};
   return poiHotbarSave(poiInventoryEdited({...kit,gold:23},slots));},
  equip:()=>poiMoveArmorSlot({zone:'bag',index:1},{zone:'armor',part:'feet'}),
  reset:poiGameResetOpen
 },
`);
const s=createServer((_,r)=>{r.setHeader('Content-Type','text/html;charset=utf-8');r.end(html)});
await new Promise(r=>s.listen(0,'127.0.0.1',r));let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
 const errors=[];p.on('pageerror',e=>errors.push(e.stack));const url='http://127.0.0.1:'+s.address().port+'/?test=1';
 const info=()=>p.evaluate(()=>window.__editorTest.outfitQA.info());
 const ready=async()=>{await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:40000});await p.waitForFunction(()=>window.__editorTest?.outfitQA.info().residents.length===2)};
 await p.goto(url,{waitUntil:'domcontentloaded'});await ready();
 const clean=await info();
 console.log('New game',clean);
 a.equal(clean.where,'frontier');a.equal(clean.weapon,null);a.equal(clean.money,0);a.equal(clean.potions,0);a.deepEqual(clean.slots,[]);
 a.deepEqual(Object.values(clean.armor),[null,null,null,null]);a.deepEqual(clean.shoe,{name:'革の靴',durability:52,icon:true});
 for(const [id,look,weapon] of [['frontierren','kai','equipWoodSpear'],['frontiersera','sera','equipWoodBow']]){
  const resident=clean.residents.find(r=>r.id===id);a(resident?.held);a.equal(resident.look,look);a.equal(resident.boots,2);a.equal(resident.def,3);
  a.deepEqual(resident.equipment,[weapon,null,'starterTunic','starterTrousers','armorLeatherShoes']);
 }
 a(await p.evaluate(()=>window.__editorTest.outfitQA.seed()));
 await p.reload({waitUntil:'domcontentloaded'});await ready();
 const reopened=await info();a.equal(reopened.money,23);a.deepEqual(reopened.slots,[{type:'armorLeatherShoes',count:1,durability:28}]);
 const equip=await p.evaluate(()=>window.__editorTest.outfitQA.equip());a(equip.ok,JSON.stringify(equip));
 a.equal((await info()).armor.feet,'armorLeatherShoes');
 await p.reload({waitUntil:'domcontentloaded'});await ready();
 a.equal((await info()).armor.feet,'armorLeatherShoes');
 await p.evaluate(()=>window.__editorTest.outfitQA.reset());
 await Promise.all([p.waitForURL(/reset-camera=1/),p.locator('#poiResetGameConfirm').tap()]);
 await ready();
 const reset=await info();a.deepEqual(reset.slots,[]);a.equal(reset.money,0);a.equal(reset.potions,0);
 a.deepEqual(Object.values(reset.armor),[null,null,null,null]);a.equal(reset.view,'視点：俯瞰');
 a.deepEqual(errors,[]);console.log('Fresh and reset inventory empty, earned items preserved on reload, real resident gear and equipped save verified.');
}finally{await b?.close();s.close();}
