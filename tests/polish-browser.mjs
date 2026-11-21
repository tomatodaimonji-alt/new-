import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const paths=process.argv.slice(2);
assert(paths.length===2,'baseline HTML and candidate HTML required');
const html=paths.map(file=>readFileSync(file,'utf8'));
const server=createServer((req,res)=>{
 res.setHeader('content-type','text/html; charset=utf-8');
 const key=req.url.split('?')[0];
 res.end(key==='/seed'?'<!doctype html><title>Fixture</title>':html[key==='/old'?0:1]);
});
await new Promise((yes,no)=>server.listen(0,'127.0.0.1',yes).once('error',no));
const origin='http://127.0.0.1:'+server.address().port;
const out=process.env.FACILITY_SCREENSHOTS;
if(out)await mkdir(out,{recursive:true});
const map={format:'forest-world-v1',version:1,width:30,height:30,world:[{x:1,y:0,z:2,type:'stonewall',rot:0}],models:[],prefabs:[],terrainHeights:[],checks:[]};
const fixtures={'forest-world-editor-v1':JSON.stringify(map,null,2),'world-workshop-pois-v1':JSON.stringify([{id:'poi-test-saved',name:'自作POI',map}]),'world-workshop-adventure-v1':'{"version":1,"x":23,"z":24,"monsters":[]}'};
const resume='world-workshop-resume-v1';
const scenarios=[
 {id:'homes',point:[22,15],name:'homes-frontage',step:[1,0]},
 {id:'base',point:[67,38],name:'woodland-edge',step:[0,-1]},
 {id:'base',point:[34,53],name:'starter-meadow',step:[1,0]},
];
const states=[];
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 for(const variant of ['old','new']){
  const ctx=await browser.newContext({viewport:{width:1120,height:800},deviceScaleFactor:1});
  const page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(const {id,point:[x,z],name,step:[dx,dz]} of scenarios){
   await page.goto(origin+'/seed');
   await page.evaluate(({fixtures,resume,id,x,z})=>{
    for(const [k,v] of Object.entries(fixtures))localStorage.setItem(k,v);
    localStorage.setItem(resume,JSON.stringify({version:1,route:'facility',id,play:true,position:{x,z,y:0,facing:0}}));
   },{fixtures,resume,id,x,z});
   await page.goto(origin+'/'+variant+'?test=1&resume=1');
   const status=()=>page.evaluate(()=>window.__editorTest.facility());
   const active=await status();
   assert.equal(active.id,id);
   assert.deepEqual(active.position,{x,z,level:0});
   assert(active.active);
   assert.equal(active.hiddenRoof,null);
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   if(out)await page.screenshot({path:out+'/'+name+'-'+variant+'.png'});
   await page.keyboard.press(dx===1?'ArrowRight':dx===-1?'ArrowLeft':dz===1?'ArrowDown':'ArrowUp');
   assert.deepEqual((await status()).position,{x:x+dx,z:z+dz,level:0});
   const bytes=await page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),Object.keys(fixtures));
   assert.deepEqual(bytes,fixtures);
   states.push([variant,name,active.position]);
  }
  assert.deepEqual(errors,[]);
  await ctx.close();
 }
 assert.equal(states.length,scenarios.length*2);
 console.log('PASS: paired v114/v115 exterior views, real walking and unchanged saved worlds',JSON.stringify(states));
}finally{
 await browser?.close();await new Promise(resolve=>server.close(resolve));
}
