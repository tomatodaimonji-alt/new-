import a from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {mkdirSync,readFileSync} from 'node:fs';
import {Script} from 'node:vm';
let html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const anchor='  freeMovementPose:()=>({x:poiWalkViewX,z:poiWalkViewZ,level:poiWalkLevel}),';
a.equal(html.split(anchor).length,2);
html=html.replace(anchor,anchor+`
 snowFrontQA:()=>{
  const scene=facilitySite?.id,pose=[poiWalkViewX,poiWalkViewZ],global=poiOverlandGlobal(scene,...pose);
  return {scene,pose,global,tile:[poiWalkX,poiWalkZ],facing:poiWalkFacing,
   pointer:poiAnalogContact?.id??null,switches:poiSnowPassSwitches,veil:!$('poiSnowTransitionVeil').hidden,
   light:[...gl.getUniform(program,loc.daylight)],sky:$('viewWrap').hasAttribute('data-poi-sky'),
   theater:poiSnowTempleNeighbor.length,stream:poiOverlandDrawing,
   exterior:poiSacredTempleVisibleAmount(scene==='base'?facilitySite:poiSnowPassBase?.site,...global,0,false),
   roof:facilitySite?.id==='base'&&facilityVisibleRoofs().some(i=>facilitySite.buildings[i]?.id==='davidTemple'),
   neighbor:poiOverlandDrawn.some(q=>q.id!==scene),kind:poiOrchestraScene(performance.now()),error:gl.getError()};
 },
`);
for(const [,s] of html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(s);
if(process.env.SNOW_SEAM_SYNTAX_ONLY)process.exit(0);
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>seed</title>':html)});
await new Promise((r,no)=>server.listen(0,'127.0.0.1',r).once('error',no));const url='http://127.0.0.1:'+server.address().port;
let b;
try{
 b=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 for(const v of [{id:'base',start:[65,137],dir:[0,1],dst:'snowpass',axis:1,index:139},
  {id:'snowpass',start:[17,1],dir:[0,-1],dst:'base',axis:1,index:139},
  {id:'base',start:[46,153],dir:[1,0],dst:'snowpass',axis:0,index:48},
  {id:'snowpass',start:[1,19],dir:[-1,0],dst:'base',axis:0,index:48}]){
  const ctx=await b.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:.65});
  try{
   const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
   await p.goto(url+'/seed');
   await p.evaluate(({id,start,axis})=>{
    localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":640500}');
    localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
     position:{x:start[0],z:start[1],y:0,facing:2},...(id==='snowpass'?{region:id,regionHp:71}:{}),townLayout:5,townMapHeight:182,templeDepth:1,
     view:{yaw:0,zoom:1,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:axis===0?-Math.PI/2:0,orbitPitch:.19,orbitDistance:6}}));
   },v);
   await p.goto(url+'/?resume=1&test=1');await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:25000});
   const read=()=>p.evaluate(()=>window.__editorTest?.snowFrontQA());let start=await read();
   const registry=()=>p.evaluate(()=>{
    const q=window.__editorTest,s=q.overlandSquare();
    return {...s,actualOwner:q.overlandSquareOwner(...s.player),
     unsupported:[q.overlandSquareOwner(127,181),q.overlandSquareOwner(183,183)],
     split:q.overlandSquareSlot(7,17)};
   });
   const square=await registry();
   a.equal(square.side,184);a.equal(square.chunk,8);a(square.slots<23**2);
   a.equal(square.site,v.id);a.equal(square.actualOwner,v.id);
   a.deepEqual(square.unsupported,[null,null]);
   a.deepEqual(square.split,[{id:'base',rows:[255,255,255,0,0,0,0,0]},
     {id:'snowpass',rows:[0,0,0,255,255,255,255,255]}]);
   a.deepEqual(start.tile,v.start);a.equal(start.scene,v.id);
   a.equal(start.exterior,0,'north and west snow edges are not the sacred entrance');a.equal(start.roof,false);
   const out=process.env.FACILITY_SCREENSHOTS,tag=v.id+'-'+v.start.join('-');
   if(out){mkdirSync(out,{recursive:true});await p.screenshot({path:out+'/'+tag+'-before.png'});}
   const dy=v.axis===0?v.dir[0]:-v.dir[1];
   const cdp=await ctx.newCDPSession(p);
   const box=await p.locator('#poiAnalogPad').boundingBox(),q={x:Math.round(box.x+box.width/2),y:Math.round(box.y+box.height/2),id:7};
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[q]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...q,x:q.x,y:q.y+dy*36}]});
   const near=await (await p.waitForFunction(({axis,index})=>{const a=window.__editorTest?.snowFrontQA();
    return a&&a.pointer!==null&&Math.abs(a.global[axis]+.5-index)<.65&&a},v,{polling:18,timeout:9000})).jsonValue();
   if(out){
    // Real screenshot readback can take several physical frames in software GPU.
    // Recenter this same held contact while taking the across frame, then resume.
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[q]});
    await p.screenshot({path:out+'/'+tag+'-across.png'});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...q,y:q.y+dy*36}]});
   }
   const after=await (await p.waitForFunction(({dst,axis,index,dir})=>{const a=window.__editorTest?.snowFrontQA();
    return a?.scene===dst&&dir[axis]*(a.global[axis]+.5-index)>.55&&a},v,{polling:18,timeout:9000})).jsonValue();
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   a.equal(after.error,0);a.equal(after.veil,false);a.equal(after.switches-start.switches,1);
   a.equal(near.pointer,after.pointer);a.notEqual(after.pointer,null);
   a(Math.abs(after.global[1-v.axis]-start.global[1-v.axis])<.12,'non-crossing axis stays fixed');
   a(Math.max(...after.light.map((n,i)=>Math.abs(n-near.light[i])))<.10,'the same night clock hands off continuously: '+JSON.stringify({v,near,after}));
   a.equal(after.kind,v.dst==='snowpass'?'snow':'outside');
   a.equal(near.exterior,0,'no silhouette at the natural ridge');a.equal(after.exterior,0,'no silhouette after crossing');
   a.equal(near.roof,false);a.equal(after.roof,false);
   if(out)await p.screenshot({path:out+'/'+tag+'-after.png'});
   const written=await p.evaluate(()=>JSON.parse(localStorage.getItem('world-workshop-resume-v1')));
   a.equal(written.region,v.dst==='snowpass'?'snowpass':undefined);
   const projected=await registry();a.equal(projected.actualOwner,v.dst);
   await p.reload({waitUntil:'domcontentloaded'});
   await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:25000});
   const cold=await read(),coldRegistry=await registry();
   a.equal(cold.scene,v.dst);a.equal(coldRegistry.actualOwner,v.dst);
   a.deepEqual(cold.tile,[written.position.x,written.position.z],
    'persisted payload stays local, while square registry maps the restored global cells');
   a.deepEqual(coldRegistry.unsupported,[null,null]);
   a.deepEqual(errors,[]);console.log('Actual aligned square overland, held motion and local resume',JSON.stringify({v,near,after,cold:cold.tile,slots:square.slots}));
  }finally{await ctx.close()}
 }
}finally{await b?.close();await new Promise(r=>server.close(r))}
