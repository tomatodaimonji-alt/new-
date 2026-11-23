import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
const html=readFileSync(process.argv[2]||'world-editor.html','utf8');
let fixture=html.replace('function poiWalkAction(){','function poiWalkAction(){\n window.__events?.push({type:"action",at:performance.now(),ready:poiAttackReady,pending:!!poiPlayerWeaponPending});').replace('function poiAnalogGeometryChange()',`window.__attackState=()=>({started:poiWalkActionStarted,weapon:poiWalkActionWeapon,ready:poiAttackReady,pending:!!poiPlayerWeaponPending,walking:!!poiFreePose?.walking,contact:!!poiAnalogContact,allowed:poiAnalogAllowed(),now:performance.now()});
function poiAnalogGeometryChange()`);
assert.notEqual(fixture,html);
const anchor="function poiAnalogGeometryChange()";
assert.equal(fixture.split(anchor).length,2);
fixture=fixture.replace(anchor,`let __attackProbe=null;
window.__attackProbeClear=()=>{if(__attackProbe)poiMonsterStates.delete(__attackProbe.obj);__attackProbe=null;poiMonsterMeshDirty=true};
window.__attackProbeSnapshot=()=>__attackProbe&&({hp:__attackProbe.state.hp,x:__attackProbe.obj.x,z:__attackProbe.obj.z});
document.addEventListener('pointerdown',e=>{
 if(!window.__events||e.pointerType!=='touch'||!e.target.closest('#poiWalkAction'))return;
 if(__attackProbe)poiMonsterStates.delete(__attackProbe.obj);
 const now=performance.now(),o=poiAimOrigin(now),reach=.76,pass=poiAimWall(o);
 const dir=[o.dir,{x:-o.dir.z,z:o.dir.x},{x:o.dir.z,z:-o.dir.x},{x:-o.dir.x,z:-o.dir.z}]
  .find(d=>poiAimWallLimit(o,d,reach,pass)>=reach);
 if(!dir)throw new Error('physical contact fixture has no unobstructed melee trace');
 const x=o.x+dir.x*reach,z=o.z+dir.z*reach;
 const obj={type:'monsterSlime',x:poiFreeCell(x),z:poiFreeCell(z),y:poiWalkLevel,rot:0};
 const state=poiCombatActorMake(obj);state.hp=80;state.townOwned=true;
 const cells=new Set([obj.x+','+obj.z]);
 state.actorFree={fromX:x,fromZ:z,x,z,start:now-400,ms:380,cells,endCells:cells,heading:0};
 poiMonsterStates.set(obj,state);poiMonsterMeshDirty=true;__attackProbe={obj,state};
},true);
`+anchor);
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<!doctype html><title>attack test</title>':fixture)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
let browser;try {
 browser=await chromium.launch({...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 for (const weapon of [null,'equipWoodSword']){
 const ctx=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
 const p=await ctx.newPage();p.on('pageerror',e=>console.log('PAGE ERROR',e.message));p.setDefaultTimeout(12000);
 await p.goto(base+'/seed');
 await p.evaluate(weapon=>{localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weapon,potions:2,gold:18,claimedCaches:['glade']}));localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":575000}');localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,position:{x:108,z:61,y:0,facing:0},townLayout:5,townMapHeight:128,view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:Math.PI,orbitPitch:.35,orbitDistance:5.5}}));},weapon);
 await p.goto(base+'/?resume=1&test=1');
 await p.waitForFunction(()=>window.__editorTest?.facility()?.active&&window.__attackState().allowed);
 const pad=await p.locator('#poiAnalogPad').boundingBox(),b=await p.locator('#poiWalkAction').boundingBox();
 const cdp=await ctx.newCDPSession(p), pt=(x,y,id)=>({x:Math.round(x),y:Math.round(y),id,radiusX:4,radiusY:4,force:.7});
 const start=pt(pad.x+pad.width/2,pad.y+pad.height/2,1),moved={...start,y:start.y-50},attack=pt(b.x+b.width/2,b.y+b.height/2,2);
 const touch=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
 await p.evaluate(()=>{window.__events=[];for(const kind of ['pointerdown','pointerup','pointercancel','click','touchstart','touchend'])document.addEventListener(kind,e=>window.__events.push({type:e.type,id:e.pointerId,primary:e.isPrimary,target:e.target?.id||e.target?.className,at:performance.now(),started:window.__attackState().started}),true)});
 for (const mode of ['released','centered','overlap','rapid-after-prior']){
  try{
   await p.waitForFunction(()=>{const s=window.__attackState();return s.allowed&&!s.pending&&s.now>s.ready});
   const prior=await p.evaluate(()=>{window.__attackProbeClear();window.__events=[];return window.__attackState()});
   if(mode==='rapid-after-prior'){
    await touch('touchStart',[attack]);await touch('touchEnd',[]);
    // Let the first hit resolve on its own target before planting a fresh
    // probe for the second tap. Keep the original cooldown clock running.
    await p.waitForFunction(()=>window.__events.some(e=>e.type==='action')&&!window.__attackState().pending);
    await p.evaluate(()=>window.__attackProbeClear());
   }
   await touch('touchStart',[start]);await touch('touchMove',[moved]);await p.waitForFunction(()=>window.__attackState().walking);
   if(mode==='released'||mode==='rapid-after-prior'){await touch('touchEnd',[]);await touch('touchStart',[attack]);await touch('touchEnd',[]);}
   else {
    if(mode==='centered')await touch('touchMove',[start]);
    await touch('touchStart',[mode==='centered'?start:moved,attack]);
    // CDP dispatchTouchEvent requires no points for touchEnd. Both fingers
    // end in this physical event, but right pointerdown was nonprimary
    // because the left thumb was centered and still touching.
    await touch('touchEnd',[]);
   }
   // Fists contact immediately; swords resolve only at the wind-up's real
   // contact. Observe the action and its settled hit, not a frame-time guess.
   await p.waitForFunction(expected=>window.__events.filter(e=>e.type==='action').length>=expected&&
    !window.__attackState().pending,mode==='rapid-after-prior'?2:1);
   await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const after=await p.evaluate(()=>({state:window.__attackState(),events:window.__events,probe:window.__attackProbeSnapshot()}));
   console.log(JSON.stringify({weapon,mode,prior,after}));
   assert(after.state.started>prior.started,'a ready physical action tap starts an attack');
   if(mode==='centered'||mode==='overlap')assert(after.events.some(e=>e.type==='pointerdown'&&e.target==='poiWalkAction'&&!e.primary),'right touch was secondary');
   const actions=after.events.filter(e=>e.type==='action');
   if(mode!=='rapid-after-prior'){
    assert.equal(actions.length,1,'no duplicate action dispatch');
    assert.equal(after.state.weapon,weapon,'real selected weapon used');
    assert(after.probe?.hp<80&&after.probe?.hp>0,'normal combat damage reached the target');
   }else{
    assert.equal(actions.length,2,'both physical taps dispatch exactly once');
    if(actions[1].at<actions[1].ready||actions[1].pending)assert.equal(after.probe?.hp,80,'legitimate cooldown still rejects the second hit');
    else assert(after.probe?.hp<80,'second hit proceeds when ordinary cooldown expired');
   }
  }catch(e){console.log('case error',weapon,mode,e.message);await touch('touchCancel',[]);process.exitCode=1;}
 }
 await ctx.close();
 }
}finally{await browser?.close();await new Promise(r=>server.close(r))}
