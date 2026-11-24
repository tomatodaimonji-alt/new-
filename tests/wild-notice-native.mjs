import a from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
let h=readFileSync(process.argv[2]??'world-editor.html','utf8');
const api="if(facilityParams.get('test')==='1')window.__editorTest={";
a.equal(h.split(api).length,2);
h=h.replace(api,api+`
  wildNotice:{
   birth:()=>{
    const now=performance.now();
    const draws=[0,0,0,.25,.5];let i=0;
    const rng=()=>draws[Math.min(i++,draws.length-1)];
    let candidates=0;
    for(let z=60;z<=120;z++)for(let x=65;x<=130;x++){
     if(!Array.from({length:10},(_,d)=>poiWildExterior(x+d,z,3)&&
       poiWalkCanStep(x+d,z)&&terrainLevel(x+d,z)===0&&
       (d===0||terrainPassable(x+d-1,z,x+d,z))).every(Boolean))continue;
     poiWalkReset(x,z,0,0,true);
     if(poiWildPick(()=>0)?.x!==x+7)continue;
     candidates++;
     poiFreePose={x:x+.49,z,level:0,angle:0};
     i=0;
     if(poiWildPick(rng)?.x!==x+8)continue;
     i=0;poiWildLastFrame=now-500;poiWildRemaining=100;poiWildSpawnFrame(now,rng);
     const o=[...poiWildActors][0],state=poiMonsterStates.get(o);
     if(!o||!state)continue;
     const born=[o.x,o.z],trace=[];
     poiNextMobTick=0;
     const realRandom=Math.random;
     try{
      Math.random=()=>.5;
      for(let t=now;t<=now+6100;t+=380){
       poiMonsterActorSync(t);poiMobFrame(t);
       trace.push({x:state.x,z:state.z,free:state.actorFree?.x,attack:!!state.playerAttack?.pending});
       if(state.playerAttack?.pending)break;
      }
     }finally{Math.random=realRandom}
     const same=poiMonsterStates.get(o)===state;
     return {hero:[x+.49,z],cell:[x,z],born,draws:i,error:gl.getError(),trace,same};
    }
    return {candidates,active:poiWildActive(),site:facilitySite?.id,level:poiWalkLevel};
   }
  },
`);
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>seed</title>':h)});
await new Promise((r,j)=>server.listen(0,'127.0.0.1',r).once('error',j));const origin='http://127.0.0.1:'+server.address().port;
let b;
try{
 b=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const p=await b.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:.65});
 await p.goto(origin+'/seed');
 await p.evaluate(()=>{
  localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weapon:null,slots:Array(27).fill(null),potions:0}));
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,position:{x:85,z:78,y:0,facing:0},
   townLayout:5,townMapHeight:182,templeDepth:1,view:{yaw:0,zoom:1,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:0,orbitPitch:.24,orbitDistance:6.7}}));
 });
 await p.goto(origin+'/?resume=1&test=1');await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:30000});
 await p.touchscreen.tap(680,170);
 const result=await p.evaluate(()=>window.__editorTest.wildNotice.birth());
 a.equal(result.error,0,JSON.stringify(result));
 a.deepEqual(result.born,[result.cell[0]+8,result.cell[1]]);
 a(Math.hypot(result.born[0]-result.hero[0],result.born[1]-result.hero[1])>6.7);
 a(result.same&&result.trace.some(t=>t.free<result.born[0]-.5),JSON.stringify(result));
 a(result.trace.some(t=>t.attack),JSON.stringify(result));
 console.log(JSON.stringify(result));
}finally{await b?.close();await new Promise(r=>server.close(r))}
