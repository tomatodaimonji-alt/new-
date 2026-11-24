import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const html=readFileSync(process.argv[2]??'world-editor.html','utf8'),axe='equipNorthMinotaurAxe';
function inject(s,a,b){assert.equal(s.split(a).length,2,a);return s.replace(a,b)}
const api='  freeMovementPose:()=>({x:poiWalkViewX,z:poiWalkViewZ,level:poiWalkLevel}),';
let fixture=inject(html,api,api+`
  cuttingEdgeQA:{
   prepare:()=>{
    const state=[...poiMonsterStates].find(([o])=>o.type==='monsterNorthMinotaur'&&o.x===64&&o.z===13&&o.y===-1)?.[1];
    if(!state||state.hp!==224)throw Error('expected live authored Minotaur');
    window.__cutSweep=[];window.__cutContact=[];window.__axeControlledFrames=true;
    state.northOpenUntil=performance.now()+6000;
   },
   frame:()=>render(),
   status:()=>{
    const state=[...poiMonsterStates].find(([o])=>o.type==='monsterNorthMinotaur'&&o.x===64&&o.z===13&&o.y===-1)?.[1];
    return {now:performance.now(),started:poiWalkActionStarted,ready:poiAttackReady,
     armed:poiEquippedWeapon(),wear:poiInventorySlots(poiHotbarRead()).find(c=>c?.type==='equipNorthMinotaurAxe')?.durability,
     boss:state?.hp,position:{x:poiWalkX,z:poiWalkZ,y:poiWalkLevel},
     sweep:window.__cutSweep??[],contacts:window.__cutContact??[]};
   }
  },
`);
fixture=inject(fixture,' const p=poiWildPick(rng);',' const p=null;');
fixture=inject(fixture,'function poiWildRegionalFrame(now,rng){','function poiWildRegionalFrame(now,rng){return;');
const boss='function poiNorthMinotaurFrame(obj,s,now){';
fixture=inject(fixture,boss,boss+'if(window.__axeIsolate)return false;');
const schedule='function render(){\n if(window.pineStartup.failed)return;\n requestAnimationFrame(render);';
fixture=inject(fixture,schedule,schedule.replace('requestAnimationFrame(render);','if(!window.__axeControlledFrames)requestAnimationFrame(render);'));
const hand='  const prop=mesh();deco(prop,weapon,0,0,0,0);';
fixture=inject(fixture,hand,hand+'\n  const qaFirst=m.p.length;');
const output=`   m.n.push(dx/n,ny/n,dz/n);m.c.push(prop.c[i],prop.c[i+1],prop.c[i+2]);
  }
 }
 return m;
}
function poiWalkAvatar`;
fixture=inject(fixture,output,output.replace('\n }\n return m;',`
  // Read the actual transformed geometry appended to the production
  // avatar buffer, not the supplied rig parameters or its analytic label.
  if(weapon==='equipNorthMinotaurAxe'&&pose?.meleeReach?.arc==='north-player-axe'&&window.__cutSweep){
   const find=(test)=>{const seen=new Set(),p=[];
    for(let i=0;i<prop.p.length;i+=3){
     const v=prop.p.slice(i,i+3),key=v.join(',');
     if(test(...v)&&!seen.has(key)){seen.add(key);p.push(m.p.slice(qaFirst+i,qaFirst+i+3))}
    }
    return p;
   };
   const crest=find((xx,yy,zz)=>xx>.625&&yy>2.3&&Math.abs(zz)<1e-7);
   const shaft=find((xx,yy,zz)=>Math.abs(xx)<.12&&Math.abs(zz)<.12&&yy>2.37&&yy<2.44);
   if(crest.length&&shaft.length){
    const mean=p=>p[0].map((_,i)=>p.reduce((v,pos)=>v+pos[i],0)/p.length);
    const now=performance.now(),at=poiAimAttack?.meleeVisual?.clock;
    window.__cutSweep.push({t:now-poiWalkActionStarted,heading,crest:mean(crest),shaft:mean(shaft),
     actualContact:Number.isFinite(at)&&now-at>=0&&now-at<24,vertices:prop.p.length/3});
   }
  }
 }
 return m;`));
const damage='function poiPlayerDamageTarget(monster,x,z,amount,weapon,now,silent=false,atContact=false,source=null){';
fixture=inject(fixture,damage,damage+`
 if(weapon==='equipNorthMinotaurAxe'&&window.__cutContact)window.__cutContact.push({now,amount,x,z});
`);
if(process.env.AXE_EDGE_LAYOUT_ONLY==='1'){
 for(const [,,script] of [...fixture.matchAll(/<script(?:\s+([^>]*))?>([\s\S]*?)<\/script>/gi)].filter(([,attrs])=>!attrs||!/\b(?:src|type)\s*=/.test(attrs)))new Script(script);
 console.log('PASS exact axe geometry/weapon contact fixture anchors and script parses');process.exit(0);
}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>Seed</title>':fixture)});
await new Promise((r,j)=>server.listen(0,'127.0.0.1',r).once('error',j));
const base='http://127.0.0.1:'+server.address().port;
const read=p=>p.evaluate(()=>window.__editorTest?.cuttingEdgeQA.status());
function facingEdge(sample,before,after){
 const vx=after.shaft[0]-before.shaft[0],vz=after.shaft[2]-before.shaft[2];
 const ex=sample.crest[0]-sample.shaft[0],ez=sample.crest[2]-sample.shaft[2];
 return (vx*ex+vz*ez)/(Math.hypot(vx,vz)*Math.hypot(ex,ez));
}
let browser,stage='launch';
const watchdog=setTimeout(()=>{console.error('axe edge stalled: '+stage);process.exit(1)},100000);
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 for(const [x,z,facing,axis] of [[64,15,0,'north'],[62,13,1,'east']]){
  const ctx=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:.65,isMobile:true,hasTouch:true});
  const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  try{
   stage=axis+' restore a carried reward';
   await p.addInitScript(()=>{window.__axeIsolate=true});
   await p.clock.install({time:new Date('2026-11-24T12:00:00Z')});
   await p.goto(base+'/seed');
   await p.evaluate(({x,z,facing,axe})=>{
    const slots=Array(27).fill(null);
    slots[0]={type:axe,count:1,durability:180};
    // The normal decoder requires one starter sword unless a real broken,
    // stored, or dropped-sword record makes its absence legitimate.
    slots[1]={type:'equipWoodSword',count:1,durability:160};
    localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weapon:null,potions:0,slots,weaponDurabilityVersion:2,northMinotaurAxeAwarded:true}));
    localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":330000}');
    localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
     position:{x,z,y:-1,facing},townLayout:5,townMapHeight:128,
     view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:-1,hideUpper:false,top:false,third:true,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
   },{x,z,facing,axe});
   await p.goto(base+'/?resume=1&test=1');
   await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:16000});
   await p.waitForFunction(()=>window.__editorTest?.facility()?.active&&document.querySelector('#viewWrap')?.hasAttribute('data-analog-play'),null,{polling:30});
   const carried=await read(p);
   assert.equal(carried.armed,null);assert.equal(carried.wear,180,'normal save restores the carried reward');
   await p.locator('#poiHotbar [data-hotbar-slot="0"]').tap();
   assert.equal((await read(p)).armed,axe,'genuine shortcut tap equips the actual reward');
   const wall=await p.evaluate(()=>Date.now());await p.clock.pauseAt(wall+1500);
   await p.evaluate(()=>window.__editorTest.cuttingEdgeQA.prepare());
   const begin=await read(p);
   assert.deepEqual(begin.position,{x,z,y:-1});
   assert.equal(begin.armed,axe);assert.equal(begin.wear,180);assert.equal(begin.boss,224);
   stage=axis+' physical attack';
   const box=await p.locator('#poiWalkAction').boundingBox();assert(box);
   await p.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);
   const tapped=await read(p);assert(tapped.started>begin.started,'real mobile action triggers active axe swing');
   for(let t=0;t<448;t+=16){
    await p.clock.fastForward(16);
    await p.evaluate(()=>window.__editorTest.cuttingEdgeQA.frame());
   }
   const end=await read(p);
   assert.equal(end.boss,190,'the authored, exposed boss takes the same genuine 34 HP hit to the front');
   assert.equal(end.wear,179,'same single attack consumes one point of wear');
   assert.equal(end.contacts.length,1);assert.equal(end.contacts[0].amount,34);
   assert.equal(end.ready-end.started,800,'sweep correction preserves existing cooldown');
   const actual=end.sweep.find(s=>s.actualContact);
   const pre=end.sweep.find(s=>s.t>=235&&s.t<275),post=end.sweep.find(s=>s.t>=385&&s.t<430);
   assert(actual&&pre&&post&&actual.vertices>30,'body mesh renders the actual blade throughout the live contact');
   assert.equal(end.contacts[0].now-end.started>=300,true,'contact never begins before the original fire time');
   const dirs=[pre,actual,post].map(s=>facingEdge(s,pre,post));
   assert(dirs[1]>.45,'at actual hit the sharpened crest leads transverse travel, never the blunt heel: '+JSON.stringify({axis,dirs,pre,actual,post}));
   assert.deepEqual(errors,[]);
   console.log('PASS reward axe travels sharpened-edge first on real '+axis+' touch sweep');
  }catch(e){const latest=await read(p).catch(()=>null);console.error(stage,JSON.stringify(latest&&{...latest,sweep:latest.sweep.slice(-10)}),errors);throw e}
  finally{await ctx.close()}
 }
}finally{await browser?.close();await new Promise(r=>server.close(r));clearTimeout(watchdog)}
