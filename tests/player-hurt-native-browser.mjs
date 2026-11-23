import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {Script} from 'node:vm';

const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const one=(src,anchor,replace)=>{assert.equal(src.split(anchor).length,2,'fixture seam: '+anchor);return src.replace(anchor,replace)};
const append=(src,anchor,extra)=>one(src,anchor,anchor+extra);
let fixture=append(html,' poiRecordedFoleyCache.set(id,buffer);',`
 if(window.__hurtQA&&(id==='playerHurt'||id==='defeat'))window.__hurtQA.ids.set(buffer,id);
`);
fixture=append(fixture,"function poiPlayImpactBuffer(buffer,when,volume){",`
 if(window.__hurtQA)window.__hurtQA.effects=poiAudioEffects;
`);
fixture=one(fixture,' const p=poiWildPick(rng);',' const p=null;');
fixture=append(fixture,'function poiWildRegionalFrame(now,rng){','if(window.__hurtQA)return;');
fixture=append(fixture,'function poiMobFrame(now){','if(window.__hurtQA)return;');
const hook='  freeMovementPose:()=>({x:poiWalkViewX,z:poiWalkViewZ,level:poiWalkLevel}),';
fixture=append(fixture,hook,`
  playerHurtNativeQA:{
   audioReady:()=>poiAudioContext?.state==='running',
   arm(hp=null){
    const q=window.__hurtQA,now=performance.now();
    poiMonsterStates.clear();poiEnemyCancelPlayer();poiCombatLockReset();
    if(hp!==null)poiPlayerHP=hp;
    const obj={x:poiWalkX+1,z:poiWalkZ,type:'monsterGoblin',y:poiWalkLevel,rot:0},s=poiCombatActorMake(obj);
    if(!poiWalkCanStep(obj.x,obj.z))throw new Error('Goblin fixture must be a clear adjacent tile');
    poiMonsterStates.set(obj,s);poiMonsterMeshDirty=true;
    const started=poiEnemyBeginPlayer(obj,s,now);
    q.attack=s.playerAttack;
    return {started,hp:poiPlayerHP,x:poiWalkX,z:poiWalkZ,windup:s.playerAttack?s.playerAttack.hit-now:null};
   },
   status(){
    const q=window.__hurtQA;
    return {hp:poiPlayerHP,x:poiWalkX,z:poiWalkZ,pending:q.attack?.pending??null,
     defeat:!!poiPlayerDeath,recordings:q.recordings};
   }
  },`);
const scripts=[...fixture.matchAll(/<script(?:\s+([^>]*))?>([\s\S]*?)<\/script>/gi)]
 .filter(([,attrs])=>!attrs||!/\b(?:src|type)\s*=/.test(attrs));
assert(scripts.length>0);
for(const [, ,code] of scripts)new Script(code);
if(process.env.HURT_FIXTURE_LAYOUT_ONLY==='1'){
 console.log('PASS real WebAudio/RAF/regular enemy fixture attaches to '+scripts.length+' exact scripts');
 process.exit(0);
}

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.setHeader('Cache-Control','no-store');
 res.end(req.url==='/seed'?'<!doctype html><title>Hurt native QA</title>':fixture);
});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const root='http://127.0.0.1:'+server.address().port;
let browser,ctx;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required']});
 ctx=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:.75,isMobile:true,hasTouch:true});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(16000);
 await page.addInitScript(()=>{
  const q=window.__hurtQA={ids:new WeakMap(),paths:new WeakMap(),recordings:[]};
  const connect=AudioNode.prototype.connect;
  AudioNode.prototype.connect=function(to,...args){
   const result=connect.call(this,to,...args);q.paths.set(this,to);return result;
  };
  const start=AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start=function(...args){
   const result=start.apply(this,args),b=this.buffer,id=q.ids.get(b);
   if(id){
    const pcm=b.getChannelData(0),amp=pcm.reduce((p,v)=>Math.max(p,Math.abs(v)),0);
    const rms=Math.sqrt(pcm.reduce((sum,v)=>sum+v*v,0)/pcm.length);
    const g=q.paths.get(this);
    q.recordings.push({id,amp,rms,frames:b.length,rate:b.sampleRate,channels:b.numberOfChannels,
      gain:g?.gain?.value??null,effects:q.paths.get(g)===q.effects&&!!q.effects,
      state:this.context.state,when:args[0],current:this.context.currentTime});
   }
   return result;
  };
 });
 await page.goto(root+'/seed');
 await page.evaluate(()=>{
  localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weapon:'equipWoodSword',potions:0,
   worn:{head:null,torso:null,legs:null,feet:null}}));
  localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":330000}');
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:102,z:93,y:0,facing:1},townLayout:5,townMapHeight:128,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 });
 await page.goto(root+'/?resume=1&test=1');
 await page.waitForFunction(()=>window.__editorTest?.facility()?.active&&document.getElementById('pineStartupCover')?.hidden);
 await page.waitForFunction(()=>window.__editorTest.playerHurtNativeQA.audioReady());
 const arm=(hp=null)=>page.evaluate(hp=>window.__editorTest.playerHurtNativeQA.arm(hp),hp);
 const read=()=>page.evaluate(()=>window.__editorTest.playerHurtNativeQA.status());
 const resolved=()=>page.waitForFunction(()=>window.__editorTest.playerHurtNativeQA.status().pending===false);
 let before=await arm();
 assert.deepEqual(before,{started:true,hp:100,x:102,z:93,windup:550});
 assert.deepEqual((await read()).recordings,[],'windup does not prematurely play impact');
 await resolved();
 let s=await read();
 assert.equal(s.hp,90,'real unarmored regular Goblin hit preserves the original ten HP damage');
 assert.deepEqual(s.recordings.map(c=>c.id),['playerHurt'],'one impact reached a native buffer source, not just a branch callback');
 const ordinary=s.recordings[0];
 assert(ordinary.amp>.20&&ordinary.rms>.025&&ordinary.amp<=1,'sample must contain real audible PCM');
 assert.equal(ordinary.frames,4800,'the full 200ms recorded clip was decoded');
 assert.equal(ordinary.rate,24000);assert.equal(ordinary.channels,1);assert.equal(ordinary.state,'running');
 assert(ordinary.effects&&Math.abs(ordinary.gain-.69)<.002,'native recording uses the same effects bus');
 assert(Math.abs(ordinary.when-ordinary.current)<.032,'contact clip is played without an artificial delay');
 before=await arm();
 assert(before.started,'second regular enemy attack committed');
 await page.keyboard.press('ArrowDown');
 await page.waitForFunction(z=>window.__editorTest.playerHurtNativeQA.status().z===z,before.z+1);
 await resolved();
 s=await read();assert.equal(s.hp,90);assert.deepEqual(s.recordings.map(c=>c.id),['playerHurt'],'one-tile native dodge neither hurts nor plays hurt audio');
 assert((await arm(10)).started,'one hit remains for the defeat case');
 await resolved();
 s=await read();assert.equal(s.hp,0);assert(s.defeat);
 assert.deepEqual(s.recordings.map(c=>c.id),['playerHurt','defeat'],'defeat plays its own native transient, not layered hurt audio');
 assert(s.recordings[1].effects);
 assert.deepEqual(errors,[]);
 console.log('PASS real Goblin hit starts exactly one decoded playerHurt on WebAudio effects bus, native dodge silent, ten HP unchanged and defeat distinct');
}finally{await ctx?.close();await browser?.close();await new Promise(r=>server.close(r))}
