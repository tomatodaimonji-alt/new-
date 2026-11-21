import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const server=createServer((req,res)=>{
 res.setHeader('content-type','text/html; charset=utf-8');
 res.end(req.url.startsWith('/seed')?'<!doctype html><title>Test fixtures</title>':html);
});
await new Promise((yes,no)=>server.listen(0,'127.0.0.1',yes).once('error',no));
const origin='http://127.0.0.1:'+server.address().port;
const key='world-workshop-pois-v1',backup='world-workshop-guild-duplicates-v105';
const current='poi-adventurers-guild-v102';
const map=(x,type='stonewall')=>({format:'forest-world-v1',version:1,width:30,height:30,size:30,world:[{x,y:0,z:2,type,rot:0}],terrainHeights:[],models:[],prefabs:[]});
const primary={id:'poi-guild-primary-v87',name:'ギルド',map:map(1)};
const canonical={id:current,name:'冒険者ギルド',map:map(6)};
const extra={id:'poi-example-stable',name:'自作の施設',map:map(7)};
const records=Array.from({length:4},(_,i)=>({id:'poi-guild-earlier-'+i,name:'冒険者ギルド',map:map(i+2,'woodwall')}));
const serialization=JSON.stringify([primary,...records,canonical,extra],null,2);
const guarded={
 'forest-world-editor-v1':JSON.stringify(map(20),null,2),
 'world-workshop-adventure-v1':'{"version":1,"x":23,"z":22,"monsters":[]}',
 'pine-adventurers-guild-poi-before-v102':'{"doNotTouch":true}'
};
let browser;
const state=(p,k)=>p.evaluate(key=>localStorage.getItem(key),k);
const set=(p,k,v)=>p.evaluate(([key,value])=>localStorage.setItem(key,value),[k,v]);
async function seed(value=serialization){
 const p=await browser.newPage({viewport:{width:1100,height:750}});
 p.setDefaultTimeout(5000);
 await p.goto(origin+'/seed');
 await p.evaluate(f=>{Object.entries(f).forEach(([k,v])=>localStorage.setItem(k,v));},{[key]:value,...guarded});
 return p;
}
async function preserved(p){for(const [k,v] of Object.entries(guarded))assert.equal(await state(p,k),v,k+' changed');}
try{
 browser=await chromium.launch({...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const page=await seed();
 const errs=[];page.on('pageerror',e=>errs.push(e.message));
 await page.goto(origin+'/?test=1');
 assert((await page.evaluate(()=>window.__editorTest?.state()))?.glLink,'WebGL init');
 const active=JSON.parse(await state(page,key));
 assert.deepEqual(active,[primary,canonical,extra],'the canonical and unrelated POIs must remain byte-equivalent');
 const backed=JSON.parse(await state(page,backup));
 assert.deepEqual(backed,{version:1,records});
 await preserved(page);
 await page.locator('#poiSampleCategories .categoryRow').click();
 const lists=await page.locator('#poiSampleCategories .poiSampleEntry >span:nth-child(2)').allTextContents();
 assert.equal(lists.filter(v=>v.startsWith('冒険者ギルド')).length,1);
 assert.equal(lists.filter(v=>v.startsWith('ギルド')).length,1);
 assert.equal(await page.locator('[data-facility-id]').count(),8);
 const archives=page.locator('#poiDuplicateBackups');
 assert(await archives.isVisible());
 await archives.locator('summary').click();
 for(let i=0;i<records.length;i++){
  const [download]=await Promise.all([page.waitForEvent('download'),archives.locator('[data-poi-duplicate-index="'+i+'"]').click()]);
  assert.match(download.suggestedFilename(),/^adventurers-guild-duplicate-\d+\.json$/);
  assert.deepEqual(JSON.parse(readFileSync(await download.path(),'utf8')),records[i].map);
 }
 await page.reload();await preserved(page);
 assert.deepEqual(JSON.parse(await state(page,key)),active);
 assert.deepEqual(JSON.parse(await state(page,backup)),backed);
 assert.deepEqual(errs,[]);
 console.log('PASS: 5 same-name entries become one, full recoverable JSON downloads, unchanged independent saves and idempotent reload');
 const fail=await seed();
 await fail.addInitScript(name=>{
  const original=Storage.prototype.setItem;
  Storage.prototype.setItem=function(k,v){if(k===name)throw new DOMException('Test quota failure','QuotaExceededError');return original.call(this,k,v);};
 },backup);
 await fail.goto(origin+'/?test=1');
 assert.equal(await state(fail,key),serialization);
 assert.equal(await state(fail,backup),null);
 await preserved(fail);
 console.log('PASS: failing backup cannot delete or rewrite any active POIs');
 const preview=await seed();
 await preview.goto(origin+'/?facility=base&test=1');
 assert.equal(await state(preview,key),serialization);
 assert.equal(await state(preview,backup),null);
 await preview.locator('#facilityExit').click();
 await preview.waitForURL(url=>url.searchParams.has('facility-return'));
 assert.equal(await state(preview,key),serialization);
 assert.equal(await state(preview,backup),null);
 await preserved(preview);
 console.log('PASS: preview and its return route never migrate saved POIs');
 const malformed=await seed(JSON.stringify([primary,...records,canonical,{unexpected:true}],null,2));
 const raw=await state(malformed,key);
 await malformed.goto(origin+'/?test=1');
 assert.equal(await state(malformed,key),raw);
 assert.equal(await state(malformed,backup),null);
 await preserved(malformed);
 console.log('PASS: malformed primary list is never rewritten');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
