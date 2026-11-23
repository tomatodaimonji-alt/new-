import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
const html=readFileSync(process.argv[2]||'world-editor.html','utf8');
const anchor='function poiEnemyCancelPlayer(){';
assert.equal(html.split(anchor).length,2);
const resolveAnchor='  if(!timely||!covered||poiWalkLevel!==a.y||';
const hitAnchor='function poiMobHitPlayer(obj,now){';
const damageAnchor=" poiPlayerHP=Math.max(0,poiPlayerHP-amount);poiSound('hurt');";
assert.equal(html.split(damageAnchor).length,2);
assert.equal(html.split(resolveAnchor).length,2);
assert.equal(html.split(hitAnchor).length,2);
const fixture=html.replace(' const p=poiWildPick(rng);',' const p=null;')
 .replace(resolveAnchor,"  if(__angleQA?.p===a.obj)__angleQA.resolutions.push({start:a.start,hit:a.hit,now,timely,covered,x:poiWalkX,z:poiWalkZ,level:poiWalkLevel});\n"+resolveAnchor)
 .replace(hitAnchor,hitAnchor+"\n if(__angleQA?.p===obj)__angleQA.contacts.push({at:now,prior:poiPlayerHP,after:null});")
 .replace(damageAnchor,damageAnchor+"\n if(__angleQA?.p===obj)__angleQA.contacts.at(-1).after=poiPlayerHP;")
 .replace("if(typeof poiWildRegionalFrame==='function')poiWildRegionalFrame(now,rng);",'')
 .replace(anchor,`
let __angleQA=null;
window.__putDiagonalSlime=()=>{
 for(const [dx,dz] of [[1,1],[-1,1],[1,-1],[-1,-1]]){
  const x=poiWalkX+dx,z=poiWalkZ+dz,p={x,z,y:poiWalkLevel,type:'monsterSlime',rot:0};
  if(!poiWalkCanStep(x,z)||!poiEnemyAdjacent(p,p,poiWalkX,poiWalkZ))continue;
  const s=poiCombatActorMake(p);
  poiMonsterStates.set(p,s);__angleQA={p,s,contacts:[],resolutions:[]};poiMonsterMeshDirty=true;
  return {x,z};
 }
 return null;
};
window.__enemyAngleState=()=>{
 const {p,s}=__angleQA;
 const a=s.playerAttack;
 return {attack:a?{angular:a.angular,dx:a.dx,dz:a.dz,sx:a.sx,sz:a.sz,tiles:a.tiles,pending:a.pending,hit:a.hit,hitAt:a.visualHitAt}:null,
  x:s.x,z:s.z,hp:poiPlayerHP,next:s.nextAttack,contacts:__angleQA.contacts,resolutions:__angleQA.resolutions};
};
`+anchor);
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<!doctype html><title>Fixture</title>':fixture);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:640,height:390},deviceScaleFactor:.65,hasTouch:true});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(16000);
 await page.goto(origin+'/seed');
 await page.evaluate(()=>{
  localStorage.setItem('world-workshop-hotbar-v1','{"version":1,"weapon":null,"potions":2,"gold":18,"claimedCaches":["glade"],"armor":{"head":null,"body":null,"legs":null,"feet":null}}');
  localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":330000}');
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:102,z:93,y:0,facing:0},townLayout:5,townMapHeight:128,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 });
 await page.goto(origin+'/?resume=1&test=1');
 await page.waitForFunction(()=>window.__editorTest?.facility()?.active);
 const spawn=await page.evaluate(()=>window.__putDiagonalSlime());
 assert(spawn,'legal diagonal lane on the authored walkable outside map');
 await page.waitForFunction(()=>window.__enemyAngleState().attack?.angular===true);
 const begin=await page.evaluate(()=>window.__enemyAngleState());
 assert.equal(begin.attack.sx,spawn.x);assert.equal(begin.attack.sz,spawn.z);
 assert(Math.abs(Math.abs(begin.attack.dx)-Math.SQRT1_2)<.001&&Math.abs(Math.abs(begin.attack.dz)-Math.SQRT1_2)<.001);
 assert.deepEqual(begin.attack.tiles,[{x:102,z:93}]);
 // CI SwiftShader can skip the original 170ms contact validity window.
 // Let the real idle player take a later naturally scheduled attempt if
 // that happens. A timely but uncovered attack is never accepted.
 await page.waitForFunction(()=>{
  const q=window.__enemyAngleState();
  return q.contacts.length||q.resolutions.some(v=>v.timely&&!v.covered);
 },undefined,{timeout:9000}).catch(async cause=>{
  throw new Error('Missing live diagonal contact: '+JSON.stringify({state:await page.evaluate(()=>window.__enemyAngleState()),errors}),{cause});
 });
 const first=await page.evaluate(()=>window.__enemyAngleState());
 assert.equal(first.contacts.length,1,JSON.stringify(first));
 const contact=first.contacts[0],res=first.resolutions.at(-1);
 assert(res.timely&&res.covered,JSON.stringify(first));
 assert.equal(res.now,contact.at);
 assert(contact.prior-contact.after>=1&&contact.prior-contact.after<=6,JSON.stringify(first));
 assert.equal(first.hp,contact.after);
 assert.equal(first.next-first.attack.hitAt,1500);
 await page.waitForTimeout(650);
 const after=await page.evaluate(()=>window.__enemyAngleState());
 assert.equal(after.hp,first.hp,'no extra diagonal contact during the compatible cooldown');
 assert.equal(after.contacts.length,1);
 assert.deepEqual([after.x,after.z],[spawn.x,spawn.z],'slime keeps its committed position during recovery');
 assert.deepEqual(errors,[]);
 console.log('PASS native ordinary monster attacks from a legal diagonal, hits once and retains slime recovery');
 await context.close();
}finally{await browser?.close();await new Promise(r=>server.close(r))}
