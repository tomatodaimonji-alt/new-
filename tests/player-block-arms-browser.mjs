import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {Script} from 'node:vm';
let h=readFileSync(process.argv[2]||'world-editor.html','utf8');
const patch=(a,b)=>{assert.equal(h.split(a).length,2,a);h=h.replace(a,b)};
const api='  freeMovementPose:()=>({x:poiWalkViewX,z:poiWalkViewZ,level:poiWalkLevel}),';
patch(api,api+`
  blockArmQA:{
   frame:()=>render(),manual:()=>{window.__blockManual=true},
   current:()=>({now:performance.now(),action:poiWalkActionStarted,armed:poiArmedWandIndex(),held:poiEquippedWeapon(),rig:window.__blockDrawn?.at(-1)})
  },`);
patch(' requestAnimationFrame(render);',' if(!window.__blockManual)requestAnimationFrame(render);');
patch(' const m=mesh(),body=mesh(),twist=pose?.twist||0,twistC=Math.cos(twist),twistS=Math.sin(twist);',`
 const m=mesh(),body=mesh(),twist=pose?.twist||0,twistC=Math.cos(twist),twistS=Math.sin(twist);
 if(worldSpear)(window.__blockArms??=new WeakMap()).set(m,{weapon,bow:pose?.bowDraw,released:!!pose?.bowReleased,action:poiWalkActionStarted,now:performance.now()});`);
patch('function poiDrawPlayerBlockArms(m,arms,gear,rotate,x,y,z){',`
function poiDrawPlayerBlockArms(m,arms,gear,rotate,x,y,z){
 const frame=window.__blockArms?.get(m);if(frame){frame.arms=arms;frame.first=m.p.length/3;}`);
patch("  block(at(.007),at(.070),handWidth,.138,knuckle);\n }",
`  block(at(.007),at(.070),handWidth,.138,knuckle);
 }
 if(frame)frame.vertices=m.p.length/3-frame.first;`);
patch('return{buf:vbo,count:n}}',`const gpu={buf:vbo,count:n},rig=window.__blockArms?.get(m);
 if(rig)window.__blockArms.set(gpu,rig);return gpu}`);
patch('function poiDrawWalkAvatar(vp,now=performance.now()){\n if(!poiWalkMesh)return;',`
function poiDrawWalkAvatar(vp,now=performance.now()){
 if(!poiWalkMesh)return;
 const rig=window.__blockArms?.get(poiWalkMesh);if(rig){
  const out=window.__blockDrawn??=[];if(out.length>=32)out.shift();out.push(rig);
 }`);
for(const [,body] of h.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(body);
if(process.env.BLOCK_ARM_PARSE_ONLY){console.log('PASS exact arm snapshot injection and syntax');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>Seed</title>':h)});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const p=await browser.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:.72});
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.clock.install({time:new Date('2026-11-24T12:00:00Z')});await p.goto(origin+'/seed');
 await p.evaluate(()=>{
  const slots=Array(27).fill(null);
  for(const [i,type] of ['equipWoodSword','equipLongStaff','fireWand','equipWoodBow'].entries())slots[i]={type,count:1,...(i===2?{charges:5}:{})};
  localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weapon:null,potions:0,slots}));
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:102,z:93,y:0,facing:1},townLayout:5,townMapHeight:128,view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:1,orbitPitch:.35,orbitDistance:5.5}}));
 });
 await p.goto(origin+'/?resume=1&test=1');await p.locator('#pineStartupCover').waitFor({state:'hidden'});
 await p.waitForFunction(()=>window.__editorTest?.facility()?.active&&window.__editorTest.blockArmQA.current().rig);
 await p.evaluate(()=>window.__editorTest.blockArmQA.manual());
 const wall=await p.evaluate(()=>Date.now());await p.clock.pauseAt(wall+1500);
 const tick=async(n=32)=>{await p.clock.fastForward(n);await p.evaluate(()=>window.__editorTest.blockArmQA.frame());};
 const get=()=>p.evaluate(()=>window.__editorTest.blockArmQA.current());
 const distance=(p,q)=>Math.hypot(...p.map((v,i)=>v-q[i]));
 const verify=(current,weapon,verts)=>{
  assert.equal(current.rig.weapon,weapon,JSON.stringify(current));
  if(verts!==undefined)assert.equal(current.rig.vertices,verts,'same submitted silhouette vertex tally');
  for(const {shoulder,elbow,wrist} of Object.values(current.rig.arms)){
   assert(Math.abs(distance(shoulder,elbow)-.238)<1e-6);
   assert(Math.abs(distance(elbow,wrist)-.267)<1e-6);
  }
  return current.rig;
 };
 const bare=verify(await get(),null);
 const slot=i=>p.locator('#poiHotbar [data-hotbar-slot="'+i+'"]');
 for(const [i,weapon] of ['equipWoodSword','equipLongStaff','fireWand','equipWoodBow'].entries()){
  await slot(i).tap();await tick();
  verify(await get(),weapon,bare.vertices);
 }
 const unposed=verify(await get(),'equipWoodBow',bare.vertices),action=p.locator('#poiWalkAction');
 await action.tap();for(let j=0;j<5;j++)await tick(36);
 const drawing=verify(await get(),'equipWoodBow',bare.vertices);
 assert(drawing.bow>.07&&drawing.bow<1);
 assert(distance(drawing.arms.left.wrist,unposed.arms.left.wrist)>.10);
 for(let j=0;j<3;j++)await tick(48);
 const full=verify(await get(),'equipWoodBow',bare.vertices);
 assert(full.bow>.94&&full.released,'release retains full-draw rig shape');
 for(let j=0;j<3;j++)await tick(36);
 const recoil=verify(await get(),'equipWoodBow',bare.vertices);
 assert(recoil.released&&recoil.bow<full.bow,'the same articulated links remain through recoil');
 assert.deepEqual(errors,[]);
 console.log('PASS actual rendered player arms and real taps across bare sword staff wand and drawn bow');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
