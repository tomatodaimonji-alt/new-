import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const prod=readFileSync(process.argv[2]??'world-editor.html','utf8');
const replace=(s,a,b)=>{assert.equal(s.split(a).length,2,a);return s.replace(a,b)};
const hook='  freeMovementPose:()=>({x:poiWalkViewX,z:poiWalkViewZ,level:poiWalkLevel}),';
const routine='function poiTownNpcRoutine(a,clock,now,budget){';
let fixture=replace(prod,' const p=poiWildPick(rng);',' const p=null;');
fixture=replace(fixture,'function poiWildRegionalFrame(now,rng){','function poiWildRegionalFrame(now,rng){return;');
fixture=replace(fixture,routine,routine+'if(window.__dialoguePinQA)return;');
fixture=replace(fixture,hook,hook+`
  dialoguePinQA:{
   setup(){
    const who=id=>poiTownNpcActors.find(a=>a.role.id===id);
    const a=who('westpeddler'),b=who('guildkeeper'),x=poiWalkX,z=poiWalkZ,y=poiWalkLevel;
    if(!a||!b)return null;
    poiTownDialogueClose();poiMonsterStates.clear();
    for(const a of poiTownNpcActors)a.recessed=true;
    const park=(a,dx,dz,recessed)=>Object.assign(a,{x:x+dx,z:z+dz,y,fromX:x+dx,fromZ:z+dz,fromY:y,
     actorLeg:null,goal:null,target:null,hitAt:null,hurtAt:null,gestureAt:null,death:null,activity:'idle',moveAt:-10000,recessed});
    park(a,1,0,false);park(b,0,1,true);
    poiWalkFacing=1;
    poiFreePose={x:x+.18,z,y,level:y,angle:-Math.PI/2,walking:false,changed:true,distance:0};
    window.__dialoguePinQA={a,b,x,z,y,park};
    poiShopSync();return a.role.id;
   },
   cross(leave){
    const q=window.__dialoguePinQA;
    q.park(q.a,leave?3:2,0,false);q.park(q.b,1,0,false);poiShopSync();
   },
   leg(){
    const q=window.__dialoguePinQA,a=q.a,now=performance.now();
    q.b.recessed=true;
    a.x=q.x+1;a.z=q.z;
    a.actorLeg={x:q.x+1.16,z:q.z,target:{x:q.x+2,z:q.z},dx:1,dz:0,heading:1.57,
     duration:850,length:.84,last:now,elapsed:0,traveled:0,foot:0};
   },
   status(){
    const q=window.__dialoguePinQA,leg=q?.a.actorLeg,button=$('poiWalkAction');
    return {prompt:button._shopPrompt,label:button.getAttribute('aria-label'),
     chosen:poiTownDialogueTarget(performance.now())?.role.id,active:poiTownDialogue?.actor.role.id,
     at:poiWalkActionStarted,frames:poiTownMotionClock,leg:leg?{x:leg.x,z:leg.z,last:leg.last,elapsed:leg.elapsed}:null,
     down:typeof poiAnalogActionTouch==='undefined'?false:!!poiAnalogActionTouch};
   }
  },`);
const scripts=[...fixture.matchAll(/<script>([\s\S]*?)<\/script>/g)];
assert(scripts.length>0);for(const [_,js] of scripts)new Script(js);
if(process.env.DIALOGUE_PIN_LAYOUT_ONLY==='1'){
 console.log('PASS exact dialogue pointer/actor/browser seams compile');
 process.exit(0);
}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<!doctype html>':fixture)});
await new Promise((r,j)=>server.listen(0,'127.0.0.1',r).once('error',j));
const url='http://127.0.0.1:'+server.address().port;
let browser,ctx;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 ctx=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:.75});
 const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(16000);
 await p.goto(url+'/seed');
 await p.evaluate(()=>{
  localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":330000}');
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:102,z:93,y:0,facing:1},townLayout:5,townMapHeight:128,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 });
 await p.goto(url+'/?resume=1&test=1');
 await p.waitForFunction(()=>window.__editorTest?.townResidents()?.actors?.length&&document.getElementById('pineStartupCover')?.hidden);
 const q=()=>p.evaluate(()=>window.__editorTest.dialoguePinQA.status());
 const setup=()=>p.evaluate(()=>window.__editorTest.dialoguePinQA.setup());
 const session=await ctx.newCDPSession(p);
 async function touchStart(){
  const b=await p.locator('#poiWalkAction').boundingBox();
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2)}]});
  assert((await q()).down,'actual touch down was captured');
 }
 const touchEnd=()=>session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 const a=await setup();assert.equal(a,'westpeddler');
 const prior=await q();assert.equal(prior.prompt,'talk');assert.match(prior.label,/と話す/);
 await touchStart();
 await p.evaluate(()=>window.__editorTest.dialoguePinQA.cross(true));
 assert.equal((await q()).chosen,'guildkeeper');
 await touchEnd();
 const miss=await q();assert.equal(miss.active,undefined);assert.equal(miss.at,prior.at,'lost talk never starts an attack');
 assert.equal(await setup(),a);
 await touchStart();
 await p.evaluate(()=>window.__editorTest.dialoguePinQA.cross(false));
 assert.equal((await q()).chosen,'guildkeeper');
 await touchEnd();
 await p.waitForFunction(()=>window.__editorTest.dialoguePinQA.status().active==='westpeddler');
 await p.evaluate(()=>window.__editorTest.dialoguePinQA.leg());
 const pinned=await q();
 await p.waitForFunction(t=>window.__editorTest.dialoguePinQA.status().frames>t+85,pinned.frames);
 const held=await q();assert.equal(held.active,a);
 assert.equal(held.leg.x,pinned.leg.x);assert.equal(held.leg.z,pinned.leg.z);assert.equal(held.leg.elapsed,0);
 await p.keyboard.press('Escape');
 await p.waitForFunction(x=>window.__editorTest.dialoguePinQA.status().leg?.x>x,pinned.leg.x);
 assert.equal((await q()).active,undefined);
 assert.deepEqual(errors,[]);
 console.log('PASS actual mobile touch never retargets or attacks after changed Talk, and active leg holds then resumes');
}finally{await ctx?.close();await browser?.close();await new Promise(r=>server.close(r))}
