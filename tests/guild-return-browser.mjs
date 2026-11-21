import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html');
const server=createServer((q,r)=>{r.setHeader('Content-Type','text/html; charset=utf-8');r.end(q.url.startsWith('/seed')?'<!doctype html>':html)});
await new Promise((done,fail)=>server.on('error',fail).listen(0,'127.0.0.1',done));
const root='http://127.0.0.1:'+server.address().port;
const id='poi-adventurers-guild-v102',name='冒険者ギルド';
const poi='world-workshop-pois-v1',editor='forest-world-editor-v1',old='pine-adventurers-guild-poi-before-v102',
 archive='world-workshop-guild-duplicates-v105',resume='world-workshop-resume-v1';
const map=(x,t='woodfloor')=>({format:'forest-world-v1',version:1,width:30,height:30,size:30,world:[{x,z:7,y:0,type:t,rot:2}],models:[],prefabs:[],checks:[],terrainHeights:[]});
const record=(x)=>({id,name,map:map(x)});
const unrelated={id:'poi-other-keep',name:'他のPOI',map:map(19,'stonewall')};
const basic={[editor]:JSON.stringify(map(22,'stonewall'),null,2),'world-workshop-adventure-v1':JSON.stringify({version:1,x:16,z:9,monsters:[]},null,2)};
const state=page=>page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).sort()));
const data=page=>page.evaluate(()=>window.__editorTest.data());
const heading=page=>page.locator('#poiSampleCategories .categoryRow');
async function gallery(page){
 if(!await page.locator('#palette').isVisible())await page.locator('#showPalette').click();
 if(!await page.locator('[data-guild-original]').count())await heading(page).click();
 assert.equal(await page.locator('[data-guild-original]').count(),1);
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--no-sandbox','--disable-dev-shm-usage']});
 async function run(stored,route='/?editor=1&test=1&facility-return=1',viewport={width:1200,height:850}){
  const page=await browser.newPage({viewport});await page.goto(root+'/seed');
  await page.evaluate(seed=>{for(const [k,v] of Object.entries(seed))localStorage.setItem(k,v)},{...basic,...stored});
  await page.goto(root+route);await page.waitForFunction(()=>window.__editorTest?.data);
  await gallery(page);return page;
 }
 async function open(page,kind,expected){
  const before=await state(page);
  await page.locator('[data-guild-original]').click();
  await page.waitForFunction(k=>window.__editorTest?.facility?.().id==='guildsaved'&&window.__editorTest.facility().guildRenewalSource===k,kind);
  if(expected)assert.deepEqual((await data(page)).world,expected.world,'preview must use exact saved placement');
  assert.deepEqual(await state(page),before,'preview did not change any stored value');
  const button=page.locator('#facilityExit');
  if(await button.count()){
   if(!await button.isVisible())await page.locator('#showPalette').click();
   await button.click();
  }else await page.goBack();
  await page.waitForFunction(()=>window.__editorTest?.data);
  await page.waitForTimeout(550);
  assert.deepEqual(await state(page),before,'return/resume must not change any saved value');
 }
 const active=await run({[poi]:JSON.stringify([unrelated,record(4)],null,2),[old]:JSON.stringify(record(5))});
 assert.match(await active.locator('[data-guild-original]').innerText(),/保存済みギルド/);
 assert.equal(await active.locator('[data-guild-original-restore]').count(),0);
 await open(active,'saved',map(4));await active.close();

 const inFacility=await run({[poi]:JSON.stringify([record(6)],null,2)},'/?facility=kitchen&test=1',{width:412,height:838});
 assert.match(await inFacility.locator('[data-guild-original]').innerText(),/保存済みギルド/);
 await open(inFacility,'saved',map(6));await inFacility.close();

 const backed=await run({[poi]:JSON.stringify([unrelated],null,2),[archive]:JSON.stringify({version:1,records:[record(7)]})});
 assert.match(await backed.locator('[data-guild-original]').innerText(),/バックアップ/);
 await open(backed,'backup',map(7));await gallery(backed);
 const previous=await state(backed);
 backed.once('dialog',d=>d.dismiss());
 await backed.locator('[data-guild-original-restore]').click();
 assert.deepEqual(await state(backed),previous);
 backed.once('dialog',d=>d.accept());
 await backed.locator('[data-guild-original-restore]').click();
 const next=await state(backed),{[poi]:current,...rest}=next,{[poi]:previousPOI,...priorRest}=previous;
 assert.deepEqual(JSON.parse(previousPOI),[unrelated]);
 assert.deepEqual(JSON.parse(current),[unrelated,record(7)]);
 assert.deepEqual(rest,priorRest);
 assert.equal(await backed.locator('[data-guild-original-restore]').count(),0);
 await backed.close();

 const fallback=await run({});
 assert.match(await fallback.locator('[data-guild-original]').innerText(),/標準見本/);
 assert.equal(await fallback.locator('[data-guild-original-restore]').count(),0);
 await open(fallback,'sample',null);await fallback.close();

 const invalid=await run({[poi]:'[{"broken":true}]',[old]:JSON.stringify(record(9))});
 assert.equal(await invalid.locator('[data-guild-original-restore]').count(),0);
 await open(invalid,'backup',map(9));await invalid.close();
 console.log('Guild gallery: exact original, mobile facility entry, archive preview/explicit restore, fallback, and byte-exact storage verified.');
}finally{
 await browser?.close();await new Promise(yes=>server.close(yes));
}
