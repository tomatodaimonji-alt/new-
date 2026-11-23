import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const html=readFileSync(process.argv[2]||'world-editor.html','utf8');
const setup='function poiRenderEnemyHealth(now,vp){';
const tag="   const el=document.createElement('progress');el.className='poiEnemyHealth';";
assert.equal(html.split(setup).length,2);assert.equal(html.split(tag).length,2);
const fixture=html.replace(setup,setup+`
 if(!window.__healthModels){
  window.__healthModels=['monsterSkelLongStaff','monsterSlime'].map((type,i)=>{
   const obj={type,x:poiWalkX+2,z:poiWalkZ-i*2,y:poiWalkLevel,rot:0,healthProbe:i};
   const state=poiCombatActorMake(obj);state.townOwned=true;
   poiMonsterStates.set(obj,state);poiMonsterMeshDirty=true;
   return [obj,state];
  });
 }
 window.__enemyHudTop=()=>window.__healthModels.map(([o,state])=>{
  const pose=poiMonsterPose(o,state,now),m=mesh();
  deco(m,poiMonsterRenderType(o),0,0,0,0);
  let top=Infinity;
  for(let i=0;i<m.p.length;i+=3){
   const [x,z]=rot2(m.p[i],m.p[i+2],state.facing||0);
   const p=poiWorldToScreen(vp,pose.x+x,pose.y+m.p[i+1],pose.z+z);
   if(p)top=Math.min(top,p.y);
  }
  return {type:o.type,top,hp:state.hp};
 });
`).replace(tag,tag+`\n   if(obj.healthProbe!==undefined)el.dataset.healthProbe=String(obj.healthProbe);`);
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url==='/seed'?'<!doctype html><title>Seed</title>':fixture);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 for(const [width,height,camera] of [[568,320,'angled'],[844,390,'orbit'],[390,740,'overhead']]){
  const ctx=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true});
  try{
   const page=await ctx.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
   await page.goto(base+'/seed');
   await page.evaluate(camera=>{
    localStorage.setItem('world-workshop-hotbar-v1','{"version":1,"weapon":"equipWoodSword","potions":0,"gold":12}');
    localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
     position:{x:41,z:43,y:0,facing:1},townLayout:5,townMapHeight:128,view:{yaw:.24,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,
      top:camera==='overhead',third:camera==='orbit',orbitYaw:Math.PI,orbitPitch:.55,orbitDistance:6.8}}));
   },camera);
   await page.goto(base+'/?resume=1&test=1');
   await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
   await page.locator('#pineStartupCover').waitFor({state:'hidden'});
   await page.waitForFunction(()=>document.querySelectorAll('.poiEnemyHealth[data-health-probe]').length===2);
   const sample=await page.evaluate(()=>{
    const base=document.querySelector('#view').getBoundingClientRect();
    const bars=[...document.querySelectorAll('.poiEnemyHealth[data-health-probe]')].map(el=>{
     const box=el.getBoundingClientRect();
     return {i:+el.dataset.healthProbe,bottom:box.bottom-base.top,width:box.width,height:box.height,value:el.value,max:el.max,
      pointer:getComputedStyle(el.parentElement).pointerEvents};
    });
    const aim=document.querySelector('#poiAimLockMarker');
    return {models:window.__enemyHudTop(),bars,reticle:!!aim&&!aim.matches('progress')};
   });
   assert(sample.reticle,'separate target marker remains present');
   for(const row of sample.bars){
    const model=sample.models[row.i];
    assert(Number.isFinite(model.top));
    assert(row.bottom+11<=model.top,'bar clears actual '+model.type+' projected triangles: '+JSON.stringify({camera,row,model}));
    assert(row.width>=25&&row.width<=34&&row.height===5);
    assert.equal(row.value,Math.min(model.hp,row.max));assert.equal(row.pointer,'none');
   }
   assert.deepEqual(errors,[]);
  }finally{await ctx.close()}
 }
 console.log('PASS actual slime/staff skeleton mesh clearance, smaller noninteractive meters, overhead/orbit/angled camera and independent aim marker');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
