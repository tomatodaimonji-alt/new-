import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const old=process.argv[3]?readFileSync(process.argv[3],'utf8'):null;
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url.startsWith('/seed')?'<!doctype html><title>Isolated fixtures</title>':req.url.startsWith('/baseline')?old:html);
});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const origin='http://127.0.0.1:'+server.address().port;
const map={format:'forest-world-v1',version:1,width:30,height:30,size:30,
 world:[{x:2,y:0,z:2,type:'stonewall',rot:1},{x:15,y:0,z:12,type:'bed',rot:2}],
 models:[],prefabs:[],terrainHeights:[],checks:[]};
const guild={...map,world:[{x:7,y:0,z:6,type:'stonewall',rot:0}]};
const fixtures={
 'forest-world-editor-v1':JSON.stringify(map,null,2),
 'world-workshop-pois-v1':JSON.stringify([
  {id:'poi-guild-primary-v87',name:'ギルド',map:guild},
  {id:'poi-adventurers-guild-v102',name:'冒険者ギルド',map:guild}],null,2),
 'pine-guild-screenshot-before-v86':JSON.stringify(guild,null,2),
 'pine-adventurers-guild-poi-before-v102':JSON.stringify({keep:'fixture'}),
 'world-workshop-guild-duplicates-v105':JSON.stringify({version:1,records:[
  {id:'poi-old-archive',name:'冒険者ギルド',map:guild}]}),
 'world-workshop-adventure-v1':'{"version":1,"x":23,"z":24,"hp":84,"monsters":[]}',
 'world-workshop-audio-v2':'{"master":81,"bgm":62,"se":88,"enabled":true}'
};
const resumeKey='world-workshop-resume-v1';
const state=page=>page.evaluate(()=>window.__editorTest?.facility?.()??null);
async function unchanged(page){
 const before=await page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),Object.keys(fixtures));
 assert.deepEqual(before,fixtures,'route must not write existing editor, Guild/archives, adventure, or audio settings');
}
const out=process.env.FACILITY_SCREENSHOTS;
if(out)await mkdir(out,{recursive:true});
const pos=(page)=>page.evaluate(()=>window.__editorTest.facility().position);
const getMap=page=>page.evaluate(()=>window.__editorTest.data());
async function setup(browser,id,start,{townLayout=5,yaw=0,orbitYaw=Math.PI,third=false,top=false,pitch=.52,prefix='/'}={}){
 const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 await ctx.addInitScript(()=>{
  const counts={uploads:0,largeUploads:0,draws:0};
  const proto=WebGLRenderingContext.prototype;
  const data=proto.bufferData,draw=proto.drawArrays;
  const get=proto.getUniformLocation,set=proto.uniformMatrix4fv,known=new WeakSet();
  proto.getUniformLocation=function(p,s){const a=get.call(this,p,s);if(a&&s==='uMVP')known.add(a);return a;};
  proto.uniformMatrix4fv=function(l,t,m){if(l&&known.has(l))window.__obliqueVP=Array.from(m);return set.call(this,l,t,m);};
  proto.bufferData=function(target,source,usage){
   counts.uploads++;
   if((typeof source==='number'?source:source?.byteLength)>300000)counts.largeUploads++;
   return data.call(this,target,source,usage);
  };
  proto.drawArrays=function(...a){counts.draws++;return draw.apply(this,a);};
  window.__occlusionCounts=counts;
 });
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
 await page.goto(origin+'/seed');
 await page.evaluate(({fixtures,resumeKey,id,start,townLayout,yaw,orbitYaw,third,top,pitch})=>{
  for(const [k,v] of Object.entries(fixtures))localStorage.setItem(k,v);
  if(start)localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weapon:null,potions:3,gold:12,drops:[{type:'healingHerb',x:107,z:59,y:0}]}));
  if(start)localStorage.setItem(resumeKey,JSON.stringify({version:1,route:'facility',id,play:true,position:{y:0,facing:0,...start},townLayout,
   view:{yaw,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top,third,orbitYaw,orbitPitch:pitch,orbitDistance:5.5}}));
 },{fixtures,resumeKey,id,start,townLayout,yaw,orbitYaw,third,top,pitch});
 await page.goto(origin+prefix+(start?'?resume=1&test=1':'?facility='+id+'&test=1'));
 if(!start)await page.locator('#enterGameWorld').tap();
 await page.waitForFunction(()=>window.__editorTest?.facility?.().mode==='play');
 assert.equal((await state(page)).id,id);
 return {ctx,page,errors};
}
const paint=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
async function capture(page,label){
 if(!out)return;
 await paint(page);
 await page.screenshot({path:out+'/v156-'+label+'.png'});
}
const view='#view';
const pocket=(x,z)=>({x,z,level:0});
const stateFade=async page=>(await state(page)).occlusion;
const screenshot=page=>page.locator(view).screenshot({animations:'disabled'});
const clickFade=async(page,value)=>{
 await page.evaluate(value=>window.__editorTest.setOverheadWallFade(value),value);
 await paint(page);
};
const inventory=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('world-workshop-hotbar-v1')));

async function project(page){
 return page.evaluate(()=>{
  const canvas=document.querySelector('#view'),v=window.__obliqueVP;
  const p=window.__editorTest.facility().position;
  const convert=([x,y,z])=>{
   const w=v[3]*x+v[7]*y+v[11]*z+v[15];
   return [(1+(v[0]*x+v[4]*y+v[8]*z+v[12])/w)/2,(1-(v[1]*x+v[5]*y+v[9]*z+v[13])/w)/2];
  };
  return {hero:convert([p.x+.5,.70,p.z+.5]),loot:convert([p.x+.8,.20,p.z+.3]),
   far:convert(p.x===75?[72.5,2.9,59.5]:[66.5,2.5,45.5]),mat:v};
 });
}
async function diff(page,off,on,points){
 return page.evaluate(async ({off,on,p})=>{
  async function pixels(base64){
   const i=new Image();i.src='data:image/png;base64,'+base64;await i.decode();
   const c=document.createElement('canvas');c.width=i.width;c.height=i.height;
   const g=c.getContext('2d');g.drawImage(i,0,0);return g.getImageData(0,0,c.width,c.height);
  }
  const [a,b]=await Promise.all([pixels(off),pixels(on)]);
  if(a.width!==b.width||a.height!==b.height)throw Error('not image pair');
  const out={total:0,hero:0,loot:0,far:0,w:a.width,h:a.height};
  for(let j=0,i=0;i<a.data.length;i+=4,j++){
   const d=Math.max(Math.abs(a.data[i]-b.data[i]),Math.abs(a.data[i+1]-b.data[i+1]),Math.abs(a.data[i+2]-b.data[i+2]));
   if(d<18)continue;
   out.total++;
   if(p)for(const [label,r] of [['hero',15],['loot',13],['far',12]]){
    const x=j%a.width,y=Math.floor(j/a.width);
    if(Math.hypot(x-p[label][0]*a.width,y-p[label][1]*a.height)<=r)out[label]++;
   }
  }
  return out;
 },{off:off.toString('base64'),on:on.toString('base64'),p:points});
}

const outside={x:75,z:59,yaw:Math.PI/2,owner:'gardener',roofIndex:7};
const frontage={x:66,z:50,yaw:0,owner:'artisan'};
async function framePair(browser,pixels,fixture,kind){
 const {ctx,page,errors}=await setup(browser,'base',fixture,{yaw:fixture.yaw});
 try{
  const map=await getMap(page),kit=await inventory(page),url=page.url();
  assert.deepEqual(await pos(page),pocket(fixture.x,fixture.z));
  assert.match(await page.locator('#poiThirdView').textContent(),/俯瞰/);
  await clickFade(page,false);const off=await screenshot(page),before=await project(page);
  const counts=await page.evaluate(()=>({...window.__occlusionCounts}));
  await clickFade(page,true);
  await page.waitForFunction(kind=>{const o=window.__editorTest.facility().occlusion;return kind==='overhead-roof'?o?.roofOwners?.length>0:o?.kind===kind;},kind);
  const active=await stateFade(page),on=await screenshot(page),after=await project(page);
  assert.deepEqual(after.mat,before.mat,'fade does not shift angle, player aim, or zoom');
  assert.ok(active.opacity<=.2,'blocking surface must reveal player clearly');
  assert.ok(kind==='overhead-roof'?active.roofFades?.[fixture.roofIndex]?.length:active.spans?.length,'draw splits actual scene mesh into opaque/translucent spans');
  const changed=await diff(pixels,off,on,after);
  assert.ok(changed.total>=85,'real WebGL output changes a region, not only the diagnostic: '+JSON.stringify(changed));
  assert.ok(changed.hero>=8,'real pixels change over the part once covering the player: '+JSON.stringify(changed));
  assert.ok(changed.far<=10,'opposite structure sample unaffected');
  await clickFade(page,false);const restored=await screenshot(page);
  const restoreDiff=await diff(pixels,off,restored,null);
  assert.ok(restoreDiff.total<=Math.max(30,restoreDiff.w*restoreDiff.h*.002),'restoring opacity restores the same world frame');
  const updated=await page.evaluate(()=>({...window.__occlusionCounts}));
  assert.equal(updated.largeUploads,counts.largeUploads,'render-only fade reuses resident large map mesh');
  if(out){
   await writeFile(out+'/v156-'+kind+'-opaque.png',off);
   await writeFile(out+'/v156-'+kind+'-revealed.png',on);
   await clickFade(page,true);await capture(page,kind+'-mobile');
  }
  if(kind==='overhead-roof'){
   await clickFade(page,true);
   for(let z=60;z<=64;z++){
    if(z===60)await page.locator('[data-poi-dir="s"]').tap();else await page.keyboard.press('ArrowDown');
    await page.waitForFunction(z=>{const p=window.__editorTest.facility().position;return p.x===75&&p.z===z;},z,{timeout:4000});
    await page.waitForTimeout(185);
   }
   await page.waitForFunction(()=>!window.__editorTest.facility().occlusion?.roofOwners?.includes(7));
  }
  assert.equal(page.url(),url);
  assert.deepEqual(await inventory(page),kit,'rendering changes no ground pickups');
  assert.deepEqual(await getMap(page),map,'rendering changes no authored objects or collision');
  await unchanged(page);assert.deepEqual(errors,[]);
  console.log(kind,JSON.stringify({active,changed}));
  return active;
 }finally{await ctx.close();}
}
async function otherModes(browser,pixels){
 for(const mode of ['top','third','editor']){
  const {ctx,page,errors}=await setup(browser,'base',outside,{yaw:outside.yaw,top:mode==='top',third:mode==='third'});
  try{
   if(mode==='editor')await page.locator('#poiWalkToggle').tap();
   await clickFade(page,false);const off=await screenshot(page);
   await clickFade(page,true);const on=await screenshot(page);
   assert.ok(!['overhead-wall','overhead-roof'].includes((await stateFade(page))?.kind),mode+' remains outside new rule');
   const changed=await diff(pixels,off,on,null);
   assert.ok(changed.total<=Math.max(20,changed.w*changed.h*.001),mode+' visual unchanged beyond frame noise');
   await unchanged(page);assert.deepEqual(errors,[]);
  }finally{await ctx.close();}
 }
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const pixels=await browser.newPage();await pixels.goto(origin+'/seed');
 const roof=await framePair(browser,pixels,outside,'overhead-roof');
 assert.deepEqual(roof.roofOwners,[outside.roofIndex],'only the blocking gardener roof fades, not cottage behind player');
 const wall=await framePair(browser,pixels,frontage,'overhead-wall');
 assert.equal(wall.wall.owner,frontage.owner);
 assert.ok(wall.wall.cells.filter(c=>c.z===51&&c.y===0).length>=7,'broad complete authored southern wall side fades');
 assert.ok(wall.wall.cells.some(c=>c.x===72&&c.z===51),'opposite extremity of the same façade is beyond the old ±4 tile strip but now fades');
 assert.ok(wall.wall.cells.every(c=>c.z===51),'other walls stay opaque');

 await otherModes(browser,pixels);
 console.log('PASS Chromium: actual exterior roof and connected façade fade, opposed structures and view modes preserved');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
