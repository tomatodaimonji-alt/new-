import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
let h=readFileSync(process.argv[2]??'world-editor.html','utf8');
function insert(a,b){assert.equal(h.split(a).length,2);h=h.replace(a,a+b)}
insert('  freeMovementPose:()=>({x:poiWalkViewX,z:poiWalkViewZ,level:poiWalkLevel}),',`
 verifyEquip:{
  ready:()=>poiInventoryAllowed(),
  fixture:()=>{
   const kit=poiHotbarRead(),slots=poiInventorySlots(kit).slice();
   slots[2]={type:'armorOrvasWaistcloth',count:1,durability:47};
   slots[3]={type:'fireWand',count:1,charges:2};
   if(!poiEconomyWrite(poiInventoryEdited({...kit,goldHotbarSlot:null},slots)))throw Error('fixture');
   poiEconomyRefresh();
  },
  open:i=>{poiItemDetailOpen($('poiHotbar').querySelector('[data-hotbar-slot="'+i+'"]'),null,true);return $('poiItemDetail').open},
  report:()=>{
   const jobs=poiTownNpcActors.slice(0,28).map(x=>{const a=poiTownNpcStatus(x);
    return {id:x.role.id,job:a.job,def:a.defense,weapon:a.weapon,gear:a.gear,
     description:a.equipment.filter(Boolean).map(id=>[id,poiInventoryItemName(id),poiEquipmentItemAttack(id),poiEquipmentDefense(id),poiEquipmentDurabilityMax(id)])
    }});
   const snap={armor:poiItemDetailEquipment({type:'armorOrvasWaistcloth',durability:47}),jobs};
   return snap;
  }
 },`);
for(const [,s] of h.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(s);
if(process.env.EQUIPMENT_SYNTAX_ONLY==='1'){console.log('Equipment test HTML parses');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>equipment seed</title>':h)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
let browser,page;
const errors=[];
try{
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const c=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:1,isMobile:true,hasTouch:true,serviceWorkers:'block'});
 await c.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
 page=await c.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/seed');
 await page.evaluate(()=>{
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:45,z:41,y:0,facing:0},townLayout:5,townMapHeight:182,templeDepth:1}));
 });
 const api=(key,...a)=>page.evaluate(([key,a])=>window.__editorTest.verifyEquip[key](...a),[key,a]);
 const boot=async()=>{
  await page.goto(origin+'/?resume=1&test=1',{waitUntil:'domcontentloaded'});
  await page.locator('#pineStartupCover').waitFor({state:'hidden',timeout:35000});
  await page.waitForFunction(()=>window.__editorTest.verifyEquip.ready(),null,{timeout:20000});
  await page.waitForFunction(()=>window.__editorTest.verifyEquip.report().jobs.length>=12,null,{timeout:20000});
 };
 await boot();
 await api('fixture');
 const detail=page.locator('#poiItemDetail');
 const text=id=>page.locator('#poiItemDetail'+id).textContent();
 const open=async i=>{assert(await api('open',i));await detail.waitFor({state:'visible'})};
 const close=async()=>{await detail.locator('[data-item-detail-action="back"]').tap();await detail.waitFor({state:'hidden'})};
 await open(2);
 assert.equal(await text('Name'),'オルヴァスの腰布');
 assert.match(await text('Type'),/^防具（脚）$/);
 assert.equal(await text('Attack'),'0');assert.match(await text('Defense'),/^\+?[1-9]\d*$/);
 assert.equal(await text('Durability'),'47 / 96');
 assert(!(await page.locator('#poiItemDetailWeaponStats').isVisible()));
 assert.deepEqual(await page.locator('#poiItemDetailEquipmentStats dt').allTextContents(),['タイプ','攻撃力','防御力','耐久値']);
 const fit=await detail.evaluate(d=>{const r=d.getBoundingClientRect();return [r.left,r.top,r.right,r.bottom,innerWidth,innerHeight]});
 assert(fit[0]>=0&&fit[1]>=0&&fit[2]<=fit[4]+1&&fit[3]<=fit[5]+1,fit.join(','));
 await page.screenshot({path:'equipment-armor-v348.png'});
 await close();await open(0);
 assert.equal(await text('Type'),'武器');assert(Number(await text('Attack'))>0);assert.equal(await text('Defense'),'0');
 assert.match(await text('Durability'),/\d+ \/ 160/);
 assert(await page.locator('#poiItemDetailWeaponStats').isVisible());
 await close();await open(3);
 assert.equal(await text('Type'),'武器');assert.match(await text('Durability'),/2回/);
 await close();await open(1);
 assert(!(await page.locator('#poiItemDetailEquipmentStats').isVisible()));
 await close();
 const before=await api('report');
 assert(before.jobs.every(j=>Number.isInteger(j.def)&&j.description.every(([id,name,attack,def,hp])=>!!name&&Number.isFinite(attack)&&Number.isInteger(def)&&hp>0)));
 assert(new Set(before.jobs.map(j=>JSON.stringify(j.gear))).size>=6);
 await boot();
 const after=await api('report');
 for(const j of before.jobs){const a=after.jobs.find(x=>x.id===j.id);if(a)assert.deepEqual(a.gear,j.gear);}
 assert.deepEqual(errors,[]);
 console.log('PASS native equipment panel, true integer defense/durability, player gear and role persistence', JSON.stringify(before.jobs.map(j=>[j.id,j.gear,j.def])));
}catch(e){console.error('Native equipment check',errors,await page?.locator('#poiItemDetail').innerText().catch(()=>null));throw e;}
finally{await browser?.close();await new Promise(ok=>server.close(ok))}
