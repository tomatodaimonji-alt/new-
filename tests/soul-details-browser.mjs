import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
let h=readFileSync(process.argv[2]??'world-editor.html','utf8');
const anchor="if(facilityParams.get('test')==='1')window.__editorTest={";
assert.equal(h.split(anchor).length,2);
h=h.replace(anchor,anchor+`
 soulDetailQA:{
  state:()=>({active:poiCompanionActor?.id??null,
    items:poiInventorySlots(poiHotbarRead()).filter(Boolean)}),
  contact:(n)=>poiCompanionHurt(n,performance.now()),
 },
`);
for(const [,js] of h.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(js);
if(process.env.SOUL_DETAIL_SYNTAX_ONLY){console.log('Soul detail native fixture exact anchor/injected syntax');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url==='/seed'?'<title>Soul detail QA</title>':h);
});
await new Promise((r,j)=>server.listen(0,'127.0.0.1',r).once('error',j));
const url='http://127.0.0.1:'+server.address().port;let browser,phase='boot';
const errors=[];
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const ctx=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:1});
 const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
 await p.goto(url+'/seed');
 await p.evaluate(()=>{
  const slots=Array(34).fill(null);
  slots[2]={type:'orvasSoul',count:1,durability:417};
  slots[3]={type:'equipWoodSword',count:1,durability:150};
  slots[9]={type:'slimeSoul',count:1,durability:17};
  localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weaponDurabilityVersion:2,slots,weapon:'equipWoodSword',potions:0,
    companionSoul:{version:1,active:'orvasSoul',pending:null,mode:'follow'}}));
  localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":360000}');
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
    position:{x:24,z:125,y:0,facing:2},townLayout:5,townMapHeight:182,templeDepth:1,
    view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:0,orbitPitch:.12,orbitDistance:6.5}}));
 });
 await p.goto(url+'/?resume=1&test=1',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>window.pineStartup?.ready||window.pineStartup?.failed,null,{timeout:45000,polling:120});
 assert(await p.evaluate(()=>window.pineStartup.ready),JSON.stringify(errors));
 await p.waitForFunction(()=>window.__editorTest?.soulDetailQA.state().active==='orvasSoul',null,{timeout:13000,polling:120});
 const status=()=>p.evaluate(()=>window.__editorTest.soulDetailQA.state());
 const detail=p.locator('#poiItemDetail'),rows=p.locator('#poiItemDetailSoulStats'),arms=p.locator('#poiItemDetailWeaponStats');
 async function assertSoul(name,values){
  await detail.waitFor({state:'visible'});await rows.waitFor({state:'visible'});
  assert.equal(await p.locator('#poiItemDetailName').innerText(),name);
  assert.deepEqual(await rows.locator('dt').allTextContents(),['攻撃','防御','HP']);
  assert.deepEqual(await rows.locator('dd').allTextContents(),values);
  const [a,b,c]=await rows.locator('div').evaluateAll(els=>els.map(el=>({...el.getBoundingClientRect().toJSON()})));
  assert(a.y+a.height<=b.y&&b.y+b.height<=c.y,'stat rows render vertically on this phone viewport');
  assert(!(await arms.isVisible()));
 }
 const back=async()=>{await p.locator('[data-item-detail-action="back"]').tap();await detail.waitFor({state:'hidden'})};
 phase='real hotbar long touch reads active Orvas';
 const slot=p.locator('[data-hotbar-slot="2"]'),r=await slot.boundingBox(),cdp=await ctx.newCDPSession(p);
 const t={x:r.x+r.width/2,y:r.y+r.height/2,id:1};
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[t]});
 await detail.waitFor({state:'visible',timeout:8000});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 assert.equal(await p.locator('#poiBagPanel').isVisible(),false);
 const def='なし（ダメージ軽減なし）';
 await assertSoul('オルヴァスの魂',['28〜47（技による）',def,'417／1050']);
 assert.equal(await p.locator('[data-item-detail-action="use"]').innerText(),'仲間に指示');
 const before=await status();
 assert(await p.evaluate(()=>window.__editorTest.soulDetailQA.contact(16)),
  'isolated external hit from the real companion health pipeline persisted');
 await assertSoul('オルヴァスの魂',['28〜47（技による）',def,'401／1050']);
 const after=await status();
 assert.equal(after.active,before.active);assert.equal(after.items.find(o=>o.type==='orvasSoul').durability,401);
 await back();
 phase='actual bag tap reads distinct inactive slime on narrow portrait';
 await p.setViewportSize({width:390,height:844});await p.locator('#poiBagToggle').tap();
 await p.locator('[data-bag-slot="0"]').tap();
 await assertSoul('スライムの魂',['6',def,'17／36']);
 assert.equal(await p.locator('[data-item-detail-action="use"]').innerText(),'仲間を呼ぶ');
 assert.deepEqual(await status(),after,'viewing this other soul cannot change the active party or token state');
 await back();
 phase='ordinary weapon details retain old stats';
 await p.locator('[data-hotbar-slot="3"]').tap();await detail.waitFor({state:'visible'});
 assert.equal(await rows.isVisible(),false);assert.equal(await arms.isVisible(),true);
 assert((await p.locator('#poiItemDetailAttack').innerText()).length>0);
 assert(!await p.locator('#poiItemDetailSoulHP').textContent());
 assert.deepEqual(errors,[]);
 console.log('Real landscape hotbar long touch, live active Orvas damage update, portrait bag slime and unchanged weapon detail.');
}catch(e){console.error(phase,errors);throw e}
finally{await browser?.close();await new Promise(r=>server.close(r))}
