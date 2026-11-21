import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const old=process.argv[3]?readFileSync(process.argv[3],'utf8'):null;
const maskLine=' const mask=poiOcclusionFrame=poiAvatarOcclusion(p,now);';
assert.equal(html.split(maskLine).length,2,'single documented v139 mask anchor');
const noFade=html.replace(maskLine,' const mask=poiOcclusionFrame={active:false};');
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
async function setup(browser,id,start,{townLayout=3,yaw=.24,orbitYaw=Math.PI+.29,third=false,pitch=.52,prefix='/'}={}){
 const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 await ctx.addInitScript(()=>{
  const counts={uploads:0,largeUploads:0,draws:0};
  const proto=WebGLRenderingContext.prototype;
  const data=proto.bufferData,draw=proto.drawArrays;
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
 await page.evaluate(({fixtures,resumeKey,id,start,townLayout,yaw,orbitYaw,third,pitch})=>{
  for(const [k,v] of Object.entries(fixtures))localStorage.setItem(k,v);
  if(start)localStorage.setItem(resumeKey,JSON.stringify({version:1,route:'facility',id,play:true,position:{y:0,facing:0,...start},townLayout,
   view:{yaw,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third,orbitYaw,orbitPitch:pitch,orbitDistance:5.5}}));
 },{fixtures,resumeKey,id,start,townLayout,yaw,orbitYaw,third,pitch});
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
 await page.screenshot({path:out+'/v139-'+label+'.png'});
}
const clip='#view';
const getCounts=page=>page.evaluate(()=>({...window.__occlusionCounts}));
const getOcc=async page=>(await state(page)).occlusion;
const screenshot=page=>page.locator(clip).screenshot({animations:'disabled'});
async function oneStep(page,d,target){
 const arrow={n:'ArrowUp',s:'ArrowDown',e:'ArrowRight',w:'ArrowLeft'}[d];
 await page.keyboard.press(arrow);
 await page.waitForFunction(({x,z})=>{const p=window.__editorTest.facility().position;return p.x===x&&p.z===z;},{x:target[0],z:target[1]});
 await page.waitForTimeout(190);
}
async function roofBoundary(browser){
 for(const [id,outer,door,inward] of [
  ['artisan',[47,30],[47,29],'n'],['townGuild',[34,17],[34,16],'n'],['lodging',[19,0],[19,1],'s']
 ]){
  const {ctx,page,errors}=await setup(browser,'base',{x:outer[0],z:outer[1]});
  try{
   const map=await getMap(page),owner=(await state(page)).buildings.findIndex(b=>b.id===id);
   assert.ok(owner>=0);
   assert.ok(map.world.some(o=>o.x===door[0]&&o.z===door[1]&&o.y===0&&/Door$/.test(o.type)),id+' represents an actual authored exterior door');
   assert.equal((await state(page)).hiddenRoof,null,id+' roof must still show on exterior approach');
   assert.ok((await state(page)).visibleRoofs.includes(owner));
   await oneStep(page,inward,door);
   const inside=await state(page);
   assert.equal(inside.hiddenRoof,owner,id+' cutaway starts on the door tile itself');
   assert.ok(!inside.visibleRoofs.includes(owner)&&inside.visibleRoofs.some(i=>i!==owner),id+' hides only its owned roof');
   await oneStep(page,inward==='n'?'s':'n',outer);
   assert.equal((await state(page)).hiddenRoof,null,id+' restores roof once on the exterior tile');
   assert.ok((await state(page)).visibleRoofs.includes(owner));
   await unchanged(page);assert.deepEqual(errors,[]);
  }finally{await ctx.close();}
 }
}
async function inspect(browser,prefix,mode){
 const seed={x:46,z:28};
 const f=await setup(browser,'base',seed,{prefix,third:true,orbitYaw:Math.PI+.24,pitch:.37});
 try{
  const {page}=f;
  assert.deepEqual(await pos(page),{...seed,level:0});
  const wasThird=await page.locator('#poiThirdView').textContent();
  assert.match(wasThird,/三人称/,'restore the real third-person camera');
  if(mode==='overhead'){
   await page.locator('#poiThirdView').tap();
   assert.match(await page.locator('#poiThirdView').textContent(),/真上/);
  }
  if(mode==='editor')await page.locator('#poiWalkToggle').tap();
  await paint(page);
  const frame=await screenshot(page);
  await paint(page);
  const before=await getCounts(page);
  for(let i=0;i<4;i++)await paint(page);
  const after=await getCounts(page);
  assert.equal(after.largeUploads,before.largeUploads,'steady frames do not rebuild large terrain or roof buffers');
  assert.ok(after.draws>before.draws,'captured genuine running WebGL frames');
  const control=await page.locator('#poiThirdView').textContent();
  const occ=await getOcc(page);
  if(prefix==='/'){
   assert.equal(!!occ?.active,mode==='third','fade pass only in third-person gameplay');
   if(mode==='third')assert.equal(control,wasThird,'the effect does not switch, rotate or recenter camera mode');
  }
  await unchanged(page);assert.deepEqual(f.errors,[]);
  const dims=await page.locator(clip).evaluate(c=>[c.width,c.height]);
  return {frame,occ,dims};
 }finally{await f.ctx.close();}
}
async function pixelCompare(page,left,right,dims,occ=null){
 return page.evaluate(async ({left,right,dims,occ})=>{
  async function load(b64){
   const img=new Image();img.src='data:image/png;base64,'+b64;await img.decode();
   const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;
   const g=c.getContext('2d');g.drawImage(img,0,0);return {w:c.width,h:c.height,data:g.getImageData(0,0,c.width,c.height).data};
  }
  const [a,b]=await Promise.all([load(left),load(right)]);
  if(a.w!==b.w||a.h!==b.h)throw Error('capture size changed');
  const w=a.w,h=a.h;
  const from=occ?[occ.foot[0]*w/dims[0],h-occ.foot[1]*h/dims[1]]:[0,0];
  const to=occ?[occ.head[0]*w/dims[0],h-occ.head[1]*h/dims[1]]:[0,0];
  const radius=occ?occ.radius*Math.max(w/dims[0],h/dims[1]):0;
  let within=0,outside=0,lowerBody=0;
  for(let i=0,p=0;i<a.data.length;i+=4,p++){
   const d=Math.max(Math.abs(a.data[i]-b.data[i]),Math.abs(a.data[i+1]-b.data[i+1]),Math.abs(a.data[i+2]-b.data[i+2]));
   if(d<14)continue;
   if(!occ){outside++;continue;}
   const x=p%w,y=Math.floor(p/w),vx=to[0]-from[0],vy=to[1]-from[1];
   const t=Math.min(1,Math.max(0,((x-from[0])*vx+(y-from[1])*vy)/(vx*vx+vy*vy)));
   if(Math.hypot(x-from[0]-t*vx,y-from[1]-t*vy)<=radius+5){
    within++;
    if(t<.48&&Math.abs(x-(from[0]+t*vx))<radius*.53)lowerBody++;
   }else outside++;
  }
  return {within,outside,lowerBody,w,h,radius};
 },{left:left.toString('base64'),right:right.toString('base64'),dims,occ});
}
async function eastGate(browser){
 const {ctx,page,errors}=await setup(browser,'base',{x:61,z:45});
 try{
  const map=await getMap(page);
  assert.ok(map.world.some(o=>o.x===62&&o.z===45&&o.y===0&&o.type==='poiFortGate'&&o.rot===3),'actual rotated stone gate');
  await oneStep(page,'e',[62,45]);
  await oneStep(page,'n',[62,44]);
  await page.keyboard.press('ArrowUp');
  assert.deepEqual(await pos(page),{x:62,z:44,level:0},'north gate shoulder walkable but adjoining side solid');
  await oneStep(page,'s',[62,45]);
  await oneStep(page,'s',[62,46]);
  await page.keyboard.press('ArrowDown');
  assert.deepEqual(await pos(page),{x:62,z:46,level:0},'south gate shoulder walkable but adjoining side solid');
  await oneStep(page,'n',[62,45]);
  await oneStep(page,'e',[63,45]);
  await oneStep(page,'e',[64,45]);
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
 if(out){
  const preview=await setup(browser,'base',{x:64,z:45},{third:true,orbitYaw:1.5*Math.PI-.24,pitch:.26});
  try{await capture(preview.page,'east-stone-gate-exterior');assert.deepEqual(preview.errors,[]);}
  finally{await preview.ctx.close();}
 }
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await roofBoundary(browser);
 await eastGate(browser);
 const pixels=await browser.newPage();await pixels.goto(origin+'/seed');
 for(const mode of ['third','overhead','editor']){
  const baseline=await inspect(browser,'/no-fade',mode),candidate=await inspect(browser,'/',mode);
  const delta=await pixelCompare(pixels,baseline.frame,candidate.frame,candidate.dims,mode==='third'?candidate.occ:null);
  console.log(mode,JSON.stringify(delta));
  if(mode==='third'){
   assert.ok(delta.within>=40&&delta.lowerBody>=12,'native canvas reveals the previously blocked lower-body capsule');
   assert.ok(delta.outside<=Math.max(40,delta.within*.12),'effect remains local to projected avatar rather than fading all walls');
   if(out){
    await writeFile(out+'/v139-artisan-avatar-mask-off.png',baseline.frame);
    if(old)await writeFile(out+'/v138-artisan-avatar-before.png',(await inspect(browser,'/baseline','third')).frame);
    await writeFile(out+'/v139-artisan-avatar-after.png',candidate.frame);
   }
  }else if(mode==='editor'){
   assert.ok(delta.outside<=delta.w*delta.h*.003,'editor canvas unchanged, not showing fade');
  }else{
   assert.ok(delta.outside<=delta.w*delta.h*.003,'overhead canvas unchanged away from the door workaround');
  }
 }
 console.log('PASS real WebGL artisan before/after local mask, untouched overhead/editor, stable GPU cache, exact boundary roof behavior and saves');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
