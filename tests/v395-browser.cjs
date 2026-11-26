const a=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs'),{createServer}=require('node:http');
const mark="if(facilityParams.get('test')==='1')window.__editorTest={";
let html=fs.readFileSync('world-editor.html','utf8');
a.equal(html.split(mark).length,2);
html=html.replace(mark,mark+`
 qa395:{
  ready:()=>facilitySite?.id==='frontier'&&poiWalkActive&&poiTownNpcActors.some(a=>a.role.id===POI_FRONTIER_SHOP_ID),
  transition:()=>{
   poiMiniUpdate();
   const origin=document.querySelector('#poiLocationName').textContent, panel=document.querySelector('#poiLocationPanel');
   const left=panel.getBoundingClientRect().left, width=panel.getBoundingClientRect().width;
   for(let x=61;x<74;x++){
    if(!poiWalkCanStep(x,30))continue;
    if(poiRegionAt(facilitySite,x,30,pineGameActive,0).name===origin)continue;
    if(!workshopResumeRestorePosition({x,z:30,y:0,facing:1}))continue;
    poiMiniUpdate();
    const party=document.querySelector('#poiPartyCards').getBoundingClientRect();
    return {origin,changed:document.querySelector('#poiLocationName').textContent,left,width,partyRight:party.right,partyTop:party.top};
   }
   throw Error('no new area reached');
  }
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
 await p.waitForFunction(()=>window.__editorTest?.qa395.ready());
 const run=name=>p.evaluate(name=>window.__editorTest.qa395[name](),name);
 const q=await run('transition');a.notEqual(q.origin,q.changed);
 const rect=()=>p.evaluate(()=>{
  const r=document.querySelector('#poiLocationPanel').getBoundingClientRect(),v=document.querySelector('#viewWrap').getBoundingClientRect();
  return {left:r.left,top:r.top,right:r.right,width:r.width,mid:(v.left+v.right)/2,max:v.right};
 });
 const first=await rect();a(first.left>=q.partyRight+4&&first.left<=q.partyRight+20&&first.left<first.mid&&first.right<first.max-70&&first.width>q.width*1.4,JSON.stringify({q,first}));
 await p.waitForFunction(({left,width})=>{const r=document.querySelector('#poiLocationPanel').getBoundingClientRect();return Math.abs(r.left-left)<1&&Math.abs(r.width-width)<1},q);
 a.deepEqual(errors,[]);
 console.log('PASS area notice expands beside the party panel and returns to its exact dock in landscape');
}finally{await b?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
