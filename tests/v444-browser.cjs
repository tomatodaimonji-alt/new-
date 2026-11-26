const a=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs'),{createServer}=require('node:http');
const mark="if(facilityParams.get('test')==='1')window.__editorTest={";
let h=fs.readFileSync('world-editor.html','utf8');a.equal(h.split(mark).length,2);
h=h.replace(mark,mark+`
  qa444:{
   ready:()=>facilitySite?.id==='frontier'&&poiWalkActive&&poiTownNpcActors.length>5,
   banter:()=>{
    const r=poiTownNpcActors.find(a=>a.role.id==='frontierregna'),l=poiTownNpcActors.find(a=>a.role.id==='frontierlyzel');
    if(!r||!l)throw Error('adventurers not available');
    const start=performance.now();
    if(!workshopResumeRestorePosition({x:r.x+1,z:r.z+2,y:0,facing:0,cave:false}))throw Error('near the pair');
    poiTownAmbientClose();poiTownDialogueClose();poiTownStreetScanAt=0;poiTownStreetNext=0;poiTownStreetLine=0;
    for(const a of [r,l])Object.assign(a,{activity:'visit',moveAt:start-5000,frontierStrike:null,frontierCombat:null,frontierSkillCast:null,actorLeg:null});
    const vp=[.13,0,0,0,0,.16,0,0,0,0,0,0,-(r.x+.5)*.13,-.29,0,1];
    poiTownStreetTry(start,vp);
    const first=poiTownAmbientSnapshot();
    poiTownDialogueDraw(start+2150,vp);
    const second=poiTownAmbientSnapshot();
    frontierLifeLine('frontierregna',r,'herb-ask',start);
    frontierLifeLine('frontierlyzel',l,'herb-gift',start);
    return {first,second,herb:[frontierLifeSpeech.get('frontierregna')?.text,frontierLifeSpeech.get('frontierlyzel')?.text]};
   },
   edges:()=>{
    if(!workshopResumeRestorePosition({x:96,z:-60,y:0,facing:0,cave:false}))throw Error('map north edge restore');
    poiTownClockGameMs=POI_TOWN_MINUTE_MS*12*60;poiThirdPerson=true;poiCameraYaw=Math.PI;poiCameraPitch=.24;poiWalkCamera();
    const p=parameters();
    frontierDrawMapEdgeRocks(p.vp);
    const plan=frontierMapEdgePlan(),castleView=[161,4.92,91],surface=frontierSouthCoveredCamera([161,1.17,85.25],castleView);
    const closed=frontierEdgeCamera([93,1.12,-63.7],[93,3.13,-68]),normal=frontierEdgeCamera([95,1.12,-57],[95,3.13,-60]);
    return {edgeCount:plan.edges.length,meshes:frontierEdgeRockSet.strips.length,
     bounds:frontierEdgeRockSet.strips.some(p=>p.bounds[1]<-1&&p.bounds[4]>=8),
     outsideBlocked:!poiWalkCanStep(96,-65),inside:poiWalkCanStep(96,-64),
     shared:!plan.edges.some(e=>e.x===64&&e.z===0&&e.dz===-1),
     outsideSouthUnchanged:surface===castleView,closed,normal};
   },
   north:()=>{
    if(!workshopResumeRestorePosition({x:96,z:-19,y:0,facing:0,cave:false}))throw Error('north restore');
    poiTownClockGameMs=POI_TOWN_MINUTE_MS*12*60;poiThirdPerson=true;poiCameraYaw=Math.PI/2;
    poiCameraPitch=.47;poiWalkCamera();
    const m=frontierNorthGroundMesh(64,-32);
    return {vertices:m.p.length/3,north:frontierNorthOwn(96,-19),valid:validPos(96,-19),
     standing:poiWalkCanStep(96,-19)};
   }
  },
`);
const server=createServer((_,r)=>{r.setHeader('Content-Type','text/html;charset=utf-8');r.end(h)});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true}),errors=[];
 p.on('pageerror',e=>{errors.push(String(e));console.error(e.stack)});
 await p.goto('http://127.0.0.1:'+server.address().port+'/?test=1',{waitUntil:'domcontentloaded'});
 await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:70000});
 await p.waitForFunction(()=>window.__editorTest?.qa444?.ready(),null,{timeout:40000});
 const q=await p.evaluate(()=>window.__editorTest.qa444.banter());
 console.log('Overhead two-person exchange',q);
 a.equal(q.first?.speaker,'frontierregna');a.match(q.first.text,/遅ぇ/);
 a.equal(q.second?.speaker,'frontierlyzel');a.match(q.second.text,/勝手/);
 a.match(q.herb[0],/ねぇか/);a.match(q.herb[1],/働いて/);
 const meadow=await p.evaluate(()=>window.__editorTest.qa444.north());
 console.log('North meadow mesh count and walkable point',meadow);a.ok(meadow.north&&meadow.valid&&meadow.standing&&meadow.vertices>=6144);
 await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 a.deepEqual(errors,[]);
 const edge=await p.evaluate(()=>window.__editorTest.qa444.edges());
 console.log('Automatic rock perimeter & surface camera',edge);
 a.equal(edge.edgeCount,14);a.ok(edge.meshes>=56&&edge.bounds&&edge.outsideBlocked&&edge.inside&&edge.shared&&edge.outsideSouthUnchanged);
 a.ok(edge.closed[2]>-64&&edge.closed[2]<-63.75);a.deepEqual(edge.normal,[95,3.13,-60]);
 await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 a.deepEqual(errors,[]);
 console.log('VISUAL_CLIFF:'+ (await p.screenshot({type:'jpeg',quality:42})).toString('base64'));
}finally{await b?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
