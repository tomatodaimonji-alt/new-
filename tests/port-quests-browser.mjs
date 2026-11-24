import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
for(const [,s] of html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(s);
if(process.env.PORT_QUEST_SYNTAX_ONLY){console.log('exact product scripts compile');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<!doctype html><title>Port quest QA</title>':html)});
await new Promise((r,j)=>server.listen(0,'127.0.0.1',r).once('error',j));
const origin='http://127.0.0.1:'+server.address().port,kit='world-workshop-hotbar-v1';
const a='pier-lantern',b='market-message';
const errors=[];let browser,ctx,p,checkpoint='launch';
const wait=(f,v=null,t=7000)=>p.waitForFunction(f,v,{timeout:t,polling:32});
const save=()=>p.evaluate(k=>JSON.parse(localStorage.getItem(k)),kit);
async function start(x,z,facing){
 await p.goto(origin+'/seed');
 await p.evaluate(({x,z,facing,kit})=>{
  if(localStorage.getItem(kit)===null)localStorage.setItem(kit,JSON.stringify({version:1,weapon:null,potions:2,gold:11}));
  localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":300000}');
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x,z,y:0,facing},townLayout:5,townMapHeight:128,
   view:{yaw:0,zoom:.9,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 },{x,z,facing,kit});
 await p.goto(origin+'/?resume=1&test=1');
 await p.locator('#pineStartupCover').waitFor({state:'hidden'});
 await wait(()=>window.__editorTest?.facility()?.active);
}
const menu=id=>p.locator('#poiNpcMenu [data-npc-action="'+id+'"]');
const click=id=>menu(id).tap();
async function request(who){
 await wait(who=>document.querySelector('#poiWalkAction')?._talkActor?.role?.id===who,who);
 await p.locator('#poiWalkAction').tap();
 await wait(who=>window.__editorTest.townResidents().dialogue?.id===who,who);
 await click('request');
}
async function see(expect,gold){
 const s=await save();assert.deepEqual(s.portQuests,expect);assert.equal(s.gold,gold);
 assert.equal(s.weapon,null);assert.equal(s.potions,2);
}
async function walkWest(){
 for(let x=76;x>=73;x--){
  await p.keyboard.press('ArrowLeft');
  await wait(x=>window.__editorTest.facility().position.x===x,x);
  await p.waitForTimeout(205);
 }
}
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 ctx=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:.65,isMobile:true,hasTouch:true});
 p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(12000);
 checkpoint='accept Claire first at real fish counter';
 await start(84,115,2);await request('portfishseller');
 await click('port-quest:'+b);await click('port-accept:'+b);await see({[b]:'accepted'},11);
 checkpoint='accept Neri from real pier and survive reload before four real walk steps';
 await start(77,118,0);await request('portfisher');await click('port-quest:'+a);await click('port-accept:'+a);
 await see({[a]:'accepted',[b]:'accepted'},11);
 await p.reload();await p.locator('#pineStartupCover').waitFor({state:'hidden'});
 await wait(()=>window.__editorTest?.facility()?.active);await walkWest();
 assert.equal((await p.evaluate(()=>window.__editorTest.facility().position)).z,118);
 await see({[a]:'ready',[b]:'accepted'},11);
 checkpoint='Marek retains the normal shop lanes and explicitly acknowledges the story delivery';
 // A new real reload checkpoint places us at the south inn; the test
 // does not mutate either quest phase outside of their actual UI commands.
 await start(101,112,3);await request('southmerchant');
 assert(await menu('buy').isVisible()&&await menu('sell').isVisible());
 await click('port-deliver:'+b);await see({[a]:'ready',[b]:'ready'},11);
 checkpoint='claim Claire and Neri rewards, each across a reload';
 await start(84,115,2);await request('portfishseller');await click('port-quest:'+b);await click('port-report:'+b);
 await see({[a]:'ready',[b]:'done'},19);
 await start(77,118,0);await request('portfisher');await click('port-quest:'+a);await click('port-report:'+a);
 await see({[a]:'done',[b]:'done'},25);assert.equal(await menu('port-report:'+a).count(),0);
 await start(84,115,2);await request('portfishseller');await click('port-quest:'+b);
 assert.equal(await menu('port-report:'+b).count(),0);assert.equal(await menu('port-accept:'+b).count(),0);
 await see({[a]:'done',[b]:'done'},25);
 assert.deepEqual(errors,[]);
 console.log('PASS real port NPC request/return UI, four pier steps, explicit live Marek conversation and persistent one-time rewards');
}catch(e){console.error(checkpoint,p?JSON.stringify(await save().catch(()=>null)):null,errors);throw e}
finally{await ctx?.close();await browser?.close();await new Promise(r=>server.close(r))}
