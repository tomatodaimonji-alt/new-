import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url.startsWith('/seed')?'<!doctype html><title>Isolated fixtures</title>':html);
});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const origin='http://127.0.0.1:'+server.address().port;
const map={format:'forest-world-v1',version:1,width:30,height:30,size:30,
 world:[{x:2,y:0,z:2,type:'stonewall',rot:1},{x:15,y:0,z:12,type:'bed',rot:2}],
 models:[],prefabs:[],terrainHeights:[],checks:[]};
const guild={...map,world:[{x:7,y:0,z:6,type:'stonewall',rot:0}]};
const fixtures={
 'forest-world-editor-v1':JSON.stringify(map,null,2),
 'world-workshop-pois-v1':JSON.stringify([
  {id:'poi-guild-primary-v87',name:'ギルド',map:guild},
  {id:'poi-adventurers-guild-v102',name:'冒険者ギルド',map:guild}],null,2),
 'pine-guild-screenshot-before-v86':JSON.stringify(guild,null,2),
 'pine-adventurers-guild-poi-before-v102':JSON.stringify({keep:'fixture'}),
 'world-workshop-guild-duplicates-v105':JSON.stringify({version:1,records:[
  {id:'poi-old-archive',name:'冒険者ギルド',map:guild}]}),
 'world-workshop-adventure-v1':'{"version":1,"x":23,"z":24,"hp":84,"monsters":[]}',
 'world-workshop-audio-v2':'{"master":81,"bgm":62,"se":88,"enabled":true}'
};
const resumeKey='world-workshop-resume-v1';
const state=page=>page.evaluate(()=>window.__editorTest?.facility?.()??null);
async function unchanged(page){
 const before=await page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),Object.keys(fixtures));
 assert.deepEqual(before,fixtures,'route must not write existing editor, Guild/archives, adventure, or audio settings');
}
const out=process.env.FACILITY_SCREENSHOTS;
if(out)await mkdir(out,{recursive:true});
const open='#enterGameWorld';
async function launch(browser,id='base',start={x:19,z:45},{camera=false,yaw=.24,orbitYaw=0,pitch=.24,townLayout=5,facing=2,kit=null,clockStart=null,fixture='',dist=5.5,level=0,width=390}={}){
 const ctx=await browser.newContext({viewport:{width,height:740},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
 await page.goto(origin+'/seed');
 await page.evaluate(({fixtures,resumeKey,id,start,camera,yaw,orbitYaw,pitch,townLayout,facing,kit,clockStart,dist,level})=>{
  for(const [k,v] of Object.entries(fixtures))localStorage.setItem(k,v);
  if(clockStart!==null)localStorage.setItem('world-workshop-town-clock-v1',JSON.stringify({version:1,gameMs:clockStart*500}));
  if(kit)localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify(kit));
  if(start)localStorage.setItem(resumeKey,JSON.stringify({version:1,route:'facility',id,play:true,position:{...start,y:level,facing},townLayout,
   view:{yaw,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:camera,orbitYaw,orbitPitch:pitch,orbitDistance:dist}}));
 },{fixtures,resumeKey,id,start,camera,yaw,orbitYaw,pitch,townLayout,facing,kit,clockStart,dist,level});
 await page.goto(origin+'/'+fixture+(start?'?resume=1&test=1':'?facility='+id+'&test=1'));
 if(!start)await page.locator(open).tap();
 await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
 assert.equal((await state(page)).id,id);
 return {ctx,page,errors};
}
const dirs={n:[0,-1],s:[0,1],e:[1,0],w:[-1,0]};
const arrow={n:'ArrowUp',s:'ArrowDown',e:'ArrowRight',w:'ArrowLeft'};
async function move(page,d,required=true,touch=false){
 const {x,z}=(await state(page)).position,[dx,dz]=dirs[d];
 if(touch)await page.locator('[data-poi-dir="'+d+'"]').tap();else await page.keyboard.press(arrow[d]);
 try{
  await page.waitForFunction(([x,z])=>{
   const p=window.__editorTest.facility().position;return p.x===x&&p.z===z;
  },[x+dx,z+dz],{timeout:required?2700:500});
 }catch(err){
  if(required)throw new Error(`Walk ${arrow[d]} from (${x},${z}) did not reach (${x+dx},${z+dz}). Actual: ${JSON.stringify((await state(page)).position)}`,{cause:err});
  return;
 }
 await page.waitForTimeout(186);
}
const getMap=page=>page.evaluate(()=>window.__editorTest.data());
const at=(x,z,level=0)=>({x,z,level});
const settle=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
async function picture(page,label){
 if(!out)return;
 await settle(page);
 await page.screenshot({path:out+'/v172-'+label+'.png'});
}
async function noMapMutation(page,map){
 assert.deepEqual(await getMap(page),map,'NPCs, rooms and clock do not write authenticated game layout or tiles');
 await unchanged(page);
}
const action='#poiWalkAction';
const clock=page=>page.evaluate(()=>window.__editorTest.townClock());
const residents=page=>page.evaluate(()=>window.__editorTest.townResidents());
function byId(info,id){return info.actors.find(o=>o.id===id);}
const worldKit='world-workshop-hotbar-v1';
const stock={version:1,weapon:null,potions:3,gold:12,claimedCaches:['glade']};
const readStock=page=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),worldKit);
const openAt=async(page,x,z)=>page.evaluate(([x,z])=>window.__editorTest.canStep(x,z),[x,z]);
const speech='#poiTownSpeech';
const dateMinute=12*60;
const talkInfo=page=>page.evaluate(()=>{
 const api=window.__editorTest;return api.townResidents()?.dialogue??api.facility()?.residents?.dialogue??null;
});
async function waitDialogue(page,opened){
 await page.waitForFunction(opened=>{
  const api=window.__editorTest,t=api.townResidents()?.dialogue??api.facility()?.residents?.dialogue??null;
  return Boolean(t)===opened;
 },opened);
 const bubble=page.locator(speech);
 await bubble.waitFor({state:'hidden'});
}
async function worker(page,id){
 await page.waitForFunction(id=>window.__editorTest.townResidents()?.actors.some(x=>x.id===id&&x.activity==='work'),id);
 return byId(await residents(page),id);
}
const morning=9*60;
const market='#poiNpcMenu';
const choices='#poiNpcMenu button[data-npc-action]';
const menu=page=>page.locator(market);
const textOption=(page,text)=>page.locator(choices).filter({hasText:text});
const choice=(page,id)=>page.locator(choices+'[data-npc-action="'+id+'"]').tap();
async function dismiss(page){
 for(let i=0;i<5&&await menu(page).isVisible();i++)await page.keyboard.press('Escape');
 await menu(page).waitFor({state:'hidden'});
}
const dpad=(page,d)=>page.locator('[data-poi-dir="'+d+'"]');
const counter=at(69,35);
const herbCount=s=>[...s.inventory.hotbar,...s.inventory.bag].reduce((n,c)=>n+(c?.type==='healingHerb'?c.count:0),0);
const cash=s=>s.inventory.gold??s.economy.gold;
async function enter(page){
 // A completed sale has a short handling gesture. Wait until the actual
 // interaction prompt is restored; otherwise the action would swing.
 await page.waitForFunction(()=>/話す|会話|取引|買い物|泊まる|宿泊/.test([document.querySelector('#poiWalkAction')?.getAttribute('aria-label'),document.querySelector('#poiWalkAction')?.textContent].join(' ')));
 await page.locator(action).tap();await menu(page).waitFor({state:'visible'});
}
async function button(page,label){
 const item=textOption(page,label);
 await item.first().tap();
}
async function verifyNoBackdrop(page){
 const card=await page.locator('#poiMessagePanel').boundingBox(),opts=await menu(page).boundingBox();
 assert.ok(card&&opts&&Math.abs(card.x-opts.x)<2&&opts.y+opts.height<card.y,'separate choices are anchored just above the speech card at its left');
 assert.ok(opts.y>=0&&card.width>opts.width,'only compact options occupy the separate panel');
 assert.equal(await page.locator('#poiMessagePanel').evaluate(el=>getComputedStyle(el).pointerEvents),'none');
 const styles=await menu(page).evaluate(el=>{
  const root=el.closest('dialog')||el;
  const p=getComputedStyle(root,'::backdrop');
  return {dialog:root.tagName==='DIALOG',bg:p.backgroundColor,filter:p.backdropFilter,
   shadow:p.boxShadow,opacity:p.opacity};
 });
 assert(!styles.dialog||(/transparent|rgba\(0, 0, 0, 0\)/.test(styles.bg)&&
  (!styles.filter||styles.filter==='none')&&styles.shadow==='none'),
  'no full-screen dim/backdrop layer: '+JSON.stringify(styles));
}
async function fixedShop(browser){
 const {ctx,page,errors}=await launch(browser,'base',counter,{clockStart:morning,kit:stock,facing:1,width:320});
 try{
  const layout=await getMap(page);
  await worker(page,'toolkeeper');
  assert.equal(await openAt(page,70,35),false,'the genuine counter is physically between player and vendor');
  const attack=(await state(page)).combat.actionAt;
  await enter(page);await verifyNoBackdrop(page);
  const frame=await menu(page).boundingBox();
  assert(frame&&frame.x>=-1&&frame.y>=-1&&frame.x+frame.width<=321&&frame.y+frame.height<=741,'fits 320px portrait');
  assert.deepEqual((await state(page)).position,counter);
  assert.equal((await state(page)).combat.actionAt,attack,'opening commerce does not attack');
  await choice(page,'status');
  await page.locator('#poiNpcInventory').waitFor({state:'visible'});
  await page.locator('#poiNpcInventoryClose').tap();
  await menu(page).waitFor({state:'visible'});
  await choice(page,'request');
  await choice(page,'shop');
  await button(page,/薬草.*6 ?G|6 ?G.*薬草/);
  const before=await readStock(page);
  assert.equal(before.gold,12,'choosing an item does not pay yet');
  await button(page,/はい|確定/);
  await page.waitForFunction(()=>window.__editorTest.facility().economy.gold===6);
  assert.equal(herbCount(await state(page)),4);
  await dismiss(page);
  assert.equal(cash(await state(page)),6,'exactly one fixed-price 6G purchase');
  await picture(page,'fixed-shop-closed');
  await noMapMutation(page,layout);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
async function residentTrade(browser){
 const seed=Array(27).fill(null),herb=count=>({type:'healingHerb',count});
 seed[0]={type:'equipWoodSword',count:1};seed[1]=herb(2);seed[9]=herb(3);
 const listed={...stock,potions:5,slots:seed};
 const {ctx,page,errors}=await launch(browser,'base',{x:34,z:61},{clockStart:morning,kit:listed,facing:1,width:390});
 try{
  const layout=await getMap(page),where=at(34,61);
  await page.evaluate(()=>window.__editorTest.testWound(45));
  await page.locator('#poiBagToggle').tap();
  await page.locator('#poiBagPanel').waitFor({state:'visible'});
  const playerBox=await page.locator('#poiBagPanel').boundingBox();
  await page.locator('#poiBagClose').tap();
  await worker(page,'stablekeeper');await enter(page);
  const before=await state(page);
  await verifyNoBackdrop(page);
  assert.equal(await page.locator(speech).isVisible(),false,'direct dialogue shows in local panel, not an overhead NPC bubble');
  const selected=()=>menu(page).evaluate(el=>{
   const rows=[...el.querySelectorAll('button[data-npc-action]')].filter(e=>!e.disabled&&e.getBoundingClientRect().width>0);
   return {at:rows.findIndex(e=>e.getAttribute('aria-selected')==='true'||e.getAttribute('aria-current')==='true'||
    e.dataset.selected==='true'||e.classList.contains('selected')||e===document.activeElement),count:rows.length};
  });
  const original=await selected();
  assert.equal(original.at,0,'first action initially selected');
  await dpad(page,'n').tap();
  assert.equal((await selected()).at,original.count-1,'D-pad up wraps to end');
  await dpad(page,'s').tap();
  assert.equal((await selected()).at,0,'D-pad down wraps to start');
  assert.deepEqual((await state(page)).position,where,'D-pad navigates choices, not player');
  assert.equal((await state(page)).combat.actionAt,before.combat.actionAt);
  const trade='#poiNpcTradePanel',detail='#poiNpcTradeDetail';
  const price=(sel,n)=>page.locator(sel).filter({hasText:new RegExp('(?:^|[^0-9])'+n+'\\s*G')});
  const tradeItem=id=>page.locator(trade+' [data-npc-action="'+id+'"]');
  const select=(id)=>tradeItem(id).tap();
  const show=async()=>{
   await page.locator(trade).waitFor({state:'visible'});
   const r=await page.locator(trade).boundingBox();
   assert(r&&playerBox&&Math.abs(r.width-playerBox.width)<=1.5&&Math.abs(r.height-playerBox.height)<=1.5,
    'private trade uses actual bag-size presentation');
   assert.equal(await page.locator('#poiBagPanel').isVisible(),false,'trade is a protected inventory projection');
  };
  const quote=async(id,amount,action)=>{
   await select(id);
   await price(detail,amount).waitFor({state:'visible'});
   const confirmation=page.locator(detail+' [data-npc-action=confirm]');
   assert.equal((await confirmation.innerText()).trim(),action);
   return confirmation;
  };
  await choice(page,'request');
  await choice(page,'sell');
  await show();
  assert.equal(await tradeItem('trade-sell:1').getAttribute('data-npc-trade-slot'),'1','actual hotbar slot offered');
  assert.equal(await tradeItem('trade-sell:9').getAttribute('data-npc-trade-slot'),'9','actual bag slot offered independently');
  assert.deepEqual(await Promise.all([tradeItem('trade-sell:1').getAttribute('data-count'),
   tradeItem('trade-sell:9').getAttribute('data-count')]),['2','3'],'each visible sell tile shows its own stack');
  await quote('trade-sell:1',3,'売る');
  assert.deepEqual(await readStock(page),listed,'selecting an actual shortcut stack does not sell or use');
  await page.keyboard.press('Escape');
  await page.locator(detail).waitFor({state:'hidden'});
  await show();
  assert.deepEqual(await readStock(page),listed,'back leaves player and NPC stock unchanged');
  await (await quote('trade-sell:1',3,'売る')).tap();
  await page.waitForFunction(()=>window.__editorTest.facility().economy.gold===15);
  await page.locator(detail).waitFor({state:'hidden'});
  const sold=await state(page),afterSale=await readStock(page);
  assert.deepEqual(sold.inventory.hotbar[1],herb(1),'only one item removed from selected hotbar stack');
  assert.deepEqual(sold.inventory.bag[0],herb(3),'same-type bag stack untouched');
  assert.equal(sold.combat.playerHP,before.combat.playerHP,'sale never uses the herb');
  assert.deepEqual(afterSale.npcTrade.actors.stablekeeper,{healingHerb:3,cannedFood:1});
  await page.keyboard.press('Escape');
  await choice(page,'buy');
  await show();
  assert.match(await page.locator(trade).innerText(),/ノア（厩舎番）.*販売品/);
  assert.equal(await tradeItem('trade:healingHerb').getAttribute('data-count'),'3','visible NPC stock reflects prior sale');
  assert.equal(await tradeItem('trade:healingHerb').getAttribute('data-price'),'9');
  await quote('trade:healingHerb',9,'買う');
  assert.deepEqual(await readStock(page),afterSale,'NPC sale stock and wallet unchanged until actual Buy');
  await page.keyboard.press('Escape');
  await page.locator(detail).waitFor({state:'hidden'});
  await (await quote('trade:healingHerb',9,'買う')).tap();
  await page.waitForFunction(()=>window.__editorTest.facility().economy.gold===6);
  await page.locator(detail).waitFor({state:'hidden'});
  const bought=await state(page),afterPurchase=await readStock(page);
  assert.equal(herbCount(bought),herbCount(before),'sale followed by purchase restores one item only');
  assert.equal(bought.combat.playerHP,before.combat.playerHP);
  assert.deepEqual(afterPurchase.npcTrade.actors.stablekeeper,{healingHerb:2,cannedFood:1});
  assert.equal(await tradeItem('trade:healingHerb').getAttribute('data-count'),'2','visible NPC stock decreases after Buy');
  if(out)await page.screenshot({path:out+'/v184-private-sale-stock.png'});
  await page.keyboard.press('Escape'); // purchase projection → request
  await page.keyboard.press('Escape'); // request → root
  await choice(page,'talk');
  assert.equal(cash(await state(page)),6);
  await picture(page,'resident-talk');
  await dismiss(page);
  await noMapMutation(page,layout);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
async function lodging(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:41,z:32},{clockStart:morning,kit:stock,facing:0});
 try{
  const layout=await getMap(page);
  await worker(page,'innkeeper');
  const before=await readStock(page);
  await enter(page);await choice(page,'request');await choice(page,'stay');
  await page.waitForFunction(()=>!!window.__editorTest.townResidents().playerBedId);
  const r=await residents(page),book=r.innBeds.find(b=>b.id===r.playerBedId);
  assert.equal(book?.occupant,'player');assert.equal(book?.y,1);
  assert.deepEqual(await readStock(page),before,'unchanged no-charge inn booking');
  await noMapMutation(page,layout);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
async function sleeping(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:39,z:26},{clockStart:23*60,kit:stock,facing:0});
 try{
  await page.waitForFunction(()=>window.__editorTest.townResidents()?.actors.some(o=>o.id==='innkeeper'&&o.activity==='sleep-home'));
  await page.locator(action).tap();
  await page.locator('#poiMessageLog').filter({hasText:/zzz\.\.\./i}).waitFor({state:'visible'});
  assert.equal(await page.locator('#poiNpcMenu').isVisible(),false,'sleeping NPC only responds with zzz and never opens awake choices');
  await noMapMutation(page,await getMap(page));assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await fixedShop(browser);await residentTrade(browser);await lodging(browser);await sleeping(browser);
 console.log('PASS actual mobile dialogue, fixed shop and resident exchange with confirmations, D-pad wrap, pause, inn and sleeping Zzz');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
