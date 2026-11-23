import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';

const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
assert.match(html,/function poiTownNpcGearVisualKey\(/,'role gear uses shared actual posed/cached art');
assert.match(html,/const POI_FRESH_ARMOR=/,'new kit has deliberate unequipped state');
assert.match(html,/id:'towncook',name:'イネス'/,'named chef belongs to authored schedule');
if(process.env.ROLE_GEAR_LAYOUT_ONLY==='1'){console.log('PASS v211 role gear and starting outfit source');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url.startsWith('/seed')?'<!doctype html><title>Isolated fixture</title>':html);
});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const origin='http://127.0.0.1:'+server.address().port;
const kitKey='world-workshop-hotbar-v1',resumeKey='world-workshop-resume-v1';
const out=process.env.FACILITY_SCREENSHOTS;if(out)await mkdir(out,{recursive:true});
const game=page=>page.evaluate(()=>window.__editorTest.facility());
const raw=page=>page.evaluate(k=>localStorage.getItem(k),kitKey);
const talk=page=>page.evaluate(()=>window.__editorTest.townResidents().dialogue);
const guild={x:56,z:29,dir:0,id:'guildkeeper',name:'リーネ',at:[56,27],weapon:'equipBallpointPen',torso:'armorGuildUniform',head:'starterCap'};
const cook={x:26,z:41,dir:2,id:'towncook',name:'イネス',at:[26,42],weapon:'equipFryingPan',torso:'armorCookApron',head:'armorCookHat'};
const legacy='{"version":1,"weapon":"equipWoodSword","potions":3,"gold":12,"claimedCaches":["glade"]}';
const gearParts=['head','torso','legs','feet'];
const legacyTypes=['starterCap','starterTunic','starterTrousers','starterBoots'];
async function launch(browser,r,kit=null){
 const ctx=await browser.newContext({viewport:{width:390,height:740},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
 await page.goto(origin+'/seed');
 await page.evaluate(({r,kit,kitKey,resumeKey})=>{
  if(kit!==null)localStorage.setItem(kitKey,kit);
  localStorage.setItem('world-workshop-town-clock-v1',JSON.stringify({version:1,gameMs:11*60*500}));
  localStorage.setItem(resumeKey,JSON.stringify({version:1,route:'facility',id:'base',play:true,position:{x:r.x,z:r.z,y:0,facing:r.dir},townLayout:5,townMapHeight:128,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 },{r,kit,kitKey,resumeKey});
 await page.goto(origin+'/?resume=1&test=1');
 await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
 assert.deepEqual((await game(page)).position,{x:r.x,z:r.z,level:0});
 return {ctx,page,errors};
}
async function art(page,id){
 const sample=await page.locator(id).evaluate(c=>{
  const pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
  let opaque=0,transparent=0;
  for(let i=3;i<pixels.length;i+=4){if(pixels[i]===0)transparent++;if(pixels[i]>225)opaque++}
  const image=c.toDataURL('image/png');
  return {opaque,transparent,size:c.width*c.height,image};
 });
 assert(sample.opaque>sample.size*.03&&sample.transparent>sample.size*.15,'real paper doll has visible mesh and transparent surrounding pixels');
 return {...sample,hash:createHash('sha256').update(sample.image).digest('hex')};
}
async function player(browser,isLegacy){
 const {ctx,page,errors}=await launch(browser,guild,isLegacy?legacy:null);
 try{
  const before=await raw(page),s=(await game(page)).inventory;
  assert(s.hotbar.concat(s.bag).some(c=>c?.type==='equipWoodSword'),'starter sword still retained as an inventory item');
  assert.equal(s.weapon,isLegacy?'equipWoodSword':null);
  assert.deepEqual(gearParts.map(k=>s.worn[k]?.type??null),isLegacy?legacyTypes:[null,null,null,null]);
  await page.locator('#poiBagToggle').tap();await page.locator('#poiBagPanel').waitFor({state:'visible'});
  const body=await art(page,'#poiAvatarPreview');
  for(const part of gearParts)assert.equal((await page.locator('[data-gear-slot="'+part+'"]').getAttribute('aria-label')).includes('未装備'),!isLegacy);
  if(isLegacy)assert.equal(await raw(page),legacy,'opening an existing implicit-starter kit cannot rewrite saved bytes');
  else assert.equal(await raw(page),before,'opening fresh inventory does not silently equip or write a kit');
  if(out)await page.screenshot({path:out+'/v211-'+(isLegacy?'legacy':'fresh')+'-paper-doll.png'});
  assert.deepEqual(errors,[]);
  return body.hash;
 }finally{await ctx.close()}
}
async function resident(browser,r){
 const {ctx,page,errors}=await launch(browser,r,legacy);
 try{
  await page.waitForFunction(r=>{
   const a=window.__editorTest.townResidents().actors.find(a=>a.id===r.id);
   return a&&!a.recessed&&a.activity==='work'&&a.x===r.at[0]&&a.z===r.at[1]&&a.y===0;
  },r);
  await page.waitForFunction(()=>document.querySelector('#poiWalkAction').getAttribute('aria-label')==='住人と話す');
  await page.locator('#poiWalkAction').tap();
  await page.waitForFunction(id=>window.__editorTest.townResidents().dialogue?.id===id,r.id);
  await page.locator('#poiNpcMenu [data-npc-action="status"]').tap();
  await page.locator('#poiNpcInventory').waitFor({state:'visible'});
  const d=await talk(page);
  assert(d.name.startsWith(r.name));assert.equal(d.status.weapon,r.weapon);
  const inside='#poiNpcInventory';
  for(const [slot,type] of [['weapon',r.weapon],['head',r.head],['torso',r.torso]]){
   const cell=page.locator(inside+' [data-npc-gear-slot="'+slot+'"]');
   assert.equal(await cell.getAttribute('data-npc-equipment'),type);
   assert(await cell.getAttribute('aria-label'));
   assert(await cell.locator('.hotbar-icon').evaluate(e=>e.childElementCount||e.textContent.trim()));
  }
  if(r.id==='towncook'){
   assert(d.status.tools.includes('equipLadle'));
   await page.locator(inside+' [data-npc-item="equipLadle"]').waitFor({state:'visible'});
  }
  const portrait=await art(page,'#poiNpcPortrait');
  assert.equal(await raw(page),legacy,'resident inspection does not mutate player inventory');
  if(out)await page.screenshot({path:out+'/v211-'+r.id+'-portrait.png'});
  assert.deepEqual(errors,[]);
  return portrait.hash;
 }finally{await ctx.close()}
}
let browser;
try{
 browser=await chromium.launch({headless:true,
  ...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 if(process.env.ROLE_GEAR_CASE!=='residents'){
  assert.notEqual(await player(browser,false),await player(browser,true),'fresh and legacy produce distinct real paper-doll pixels');
 }
 if(process.env.ROLE_GEAR_CASE!=='players'){
  assert.notEqual(await resident(browser,guild),await resident(browser,cook),'authored clerk and cook generate genuinely different transparent NPC art');
 }
 console.log('PASS native portrait role/loadout, fresh gear, legacy bytes and distinct canvas art');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
