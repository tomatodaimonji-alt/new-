import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url.startsWith('/seed')?'<!doctype html><title>Isolated fixtures</title>':html);
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
 const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:.8,isMobile:true,hasTouch:true});
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
 await page.screenshot({path:out+'/v160-'+label+'.png'});
}
const view='#view';
const pocket=(x,z)=>({x,z,level:0});
const stateFade=async page=>(await state(page)).occlusion;
const screenshot=page=>page.locator(view).screenshot({animations:'disabled'});
const clickFade=async(page,value)=>{
 await page.evaluate(value=>window.__editorTest.setUpperStoreyFade(value),value);
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
   far:convert([38.5,1.25,22.45]),mat:v};
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


const rear={x:41,z:22,yaw:.18};
function nearInn(occlusion){
 return Boolean(occlusion?.storey?.cells?.some(c=>c.owner==='lodging'&&c.y===1));
}
async function rearInn(browser,pixels){
 const {ctx,page,errors}=await setup(browser,'base',rear,{yaw:rear.yaw});
 try{
  const map=await getMap(page),kit=await inventory(page),url=page.url();
  assert.deepEqual(await pos(page),pocket(rear.x,rear.z));
  assert.ok(map.world.some(o=>o.x===41&&o.z===23&&o.y===0&&o.type==='plasterwallDoor'),'real north lodging door');
  assert.match(await page.locator('#poiThirdView').textContent(),/俯瞰/);
  await clickFade(page,false);
  const opaque=await screenshot(page),prior=await project(page),oldOcclusion=await stateFade(page);
  const uploads=await page.evaluate(()=>window.__occlusionCounts.largeUploads);
  await clickFade(page,true);
  await page.waitForFunction(()=>{
   const o=window.__editorTest.facility().occlusion;
   return o?.storey?.cells?.some(c=>c.owner==='lodging'&&c.y===1);
  });
  const cut=await stateFade(page);
  assert.ok(nearInn(cut)&&cut.opacity<=.2&&cut.spans.length,'real inn upper wall participates in transparent scene ranges');
  assert.ok(cut.storey.cells.every(c=>c.y>=1&&c.owner==='lodging'&&c.x>=36&&c.x<=47&&c.z>=23&&c.z<=33),
   'only the lodging upstairs changes; ground-floor structure stays untouched');
  assert.deepEqual(cut.roofOwners??[],oldOcclusion?.roofOwners??[],'existing roof visibility does not change with new upper layer fade');
  const visible=await screenshot(page),current=await project(page);
  assert.deepEqual(current.mat,prior.mat,'no camera aim/zoom changes when revealing the player');
  const changed=await diff(pixels,opaque,visible,current);
  assert.ok(changed.hero>=7&&changed.total>=70,'real WebGL pixels change over the missing avatar: '+JSON.stringify(changed));
  assert.ok(changed.far<=10,'nearby fort wall is unaffected');
  assert.equal(await page.evaluate(()=>window.__occlusionCounts.largeUploads),uploads,'changing fade alone does not upload a new static map');
  if(out){
   await writeFile(out+'/v160-behind-inn-opaque.png',opaque);
   await writeFile(out+'/v160-behind-inn-revealed.png',visible);
   await capture(page,'behind-inn-390');
  }
  const connected=await page.evaluate(()=>{
   const api=window.__editorTest;
   return api.canStep(42,22,41,22)&&!api.canStep(41,21,41,22);
  });
  assert.ok(connected,'existing passage and fort boundary rules retained');
  await page.locator('[data-poi-dir="e"]').tap();
  await page.waitForFunction(()=>window.__editorTest.facility().position.x===42);
  await page.locator('#poiThirdView').tap();
  await page.waitForFunction(()=>/三人称/.test(document.querySelector('#poiThirdView').textContent)&&!window.__editorTest.facility().occlusion?.storey);
  assert.equal(nearInn(await stateFade(page)),false,'new rule is angled-view only');
  await page.locator('#poiThirdView').tap();
  await page.waitForFunction(()=>/真上/.test(document.querySelector('#poiThirdView').textContent)&&!window.__editorTest.facility().occlusion?.storey);
  assert.equal(nearInn(await stateFade(page)),false,'true top view unchanged');
  assert.equal(page.url(),url);
  assert.deepEqual(await inventory(page),kit);
  assert.deepEqual(await getMap(page),map);
  await unchanged(page);assert.deepEqual(errors,[]);
  console.log('behind inn WebGL result',JSON.stringify({changed,upperWalls:cut.storey.cells.filter(c=>c.y===1).length,roofOwners:cut.roofOwners}));
 }finally{await ctx.close();}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const pixels=await browser.newPage();await pixels.goto(origin+'/seed');
 await rearInn(browser,pixels);
 console.log('PASS 390px Chromium: real inn rear upper floor cutaway reveals avatar, nearby structure and other modes preserved');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
