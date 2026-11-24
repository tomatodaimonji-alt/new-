import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync} from 'node:fs';
import {Script} from 'node:vm';
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
for(const [,s] of html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(s);
if(process.env.AREA_CARD_SYNTAX_ONLY==='1'){console.log('fixed area card source parses');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url==='/seed'?'<title>Area card QA</title>':html);
});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const url='http://127.0.0.1:'+server.address().port;let browser,phase='boot';
const out=process.env.FACILITY_SCREENSHOTS;
if(out)mkdirSync(out,{recursive:true});
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const c=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:.8,reducedMotion:'no-preference'});
 await c.addInitScript(()=>{
  const animate=Element.prototype.animate;window.__areaPulses=[];
  Element.prototype.animate=function(...a){
   const r=animate.apply(this,a);if(this.id==='poiLocationPanel')window.__areaPulses.push(r);
   return r;
  };
 });
 const p=await c.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(url+'/seed');
 await p.evaluate(()=>{
  const slots=Array(27).fill(null);slots[0]={type:'orvasSoul',count:1,durability:193};
  localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weaponDurabilityVersion:2,slots,weapon:null,potions:0,
    companionSoul:{version:1,active:'orvasSoul',pending:null,mode:'follow'}}));
  localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":360000}');
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,position:{x:24,z:127,y:0,facing:2},
    townLayout:5,townMapHeight:182,templeDepth:1,view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:0,orbitPitch:.12,orbitDistance:6.5}}));
 });
 await p.goto(url+'/?resume=1&test=1',{waitUntil:'domcontentloaded',timeout:45000});
 await p.waitForFunction(()=>window.pineStartup?.ready||window.pineStartup?.failed,null,{polling:120,timeout:45000});
 assert(await p.evaluate(()=>window.pineStartup.ready),JSON.stringify(errors));
 const pos=()=>p.evaluate(()=>window.__editorTest.facility().position);
 assert.deepEqual(await pos(),{x:24,z:127,level:0});
 const area=p.locator('#poiLocationName'),rank=p.locator('#poiLocationStars');
 assert.notEqual(await area.innerText(),'オルヴァスの大神殿');
 assert.equal(await p.locator('#poiCompanionHudHpValue').innerText(),'193/1050');
 phase='real temple traversal, actual player and active companion';
 for(const z of [128,129]){
  for(let i=0;i<4&&(await pos()).z!==z;i++){await p.keyboard.press('ArrowUp');await p.waitForTimeout(290)}
  assert.deepEqual(await pos(),{x:24,z,level:0});
 }
 await p.evaluate(()=>document.fonts.ready);
 assert.equal(await area.innerText(),'オルヴァスの大神殿');assert.equal(await area.getAttribute('title'),'オルヴァスの大神殿');
 assert.equal(await rank.innerText(),'★'.repeat(10));assert.equal(await rank.getAttribute('aria-label'),'危険度 10／10');
 const measure=()=>p.evaluate(()=>{
  const get=id=>document.querySelector('#'+id),rect=el=>el.getBoundingClientRect().toJSON(),name=get('poiLocationName'),stars=get('poiLocationStars');
  const lines=el=>{const range=document.createRange();range.selectNodeContents(el);return [...range.getClientRects()].map(x=>x.toJSON())};
  const nodes={mini:rect(get('poiMiniMap')),clock:rect(get('poiClockHud')),area:rect(get('poiLocationPanel')),party:rect(get('poiPartyCards')),
   analog:rect(get('poiAnalogPad')),mapOpen:rect(get('poiMiniOpen'))};
  return {...nodes,title:lines(name),stars:lines(stars),font:parseFloat(getComputedStyle(stars).fontSize),frames:window.__areaPulses.length,
   lanes:[...document.querySelectorAll('#poiPartyCards .poiPartyCard')].filter(x=>!x.hidden).map(rect)};
 });
 function verify(s,w,h,all=true,wrap=false,gap=7,left=5){
  assert(Math.abs(s.mini.width-Math.min(100,Math.max(67,h*.24)))<1.2,JSON.stringify(s));
  assert(Math.abs(s.mini.width-s.mini.height)<1.2);
  assert(Math.abs(s.area.left-s.mini.left)<.2&&Math.abs(s.mini.left-left)<.4);
  assert(Math.abs(s.clock.left-s.mini.left)<.2&&Math.abs(s.clock.width-s.mini.width)<1.2);
  assert(s.area.bottom<s.clock.top&&s.clock.bottom<=s.analog.top+.6,'the HUD stops above the touch pad');
  assert(s.area.right+gap<=s.party.left&&s.party.right<=w-5,'two separate safe-area columns');
  assert(s.area.height>=37);
  assert(s.lanes.length===(all?4:2));
  assert(s.lanes.every((r,i)=>r.left>=s.party.left-.2&&r.right<=s.party.right+.2&&(!i||s.lanes[i-1].bottom+3<=r.top)));
  for(const row of [...s.title,...s.stars])assert(row.right<=s.area.right-4&&row.left>=s.area.left+4,JSON.stringify(s));
  assert(s.title.length>=(wrap?2:1));
  if(!wrap){assert.equal(s.stars.length,1);assert(s.font>=(w>600?11:9));}
 }
 const before=await measure();verify(before,844,390,false);assert(before.frames>0);
 // Scrub the actual area animation to peak and verify both fixed bounds
 // and the visible inset pulse. No real simulated ally is cloned here.
 await p.evaluate(()=>{const a=window.__areaPulses.at(-1);a.pause();a.currentTime=a.effect.getTiming().duration*.27;});
 const peak=await measure();verify(peak,844,390,false);assert.deepEqual(peak.area,before.area);
 assert.match(await p.locator('#poiLocationPanel').evaluate(el=>getComputedStyle(el).boxShadow),/inset/);
 if(out)await p.screenshot({path:out+'/area-card-common.png',timeout:10000});
 phase='four-card capacity with simulated phone safe areas; no party gameplay mocked';
 await p.evaluate(()=>{
  const view=document.querySelector('#viewWrap'),live=document.querySelector('#poiCompanionHud'),party=document.querySelector('#poiPartyCards');
  for(let i=0;i<2;i++){
   const c=live.cloneNode(true);for(const el of [c,...c.querySelectorAll('[id]')])el.removeAttribute('id');
   c.dataset.fixtureLayoutCard='';c.dataset.partySlot=String(i+2);c.querySelector('strong').textContent=i===0?'スライム':'仲間';party.append(c);
  }
 });
 verify(await measure(),844,390);
 await p.setViewportSize({width:568,height:320});
 await p.evaluate(()=>{const s=document.querySelector('#viewWrap').style;s.setProperty('--poi-land-left','46px');s.setProperty('--poi-land-right','44px');});
 const narrow=await measure();verify(narrow,568,320,true,false,7,46);
 if(out)await p.screenshot({path:out+'/area-card-narrow-safe.png',timeout:10000});
 await p.evaluate(()=>document.querySelector('#viewWrap').style.setProperty('--poi-area-width','86px'));
 verify(await measure(),568,320,true,true,7,46);
 await p.evaluate(()=>document.querySelector('#viewWrap').style.removeProperty('--poi-area-width'));
 phase='original real map and inventory targets';
 await p.locator('#poiMiniOpen').tap();await p.locator('#poiLocalMapDialog').waitFor({state:'visible'});
 await p.locator('#poiLocalMapClose').tap();await p.locator('#poiLocalMapDialog').waitFor({state:'hidden'});
 await p.locator('#poiBagToggle').tap();await p.locator('#poiBagPanel').waitFor({state:'visible'});
 await p.locator('#poiBagClose').tap();await p.locator('#poiBagPanel').waitFor({state:'hidden'});
 assert.deepEqual(errors,[]);await c.close();
 console.log('Native temple title and ten stars in fixed lanes, 2 genuine cards + 4-card layout capacity, touch maps/inventory unchanged.');
}catch(e){console.error(phase);throw e}
finally{await browser?.close();await new Promise(r=>server.close(r))}
