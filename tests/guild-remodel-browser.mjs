import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {mkdirSync,readFileSync} from 'node:fs';
import {Script} from 'node:vm';
let html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const put=(a,b)=>{assert.equal(html.split(a).length,2,a);html=html.replace(a,b)};
const ap="if(facilityParams.get('test')==='1')window.__editorTest={";
put(ap,ap+`
 guildFitQA:{
  frame:()=>render(),
  inspect:()=>{
   const i=facilitySite.buildings.findIndex(o=>o.id==='townGuild'),g=facilitySite.buildings[i];
   return {x:poiWalkX,z:poiWalkZ,y:poiWalkLevel,entry:g.entrance,active:!!facilitySite.guildRemodel,
    room:facilityHiddenRoof(),guild:i,roof:facilityRoofMeshes[i]?.count??0,shown:facilityVisibleRoofs().includes(i),
    action:$('poiWalkAction')?.textContent,dialogue:poiTownDialogueSnapshot(),dir:['n','s','e','w'].map(k=>poiCameraRelativeStep(k)),
    art:window.__guildFitArt??0,view:window.__guildFitRaster||null,err:gl.getError()};
  }
 },
`);
const core=" const built=stock&&facilityRecord.id==='base'?poiTownGuildRemodel(stock):stock;";
put(core," const built=stock&&facilityRecord.id==='base'&&location.pathname!=='/before'?poiTownGuildRemodel(stock):stock;");
put(' requestAnimationFrame(render);',' if(!window.__guildFitPause)requestAnimationFrame(render);');
const art='function poiTownGuildCladding(m,o,faces){\n const g=poiTownGuildFacade(o);\n if(!g)return false;';
put(art,art+'\n window.__guildFitArt=(window.__guildFitArt??0)+1;');
const finish=' facilityDrawRoofs(p.vp);poiDrawGameRoofs(p.vp);';
put(finish,finish+`
 if(window.__guildFitCapture){
  window.__guildFitCapture=false;
  const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;
  const pix=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pix);
  let hash=2166136261,tan=0,gray=0,non=0;
  for(let y=Math.floor(h*.24);y<Math.floor(h*.89);y++)for(let x=Math.floor(w*.18);x<Math.floor(w*.82);x++){
   const i=(y*w+x)*4;if(!pix[i+3])continue;non++;
   for(let c=0;c<3;c++)hash=Math.imul(hash^pix[i+c],16777619);
   if(pix[i]>pix[i+1]*1.07&&pix[i+1]>pix[i+2]*1.09)tan++;
   if(Math.abs(pix[i]-pix[i+1])<12&&Math.abs(pix[i+1]-pix[i+2])<10)gray++;
  }
  const m=parameters().vp;window.__guildFitRaster={hash,tan,gray,non,m:Array.from(m)};
 }
`);
for(const [,js] of html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(js);
if(process.env.GUILD_REMODEL_SYNTAX_ONLY){console.log('Guild fit-out fixture parses');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>Guild Fit QA</title>':html)});
await new Promise((ok,no)=>server.listen(0,'127.0.0.1',ok).once('error',no));const base='http://127.0.0.1:'+server.address().port;
let b,last,phase='boot';
try{
 b=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const dir=process.env.FACILITY_SCREENSHOTS;if(dir)mkdirSync(dir,{recursive:true});
 async function open(mode,x,z,arm){
  const context=await b.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:.75}),p=await context.newPage(),errors=[];
  p.on('pageerror',e=>errors.push(e.message));await p.clock.install({time:new Date('2026-04-01T10:00:00Z')});
  await p.goto(base+'/seed');
  await p.evaluate(({x,z,arm})=>{
   localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":300000}');
   localStorage.setItem('world-workshop-hotbar-v1','{"version":1,"weapon":null,"potions":1,"gold":23}');
   localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
    position:{x,z,y:0,facing:0},townLayout:5,townMapHeight:128,view:{yaw:0,zoom:1.05,
    panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:Math.PI,orbitPitch:.12,orbitDistance:arm}}));
  },{x,z,arm});
  await p.goto(base+'/'+mode+'?resume=1&test=1',{waitUntil:'domcontentloaded',timeout:45000});
  await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:35000});
  await p.waitForFunction(()=>window.__editorTest?.facility()?.active,null,{polling:50,timeout:30000});
  await p.clock.pauseAt((await p.evaluate(()=>Date.now()))+1500);await p.evaluate(()=>{window.__guildFitPause=true});
  const tick=async(ms=225)=>{await p.clock.fastForward(ms);await p.evaluate(()=>window.__editorTest.guildFitQA.frame());
   return last=await p.evaluate(()=>window.__editorTest.guildFitQA.inspect())};
  return {context,p,errors,tick};
 }
 async function capture(mode,label,x,z,arm){
  const q=await open(mode,x,z,arm);
  await q.p.evaluate(()=>{window.__guildFitCapture=true});
  const s=await q.tick(38);assert.deepEqual([s.x,s.z,s.y],[x,z,0]);assert.equal(s.err,0);
  assert(s.view.non>10000,'actual rendered viewport, not blank canvas');assert(s.roof>20);
  if(dir)await q.p.screenshot({path:dir+'/guild-'+label+'-'+mode+'.png'});
  assert.deepEqual(q.errors,[]);await q.context.close();return s;
 }
 for(const [label,x,z,arm] of [['exterior',56,44,10.5],['interior',56,33,4.0]]){
  phase='identical camera '+label;
  const before=await capture('before',label,x,z,arm),after=await capture('after',label,x,z,arm);
  assert(before.view.m.every((v,i)=>Math.abs(v-after.view.m[i])<.00001),'comparison uses equivalent orbit matrices');
  assert.equal(before.active,false);assert.equal(after.active,true);assert(after.art>60&&before.art===0);
  assert.notEqual(after.view.hash,before.view.hash,'differently painted real scene');
  if(label==='exterior'){assert(after.shown&&before.shown);assert(after.view.tan>before.view.tan);}
  else assert.equal(after.room,after.guild);
  console.log(label,JSON.stringify({before:[before.view.tan,before.view.gray,before.roof],after:[after.view.tan,after.view.gray,after.roof]}));
 }
 phase='walk through old gate, reach real clerk, and climb both existing stairs';
 const q=await open('after',56,39,5.5),p=q.p;await q.tick(38);
 const step=async(x,z,y=last.y)=>{
  const dx=x-last.x,dz=z-last.z,i=last.dir.findIndex(d=>d[0]===dx&&d[1]===dz);
  assert(i>=0,JSON.stringify({last,x,z}));
  await p.keyboard.press(['ArrowUp','ArrowDown','ArrowRight','ArrowLeft'][i]);const s=await q.tick();
  assert.deepEqual([s.x,s.z,s.y],[x,z,y],JSON.stringify(s));
 };
 for(let z=38;z>=29;z--)await step(56,z);
 assert.match(last.action,/話す/,'reception remains interactable from the public side');
 await p.locator('#poiWalkAction').tap();
 await p.locator('#poiNpcMenu').waitFor({state:'visible'});
 const spoken=await p.evaluate(()=>window.__editorTest.guildFitQA.inspect().dialogue);
 assert.equal(spoken?.id,'guildkeeper');assert.match(spoken?.name??'',/リーネ/);
 assert(await p.locator('#poiNpcMenu button[data-npc-action=quest]').isVisible());
 await p.keyboard.press('Escape');await q.tick(48);
 for(let z=30;z<=35;z++)await step(56,z);
 for(let x=55;x>=50;x--)await step(x,35);
 await step(50,36,1);
 for(let x=51;x<=61;x++)await step(x,36);
 await step(61,35,2);
 assert.deepEqual(q.errors,[]);
 assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('world-workshop-hotbar-v1')).gold),23);
 console.log('Native guild gate, real public clerk, both pre-existing live stairs and existing bag preserved');
} catch(e){console.error('Guild remodel QA failed:',phase,last);throw e}
finally{await b?.close();await new Promise(ok=>server.close(ok))}
