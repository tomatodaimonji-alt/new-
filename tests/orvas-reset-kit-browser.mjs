import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const {argv,env}=process,file=argv[2]??'world-editor.html';
let html=readFileSync(file,'utf8');
const mark='  freeMovementPose:()=>({x:poiWalkViewX,z:poiWalkViewZ,level:poiWalkLevel}),';
assert.equal(html.split(mark).length,2);
html=html.replace(mark,mark+`
  resetKitQA:()=>{const k=poiHotbarRead(),slots=poiInventorySlots(k);
   return {walking:poiWalkActive,site:facilitySite?.id,pos:[poiWalkX,poiWalkZ,poiWalkLevel],
    kit:{weapon:k.weapon,potions:k.potions,gold:k.gold??0,orvasRewards:k.orvasRewards??0,
     slots:slots.map(c=>c?{type:c.type,count:c.count,durability:c.durability}:null)},
    spawn:facilitySite?.spawn,max:['equipOrvasHead','equipOrvasGreatsword','equipOrvasTwinGreatswords'].map(poiEquipmentDurabilityMax),
    raw:localStorage.getItem(POI_HOTBAR_KEY),backup:localStorage.getItem(POI_GAME_RESET_BACKUP),first:localStorage.getItem(POI_GAME_RESET_FIRST_BACKUP)};
  },
`);
for(const [,js] of html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(js);
if(env.ORVAS_RESET_LAYOUT_ONLY){console.log('Exact reset browser source parses');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('content-type','text/html;charset=utf-8');res.end(req.url==='/seed'?'<title>Reset proof sandbox</title>':html)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
const keys=['equipOrvasHead','equipOrvasGreatsword','equipOrvasTwinGreatswords'];
const kitKey='world-workshop-hotbar-v1',resumeKey='world-workshop-resume-v1';
let browser,p,where='start';
const errors=[];
const ready=async()=>{await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:25000});
 await p.waitForFunction(()=>!!window.__editorTest?.resetKitQA?.().walking,null,{timeout:13000});};
const snapshot=()=>p.evaluate(()=>window.__editorTest.resetKitQA());
const noOrvas=s=>assert.equal(s.kit.slots.filter(c=>keys.includes(c?.type)).length,0);
async function localPage(){p=await browser.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:.7});p.on('pageerror',e=>errors.push(e.message));}
async function open(){await p.locator('#poiLandscapeMenuToggle').click();await p.locator('[data-landscape-action="reset"]').click();
 await p.locator('#poiResetGameDialog').waitFor({state:'visible'});assert.equal(await p.evaluate(()=>document.activeElement.id),'poiResetGameCancel');}
function seeded(s){
 const all=s.kit.slots,orvas=all.filter(c=>keys.includes(c?.type));
 assert.deepEqual(orvas.map(c=>c.type),keys);assert(orvas.every((c,i)=>c.count===1&&c.durability===s.max[i]&&c.durability>0));
 assert.deepEqual(all.slice(2,5).map(c=>c?.type),keys,'three explicit reset slots are inside the 9-slot shortcut bar');
 assert.equal(all[0]?.type,'equipWoodSword');assert.equal(all[1]?.count,3);assert.equal(s.kit.potions,3);
 assert.equal(s.kit.weapon,null);assert.equal(s.kit.orvasRewards,0);
}
try{
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 where='fresh cold session and inert reset-camera URL';
 await localPage();await p.goto(url+'/?facility=base&facility-play=1&reset-camera=1&test=1',{waitUntil:'domcontentloaded'});await ready();noOrvas(await snapshot());await p.context().close();
 where='old resume and inventory remain intact';
 await localPage();await p.goto(url+'/seed');
 const oldKit=JSON.stringify({version:1,weapon:null,potions:8,gold:1234});
 const oldResume=JSON.stringify({version:1,route:'facility',id:'base',play:true,position:{x:45,z:41,y:0,facing:2},townLayout:5,townMapHeight:128,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.35,orbitDistance:5.5}});
 await p.evaluate(([k,r,v,w])=>{localStorage.setItem(k,v);localStorage.setItem(r,w);localStorage.setItem('reset-qa-other','keep')},[kitKey,resumeKey,oldKit,oldResume]);
 await p.goto(url+'/?resume=1&test=1',{waitUntil:'domcontentloaded'});await ready();
 let s=await snapshot();assert.deepEqual(s.pos,[45,41,0]);assert.equal(s.kit.potions,8);assert.equal(s.kit.gold,1234);noOrvas(s);
 await p.reload({waitUntil:'domcontentloaded'});await ready();s=await snapshot();noOrvas(s);assert.deepEqual(s.pos,[45,41,0]);assert.equal(s.kit.gold,1234);
 where='real menu cancel cannot alter storage or position';
 const before=s;
 await open();await p.locator('#poiResetGameCancel').click();await p.locator('#poiResetGameDialog').waitFor({state:'hidden'});
 s=await snapshot();assert.equal(s.raw,before.raw);assert.equal(s.backup,before.backup);assert.deepEqual(s.pos,before.pos);noOrvas(s);
 where='real menu confirm writes exactly one of each and archives prior game';
 await open();await Promise.all([p.waitForURL(/reset-camera=1/),p.locator('#poiResetGameConfirm').click()]);await ready();
 s=await snapshot();seeded(s);assert.equal(s.kit.gold,0);assert.deepEqual(s.pos,[s.spawn.x,s.spawn.z,0]);assert.equal(await p.evaluate(()=>localStorage.getItem('reset-qa-other')),'keep');
 assert.equal(JSON.parse(s.first).before[kitKey],before.raw);assert.equal(JSON.parse(s.backup).phase,'complete');
 where='reload again is not an initialization or second grant';
 const first=s.first;await p.reload({waitUntil:'domcontentloaded'});await ready();s=await snapshot();seeded(s);assert.equal(s.first,first);
 where='second explicit initialization replaces rather than accumulating another set';
 await open();await Promise.all([p.waitForEvent('framenavigated',{predicate:f=>f===p.mainFrame()}),p.locator('#poiResetGameConfirm').click()]);await ready();
 s=await snapshot();seeded(s);assert.equal(s.first,first);assert.deepEqual(errors,[]);
 console.log('Actual fresh/reload/cancel/confirm/repeat: only explicit initialization grants a single valid Orvas set, preserving starter and verified original archive.');
}catch(e){console.error(where,await snapshot().catch(()=>null),errors);throw e}
finally{await browser?.close();await new Promise(r=>server.close(r))}
