import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';

const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
assert.match(html,/#poiBagWallet\[data-wallet-empty\]\s+svg/,'v208 hides zero-gold icon');
assert.match(html,/function poiTownCounterTalkReachable\(/,'v208 uses actual aligned counter line');
if(process.env.GOLD_COUNTER_LAYOUT_ONLY==='1'){
 console.log('PASS v208 zero-wallet UI and aligned service-counter contract');process.exit(0);
}
const wallAnchor='const built=guildOriginalRequested?pineGuildOriginalSite():guildRenewalRequested?(pineGuildRenewalSite()||pineGuildRenewalSample()):buildFacilitySite(facilityRecord.id);';
assert.equal(html.split(wallAnchor).length,2);
const blocked=html.replace(wallAnchor,wallAnchor+"\n if(built&&facilityRecord.id==='base')built.map.world.push({x:70,z:35,y:0,type:'woodwall',rot:1});");
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url.startsWith('/seed')?'<!doctype html><title>Isolated fixture</title>':html);
});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const origin='http://127.0.0.1:'+server.address().port;
const kitKey='world-workshop-hotbar-v1',resumeKey='world-workshop-resume-v1';
const action='#poiWalkAction',bag='#poiBagPanel',wallet='#poiBagWallet',goldIcon='#poiGoldValue';
const slot='#poiHotbar [data-hotbar-slot="4"]',option=id=>'#poiNpcMenu button[data-npc-action="'+id+'"]';
const out=process.env.FACILITY_SCREENSHOTS;if(out)await mkdir(out,{recursive:true});
const state=page=>page.evaluate(()=>window.__editorTest.facility());
const talk=page=>page.evaluate(()=>window.__editorTest.townResidents().dialogue);
const raw=page=>page.evaluate(key=>localStorage.getItem(key),kitKey);
const store=async page=>JSON.parse(await raw(page));
const kit=(gold,assigned=true)=>({version:1,weapon:'equipWoodSword',potions:2,...(gold?{gold}:{}),claimedCaches:['glade'],...(assigned?{goldHotbarSlot:4}:{})});
const roles={
 tool:{id:'toolkeeper',name:'トビン',x:69,z:35,dir:1,npcX:71,npcZ:35,service:'shop'},
 inn:{id:'innkeeper',name:'ガルド',x:41,z:32,dir:0,npcX:41,npcZ:30,service:'stay'},
 guild:{id:'guildkeeper',name:'リーネ',x:56,z:29,dir:0,npcX:56,npcZ:27,service:'quest'},
 workshop:{id:'workshopkeeper',name:'ブラム',x:78,z:32,dir:1,npcX:80,npcZ:32},
 dining:{id:'diningkeeper',name:'マルタ',x:31,z:38,dir:0,npcX:31,npcZ:36}
};
async function launch(browser,where,data,wall=false){
 const ctx=await browser.newContext({viewport:{width:390,height:740},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
 await page.goto(origin+'/seed');
 await page.evaluate(({where,data,kitKey,resumeKey})=>{
  localStorage.setItem(kitKey,JSON.stringify(data));
  localStorage.setItem('world-workshop-town-clock-v1',JSON.stringify({version:1,gameMs:11*60*500}));
  localStorage.setItem(resumeKey,JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:where.x,z:where.z,y:0,facing:where.dir},townLayout:5,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 },{where,data,kitKey,resumeKey});
 // Keep native resume URL identical to unmodified cases. Only this
 // disposable route receives the map with a wall across the service line.
 if(wall)await page.route(url=>url.origin===origin&&url.pathname==='/'&&url.searchParams.has('resume'),
  route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:blocked}));
 await page.goto(origin+'/?resume=1&test=1');
 await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
 assert.deepEqual((await state(page)).position,{x:where.x,z:where.z,level:0});
 return {ctx,page,errors};
}
async function worker(page,r){
 return page.waitForFunction(r=>window.__editorTest.townResidents()?.actors.some(a=>
  a.id===r.id&&a.x===r.npcX&&a.z===r.npcZ&&a.y===0&&a.activity==='work'&&!a.recessed),r);
}
async function openTalk(page,r){
 await worker(page,r);
 await page.waitForFunction(()=>document.querySelector('#poiWalkAction').getAttribute('aria-label')==='住人と話す');
 await page.locator(action).tap();
 await page.waitForFunction(id=>window.__editorTest.townResidents()?.dialogue?.id===id,r.id);
 assert((await talk(page)).name.startsWith(r.name));
}
async function choose(page,id){await page.locator(option(id)).tap()}
async function emptyUi(page){
 const cell=page.locator(slot);
 assert.equal(await cell.getAttribute('data-gold-shortcut'),null);
 assert(!(await cell.getAttribute('aria-label')).includes('金貨'));
 assert.equal(await cell.locator('.hotbar-count').textContent(),'');
 assert.equal((await state(page)).inventory.goldHotbarSlot,null);
 await page.locator('#poiBagToggle').tap();await page.locator(bag).waitFor({state:'visible'});
 assert.equal(await page.locator(wallet).getAttribute('data-wallet-empty'),'');
 assert.equal(await page.locator(goldIcon).textContent(),'');
 assert.equal(await page.locator(wallet+' svg').evaluate(el=>getComputedStyle(el).visibility),'hidden');
}
async function oldZero(browser){
 const data=kit(0),{ctx,page,errors}=await launch(browser,roles.tool,data);
 try{
  const before=await raw(page);
  assert.equal(JSON.parse(before).goldHotbarSlot,4);
  await emptyUi(page);
  assert.equal(await raw(page),before,'opening stale zero-wallet save is read-only');
  if(out)await page.screenshot({path:out+'/v208-stale-zero-wallet.png'});
  await page.reload();await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
  await emptyUi(page);
  assert.equal(await raw(page),before);
  assert.deepEqual(errors,[]);
 }finally{await ctx.close()}
}
async function spend(browser){
 const data=kit(6),r=roles.tool,{ctx,page,errors}=await launch(browser,r,data);
 try{
  const before=await raw(page),cell=page.locator(slot);
  assert(await cell.evaluate(e=>e.hasAttribute('data-gold-shortcut')));
  assert.equal((await cell.locator('.hotbar-count').innerText()).trim(),'6');
  await openTalk(page,r);await choose(page,'request');await choose(page,'shop');
  assert.match(await page.locator(option('trade:shop-herb')).innerText(),/薬草 6G/);
  await choose(page,'trade:shop-herb');assert.equal(await raw(page),before,'preview must not spend coins');
  await choose(page,'confirm');
  await page.waitForFunction(()=>window.__editorTest.facility().economy.gold===0);
  const after=await store(page);
  assert.equal(after.gold??0,0);assert.equal(after.goldHotbarSlot,undefined);
  assert.equal(after.potions,data.potions+1);assert.equal(after.weapon,data.weapon);
  await page.reload();await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
  await emptyUi(page);
  assert.deepEqual(await store(page),after);
  if(out)await page.screenshot({path:out+'/v208-post-purchase-zero-wallet.png'});
  assert.deepEqual(errors,[]);
 }finally{await ctx.close()}
}
async function counters(browser){
 for(const r of [roles.inn,roles.guild,roles.workshop,roles.dining]){
  const {ctx,page,errors}=await launch(browser,r,kit(12,false));
  try{
   const before=await raw(page);
   await openTalk(page,r);
   if(r.service==='stay'){
    await choose(page,'request');
    await page.locator(option('stay')).waitFor({state:'visible'});
   }else if(r.service==='quest')await page.locator(option('quest')).waitFor({state:'visible'});
   else await page.locator(option('talk')).waitFor({state:'visible'});
   assert.equal(await raw(page),before,'counter chat and navigation do not grant purchases or quests');
   assert.deepEqual(errors,[]);
  }finally{await ctx.close()}
 }
 const r=roles.tool,{ctx,page,errors}=await launch(browser,r,kit(6),true);
 try{
  await worker(page,r);
  const map=await page.evaluate(()=>window.__editorTest.data());
  assert(map.world.some(o=>o.x===70&&o.z===35&&o.y===0&&o.type==='woodwall'));
  assert.equal(await page.locator(action).getAttribute('aria-label'),'攻撃または決定');
  const before=await raw(page);
  await page.locator(action).tap();
  assert.equal(await talk(page),null,'real wall stacked over counter blocks native decision');
  assert.equal(await raw(page),before);
  assert.deepEqual(errors,[]);
 }finally{await ctx.close()}
}
let browser;
try{
 browser=await chromium.launch({headless:true,
  ...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 if(process.env.GOLD_COUNTER_CASE!=='counters')await oldZero(browser);
 await spend(browser);
 if(process.env.GOLD_COUNTER_CASE!=='gold')await counters(browser);
 console.log('PASS native portrait zero wallet, actual 6G purchase to 0, five staffed counters, and blocked unrelated wall');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
