import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {Script} from 'node:vm';
const html=readFileSync(process.argv[2]||'world-editor.html','utf8');
function replaceOnce(source,anchor,replacement){
 assert.equal(source.split(anchor).length,2,anchor);
 return source.replace(anchor,replacement);
}
let fixture=replaceOnce(html,' const p=poiWildPick(rng);',' const p=null;');
fixture=replaceOnce(fixture,'function poiWildRegionalFrame(now,rng){','function poiWildRegionalFrame(now,rng){if(window.__spearQA?.isolated)return;');
fixture=replaceOnce(fixture,' return m;\n}\nfunction poiWalkAvatar(now=performance.now()){',` if(window.__spearQA?.isolated&&weapon==='equipWoodSpear'&&pose&&x>50){
  m.__spearQA={origin:[x,y,z],heading,count:m.p.length/3};
 }
 return m;
}
function poiWalkAvatar(now=performance.now()){`);
if(fixture.includes("   poiBuildWorldSpear(m,pose,{x:gx,y:gy,z:gz},rotate,x,y,z);")){
 const worldBranch="   poiBuildWorldSpear(m,pose,{x:gx,y:gy,z:gz},rotate,x,y,z);";
 fixture=replaceOnce(fixture,worldBranch,worldBranch+`
   if(window.__spearQA?.isolated&&pose&&x>50){
    const [rx,rz]=rotate(gx,gz);
    m.__spearQA={origin:[x,y,z],grip:[x+rx,y+gy,z+rz],heading,count:m.p.length/3};
   }
`);
}
const payload='return{buf:vbo,count:n}}';
fixture=replaceOnce(fixture,payload,`return{buf:vbo,count:n,...(m.__spearQA?
 {__spearQA:{...m.__spearQA,point:Array.from(data.slice((n-1)*9,(n-1)*9+3))}}:null)}}`);
const draw='function draw(mesh,vp,first=0,count=mesh?.count){if(!mesh||!count)return;';
fixture=replaceOnce(fixture,draw,draw+`
 if(mesh===poiWalkMesh&&mesh.__spearQA&&first+count>=mesh.count&&window.__spearQA?.event&&window.__spearQA.event.frame===window.__spearQA.drawFrame){
  window.__spearQA.drawn={...mesh.__spearQA,time:window.__spearQA.drawFrame,first,count,canvas:[canvas.width,canvas.height],stopContact:poiPlayerHitstop?.contact};
 }
`);
const avatar='function poiDrawWalkAvatar(vp,now=performance.now()){';
fixture=replaceOnce(fixture,avatar,avatar+'\n if(window.__spearQA)window.__spearQA.drawFrame=now;');
const resolve=fixture.match(/^function poiPlayerWeaponResolve\(shot,now,line=[\s\S]*?\)\{(?=\n)/m)?.[0];
assert(resolve,'find the full production resolver signature, including a multiline default');
fixture=replaceOnce(fixture,resolve,resolve+`
 if(shot.type==='equipWoodSpear'&&window.__spearQA?.isolated){
  const q=window.__spearQA;
  q.event={frame:now,started:shot.started,hitAt:shot.profile.hit,origin:shot.aim,direction:{x:shot.dx,z:shot.dz},range:shot.profile.range,
   forward:line.forward??null,spearPoint:line.spearPoint??null,selected:line.monster?.[1]===q.state,before:q.state.hp};
 }
`);
const hp=' state.hp=Math.max(0,state.hp-amount);';
fixture=replaceOnce(fixture,hp,hp+`
 if(weapon==='equipWoodSpear'&&window.__spearQA?.state===state&&window.__spearQA.event)
  window.__spearQA.event.damage={amount,after:state.hp,time:now};
`);
const hook='  freeMovementPose:()=>({x:poiWalkViewX,z:poiWalkViewZ,level:poiWalkLevel}),';
fixture=replaceOnce(fixture,hook,hook+`
  spearContactQA:{
   seed:({dx,dz})=>{
    const o=poiAimOrigin(performance.now()),x=o.x+dx,z=o.z+dz,y=o.y,ix=poiFreeCell(x),iz=poiFreeCell(z);
    poiMonsterStates.clear();poiCombatLockReset();poiMonsterMeshDirty=true;
    const obj={type:'monsterSlime',x:ix,z:iz,y,rot:0},s=poiCombatActorMake(obj);
    const cells=new Set([ix+','+iz]),now=performance.now();
    s.hp=100;s.townOwned=true;
    s.actorFree={fromX:x,fromZ:z,x,z,start:now-400,ms:380,cells,endCells:cells,heading:0};
    poiMonsterStates.set(obj,s);
    window.__spearQA={isolated:true,state:s,target:{x,z,y}};
    return {x,z,y};
   },
   status:()=>{
    const q=window.__spearQA;
    return q?{event:q.event,drawn:q.drawn,target:q.target,hp:q.state.hp,
     stopped:poiPlayerHitstop?.weapon==='equipWoodSpear'?{contact:poiPlayerHitstop.contact,until:poiPlayerHitstop.until}:null,
     held:poiEquippedWeapon(),touches:q.touches}:null;
   }
  },`);
fixture=replaceOnce(fixture,"const poiAnalogAction=$('poiWalkAction');",`document.addEventListener('pointerdown',e=>{
 if(window.__spearQA&&e.pointerType==='touch') (window.__spearQA.touches??=[]).push(e.target.closest('#poiWalkAction')?'attack':e.target.closest('[data-hotbar-slot]')?'slot':'other');
},true);
const poiAnalogAction=$('poiWalkAction');`);
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url==='/seed'?'<!doctype html><title>Spear test</title>':fixture);
});
await new Promise((ok,fail)=>server.listen(0,'127.0.0.1',ok).once('error',fail));
const origin='http://127.0.0.1:'+server.address().port;
let browser;
try{
 if(process.env.SPEAR_FIXTURE_LAYOUT_ONLY==='1'){
  const scripts=[...fixture.matchAll(/<script(?:\s+([^>]*))?>([\s\S]*?)<\/script>/gi)]
   .filter(([,attrs])=>!attrs||!/\b(?:src|type)\s*=/.test(attrs));
  assert(scripts.length>0);
  for(let i=0;i<scripts.length;i++)new Script(scripts[i][2],{filename:'fixture-script-'+(i+1)+'.js'});
  console.log('PASS all exact spear render instrumentation seams and '+scripts.length+' full injected script(s) parse');
 }
 else{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 for(const [d,damage,diagonal] of [[2,18,false],[2.85,24,true],[3.14,0,false]]){
  const context=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:.75,hasTouch:true,isMobile:true});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(17000);
  await page.goto(origin+'/seed');
  await page.evaluate(()=>{
   const slots=Array(27).fill(null);slots[0]={type:'equipWoodSword',count:1};slots[2]={type:'equipWoodSpear',count:1,durability:37};
   localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weapon:'equipWoodSword',potions:0,slots}));
   localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":330000}');
   localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
    position:{x:102,z:93,y:0,facing:1},townLayout:5,townMapHeight:128,
    view:{yaw:0,zoom:.9,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:Math.PI,orbitPitch:.36,orbitDistance:5.5}}));
  });
  await page.goto(origin+'/?resume=1&test=1');
  await page.waitForFunction(()=>window.__editorTest?.facility()?.active&&document.getElementById('pineStartupCover')?.hidden);
  const read=()=>page.evaluate(()=>window.__editorTest.spearContactQA.status());
  await page.evaluate(({dx,dz})=>window.__editorTest.spearContactQA.seed({dx,dz}),{dx:diagonal?d*.8:d,dz:diagonal?d*.6:0});
  await page.locator('#poiHotbar [data-hotbar-slot="2"]').tap();
  await page.waitForFunction(()=>window.__editorTest.spearContactQA.status()?.held==='equipWoodSpear');
  await page.locator('#poiWalkAction').tap();
  await page.waitForFunction(()=>window.__editorTest.spearContactQA.status()?.event);
  if(damage)try{await page.waitForFunction(()=>window.__editorTest.spearContactQA.status()?.drawn,null,{timeout:4500});}
  catch(cause){throw new Error('damage frame did not submit held spear: '+JSON.stringify(await read()),{cause})}
  const s=await read();
  console.log(JSON.stringify({distance:d,damage,diagonal,s}));
  assert.deepEqual(s.touches,['slot','attack']);
  assert.equal(s.hp,100-damage);
  assert.equal(s.event.selected,damage>0);
  assert.equal(s.event.hitAt,240);
  assert(s.event.frame>=s.event.started+s.event.hitAt,'native contact uses existing gameplay deadline');
  if(damage){
   const {drawn,event,target}=s,dir=event.direction;
   assert.equal(drawn.time,event.frame,'the submitted VBO is observed in the actual damage frame');
   assert.equal(event.damage.time,drawn.time);
   assert.equal(event.damage.amount,damage);
   assert(drawn.canvas.every(x=>x>0)&&drawn.count>0);
   const x=drawn.point[0]-event.origin.x-.5,z=drawn.point[2]-event.origin.z-.5;
   const lateral=x*dir.z-z*dir.x,tip=x*dir.x+z*dir.z;
   const targetCenter=(target.x-event.origin.x)*dir.x+(target.z-event.origin.z)*dir.z;
   assert(Math.abs(targetCenter-d)<.04);
   assert(Math.abs(lateral)<.30,'spear apex stays close to the weapon ray: '+JSON.stringify({tip,lateral}));
   assert.equal(drawn.stopContact,drawn.time,'the exact aligned draw is the native contact hitstop frame');
   assert(Math.abs(tip-3)<.23,'point actually reaches the weapon’s three-cell range: '+tip);
   assert(tip>=targetCenter-.17,'visible point touches or crosses the hit target');
   assert(drawn.grip&&event.spearPoint,'world-specific held mesh follows the exact engine point');
   const gripForward=(drawn.grip[0]-event.origin.x-.5)*dir.x+(drawn.grip[2]-event.origin.z-.5)*dir.z;
   const span=(targetCenter-gripForward)/(tip-gripForward);
   const at=drawn.grip.map((v,i)=>v+(drawn.point[i]-v)*span);
   assert(Math.hypot(at[0]-event.spearPoint.x,at[1]-event.spearPoint.y,at[2]-event.spearPoint.z)<.12,
    'solid rendered shaft-to-apex line intersects the damaged body point: '+JSON.stringify({span,at,point:event.spearPoint}));
  }else assert.equal(s.event.damage,undefined,'target beyond full extension cannot be hurt');
  assert.deepEqual(errors,[]);
  await context.close();
 }
 console.log('PASS native touch selects and thrusts; contact draw submits aligned three-cell tip and preserves 75% shaft / full tip / beyond-range miss');
 }
}finally{await browser?.close();await new Promise(r=>server.close(r))}
