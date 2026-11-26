const a=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs'),{createServer}=require('node:http');
const mark="if(facilityParams.get('test')==='1')window.__editorTest={";
let html=fs.readFileSync('world-editor.html','utf8');
a.equal(html.split(mark).length,2);
html=html.replace(mark,mark+`
 qa387:{
  ready:()=>facilitySite?.id==='frontier'&&poiWalkActive,
  move:(x,z,dx,dz)=>{
   const step=(i,j,g,h)=>poiWalkCanStep(i,j,g,h,undefined,true,true);
   return poiFreeAdvance(x,z,dx,dz,POI_FREE_RADIUS,step,step,frontierMovementClip(null,x,z));
  },
  save:(x,z,subX,subZ)=>{
   const p={x,z,y:0,facing:2,subX,subZ},raw=JSON.stringify({version:1,route:'facility',id:'frontier',play:true,position:p});
   const decoded=workshopResumeDecode(raw)?.position;
   const ok=workshopResumeRestorePosition(decoded);
   return {ok,decoded,point:ok?frontierResumeCoordinates():null};
  },
  speech:()=>{
   const now=performance.now(),actor={role:{id:'fixture'},x:poiWalkX,z:poiWalkZ,fx:poiWalkX,fz:poiWalkZ,y:0};
   frontierLifeLine('fixture',actor,'heal',now);
  },
  audio:()=>{
   const out=[],saved=poiSound,actor={x:poiWalkX,z:poiWalkZ,y:0};
   poiSound=(...args)=>out.push(args.slice(0,2));
   try{
    for(const type of ['equipStick','equipWoodSpear','equipWalkingCane','equipWoodBow']){
     for(const phase of ['ready','release','swing'])poiCompanionWeaponCue(actor,type,phase);
    }
    poiCompanionWeaponCue({...actor,x:actor.x+19},'equipStick','swing');
   }finally{poiSound=saved}
   return out;
  },
  stick:()=>{
   const c=document.createElement('canvas');c.width=112;c.height=96;
   const drawn=drawWallThumbnail(c,'equipStick',{transparent:true,fit:true,rot:0}),data=c.getContext('2d').getImageData(0,0,112,96).data;
   return {drawn,pixels:Array.from(data).filter((v,i)=>i%4===3&&v>200).length,profile:poiPlayerWeaponProfile('equipStick').reachStars};
  },
 },
`);
const server=createServer((_,r)=>{r.setHeader('Content-Type','text/html;charset=utf-8');r.end(html)});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true});const errors=[];
 p.setDefaultTimeout(12000);p.on('pageerror',e=>{errors.push(e.message);console.log(e.stack)});
 await p.goto('http://127.0.0.1:'+server.address().port+'/?test=1',{waitUntil:'domcontentloaded'});
 await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:35000});
 await p.waitForFunction(()=>window.__editorTest?.qa387.ready());
 const run=(name,...args)=>p.evaluate(([name,args])=>window.__editorTest.qa387[name](...args),[name,args]);
 const close=(v,w,near=.003)=>a(Math.abs(v-w)<near,JSON.stringify({v,w}));
 const lane=await run('move',37,21.7,-.89,0);close(lane.x,36.11);
 close((await run('move',lane.x,lane.z,0,1.1)).z,22.8);
 close((await run('move',lane.x,lane.z,-1,0)).x,36.05);
 close((await run('move',38,27,0,-2)).z,25);
 close((await run('move',39,24,-1,0)).x,38.701);
 close((await run('move',41,33,0,1.8)).z,34.8);
 const saved=await run('save',36,22,36.11,21.7);a(saved.ok);close(saved.point.subX,36.11);
 a(!(await run('save',36,22,35.9,21.7)).ok);
 const stick=await run('stick');a(stick.drawn&&stick.pixels>70&&stick.profile===3,JSON.stringify(stick));
 a.deepEqual(await run('audio'),[['attack','equipStick'],['attack','equipWoodSpear'],['attack','equipWalkingCane'],['bow-draw',null],['attack','equipWoodBow']]);
 const theme=await p.evaluate(()=>{
  const bubble=document.createElement('div');bubble.className='frontierLifeLine';document.querySelector('#frontierLifeSpeech').append(bubble);
  const d=getComputedStyle(bubble),s=getComputedStyle(document.querySelector('#poiTownSpeech'));
  return [d.backgroundColor,s.backgroundColor,d.backdropFilter];
 });
 a.equal(theme[0],theme[1]);a.equal(theme[2],'blur(5px)');a.deepEqual(errors,[]);
 console.log('PASS village floor gaps, solid walls and counter, both door orientations, resume position, stick render, shared speech surface and distinct ally weapon cues');
}finally{await b?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
