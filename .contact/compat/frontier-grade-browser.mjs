import a from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {mkdirSync,readFileSync} from 'node:fs';
import {Script} from 'node:vm';
let html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const put=(a1,b)=>{a.equal(html.split(a1).length,2,a1);html=html.replace(a1,b)};
const marker="if(facilityParams.get('test')==='1')window.__editorTest={";
put(marker,marker+`
 testFrontierGrade:{
  dirs:()=>['n','s','e','w'].map(k=>poiCameraRelativeStep(k)),
  yaw:y=>{poiCameraYaw=y;poiCameraPitch=.15;poiCameraDistance=5.5},
  snap:()=>{
   const o=[...poiMonsterStates.keys()].find(o=>o.type==='monsterStoneDavid'),s=poiMonsterStates.get(o);
   const p=parameters(),x=poiWalkViewX,z=poiWalkViewZ;
   return {x,z,tile:[poiWalkX,poiWalkZ],level:poiWalkLevel,scene:facilitySite.id,eye:p.eye,
   reveal:poiSacredTempleViewAmount(),inside:poiSacredInteriorPlayer(),floor:window.__frontGradeFloor??0,
   ghost:typeof poiSnowExteriorShown==='number'?poiSnowExteriorShown:0,visual:window.__frontGradeBoss??false,
   peek:poiSacredTunnelPresentation(facilitySite,x,z,poiWalkLevel),
   admitted:o&&poiSacredInteriorHostileVisible(o),phase:s&&poiDavidPose(s,performance.now()).phase,
   visibleArea:poiRegionAt(facilitySite,poiWalkX,poiWalkZ,false,0).name,
   light:[...gl.getUniform(program,loc.daylight)],fog:gl.getUniform(program,loc.sacredFog)[2],bar:$('poiEnemyHealthLayer')?.textContent,error:gl.getError()};
  }
 },
`);
put('function poiSacredInteriorDraw(vp,peek=false){','function poiSacredInteriorDraw(vp,peek=false){window.__frontGradeFloor=0;');
put(' if(inside||peek)for(const m of q.draws)if(poiOverlandBoxVisible(vp,m.bounds))draw(m,vp);',
 ' window.__frontGradeFloor=0;if(inside||peek)for(const m of q.draws)if(poiOverlandBoxVisible(vp,m.bounds)){draw(m,vp);window.__frontGradeFloor+=m.count}');
put(" const onSlice=(o,state)=>(poiSacredInteriorHostileVisible(o)||sacredPeek&&poiSacredTunnelBoss(facilitySite,o))&&",
    " const onSlice=(o,state)=>(poiSacredInteriorHostileVisible(o)||sacredPeek&&poiSacredTunnelBoss(facilitySite,o))&&");
put(' const clip=typeof poiOverlandDrawing', " window.__frontGradeBoss=[...poiMonsterStates].some(([o,s])=>o.type==='monsterStoneDavid'&&s.hp>0&&onSlice(o,s));\n const clip=typeof poiOverlandDrawing");
for(const [,s] of html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(s);
if(process.env.FRONTIER_SYNTAX_ONLY)process.exit(0);
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>seed</title>':html)});
await new Promise((r,j)=>server.listen(0,'127.0.0.1',r).once('error',j));const origin='http://127.0.0.1:'+server.address().port;
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 async function scene(v,fn){
  const ctx=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:.75});
  const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  try{
   await p.goto(origin+'/seed');
   await p.evaluate(({x,z,region,angle,minute})=>{
    localStorage.setItem('world-workshop-town-clock-v1',JSON.stringify({version:1,gameMs:minute*500}));
    localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
     position:{x,z,y:0,facing:2},...(region?{region,regionHp:71}:{}),townLayout:5,townMapHeight:182,templeDepth:1,
     view:{yaw:0,zoom:1,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:angle,orbitPitch:.15,orbitDistance:5.5}}));
   },v);
   await p.goto(origin+'/?resume=1&test=1');await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:30000});
   const snap=()=>p.evaluate(()=>window.__editorTest.testFrontierGrade.snap());
   const image=async name=>{if(process.env.FACILITY_SCREENSHOTS){mkdirSync(process.env.FACILITY_SCREENSHOTS,{recursive:true});await p.screenshot({path:process.env.FACILITY_SCREENSHOTS+'/'+name+'.png'});}};
   await fn(p,snap,image);a.deepEqual(errors,[]);
  }finally{await ctx.close()}
 }
 for(const v of [{x:1,z:14,region:'snowpass',angle:-Math.PI/2,minute:1364},{x:46,z:153,angle:-Math.PI/2,minute:780},{x:2,z:158,angle:Math.PI/2,minute:780},{x:24,z:180,angle:Math.PI,minute:1364}]){
  await scene(v,async(p,snap,image)=>{
   const s=await snap();
   a.equal(s.reveal,v.region?1:0);a.equal(s.ghost,0);a.equal(s.floor,0);a(!s.peek&&!s.visual&&!s.inside);a.equal(s.error,0);
   a.equal(s.visibleArea,v.region?'白嶺峠':'深樹の聖林');await image('concealed-'+v.x+'-'+v.z);
  });
 }
 await scene({x:24,z:125,angle:0,minute:1330},async(p,snap,image)=>{
  await p.waitForFunction(()=>{const s=window.__editorTest.testFrontierGrade.snap();return s.floor>0&&s.peek&&s.visual},null,{polling:50,timeout:12000});
  const outside=await snap();a(outside.floor>0&&outside.visual&&!outside.inside&&!outside.admitted);a.equal(outside.phase,'dormant');
  await image('north-aperture-visible');
  await p.evaluate(()=>window.__editorTest.testFrontierGrade.yaw(1.27));
  await p.waitForFunction(()=>window.__editorTest.testFrontierGrade.snap().peek,null,{polling:50,timeout:5000});
  const sideways=await snap();a(sideways.peek&&sideways.visual&&!sideways.admitted);a.deepEqual(sideways.tile,outside.tile);
  await p.evaluate(()=>window.__editorTest.testFrontierGrade.yaw(0));
  async function realStep(z){
   const dirs=await p.evaluate(()=>window.__editorTest.testFrontierGrade.dirs());
   const i=dirs.findIndex(([x,z])=>x===0&&z===1);a(i>=0);
   for(let n=0;n<3;n++){
    await p.keyboard.press(['ArrowUp','ArrowDown','ArrowRight','ArrowLeft'][i]);await p.waitForTimeout(350);
    const s=await snap();if(s.tile[1]===z)return s;a.equal(s.tile[1],z-1);
   }
   a.fail('needed authentic tunnel step '+z);
  }
  let last=outside;
  for(let z=126;z<=135;z++){
   const s=await realStep(z);a(s.floor>0&&s.visual,'no sudden replacement of real visible interior');
   a(Math.max(...s.light.map((n,i)=>Math.abs(n-last.light[i])))<.065,'real tunnel color transfers without a binary pop');
   a.equal(s.phase,'dormant');last=s;
   if(z===128||z===135)await image('tunnel-'+z);
  }
  a.equal(last.error,0);
  console.log('Genuine aperture, unengaged hidden outside and gradual light',JSON.stringify({outside,sideways,end:last}));
 });
}finally{await browser?.close();await new Promise(r=>server.close(r))}
