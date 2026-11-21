import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const old=process.argv[3]?readFileSync(process.argv[3],'utf8'):null;
const noFade=old; // Paired against the exact v147 world when requested.
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url.startsWith('/seed')?'<!doctype html><title>Isolated fixtures</title>':req.url.startsWith('/baseline')?old:req.url.startsWith('/no-fade')?noFade:html);
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
const directions=[[-1,0,'ArrowLeft','w'],[1,0,'ArrowRight','e'],[0,-1,'ArrowUp','n'],[0,1,'ArrowDown','s']];
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
async function route(page,goal,nextFloor,limits,mobileLast=false){
 const start=await pos(page),[gx,gz]=goal;
 const path=await page.evaluate(({goal:[gx,gz],start,limits:[x0,x1,z0,z1]})=>{
  const api=window.__editorTest;
  const stairs=new Set(api.data().world.filter(o=>o.y===start.level&&/^guildStair(?:Up|Down)$/.test(o.type)).map(o=>o.x+','+o.z));
  const dirs=[[-1,0,'ArrowLeft','w'],[1,0,'ArrowRight','e'],[0,-1,'ArrowUp','n'],[0,1,'ArrowDown','s']];
  const key=(x,z)=>x+','+z,first=key(start.x,start.z),last=key(gx,gz);
  const q=[[start.x,start.z]],seen=new Map([[first,null]]);
  for(let i=0;i<q.length&&!seen.has(last);i++){
   const [x,z]=q[i];
   for(const [dx,dz,arrow,tap] of dirs){
    const a=x+dx,b=z+dz,k=key(a,b);
    if(a<x0||a>x1||b<z0||b>z1||seen.has(k)||(stairs.has(k)&&k!==last)||!api.canStep(a,b,x,z))continue;
    seen.set(k,{from:key(x,z),x:a,z:b,arrow,tap});q.push([a,b]);
   }
  }
  if(!seen.has(last))return null;
  const steps=[];for(let k=last;k!==first;k=seen.get(k).from)steps.push(seen.get(k));return steps.reverse();
 },{start,goal,limits});
 assert.ok(path,'no actual collision-valid route from '+JSON.stringify(start)+' to '+goal);
 for(const [i,{arrow,tap,x,z}] of path.entries()){
  const isLast=i===path.length-1;
  if(mobileLast&&isLast)await page.locator('[data-poi-dir="'+tap+'"]').tap();else await page.keyboard.press(arrow);
  const level=isLast?nextFloor:start.level;
  await page.waitForFunction(({x,z,level})=>{const p=window.__editorTest.facility().position;return p.x===x&&p.z===z&&p.level===level;},{x,z,level},{timeout:3000})
   .catch(async e=>{throw new Error('Missed step '+[x,z,level]+' from '+JSON.stringify(await pos(page)),{cause:e});});
  await page.waitForTimeout(185);
 }
}
const paint=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
async function capture(page,label){
 if(!out)return;
 await paint(page);
 await page.screenshot({path:out+'/v148-'+label+'.png'});
}
const view='#view';
const seed={x:108,z:58};
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
  const convert=([x,y,z])=>{
   const w=v[3]*x+v[7]*y+v[11]*z+v[15];
   return [(1+(v[0]*x+v[4]*y+v[8]*z+v[12])/w)/2,(1-(v[1]*x+v[5]*y+v[9]*z+v[13])/w)/2];
  };
  return {hero:convert([108.5,.8,58.5]),loot:convert([107.5,.22,59.5]),
   far:convert([109.5,2.65,56.5]),width:canvas.clientWidth,height:canvas.clientHeight,mat:v};
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
async function realTower(browser,pixels){
 const {ctx,page,errors}=await setup(browser,'base',seed,{yaw:0});
 try{
  const map=await getMap(page),kit=await inventory(page),url=page.url();
  assert.deepEqual(await pos(page),pocket(seed.x,seed.z));
  assert.match(await page.locator('#poiThirdView').textContent(),/俯瞰/);
  assert.ok(map.world.some(o=>o.x===108&&o.z===60&&o.y===0&&o.type==='ruinDoorBroken'),'fixture uses actual outside lookout tower doorway');
  assert.ok(kit.drops.some(d=>d.type==='healingHerb'&&d.x===107&&d.z===59),'actual dropped loot coexists with the character behind wall');
  await clickFade(page,false);const off=await screenshot(page),before=await project(page);
  const counts=await page.evaluate(()=>({...window.__occlusionCounts}));
  await clickFade(page,true);
  await page.waitForFunction(()=>window.__editorTest.facility().occlusion?.kind==='overhead-wall');
  const active=await stateFade(page),on=await screenshot(page),after=await project(page);
  assert.deepEqual(after.mat,before.mat,'fade never shifts angle, aim, camera or zoom');
  assert.ok(active.opacity<=.2,'front run is strongly transparent');
  assert.ok(active.wall.cells.filter(o=>o.z===60).length>=4,'coherent near wall strip, not tiny avatar cutout');
  assert.ok(active.wall.cells.every(o=>o.z===60),'far wall z56 remains opaque and is not submitted to fade pass');
  const changed=await diff(pixels,off,on,after);
  console.log('oblique tower pixels',JSON.stringify(changed));
  assert.ok(changed.total>130&&changed.hero>=12&&changed.loot>=5,'actual WebGL shows through near wall across player and dropped item pixels');
  assert.ok(changed.far<=9,'rear wall sample unchanged in the live frame');
  const updated=await page.evaluate(()=>({...window.__occlusionCounts}));
  assert.equal(updated.largeUploads,counts.largeUploads,'animated wall switches do not upload/bake a fresh city VBO');
  if(out){
   await writeFile(out+'/v148-tower-before.png',off);
   await writeFile(out+'/v148-tower-transparent-wall.png',on);
   await capture(page,'tower-mobile-before-exit');
  }
  await route(page,[108,61],0,[108,108,58,62],true);
  await page.waitForFunction(()=>window.__editorTest.facility().occlusion?.kind!=='overhead-wall');
  assert.equal(page.url(),url);
  assert.deepEqual(await inventory(page),kit,'rendering neither picks up nor modifies ground item');
  assert.deepEqual(await getMap(page),map,'building collisions and authored map are never replaced');
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
async function reverseWall(browser){
 const {ctx,page,errors}=await setup(browser,'base',seed,{yaw:Math.PI});
 try{
  await clickFade(page,true);
  await page.waitForFunction(()=>window.__editorTest.facility().occlusion?.kind==='overhead-wall');
  const o=await stateFade(page);
  assert.ok(o.wall.cells.length>=4&&o.wall.cells.every(c=>c.z===56),'reversed camera selects north run instead of south run');
  await route(page,[108,55],0,[108,108,54,58],true);
  await page.waitForFunction(()=>window.__editorTest.facility().occlusion?.kind!=='overhead-wall');
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
async function otherModes(browser,pixels){
 for(const mode of ['top','third','editor']){
  const {ctx,page,errors}=await setup(browser,'base',seed,{yaw:0,top:mode==='top',third:mode==='third'});
  try{
   if(mode==='editor')await page.locator('#poiWalkToggle').tap();
   await clickFade(page,false);const off=await screenshot(page);
   await clickFade(page,true);const on=await screenshot(page);
   assert.notEqual((await stateFade(page))?.kind,'overhead-wall',mode+' remains outside new rule');
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
 await realTower(browser,pixels);
 await reverseWall(browser);
 await otherModes(browser,pixels);
 console.log('PASS Chromium: oblique-only near wall strongly transparent, visible player/ground item, far wall preserved, exit restore and protected saves');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
