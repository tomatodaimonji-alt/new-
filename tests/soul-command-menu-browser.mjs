import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const h=readFileSync(process.argv[2]??'world-editor.html','utf8');let html=h;
function inject(a,b){assert.equal(html.split(a).length,2,a);html=html.replace(a,b);}
const anchor="if(facilityParams.get('test')==='1')window.__editorTest={";
inject(anchor,anchor+`
 soulMenuQA:{
  pause:()=>{window.__soulMenuManual=true},frame:()=>render(),
  get:()=>{
   const k=poiHotbarRead(),a=poiCompanionActor,node=$('poiCompanionCommands'),slots=poiInventorySlots(k);
   return {time:performance.now(),open:!node.hidden,modal:node.matches(':modal'),role:node.getAttribute('role'),title:$('poiCompanionCommandsTitle').textContent,
    cursor:[...document.querySelectorAll('#poiHotbar button[aria-pressed=true]')].map(b=>+b.dataset.hotbarSlot),
    labels:[...node.querySelectorAll('button')].map(b=>b.textContent.trim()),disabled:node.querySelector('[data-companion-command="dismiss"]').disabled,
    active:k.companionSoul?.active??null,mode:poiCompanionMode(k),savedMode:k.companionSoul?.mode??null,
    weapon:k.weapon,wand:poiArmedWandIndex(),hp:slots[2]?.durability??null,orvasHp:slots[5]?.durability??null,
    xy:[poiWalkViewX,poiWalkViewZ],contact:poiAnalogContact?.id??null,walking:!!poiFreePose?.walking,
    actor:a?.id??null,ally:a?[poiCompanionPosition(a).x,poiCompanionPosition(a).z]:null,
    leader:!!a?.followLeader,allyMoving:!!a?.freeMoving,pending:!!a?.attackMotion?.pending,target:poiCompanionTarget?.o?.type??null,
    foe:window.__soulFoe?.s?.hp??null,foePos:window.__soulFoe?.s?[window.__soulFoe.s.x,window.__soulFoe.s.z]:null,
    supported:poiInventoryAllowed(),damage:window.__soulDamage??[]};
  },
  walkAxis:()=>{
   const p=poiCompanionPlayerPoint(performance.now());
   const directions=[[44,0],[-44,0],[0,44],[0,-44]];
   return directions.map(([x,y])=>{
    const sample=poiAnalogSample(x,y,poiThirdPerson,poiThirdPerson?poiCameraYaw:yaw);
    let length=0;
    for(let i=1;i<=90;i++){
     const current={x:p.x+sample.dx*(i-1)/10,z:p.z+sample.dz*(i-1)/10},next={x:p.x+sample.dx*i/10,z:p.z+sample.dz*i/10};
     if(!poiWalkCanStep(Math.round(next.x),Math.round(next.z),Math.round(current.x),Math.round(current.z)))break;
     length=i/10;
    }
    return {x,y,length};
   }).sort((a,b)=>b.length-a.length)[0];
  },
  opponent:()=>{
   const a=poiCompanionActor,p={x:poiWalkX,z:poiWalkZ},c=poiCompanionPosition(a);
   for(const [dx,dz] of [[2,1],[-2,1],[1,2],[1,-2],[-2,-1],[2,-1],[0,3],[0,-3],[3,0],[-3,0]]){
    const x=a.x+dx,z=a.z+dz;
    if(!poiWalkCanStep(x,z)||poiMonsterAt(x,z,true)||(p.x===x&&p.z===z)||
       !poiCompanionAttackClear(c,{x,z},a.y)||Math.hypot(x-p.x,z-p.z)>4.9)continue;
    const o={type:'monsterSkeleton',x,z,y:a.y,rot:0},s=poiCombatActorMake(o);
    s.nextAttack=performance.now()+90_000;
    poiMonsterStates.set(o,s);poiMonsterMeshDirty=true;window.__soulFoe={o,s};return s.hp;
   }
   return false;
  },
  retire:()=>{const f=window.__soulFoe;if(f){poiMonsterStates.delete(f.o);poiMonsterMeshDirty=true;window.__soulFoe=null}},
  hurt:damage=>poiCompanionHurt(damage,performance.now()),
 },
`);
inject(' requestAnimationFrame(render);',' if(!window.__soulMenuManual)requestAnimationFrame(render);');
inject('function poiWildRegionalFrame(now,rng){','function poiWildRegionalFrame(now,rng){return;');
inject('function poiWildPick(rng){','function poiWildPick(rng){return null;');
const contact='function poiPlayerDamageTarget(monster,x,z,amount,weapon,now,silent=false,atContact=false,source=null){';
inject(contact,contact+'\n if(source?.companion&&monster[0]===window.__soulFoe?.o)(window.__soulDamage??=[]).push({amount,now});');
for(const [,body] of html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(body);
if(process.env.SOUL_MENU_PARSE_ONLY){console.log('actual command panel and native movement anchors parse');process.exit(0);}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf8');res.end(req.url==='/seed'?'<title>Seed</title>':html)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
const labels=['戦いを優先','追尾優先','魂に戻す','戻る'];let browser,where='boot',last;
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const ctx=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:.72});const p=await ctx.newPage(),errors=[];
 p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(23000);
 await p.clock.install({time:new Date('2026-04-01T10:00:00Z')});
 await p.goto(url+'/seed');await p.evaluate(()=>{
  const slots=Array(27).fill(null);slots[0]={type:'equipWoodSword',count:1,durability:90};
  slots[2]={type:'slimeSoul',count:1,durability:22};slots[4]={type:'fireWand',count:1,charges:5};slots[5]={type:'orvasSoul',count:1,durability:123};
  localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weaponDurabilityVersion:2,fireWandFound:true,weapon:'equipWoodSword',gold:3,potions:0,slots,companionSoul:{version:1,active:'slimeSoul',pending:null,mode:'flee'}}));
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,position:{x:102,z:93,y:0,facing:2},townLayout:5,townMapHeight:182,templeDepth:1,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:0,orbitPitch:.25,orbitDistance:5.5}}));
 });
 const load=async()=>{
  await p.goto(url+'/?resume=1&test=1',{waitUntil:'domcontentloaded'});
  await p.locator('#pineStartupCover').waitFor({state:'hidden'});await p.waitForFunction(()=>window.__editorTest?.facility?.().active);
  await p.evaluate(()=>window.__editorTest.soulMenuQA.pause());
  for(const pad of [12_000,30_000]){try{await p.clock.pauseAt((await p.evaluate(()=>Date.now()))+pad);break;}catch(e){if(pad===30_000||!String(e?.message).includes('Cannot fast-forward to the past'))throw e;}}
 };
 await load();
 const read=async()=>last=await p.evaluate(()=>window.__editorTest.soulMenuQA.get());
 const step=async(ms=50)=>{await p.clock.fastForward(ms);await p.evaluate(()=>window.__editorTest.soulMenuQA.frame());return read()};
 const until=async(fn,n=80)=>{let q=await read();for(let i=0;i<n&&!fn(q);i++)q=await step();assert(fn(q),JSON.stringify(q));return q};
 const cdp=await ctx.newCDPSession(p),point=async(sel,id)=>{
  const b=await p.locator(sel).boundingBox();assert(b,sel);return {x:b.x+b.width/2,y:b.y+b.height/2,id,radiusX:4,radiusY:4,force:.7};
 };
 const touch=(type,pts)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pts});
 const tap=async(sel,held=[])=>{const pt=await point(sel,12);await touch('touchStart',[pt]);await touch('touchEnd',[pt]);return read();};
 const slot=n=>'#poiHotbar [data-hotbar-slot="'+n+'"]',command=m=>'#poiCompanionCommands [data-companion-command="'+m+'"]';
 const menu=(q,n)=>{assert.deepEqual(q.cursor,[n]);assert(q.open&&!q.modal&&q.role==='dialog');assert.deepEqual(q.labels,labels);};
 const initial=await until(q=>q.actor==='slimeSoul');assert.equal(initial.mode,'follow');assert.equal(initial.hp,22);assert.equal(initial.orvasHp,123);
 where='one true inactive soul tap with live left thumb and armed wand';
 assert.equal((await tap(slot(4))).wand,4);
 const start=await point('#poiAnalogPad',1),held={...start,y:start.y-45};
 await touch('touchStart',[start]);await touch('touchMove',[held]);
 const left=await until(q=>q.contact!==null&&q.walking);const picked=await tap(slot(5),[held]);
 menu(picked,5);assert(picked.disabled);assert.equal(picked.active,'slimeSoul');assert.equal(picked.weapon,'equipWoodSword');assert.equal(picked.wand,4);
 const moving=await until(q=>Math.hypot(q.xy[0]-left.xy[0],q.xy[1]-left.xy[1])>.06,16);
 assert.equal(moving.contact,left.contact);
 const returned=await tap(command('back'),[held]);assert(!returned.open);assert.deepEqual(returned.cursor,[5]);assert.equal(returned.active,'slimeSoul');
 assert.equal(returned.contact,left.contact);await touch('touchEnd',[]);
 if(process.env.SOUL_BEHAVIOR_NATIVE==='1'){
  where='native analog pressure, ordinary companion species rate and four/two follow hysteresis';
  const axis=await p.evaluate(()=>window.__editorTest.soulMenuQA.walkAxis());assert(axis.length>=7,JSON.stringify(axis));
  const pos=async n=>({...start,x:start.x+axis.x*n,y:start.y+axis.y*n});
  const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
  const rate=(a,b,field)=>distance(a[field],b[field])/(b.time-a.time);
  const gap=q=>distance(q.ally,q.xy);
  await touch('touchStart',[start]);await touch('touchMove',[await pos(1.04)]);
  let previous=await read(),first,fast=[];
  for(let i=0;i<190&&!first;i++){
   const q=await step();
   if(q.allyMoving&&q.leader){first=q;break;}
   assert(!q.leader,'follow did not move with a clear route');
   if(gap(q)<3.8)assert(distance(previous.ally,q.ally)<.003,'must wait for the 4 tile start gap');
   previous=q;
  }
  assert(first,'ordinary companion starts only after a genuine player move');assert(gap(first)>3.75,JSON.stringify(first));
  // A small sample avoids travelling out of the known clear ray; changing pressure changes only player rate.
  fast=[first];for(let i=0;i<4;i++)fast.push(await step());
  await touch('touchMove',[await pos(.54)]);await step();
  const slow=[await step()];for(let i=0;i<4;i++)slow.push(await step());
  const arFast=rate(fast[0],fast.at(-1),'ally'),arSlow=rate(slow[0],slow.at(-1),'ally');
  const prFast=rate(fast[0],fast.at(-1),'xy'),prSlow=rate(slow[0],slow.at(-1),'xy');
  assert(prFast>prSlow*1.25&&prSlow>.0005,JSON.stringify({prFast,prSlow}));
  for(const speed of [arFast,arSlow])assert(Math.abs(speed-1/380)<.00016,JSON.stringify({speed,arFast,arSlow,prFast,prSlow}));
  await touch('touchEnd',[]);
  const stopped=await until(q=>!q.leader&&!q.allyMoving&&gap(q)<2.09,160);assert(gap(stopped)>1.89,JSON.stringify(stopped));
  const after=await step(200);assert(distance(after.ally,stopped.ally)<.003);assert.deepEqual(errors,[]);
  await cdp.detach();await ctx.close();
  console.log('PASS real touch native species speed under two unequal player speeds, 4-to-2 hysteresis',JSON.stringify({arFast,arSlow,prFast,prSlow,start:gap(first),stop:gap(stopped)}));
 }else{
 where='actual valid nearby foe ignored while following';
 const hp=await p.evaluate(()=>window.__editorTest.soulMenuQA.opponent());assert(hp);
 for(let i=0;i<25;i++){const q=await step();assert.equal(q.foe,hp);assert(!q.pending&&q.mode==='follow');}
 where='priority commits actual melee and switching to follow cancels the pending strike';
 menu(await tap(slot(2)),2);const fighting=await tap(command('fight'));assert(!fighting.open&&fighting.mode==='fight');
 await until(q=>q.pending);
 menu(await tap(slot(2)),2);await tap(command('follow'));
 for(let i=0;i<12;i++){const q=await step();assert.equal(q.foe,hp);assert(!q.pending&&q.mode==='follow');}
 menu(await tap(slot(2)),2);await tap(command('fight'));
 const landed=await until(q=>q.foe<hp);assert.equal(landed.damage.length,1);
 await p.evaluate(()=>window.__editorTest.soulMenuQA.retire());
 where='dismiss retains precise token and hp; explicit inactive priority summons correct token';
 menu(await tap(slot(2)),2);const dismissed=await tap(command('dismiss'));
 assert(!dismissed.open);assert.equal(dismissed.active,null);assert.deepEqual(dismissed.cursor,[2]);assert.equal(dismissed.hp,22);
 menu(await tap(slot(5)),5);const summoned=await tap(command('follow'));
 assert.equal(summoned.active,'orvasSoul');assert.equal(summoned.savedMode,'follow');assert.equal(summoned.orvasHp,123);assert.equal(summoned.weapon,'equipWoodSword');
 await p.clock.resume();await load();
 const reload=await until(q=>q.actor==='orvasSoul');assert.equal(reload.mode,'follow');assert.equal(reload.orvasHp,123);assert.equal(reload.hp,22);
 where='real terminal soul damage closes stale menu and clears selection';
 menu(await tap(slot(5)),5);
 assert(await p.evaluate(()=>window.__editorTest.soulMenuQA.hurt(123)));
 const gone=await step();assert(!gone.open);assert.equal(gone.orvasHp,null);assert.equal(gone.active,null);assert(!gone.cursor.includes(5));
 assert.deepEqual(errors,[]);await cdp.detach();await ctx.close();
 console.log('PASS exact real four commands, exact cursor, simultaneous movement, autonomous fight/follow cancel, durability and zero terminal',JSON.stringify({old:left.mode,hit:landed.damage,restored:reload.orvasHp}));
 }
}catch(e){console.error(where,JSON.stringify(last));throw e}
finally{await browser?.close();await new Promise(r=>server.close(r))}
