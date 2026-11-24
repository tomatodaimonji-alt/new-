import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {writeFile,mkdir} from 'node:fs/promises';
import {Script} from 'node:vm';
const h=readFileSync(process.argv[2]||'world-editor.html','utf8');
function apply(s,a,b){assert.equal(s.split(a).length,2,a);return s.replace(a,b);}
const hook="if(facilityParams.get('test')==='1')window.__editorTest={";
let page=apply(h,hook,hook+`
 hitEdgeQA:{
  manual:()=>{window.__hitEdgeManual=true},draw:()=>render(),
  state:()=>{
   const node=$('poiPlayerDamageEdge'),p=poiDavidActive?.s?.david,cs=getComputedStyle(node),death=$('poiDeathFade');
   return {hp:poiPlayerHP,pos:[poiWalkX,poiWalkZ,poiWalkLevel],phase:poiPlayerDeath?.phase??null,deathHidden:death.hidden,
    ready:p?.wakeDone||false,awake:!!p?.awake,attack:p?.attack??null,flash:poiPlayerHitFlashAt,
    time:performance.now(),shell:cs.backgroundImage,opacity:+cs.opacity,pass:cs.pointerEvents,
    hidden:node.getAttribute('aria-hidden'),aria:$('poiPlayerDamageEdge').closest('#viewWrap')!==null,
    healed:!!poiHealingCast,packets:window.__hitEdge.map(a=>({t:a.t,first:a.first,end:a.end,ms:a.ms,hp:a.hp}))};
  },
  choose:()=>{const s=poiDavidActive?.s;if(!s?.david?.awake||s.david.attack)return false;s.david.cycle=2;return true;},
  pose:(x,z)=>workshopResumeRestorePosition({x,z,y:0,facing:0}),
 },
`);
page=apply(page,' requestAnimationFrame(render);',' if(!window.__hitEdgeManual)requestAnimationFrame(render);');
page=apply(page,'function poiDavidMobFrame(o,s,now){','function poiDavidMobFrame(o,s,now){if(!window.__hitEdgeManual)return false;');
page=apply(page,'function poiWildRegionalFrame(now,rng){','function poiWildRegionalFrame(now,rng){return;');
page=apply(page,'function poiWildPick(rng){','function poiWildPick(rng){return null;');
page=apply(page," const a=node.animate([{opacity:reduced?.37:.73},{opacity:0}],{duration,easing:'cubic-bezier(.18,.58,.35,1)'});"," const a=node.animate([{opacity:reduced?.37:.73},{opacity:0}],{duration,easing:'cubic-bezier(.18,.58,.35,1)'}); window.__hitEdge.at(-1).hp=poiPlayerHP;");
for(const [,body] of page.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(body);
if(process.env.HIT_EDGE_PARSE_ONLY){console.log('actual gameplay and native overlay hooks parse');process.exit(0);}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>Seed</title>':page)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
const shots=process.env.FACILITY_SCREENSHOTS;let browser;
try{
 if(shots)await mkdir(shots,{recursive:true});
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 for(const reduced of [false,true]){
  const ctx=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:.72,reducedMotion:reduced?'reduce':'no-preference'});
  const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.stack||e.message));p.setDefaultTimeout(20000);
  let checkpoint='trusted real combat boot';
  const read=()=>p.evaluate(()=>window.__editorTest.hitEdgeQA.state());
  try{
   await ctx.addInitScript(()=>{
    window.__hitEdge=[];
    const original=Element.prototype.animate;
    Element.prototype.animate=function(...args){
     const a=original.apply(this,args);
     if(this.id==='poiPlayerDamageEdge'){
      const [first,...rest]=a.effect.getKeyframes(),end=rest.at(-1);
      window.__hitEdge.push({a,t:performance.now(),first:+first.opacity,end:+end.opacity,ms:a.effect.getTiming().duration,hp:0});
      a.pause(); // only for paired compositor images of the exact same real scene
      a.currentTime=12;
     }
     return a;
    }
   });
   await p.clock.install({time:new Date('2026-04-01T12:00:00Z')});
   await p.goto(url+'/seed');await p.evaluate(()=>{
    const slots=Array.from({length:30},()=>null);slots[0]={type:'equipWoodSword',count:1};slots[3]={type:'healingHerb',count:1};
    localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weapon:'equipWoodSword',potions:1,gold:0,slots}));
    localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
     position:{x:24,z:102,y:0,facing:2},townLayout:5,townMapHeight:128,
     view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:0,orbitPitch:.12,orbitDistance:5.5}}));
   });
   await p.goto(url+'/?resume=1&test=1',{waitUntil:'domcontentloaded'});await p.locator('#pineStartupCover').waitFor({state:'hidden'});
   await p.waitForFunction(()=>window.__editorTest?.facility?.().active);
   await p.evaluate(()=>window.__editorTest.hitEdgeQA.manual());
   await p.clock.pauseAt((await p.evaluate(()=>Date.now()))+3200);
   const advance=async(ms=48)=>{await p.clock.fastForward(ms);await p.evaluate(()=>window.__editorTest.hitEdgeQA.draw());return read()};
   const until=async(compare,limit)=>{let r=await read();for(let i=0;i<limit&&!compare(r);i++)r=await advance();assert(compare(r),JSON.stringify(r));return r};
   const initial=await read();
   assert(initial.hp===100&&initial.packets.length===0&&initial.opacity===0&&initial.pass==='none'&&initial.hidden==='true'&&initial.aria);
   checkpoint='real telegraphed stomp, then real damage and unchanged body flash';
   await until(q=>q.awake,56);
   assert(await p.evaluate(()=>window.__editorTest.hitEdgeQA.choose()));
   const tell=await until(q=>q.attack?.kind==='stomp'&&q.attack.cursor===0,170);
   assert.equal(tell.hp,100);assert.equal(tell.packets.length,0);
   const got=await until(q=>q.hp<100,70);
   assert.equal(got.attack.cursor,1);assert.equal(got.packets.length,1);assert.equal(got.packets[0].hp,got.hp);
   assert.equal(got.packets[0].t,got.flash);assert.equal(got.packets[0].ms,reduced?135:295);
   assert(got.packets[0].first===(reduced?.37:.73)&&got.packets[0].end===0&&got.deathHidden);
   checkpoint='native real screenshot difference confined to margins';
   const cdp=await ctx.newCDPSession(p),capture=async()=>{
    const r=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});return r.data;
   };
   const on=await capture();
   await p.evaluate(()=>{const a=window.__hitEdge[0].a;a.currentTime=a.effect.getTiming().duration;});
   const off=await capture();
   const pixels=await p.evaluate(async({on,off})=>{
    const grab=async s=>{const a=new Image();a.src='data:image/png;base64,'+s;await a.decode();const c=document.createElement('canvas');c.width=a.width;c.height=a.height;const g=c.getContext('2d');g.drawImage(a,0,0);return {g,w:c.width,h:c.height};};
    const a=await grab(on),b=await grab(off),get=({g,w,h},x,y)=>Array.from(g.getImageData(Math.round(w*x),Math.round(h*y),1,1).data).slice(0,3);
    const delta=(x,y)=>get(a,x,y).map((v,i)=>v-get(b,x,y)[i]);
    return {middle:[[.50,.38],[.50,.50],[.53,.58]].map(([x,y])=>delta(x,y)),edges:[[.97,.50],[.032,.51],[.50,.026],[.90,.12]].map(([x,y])=>delta(x,y))};
   },{on,off});
   assert(pixels.middle.every(a=>a.every(v=>Math.abs(v)<=3)),JSON.stringify(pixels));
   assert(pixels.edges.some(a=>Math.abs(a[0])+Math.abs(a[1])+Math.abs(a[2])>=14),JSON.stringify(pixels));
   if(shots&&!reduced){await writeFile(shots+'/hit-perimeter.png',Buffer.from(on,'base64'));await writeFile(shots+'/identical-scene-without-perimeter.png',Buffer.from(off,'base64'));}
   await p.evaluate(()=>window.__hitEdge[0].a.play());await cdp.detach();
   checkpoint='trusted real healing shortcut cannot create hit cue';
   assert(await p.evaluate(()=>window.__editorTest.hitEdgeQA.pose(41,43)));
   await advance(220);
   await p.locator('[data-hotbar-slot="3"]').tap();
   const healing=await read();assert(healing.healed,JSON.stringify(healing));
   const health=await until(q=>q.hp>got.hp&&!q.healed,75);
   assert.equal(health.packets.length,1);assert.equal(health.opacity,0);assert(health.deathHidden);
   assert.deepEqual(errors,[]);
   console.log('PASS real stomp and disjoint heart healing, rendered pixels only at margins',JSON.stringify({reduced,damage:100-got.hp,heal:health.hp-got.hp,pulse:got.packets[0],pixels}));
  }catch(e){console.error(checkpoint,JSON.stringify(await read().catch(()=>null)),errors);throw e}
  finally{await ctx.close();}
 }
}finally{await browser?.close();await new Promise(r=>server.close(r))}
