import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const h=readFileSync(process.argv[2]??'world-editor.html','utf8');
const extract=(a,b)=>{const i=h.indexOf(a),j=h.indexOf(b,i+1);assert(i>=0&&j>i);return h.slice(i,j)};
const starter=vm.runInNewContext(extract('function pineStarterGuildPOI(', 'function pineSupermarketPOI(')+'\npineStarterGuildPOI();world',
 {world:[],models:[],prefabs:[],terrainHeights:new Map(),MAP_W:30,MAP_H:30,
  level:0,hideUpper:false,selected:'wall',mode:'move',rotation:0,
  $:()=>({classList:{remove(){}}}),snapshot(){},commit(){},poiWalkReset(){},refreshPalette(){},updateStats(){},
  updateSelected(){},showEntireMap(){},toast(){},confirm:()=>true});
const save=(world)=>({format:'forest-world-v1',version:1,width:30,height:30,size:30,terrainHeights:[],models:[],prefabs:[],
 checks:[],world});
const main=save([{type:'woodwall',x:5,y:0,z:5,rot:0}]);
const canonical=save([...starter.map(o=>({...o})),{type:'crate',x:16,z:18,y:0,rot:2}]); // Prove we used the actual saved POI, not fallback.
const stored={
 'forest-world-editor-v1':JSON.stringify(main,null,2),
 'world-workshop-pois-v1':JSON.stringify([{id:'poi-adventurers-guild-v102',name:'冒険者ギルド',map:canonical}],null,2),
 'world-workshop-adventure-v1':'{"preserve":"adventure"}',
 'pine-guild-screenshot-before-v86':JSON.stringify(save(starter),null,2)
};
const server=createServer((req,res)=>{res.setHeader('content-type','text/html; charset=utf-8');res.end(req.url.startsWith('/seed')?'<!doctype html><title>Seeds</title>':h)});
await new Promise((res,rej)=>server.listen(0,'127.0.0.1',res).once('error',rej));
const origin='http://127.0.0.1:'+server.address().port, out=process.env.FACILITY_SCREENSHOTS;
if(out)await mkdir(out,{recursive:true});
const key=(x,z)=>x+','+z;
const directions=[[-1,0,'ArrowLeft'],[1,0,'ArrowRight'],[0,-1,'ArrowUp'],[0,1,'ArrowDown']];
const state=page=>page.evaluate(()=>window.__editorTest.facility());
const getSave=page=>page.evaluate(()=>window.__editorTest.data());
const captureStorage=page=>page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),Object.keys(stored));
async function go(page,map,xz,nextFloor){
 const {position:start}=await state(page),[destX,destZ]=xz;
 const pass=new Set(await page.evaluate(()=>{
  const r=[];for(let z=0;z<30;z++)for(let x=0;x<30;x++)if(window.__editorTest.canStep(x,z))r.push(x+','+z);
  return r;
 }));
 const stairs=new Set(map.world.filter(o=>o.y===start.level&&/^guildStair(?:Up|Down)$/.test(o.type)).map(o=>key(o.x,o.z)));
 const same=key(start.x,start.z),goal=key(destX,destZ);
 const queue=[[start.x,start.z]],prev=new Map([[same,null]]);
 for(let i=0;i<queue.length&&!prev.has(goal);i++)for(const [dx,dz,arrow] of directions){
  const [x,z]=queue[i],nx=x+dx,nz=z+dz,k=key(nx,nz);
  if(prev.has(k)||!pass.has(k)||(stairs.has(k)&&k!==goal))continue;
  prev.set(k,{before:key(x,z),arrow,coords:[nx,nz]});queue.push([nx,nz]);
 }
 assert(prev.has(goal),'No route from '+same+' to '+goal+' at floor '+start.level);
 const steps=[];for(let k=goal;k!==same;k=prev.get(k).before)steps.push(prev.get(k));
 steps.reverse();
 for(const [i,{arrow,coords:[x,z]}] of steps.entries()){
  await page.keyboard.press(arrow);
  assert.deepEqual((await state(page)).position,{x,z,level:i===steps.length-1&&nextFloor!==undefined?nextFloor:start.level});
  await page.waitForTimeout(185);
 }
}
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1210,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/seed');
 await page.evaluate(f=>{for(const [k,v] of Object.entries(f))localStorage.setItem(k,v)},stored);
 await page.goto(origin+'/?facility-return=1&test=1');
 await page.locator('#poiSampleCategories .categoryRow').click();
 await page.locator('#guildRenewalPreview').click();
 await page.waitForURL(u=>u.searchParams.get('facility')==='guildrenewal');
 const first=await state(page);
 assert.equal(first.id,'guildrenewal');assert.equal(first.active,false);
 assert.equal(first.guildRenewalSource,'saved');
 const map=await getSave(page);
 const protectedTile=o=>![1,2].includes(o.y)||o.x<=7||o.x>=22||o.z<=6||o.z>=20;
 assert.deepEqual(map.world.filter(protectedTile),canonical.world.filter(protectedTile),'ground floor/outer walls/roof/source data');
 assert(map.world.some(o=>o.x===14&&o.z===9&&o.y===2&&o.type==='poiLedgerPapers'));
 assert.deepEqual(await captureStorage(page),stored,'preview must never replace or reformat the actual saved world');
 await page.locator('#poiWalkToggle').click();
 assert((await state(page)).roofMeshes.some(c=>c>0));
 await go(page,map,[8,18],1);
 assert.deepEqual((await state(page)).visibleLayers,[0,1],'2F gallery should look into 1F, not see the new 3F deck');
 assert.equal(await page.evaluate(()=>window.__editorTest.canStep(14,13)),false,'cannot walk into real atrium void');
 await go(page,map,[10,9]);
 if(out)await page.screenshot({path:out+'/guild-2f-gallery.png'});
 await go(page,map,[19,17],2);
 await go(page,map,[14,15]);
 await go(page,map,[14,14]);
 await go(page,map,[14,12]);
 if(out)await page.screenshot({path:out+'/guild-3f-office.png'});
 assert.deepEqual(await captureStorage(page),stored);
 await page.locator('#facilityExit').click();
 await page.waitForURL(u=>u.searchParams.get('facility-return')==='1');
 assert.deepEqual(await captureStorage(page),stored);
 const another=await browser.newPage({viewport:{width:1000,height:760}});
 another.on('pageerror',e=>errors.push(e.message));
 await another.goto(origin+'/?facility=guildrenewal&test=1');
 assert.equal((await state(another)).guildRenewalSource,'sample');
 assert.match(await another.locator('#facilitySessionName').textContent(),/標準見本/);
 assert.equal((await captureStorage(another))['world-workshop-pois-v1'],null,'sample creates no stored POI');
 assert.deepEqual(errors,[]);
 console.log('PASS: cloned saved guild, walked both staircases, real atrium and office, exact storage isolation.');
}finally{
 await browser?.close();await new Promise(res=>server.close(res));
}
