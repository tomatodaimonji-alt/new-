import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
function add(h,a,b){assert.equal(h.split(a).length,2,a);return h.replace(a,a+b)}
let built=add(html,'function poiSound(kind,weapon=null,defeated=false,atContact=false,targetType=null){',`
 if(kind==='npc-greet')(window.__greetingCues??=[]).push(performance.now());`);
const testApi='  freeMovementPose:()=>({x:poiWalkViewX,z:poiWalkViewZ,level:poiWalkLevel}),';
built=add(built,testApi,`
  oneLineQA:()=>({dialogue:poiTownDialogueSnapshot(),cues:window.__greetingCues?.length??0,
   now:performance.now(),ready:poiWalkNextReady,attack:poiWalkActionStarted,x:poiWalkX,z:poiWalkZ,
   fx:poiWalkViewX,fz:poiWalkViewZ,pad:!!poiAnalogContact}),`);
for(const [,s] of built.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(s);
if(process.env.NPC_ONCE_SYNTAX_ONLY){console.log('both production instrumented scripts parse');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<!doctype html><title>NPC talk QA</title>':built);
});
await new Promise((r,j)=>server.listen(0,'127.0.0.1',r).once('error',j));
const origin='http://127.0.0.1:'+server.address().port,errors=[];
let browser,context,page,checkpoint='launch';
const wait=(f,a=null,t=7000)=>page.waitForFunction(f,a,{polling:35,timeout:t});
const qa=()=>page.evaluate(()=>window.__editorTest.oneLineQA());
async function start(x,z,facing){
 await page.goto(origin+'/seed');
 await page.evaluate(({x,z,facing})=>{
  localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":300000}');
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x,z,y:0,facing},townLayout:5,townMapHeight:128,
   view:{yaw:0,zoom:.9,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 },{x,z,facing});
 await page.goto(origin+'/?resume=1&test=1');
 await page.locator('#pineStartupCover').waitFor({state:'hidden'});
 await wait(()=>window.__editorTest?.facility()?.active&&document.querySelector('#viewWrap').hasAttribute('data-analog-play'));
}
async function tapGreeting(id){
 await wait(id=>document.querySelector('#poiWalkAction')?._talkActor?.role?.id===id,id);
 await page.locator('#poiWalkAction').tap();
 await wait(id=>window.__editorTest.oneLineQA().dialogue?.id===id&&window.__editorTest.oneLineQA().dialogue?.menu==='root',id);
}
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 context=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:.65,isMobile:true,hasTouch:true});
 page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const menu=page.locator('#poiNpcMenu'),talk=menu.locator('[data-npc-action="talk"]'),
  line=page.locator('#poiMessagePanel [data-kind="dialogue"]'),pad=page.locator('#poiAnalogPad');
 checkpoint='town cook greeting and directional movement cancels root';
 await start(26,41,2);await tapGreeting('towncook');
 const first=await qa();assert.equal(first.cues,1);assert.deepEqual(first.dialogue.actions.map(o=>o.id),['talk','status','request','back']);
 await page.keyboard.press('ArrowUp');
 await wait(()=>{const q=window.__editorTest.oneLineQA();return !q.dialogue&&q.z===40});
 assert(!(await menu.isVisible()));
 await wait(()=>{const q=window.__editorTest.oneLineQA();return q.now>=q.ready});
 await page.keyboard.press('ArrowDown');await wait(()=>window.__editorTest.oneLineQA().z===41);
 checkpoint='single chosen line hides menu; resting thumb does not dismiss, captured drag dismisses and moves';
 await tapGreeting('towncook');await talk.tap();
 await wait(()=>window.__editorTest.oneLineQA().dialogue?.speechOnly===true);
 assert(!(await menu.isVisible()));assert(await line.isVisible());assert.match(await line.textContent(),/熱いうち/);
 const speech=await qa();assert.equal(speech.cues,2);assert.equal(speech.attack,first.attack);
 const cdp=await context.newCDPSession(page),box=await pad.boundingBox();
 const t=y=>({x:Math.round(box.x+box.width*.50),y:Math.round(y),id:1,radiusX:6,radiusY:6,force:.72});
 const y=box.y+box.height*.50;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[t(y)]});
 await wait(()=>window.__editorTest.oneLineQA().pad);
 await page.waitForTimeout(125);assert((await qa()).dialogue?.speechOnly);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[t(y-36)]});
 await wait(start=>{const q=window.__editorTest.oneLineQA();return !q.dialogue&&q.pad&&q.fz<start-.13},speech.fz);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 assert(!(await line.isVisible()));
 checkpoint='Fisher offers 依頼 once greeted; chosen speech times out without another input or SE';
 await start(77,118,0);await tapGreeting('portfisher');
 assert.equal((await qa()).cues,1);
 await menu.locator('[data-npc-action="request"]').tap();
 assert(await menu.locator('[data-npc-action="local-help"]').isVisible());
 assert(!(await menu.locator('[data-npc-action="sell"]').count()));
 await menu.locator('[data-npc-action="local-help"]').tap();
 await wait(()=>/頼みごと/.test(window.__editorTest.oneLineQA().dialogue?.text??''));
 await menu.locator('[data-npc-action="back"]').tap();
 await talk.tap();await wait(()=>window.__editorTest.oneLineQA().dialogue?.speechOnly===true);
 assert(!(await menu.isVisible()));assert(await line.isVisible());
 await wait(()=>!window.__editorTest.oneLineQA().dialogue,null,9000);
 assert(!(await line.isVisible()));assert.equal((await qa()).cues,1);
 assert.deepEqual(errors,[]);
 console.log('PASS real greeting cue, root choice→single announcement→automatic cleanup, directional and held analogue cancellation/movement, Fisher request');
}catch(e){console.error(checkpoint,JSON.stringify(page?await qa().catch(()=>null):null),errors);throw e}
finally{await context?.close();await browser?.close();await new Promise(r=>server.close(r))}
