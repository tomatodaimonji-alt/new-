import a from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
let html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const anchor='  freeMovementPose:()=>({x:poiWalkViewX,z:poiWalkViewZ,level:poiWalkLevel}),';
a.equal(html.split(anchor).length,2);
html=html.replace(anchor,anchor+`
  deepTempleQA:()=>{
   const t=facilitySite?.davidTemple,s=poiDavidActive?.s,p={x:poiWalkX,z:poiWalkZ,y:poiWalkLevel};
   const ri=facilitySite?.buildings?.findIndex(v=>v.id==='davidTemple');
   return {p:[p.x,p.z,p.y],movingUntil:poiWalkNextReady,now:performance.now(),map:[MAP_W,MAP_H],
    tunnel:poiDavidTempleTunnelAt(facilitySite,p.x,p.z,p.y),inside:poiDavidTempleEnclosedAt(facilitySite,p.x,p.z,p.y),
    arena:t?poiDavidIn(t.boss,p):false,roof:facilityVisibleRoofs().includes(ri),
    discovered:!!poiHotbarRead().sacredTempleSeen,boss:t?[t.boss.x,t.boss.z]:null,awake:!!s?.david?.awake,
    wakeReady:typeof poiDavidBattleActive==='function'&&poiDavidBattleActive(performance.now()),
    save:JSON.parse(localStorage.getItem(WORKSHOP_RESUME_KEY)||'null'),
    threshold:t?.threshold,alive:poiPlayerHP>0};
  },
`);
for(const [,js] of html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(js);
if(process.env.DEEP_TEMPLE_PARSE_ONLY){console.log('Deep temple browser test parses exact production injection');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('content-type','text/html;charset=utf-8');res.end(req.url==='/seed'?'<title>Temple QA</title>':html)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url='http://127.0.0.1:'+server.address().port;
let browser,p,where;
const errors=[];
const state=()=>p.evaluate(()=>window.__editorTest.deepTempleQA());
const wait=(fn,arg)=>p.waitForFunction(fn,arg,{polling:35,timeout:16000});
const cover=()=>p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:21000});
async function init(x,z,newDepth){
 if(p)await p.context().close();
 p=await browser.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:.74});
 p.on('pageerror',e=>errors.push(e.message));
 await p.goto(url+'/seed');
 await p.evaluate(({x,z,newDepth})=>localStorage.setItem('world-workshop-resume-v1',JSON.stringify({
  version:1,route:'facility',id:'base',play:true,townLayout:5,townMapHeight:newDepth?182:128,...(newDepth?{templeDepth:1}:{}),
  position:{x,z,y:0,facing:2},view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:0,orbitPitch:.35,orbitDistance:5.5}
 })),{x,z,newDepth});
 await p.goto(url+'/?resume=1&test=1',{waitUntil:'domcontentloaded'});await cover();
 await wait(()=>!!window.__editorTest?.deepTempleQA);
 return state();
}
async function step(expected,key='ArrowDown'){
 await p.keyboard.press(key);
 await wait(z=>{const q=window.__editorTest.deepTempleQA();return q.p[0]===24&&q.p[1]===z&&q.now>=q.movingUntil},expected);
 return state();
}
try{
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 where='far roof from real safe town side';let s=await init(45,41,true);a.deepEqual(s.p,[45,41,0]);a.equal(s.roof,false);
 a(s.map[1]>=182);a.deepEqual(s.boss,[24,158]);a.equal(s.discovered,false);
 where='legacy real chamber save migrates once to new forecourt';s=await init(24,104,false);
 a.deepEqual(s.p,[24,125,0]);a(s.roof);a(!s.tunnel&&!s.inside&&!s.awake);a.equal(s.save.templeDepth,1);
 where='continuous real path through north mouth, covered tunnel and distant new boss room';
 for(let z=126;z<=142;z++){
  s=await step(z);
  a(s.alive&&s.roof);
  a.equal(s.tunnel,z>=128&&z<142);a.equal(s.inside,z>=128);
  a.equal(s.arena,z===142);a.equal(s.awake,false);
  if(z>=128)a.equal(s.discovered,true);
 }
 for(let z=143;z<156;z++){s=await step(z);a(!s.awake,'boss cannot wake well before center');}
 s=await step(156);await wait(()=>window.__editorTest.deepTempleQA().awake);a.deepEqual(s.boss,[24,158]);
 where='record real depth save beyond original map and reopen';await p.reload({waitUntil:'domcontentloaded'});await cover();
 await wait(()=>!!window.__editorTest?.deepTempleQA);
 s=await state();a.deepEqual(s.p,[24,156,0]);a(s.discovered&&s.save.templeDepth===1);a.deepEqual(errors,[]);
 console.log('Actual open-world save migration; dark covered walk without load to wide arena; boss remains asleep until near its true centre.');
}catch(e){console.error(where,await state().catch(()=>null),errors);throw e}
finally{await browser?.close();await new Promise(r=>server.close(r))}
