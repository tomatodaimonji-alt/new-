import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync} from 'node:fs';
import {Script} from 'node:vm';
let html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const api="if(facilityParams.get('test')==='1')window.__editorTest={";
assert.equal(html.split(api).length,2);
html=html.replace(api,api+`
 squareFieldQA:{
  state:()=>{
   const id=facilitySite.id,g=poiOverlandGlobal(id,poiWalkViewX,poiWalkViewZ),a=poiCompanionActor,k=poiHotbarRead(),f=poiLocalFrame;
   const mask=(x,z)=>{
    const row=poiOverlandGroundDrawn.get(id+':'+(x>>3)+','+(z>>3));
    return !!(row?.[z&7]&(1<<(x&7)));
   };
   const discovered=f?.cells[f.cells.length>>1]??0;if(a)window.__squareAlly??=a;
   return {id,g,x:poiWalkX,z:poiWalkZ,px:poiWalkViewX,pz:poiWalkViewZ,level:poiWalkLevel,
    pointer:poiAnalogContact?.id??null,stream:poiOverlandDrawing,loaded:mask(poiWalkX,poiWalkZ),
    nearPort:mask(85,130),bytes:[...poiOverlandMeshes.values()].reduce((a,m)=>a+m.bytes,0)+(typeof poiOutdoorFarBytes==='number'?poiOutdoorFarBytes:0),
    codes:[validPos(183,183),validPos(184,183),validPos(183,184)],oob:poiWalkCanStep(184,183),
    blackSnow:f&&Math.abs(f.x-72)<=20&&Math.abs(f.z-150)<=20?f.cells[(150-f.crop.z1)*41+71-f.crop.x1]:null,
    visible:discovered,scopes:[...(poiLocalSurveys?.keys()??[])],gl:gl.getError(),ally:a?.id??null,same:a===window.__squareAlly,
    allyMesh:poiCompanionWorldActor===a?poiCompanionMesh?.count??0:0,hpOrvas:k.slots?.[1]?.durability,
    drops:k.drops??[],geld:k.groundGold??[],souls:k.soulDrops??[]};
  },
  drop:()=>[poiInventoryDrop(2),poiGroundGoldDrop(4),poiInventoryDrop(3)],
  water:()=>[poiWalkCanStep(76,127),poiWalkCanStep(78,127),
   world.find(o=>o.x===76&&o.z===127&&o.y===0)?.type]
 },`);
for(const [,s] of html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(s);
if(process.env.SQUARE_FIELD_PARSE_ONLY)process.exit(0);
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const srv=createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end(req.url==='/seed'?'<title>Seed</title>':html)});
await new Promise((ok,no)=>srv.listen(0,'127.0.0.1',ok).once('error',no));
const base='http://127.0.0.1:'+srv.address().port;
let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 function clean(s){assert.equal(s.level,0);assert.equal(s.gl,0);assert(s.bytes<=4*2**20);assert.equal(s.ally,'orvasSoul');assert.equal(s.hpOrvas,377)}
 async function open(site,x,z,yaw){
  const c=await b.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:.65}),p=await c.newPage(),errors=[];
  p.on('pageerror',e=>errors.push(e.message));await p.goto(base+'/seed');
  await p.evaluate(({site,x,z,yaw})=>{
   const slots=Array(27).fill(null);
   slots[0]={type:'equipWoodSword',count:1,durability:150};slots[1]={type:'orvasSoul',count:1,durability:377};
   slots[2]={type:'healingHerb',count:2};slots[3]={type:'slimeSoul',count:1,durability:22};
   localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weapon:null,potions:0,gold:9,weaponDurabilityVersion:2,slots,
    companionSoul:{version:1,active:'orvasSoul',mode:'follow',pending:null}}));
   localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":345000}');
   localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
    ...(site==='snowpass'?{region:site,regionHp:71}:{}),position:{x,z,y:0,facing:2},
    townLayout:5,townMapHeight:182,templeDepth:1,view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,
     top:false,third:true,orbitYaw:yaw,orbitPitch:.14,orbitDistance:6}}));
  },{site,x,z,yaw});
  await p.goto(base+'/?resume=1&test=1',{waitUntil:'domcontentloaded'});
  const ready=async()=>{await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:30000});
   await p.waitForFunction(()=>window.__editorTest?.squareFieldQA&&window.__editorTest?.facility()?.active&&
    window.__editorTest.squareFieldQA.state().ally==='orvasSoul',null,{timeout:14000,polling:55});};
  const read=()=>p.evaluate(()=>window.__editorTest.squareFieldQA.state());
  const until=async pred=>{let s;for(let i=0;i<65;i++){s=await read();if(pred(s))return s;await p.waitForTimeout(90)}
   throw Error(JSON.stringify({s,errors}));};
  const cdp=await c.newCDPSession(p);
  const box=async()=>await p.locator('#poiAnalogPad').boundingBox();
  const hold=async(dy,stop)=>{
   const r=await box(),q={x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2),id:7};
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[q]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...q,y:q.y+dy*34}]});
   try{return await until(s=>s.pointer!==null&&stop(s))}
   finally{await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})}
  };
  const shot=async key=>{const o=process.env.FACILITY_SCREENSHOTS;if(o){mkdirSync(o,{recursive:true});await p.screenshot({path:o+'/'+key+'.png'})}};
  const reload=async()=>{await p.reload({waitUntil:'domcontentloaded'});await ready();return read()};
  await ready();return {c,p,read,until,hold,reload,shot,errors};
 }
 {
  const q=await open('base',85,126,0),s=await q.until(s=>s.nearPort&&s.allyMesh>400);
  assert.deepEqual([s.x,s.z],[85,126]);clean(s);
  assert.deepEqual(await q.p.evaluate(()=>window.__editorTest.squareFieldQA.water()),[false,true,'sea']);
  await q.shot('real-port-water-and-outer-ground');
  const entered=await q.hold(-1,s=>s.z>=131&&s.loaded&&s.visible>0);
  clean(entered);assert(entered.scopes.includes('base:0:outerfield'),JSON.stringify(entered));
  await q.shot('walking-beyond-old-port-edge');
  const cold=await q.reload();assert(cold.z>=128&&cold.visible>0);
  clean(cold);assert.deepEqual(q.errors,[]);await q.c.close();
 }
 {
  const q=await open('base',127,90,-Math.PI/2);
  const entered=await q.hold(1,s=>s.x>=131&&s.loaded);clean(entered);assert.equal(entered.z,90);
  const cold=await q.reload();assert(cold.x>=128&&cold.visible>0);clean(cold);
  await q.shot('past-legacy-max-x');assert.deepEqual(q.errors,[]);await q.c.close();
 }
 {
  const q=await open('base',183,183,-Math.PI/2),s=await q.until(s=>s.loaded&&s.visible>0);
  clean(s);assert.deepEqual([s.x,s.z],[183,183]);assert.deepEqual(s.codes,[true,false,false]);assert.equal(s.oob,false);
  const actions=await q.p.evaluate(()=>window.__editorTest.squareFieldQA.drop());
  assert(actions.every(a=>a.ok),JSON.stringify(actions));
  const dropped=await q.read();
  for(const stack of [dropped.drops,dropped.geld,dropped.souls])
   assert(stack.some(v=>v.x>=179&&v.z>=179&&v.y===0&&!v.region),JSON.stringify(dropped));
  const cold=await q.reload();assert.deepEqual([cold.x,cold.z],[183,183]);clean(cold);
  assert.deepEqual([cold.drops,cold.geld,cold.souls],[dropped.drops,dropped.geld,dropped.souls]);
  await q.shot('exact-square-corner-resume');assert.deepEqual(q.errors,[]);await q.c.close();
 }
 for(const [site,x,z,yaw,dy,to,where] of [['snowpass',22,10,-Math.PI/2,1,'base',s=>s.x>=73],
  ['base',74,149,-Math.PI/2,-1,'snowpass',s=>s.x<=22],
  ['snowpass',12,27,0,-1,'base',s=>s.z>=169],
  ['base',60,169,0,1,'snowpass',s=>s.z<=27]]){
  const q=await open(site,x,z,yaw),s=await q.hold(dy,s=>s.id===to&&where(s)&&s.loaded);
  clean(s);assert(s.pointer!==null&&s.same);const arrived=await q.until(a=>a.allyMesh>400&&a.same);clean(arrived);if(s.id==='base'&&s.blackSnow!==null)assert.equal(s.blackSnow,0);
  const cold=await q.reload();assert.equal(cold.id,to);clean(cold);
  await q.shot(site+'-'+x+'-'+z+'-crossed');assert.deepEqual(q.errors,[]);await q.c.close();
 }
 console.log('Native actual Port and east border walk, 183×183 cold resume and item/coin/soul persistence, both new Snow edges both ways');
}finally{await b?.close();await new Promise(ok=>srv.close(ok))}
