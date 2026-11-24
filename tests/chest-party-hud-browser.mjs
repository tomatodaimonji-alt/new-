import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync} from 'node:fs';
import {Script} from 'node:vm';
const h=readFileSync(process.argv[2]??'world-editor.html','utf8');
for(const [,s] of h.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(s);
if(process.env.CHEST_PARTY_SYNTAX_ONLY){console.log('Chest party HUD source parses');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>Chest party QA</title>':h);
});
await new Promise((r,j)=>server.listen(0,'127.0.0.1',r).once('error',j));
const url='http://127.0.0.1:'+server.address().port;let browser,phase='boot',last;
const out=process.env.FACILITY_SCREENSHOTS;if(out)mkdirSync(out,{recursive:true});
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const c=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:1});
 const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(url+'/seed');
 await p.evaluate(()=>{
  const slots=Array(27).fill(null);slots[0]={type:'equipWoodSword',count:1,durability:150};slots[1]={type:'orvasSoul',count:1,durability:193};
  const chest=Array(18).fill(null);chest[0]={type:'cannedFood',count:3};chest[1]={type:'healingHerb',count:4};
  localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weaponDurabilityVersion:2,slots,weapon:null,potions:0,
   otherworldCleared:true,otherworldChest:{version:1,slots:chest}}));
  localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":360000}');
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,position:{x:100,z:75,y:-1,facing:0},
   townLayout:5,townMapHeight:182,templeDepth:1,view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:-1,hideUpper:false,top:false,third:true,orbitYaw:0,orbitPitch:.12,orbitDistance:6.5}}));
 });
 await p.goto(url+'/?resume=1&test=1',{waitUntil:'domcontentloaded',timeout:45000});
 await p.waitForFunction(()=>window.pineStartup?.ready||window.pineStartup?.failed,null,{polling:120,timeout:45000});
 assert(await p.evaluate(()=>window.pineStartup.ready),JSON.stringify(errors));
 await p.evaluate(()=>document.fonts.ready);
 const read=async()=>last=await p.evaluate(()=>{
  const id=k=>document.getElementById(k);
  const data=el=>({rect:el.getBoundingClientRect().toJSON(),visibility:getComputedStyle(el).visibility,display:getComputedStyle(el).display,
    pointer:getComputedStyle(el).pointerEvents,hidden:el.hidden===true});
  const hero=document.querySelector('#poiPartyCards [data-party-slot="0"]');
  const q=window.__editorTest.facility();
  const hitter=el=>{
   const r=el.getBoundingClientRect();
   return document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)?.closest('button')===el;
  };
  return {pos:q.position,loc:id('poiLocationName').textContent,hero:data(hero),ally:data(id('poiCompanionHud')),
   mini:data(id('poiMiniMap')),bag:data(id('poiBagPanel')),chest:data(id('poiChestPanel')),
   bagHit:hitter(id('poiBagClose')),takeHit:hitter(id('poiChestTakeAll')),closeHit:hitter(id('poiChestClose')),
   hp:id('poiPlayerHpValue').textContent,hpInBag:id('poiBagPlayerHpValue').textContent,allyHp:id('poiCompanionHudHpValue').textContent,
   active:window.__editorTest.companion().active};
 });
 const item=p.locator('#poiHotbar [data-hotbar-slot="1"]');
 const command=x=>p.locator('#poiCompanionCommands [data-companion-command="'+x+'"]');
 const chest=p.locator('#poiChestPanel'),bag=p.locator('#poiBagPanel'),detail=p.locator('#poiItemDetail');
 const action=p.locator('#poiWalkAction');
 const openChest=async()=>{await action.tap();await chest.waitFor({state:'visible'});return read()};
 const closeChest=async()=>{await p.locator('#poiChestClose').tap();await chest.waitFor({state:'hidden'});await bag.waitFor({state:'hidden'});return read()};
 let s=await read();assert.deepEqual(s.pos,{x:100,z:75,level:-1});assert.equal(s.loc,'星蝕の回廊');
 phase='real summoning and exact live starting HP at the Otherworld treasure stand';
 await p.bringToFront();await item.tap();await command('summon').tap();
 await p.waitForFunction(()=>window.__editorTest.companion().active==='orvasSoul'&&document.querySelector('#poiCompanionHudHpValue').textContent==='193/1050');
 assert(await p.evaluate(()=>window.__editorTest.testWound(15)));
 const before=await read();assert.equal(before.hp,'85/100');assert.equal(before.allyHp,'193/1050');
 const near=(x,y)=>assert(Math.abs(x-y)<.5,JSON.stringify([x,y]));
 function verify(s,expectBuddy=true){
  assert.equal(s.hero.visibility,'visible',JSON.stringify(s));
  assert.equal(s.hero.pointer,'none');assert.equal(s.hp,'85/100');assert.equal(s.hpInBag,s.hp);
  if(expectBuddy){assert.equal(s.ally.visibility,'visible',JSON.stringify(s));assert(!s.ally.hidden);assert.equal(s.ally.pointer,'none');assert.equal(s.allyHp,'193/1050');}
  else{assert(s.ally.hidden);assert.equal(s.ally.display,'none');}
  for(const card of [s.hero,...(expectBuddy?[s.ally]:[])])for(const panel of [s.bag,s.chest].filter(x=>!x.hidden)){
   const a=card.rect,b=panel.rect;
   assert(a.bottom<=b.top+1||b.bottom<=a.top+1||a.right<=b.left+1||b.right<=a.left+1,JSON.stringify({a,b}));
  }
  assert(s.bagHit);if(!s.chest.hidden)assert(s.closeHit&&s.takeHit);
  assert.deepEqual(s.pos,{x:100,z:75,level:-1});
 }
 phase='actual treasure chest opens both drawers and preserves both party cards';
 s=await openChest();verify(s);
 near(s.hero.rect.left,before.hero.rect.left);near(s.hero.rect.top,before.hero.rect.top);
 if(out)await p.screenshot({path:out+'/star-corridor-chest-live-hud.png'});
 phase='original chest selection and return still physically clickable';
 await p.locator('#poiChestGrid [data-chest-slot="0"]').tap();
 await detail.waitFor({state:'visible'});assert.equal(await p.locator('#poiItemDetailName').innerText(),'缶詰');
 await detail.locator('[data-item-detail-action="back"]').tap();await detail.waitFor({state:'hidden'});
 verify(await read());
 phase='narrow landscape keeps readable card row and location geometry';
 await p.setViewportSize({width:568,height:320});
 s=await read();verify(s);assert(s.ally.rect.left>=s.hero.rect.right+3);
 assert(s.hero.rect.left>s.mini.rect.right+5);
 if(out)await p.screenshot({path:out+'/star-corridor-chest-live-hud-narrow.png'});
 const closed=await closeChest();near(closed.hero.rect.left,s.hero.rect.left);near(closed.hero.rect.top,s.hero.rect.top);
 assert.equal(closed.ally.rect.left,closed.hero.rect.left);assert(closed.ally.rect.top>=closed.hero.rect.bottom+3);
 phase='ordinary bag preserves current party, then real dismissal stays hidden in chest';
 await p.locator('#poiBagToggle').tap();await bag.waitFor({state:'visible'});verify(await read());
 await p.locator('#poiBagClose').tap();await bag.waitFor({state:'hidden'});
 await item.tap();await command('dismiss').tap();await p.waitForFunction(()=>window.__editorTest.companion().active===null);
 s=await openChest();verify(s,false);await closeChest();
 assert.deepEqual(errors,[]);await c.close();
 console.log('Actual 星蝕の回廊 chest: real player and active ally HP visible, ordinary bag and chest clicks work, narrow clearance and dismissal respected.');
}catch(e){console.error(phase,last);throw e}
finally{await browser?.close();await new Promise(r=>server.close(r))}
