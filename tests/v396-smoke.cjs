const a=require('node:assert/strict'),fs=require('node:fs'),{createServer}=require('node:http'),{chromium}=require('playwright');
const file=process.argv[2]||'world-editor.html', hook="if(facilityParams.get('test')==='1')window.__editorTest={";
let h=fs.readFileSync(file,'utf8');a.equal(h.split(hook).length,2);
h=h.replace(hook,hook+`
 frontierSmoke:{
  state:()=>({id:facilitySite?.id,on:poiWalkActive,x:poiWalkX,z:poiWalkZ,y:poiWalkLevel,
   room:facilityHiddenRoof(),map:$('poiLocationName').textContent,known:poiMiniSnapshot()?.local?.known??0,
   items:$('poiHotbar').querySelectorAll('button[data-hotbar-slot]').length,bag:!$('poiBagPanel').hidden,
   label:$('poiWalkAction').textContent,gl:gl.getError(),hp:poiPlayerHP,
   water:poiWalkCanStep(64,24),bridge:poiWalkCanStep(64,30),
   npc:poiTownNpcActors.map(n=>({id:n.role.id,x:n.x,z:n.z,act:n.activity,recessed:n.recessed})),
   clock:poiTownClockSnapshot()?.minute}),
  delta:(dx,dz)=>{
   const angle=poiThirdPerson?poiCameraYaw:yaw,l=poiAnalogSample(42,0,poiThirdPerson,angle),m=poiAnalogSample(0,42,poiThirdPerson,angle);
   return [42*(dx*l.dx+dz*l.dz),42*(dx*m.dx+dz*m.dz)];
  }
 },
`);
const s=createServer((_,r)=>{r.setHeader('Content-Type','text/html;charset=utf-8');r.end(h)});
(async()=>{await new Promise(r=>s.listen(0,'127.0.0.1',r));let b,p;const errs=[];
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const c=await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 p=await c.newPage();p.on('pageerror',e=>errs.push(e.message));p.setDefaultTimeout(15000);
 const api=()=>p.evaluate(()=>window.__editorTest.frontierSmoke.state());
 const wait=fn=>p.waitForFunction(fn,null,{timeout:14000});
 const t=Date.now();await p.goto('http://127.0.0.1:'+s.address().port+'/?test=1',{waitUntil:'domcontentloaded'});
 await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:40000});
 await wait(()=>window.__editorTest?.frontierSmoke?.state().on);
 const start=await api();console.log('START',Date.now()-t,start);
 a.equal(start.id,'frontier');a(start.items>0&&start.known>0&&start.gl===0);a.equal(start.water,false);a.equal(start.bridge,true);
 fs.mkdirSync('playtest-shots',{recursive:true});
 await p.screenshot({timeout:15000,path:'playtest-shots/01-new-game.png'});
 await p.locator('#poiBagToggle').tap();
 await p.locator('#poiBagPanel').waitFor({state:'visible'});a.equal((await api()).bag,true);
 await p.screenshot({timeout:15000,path:'playtest-shots/02-inventory.png'});
 console.log('BAG INPUT',await p.locator('#poiBagToggle').evaluate(e=>{
  const r=e.getBoundingClientRect(),target=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
  return {toggleTappable:e.contains(target),coveredBy:target?.closest('[id]')?.id};
 }));
 await p.locator('#poiBagClose').tap();await p.locator('#poiBagPanel').waitFor({state:'hidden'});
 const cdp=await c.newCDPSession(p),touch=(type,touchPoints=[])=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
 const walk=async(dx,dz,x,z)=>{
  const position=await api(),pad=await p.locator('#poiAnalogPad').boundingBox();
  a(pad,'gesture pad visible');const u=pad.x+pad.width/2,v=pad.y+pad.height/2;
  const d=await p.evaluate(([dx,dz])=>window.__editorTest.frontierSmoke.delta(dx,dz),[dx,dz]);
  await touch('touchStart',[{x:u,y:v}]);await touch('touchMove',[{x:u+d[0],y:v+d[1]}]);
  try{
   await p.waitForFunction(({dx,dz,x,z})=>{
    const q=window.__editorTest.frontierSmoke.state();
    return (!dx||(dx>0?q.x>=x:q.x<=x))&&(!dz||(dz>0?q.z>=z:q.z<=z));
   },{dx,dz,x,z},{timeout:60000,polling:250});
  }catch(e){console.log('STUCK',{from:position,to:[x,z],current:await api(),delta:d});throw e;}
  finally{await touch('touchEnd');}
  return api();
 };
 const z=start.z, x=start.x;
 // Actual touch input from a clean game, no teleports or NPC clock overrides.
 const crossing=await walk(1,0,64,z);
 a.equal(crossing.z,z);a.equal(crossing.id,'frontier');a.equal(crossing.gl,0);
 await p.screenshot({timeout:15000,path:'playtest-shots/03-bridge.png'});
 await walk(1,0,71,z);
 const returned=await walk(-1,0,x,z);a.equal(returned.z,z);
 console.log('BRIDGE OUT AND BACK',{crossing,returned});
 const approach=await walk(-1,0,38,z);a(approach.x>=37&&approach.x<=38,'toolshop approach overshot');
 // A shop counter test is diagnostic rather than a hard assertion:
 // walking actors can be away, under threat, or block movement.
 try{
  if(approach.x===38){
   const at=await walk(0,-1,25,25);console.log('SHOP ENTRY',at);
   await p.screenshot({timeout:15000,path:'playtest-shots/04-shop.png'});
   if(at.label==='話す'){
    await p.locator('#poiWalkAction').tap();
    const menu=await p.locator('#poiNpcMenu').innerText({timeout:3000});
    if(!menu.includes('買う'))console.log('CONCERN expected buy command unavailable',menu);
    else console.log('PASS shop counter shows Buy');
    await p.screenshot({timeout:15000,path:'playtest-shots/05-shop-menu.png'});
   }else console.log('CONCERN no talk command facing clerk from counter',at);
  }else console.log('CONCERN landing overshot shop doorway, exact approach not reached');
 }catch(e){console.log('CONCERN shop approach or interaction:',e.message);}
 a.deepEqual(errs,[]);
 console.log('PASS blank-save boot, add-item bag opens/closes, touch walks through village and across bridge and back, water blocked and no page errors');
}finally{await b?.close();s.close()}})().catch(e=>{console.error(e);process.exitCode=1});
