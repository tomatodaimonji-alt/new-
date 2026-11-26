const a=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs'),{createServer}=require('node:http');
const mark="if(facilityParams.get('test')==='1')window.__editorTest={";
let h=fs.readFileSync(process.argv[2]||'world-editor.html','utf8');
a.equal(h.split(mark).length,2);
h=h.replace(mark,mark+`
 qa397:{
  ready:()=>facilitySite?.id==='frontier'&&poiWalkActive&&poiTownNpcActors.some(a=>a.role.id==='frontierchief'),
  trace:(action)=>{
   const id='human:frontierchief',b=facilitySite.buildings.find(q=>q.id==='frontierHouse'),t=performance.now()+220;
   poiTownDialogueClose();poiMonsterStates.clear();
   for(const n of poiTownNpcActors)if(n.role.id!=='frontierchief')n.recessed=true;
   const n=poiTownNpcActors.find(n=>n.role.id==='frontierchief');
   const put=(x,z,facing=2)=>{
    if(!workshopResumeRestorePosition({x,z,y:0,facing}))throw Error('invalid fixture '+x+','+z);
   };
   const moving=(body)=>({x:+body.px?.toFixed(3),z:+body.pz?.toFixed(3)});
   const body=()=>poiPartyActorById(id);
   const samples=[];
   const tick=(x,z,count,when)=>{
    put(x,z);
    for(let i=0;i<count;i++){
     poiCompanionTick(when+i*32);
     const a=body();if(!a)throw Error('party runtime missing');
     if(i%30===0||i===count-1)samples.push({i,where:[x,z],...moving(a),goal:a.freeGoal,leg:a.localDetour?.path?.[0],stall:a.localStallAt,route:a.doorRoute?.phase});
    }
   };
   if(action==='behind')put(46,24,3);else put(45,25,0);
   const recruit=poiHumanPartyRecruit(n,t);
   if(!recruit.ok)throw Error('recruit failed: '+JSON.stringify(recruit));
   const started=moving(body());
   if(action==='brief'){
    tick(46,27,200,t+300);
   }else if(action==='behind'){
    tick(51,30,230,t+300);
   }else{
    tick(46,27,40,t+300);tick(51,30,220,t+1660);
   }
   const end=moving(body());
   const inside=frontierHomeInteriorAt(facilitySite,end.x+.5,end.z+.5)?.id??null;
   return {action,started,end,inside,door:b.door,samples};
  }
 },
`);
const s=createServer((_,r)=>{r.setHeader('Content-Type','text/html;charset=utf-8');r.end(h)});
(async()=>{await new Promise(r=>s.listen(0,'127.0.0.1',r));let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const errors=[],results=[];
 for(const scenario of ['brief','behind','walk']){
  const p=await b.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
  p.on('pageerror',e=>errors.push(String(e.stack)));
  await p.goto('http://127.0.0.1:'+s.address().port+'/?test=1',{waitUntil:'domcontentloaded'});
  await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:35000});
  await p.waitForFunction(()=>window.__editorTest?.qa397.ready());
  const q=await p.evaluate(scenario=>window.__editorTest.qa397.trace(scenario),scenario);console.log(JSON.stringify(q));results.push(q);
  await p.close();
 }
 a.equal(results.some(q=>q.inside||q.end.z<26.72),false,'Roan must cross the real threshold and leave the home');
 a.deepEqual(errors,[]);
 console.log('PASS Roan recruited indoors crosses the real doorway and follows without teleport')
}finally{await b?.close();s.close()}})().catch(e=>{console.error(e);process.exitCode=1});
