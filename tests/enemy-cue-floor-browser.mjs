import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const beforeFix=process.argv.includes('--expect-buried-stone');
function inject(s,a,b){assert.equal(s.split(a).length,2,a);return s.replace(a,b)}
const hook="  townResidents:()=>typeof poiTownResidentsSnapshot==='function'?poiTownResidentsSnapshot():null,";
let fixture=inject(html,hook,hook+`
  cueDepthQA:{
   sample:kind=>{
    poiEnemyCancelPlayer();poiMonsterStates.clear();poiMonsterMeshDirty=true;
    const now=performance.now(),y=poiWalkLevel,mine=kind==='mine';
    const obj=mine?world.find(o=>o.type==='monsterMineGuard'&&o.x===120&&o.z===55&&o.y===-1):
     {x:99,z:97,y,type:'monsterSlime'};
    const s=poiCombatActorMake(obj);poiMonsterStates.set(obj,s);
    // Place a long-lived, committed attack in the real renderer. Combat
    // timing itself stays covered by the independent ordinary/guardian tests.
    s.playerAttack={obj,start:now-100,hit:now+20000,sx:s.x,sz:s.z,y,dx:mine?1:-1,dz:0,pending:true,
     x:mine?122:98,z:mine?55:97,...(mine?{guardTrial:true,angular:true}:null)};
    poiEnemyPending.add(s);
    const tiles=mine?[{x:121,z:55,type:'moss'},{x:122,z:55,type:'stone'}]:[{x:98,z:97,type:'grassTrampled'}];
    for(const p of tiles)if(!world.some(o=>o.x===p.x&&o.z===p.z&&o.y===y&&o.type===p.type))throw Error('real floor type missing '+JSON.stringify(p));
    window.__cueDepthQA={tiles,y,frames:[],armed:true};
   },
   read:()=>window.__cueDepthQA?.frames||[],
  },`);
const draw=' poiDrawNorthAxeCue(now,p.vp);';
fixture=inject(fixture,draw,`
 const qaCue=window.__cueDepthQA,readCuePixels=()=>{
  if(!qaCue?.armed)return null;
  const floor=qaCue.y*1.4,ratioX=canvas.width/canvas.clientWidth,ratioY=canvas.height/canvas.clientHeight;
  return qaCue.tiles.map(({x,z,type})=>{
   const result=[];
   for(const dx of [.21,.31,.43,.56,.66])for(const dz of [.20,.30,.45,.54,.66,.8]){
    const pt=poiWorldToScreen(p.vp,x+dx,terrainY(x,z)+floor+.142,z+dz);
    if(!pt)continue;
    const px=Math.round(pt.x*ratioX),py=canvas.height-1-Math.round(pt.y*ratioY);
    if(px<1||py<1||px>=canvas.width-1||py>=canvas.height-1)continue;
    const rgb=new Uint8Array(4);gl.readPixels(px,py,1,1,gl.RGBA,gl.UNSIGNED_BYTE,rgb);result.push([...rgb]);
   }
   return {type,result};
  });
 };
 const cueBefore=readCuePixels();
 `+draw+`
 if(cueBefore){
  const cueAfter=readCuePixels();
  qaCue.frames.push(cueBefore.map(({type,result},i)=>{
   const shifts=result.map((rgb,j)=>{const a=cueAfter[i].result[j];return (a[0]-a[1])-(rgb[0]-rgb[1])});
   return {type,shifts,red:shifts.filter(d=>d>=12).length,n:shifts.length};
  }));
  if(qaCue.frames.length>=2)qaCue.armed=false;
 }
`);
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<!doctype html><title>Ground warning QA</title>':fixture)});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const origin='http://127.0.0.1:'+server.address().port;
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 for(const [kind,pos] of [['mine',[118,54,-1]],['outside',[98,96,0]]]){
  const ctx=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:.75,isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto(origin+'/seed');
   await page.evaluate(([x,z,y])=>{
    localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":360000}');
    localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
     position:{x,z,y,facing:2},townLayout:5,townMapHeight:128,
     view:{yaw:0,zoom:1.45,panX:0,panZ:0,level:y,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
   },pos);
   await page.goto(origin+'/?resume=1&test=1');
   await page.locator('#pineStartupCover').waitFor({state:'hidden'});
   assert.deepEqual(await page.evaluate(()=>window.__editorTest.facility().position),{x:pos[0],z:pos[1],level:pos[2]});
   await page.evaluate(kind=>window.__editorTest.cueDepthQA.sample(kind),kind);
   await page.waitForFunction(()=>window.__editorTest.cueDepthQA.read().length>=2);
   const data=await page.evaluate(()=>window.__editorTest.cueDepthQA.read());
   for(const frame of data)for(const s of frame){
    assert(s.n>=20,JSON.stringify(s));
    if(beforeFix&&s.type==='stone')assert(s.red/s.n<=.45,'old stone buries the warning: '+JSON.stringify(s));
    else assert(s.red/s.n>=.64,'warning should cover broad visible '+s.type+': '+JSON.stringify(s));
   }
   assert.deepEqual(errors,[]);console.log(kind,JSON.stringify(data.map(tiles=>tiles.map(({type,n,red})=>({type,n,red})))));
  }finally{await ctx.close()}
 }
 console.log(beforeFix?'PASS reproduces stone-only buried warning on real framebuffer':'PASS actual broad warnings on mine stone, moss and outdoor grass framebuffer');
}finally{await browser?.close();await new Promise(r=>server.close(r))}
