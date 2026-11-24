import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync} from 'node:fs';
import {Script} from 'node:vm';
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const key="if(facilityParams.get('test')==='1')window.__editorTest={";
assert.equal(html.split(key).length,2);
const fixture=html.replace(key,key+`
 partyHPQA:{
  ready:()=>poiCompanionActor?.id==='orvasSoul',
  injure:()=>{
   const now=performance.now();
   poiMobHitPlayer({type:'monsterSlime'},now,27);
   return poiCompanionHurt(163,now);
  }
 },
`);
for(const [,s] of fixture.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(s);
if(process.env.PARSE_ONLY){console.log('Exact native party HP fixture parses');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>Party</title>':fixture)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
let b,when='startup';
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const dir=process.env.FACILITY_SCREENSHOTS;if(dir)mkdirSync(dir,{recursive:true});
 for(const viewport of [{width:844,height:390},{width:568,height:320},{width:390,height:760}]){
  const ctx=await b.newContext({viewport,deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(25000);
  await p.goto(url+'/seed');
  await p.evaluate(()=>{
   const slots=Array(27).fill(null);slots[5]={type:'orvasSoul',count:1,durability:1050};
   localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weaponDurabilityVersion:2,slots,companionSoul:{version:1,active:'orvasSoul',pending:null}}));
   localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,position:{x:41,z:42,y:0,facing:2},townLayout:5,townMapHeight:180,
    view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:0,orbitPitch:.35,orbitDistance:5.5}}));
  });
  await p.goto(url+'/?resume=1&test=1',{waitUntil:'domcontentloaded',timeout:45000});
  await p.locator('#pineStartupCover').waitFor({state:'hidden'});
  await p.waitForFunction(()=>window.__editorTest?.partyHPQA.ready()&&!document.querySelector('#poiCompanionHud').hidden);
  const snapshot=()=>p.evaluate(()=>{
   const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}};
   const css=(el,keys)=>Object.fromEntries(keys.map(k=>[k,getComputedStyle(el)[k]]));
   const cards=[...document.querySelectorAll('#poiPartyCards .poiPartyCard')].map(c=>{
    const n=c.querySelector('strong'),v=c.querySelector('span'),h=c.querySelector('progress');
    return {name:n.textContent,text:v.textContent,val:h.value,max:h.max,aria:h.getAttribute('aria-label'),fit:v.scrollWidth<=v.clientWidth&&n.scrollWidth<=n.clientWidth,
     card:rect(c),n:rect(n),v:rect(v),h:rect(h),colors:[css(c,['backgroundColor','borderColor','boxShadow','color']),css(h,['accentColor','backgroundColor','borderRadius']),css(v,['fontSize','fontWeight'])],
     ordered:n.compareDocumentPosition(v)&Node.DOCUMENT_POSITION_FOLLOWING&&v.compareDocumentPosition(h)&Node.DOCUMENT_POSITION_FOLLOWING};
   });
   return {cards,mini:rect(document.querySelector('#poiMiniHud')),viewport:[window.innerWidth,window.innerHeight]};
  });
  const verify=async phase=>{
   when=viewport.width+' '+phase;const s=await snapshot(),[x,y]=s.cards;
   assert.equal(s.cards.length,2);assert(x.fit&&y.fit,JSON.stringify(s));
   assert.deepEqual([x.card.w,x.card.h,x.h.w,x.h.h],[y.card.w,y.card.h,y.h.w,y.h.h]);
   assert.deepEqual(x.colors,y.colors);
   assert.equal(x.colors[1].accentColor,'rgb(138, 185, 129)');
   for(const c of s.cards){
    assert(c.ordered&&c.n.bottom<=c.v.y&&c.v.bottom<=c.h.y);
    assert(c.card.x>=0&&c.card.right<=s.viewport[0]&&c.card.bottom<s.viewport[1]);
    const m=s.mini,k=c.card;assert(k.x>=m.right||k.right<=m.x||k.y>=m.bottom||k.bottom<=m.y,'party and minimap must not overlap');
   }
   assert(x.card.bottom<y.card.y);
   assert.equal(x.aria,'プレイヤーのHP');assert.equal(y.aria,'オルヴァスのHP');
   if(viewport.width===844){
    const shot=await p.screenshot({...(dir?{path:dir+'/hp-unified-'+phase+'.png'}:{}),scale:'css'});
    const colors=await p.evaluate(async({png,bars})=>{
     const img=new Image();img.src='data:image/png;base64,'+png;await img.decode();
     const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;
     const g=canvas.getContext('2d');g.drawImage(img,0,0);
     return bars.map(b=>[.24,.94].map(f=>[...g.getImageData(Math.round(b.x+b.w*f),Math.round(b.y+b.h/2),1,1).data].slice(0,3)));
    },{png:shot.toString('base64'),bars:s.cards.map(c=>c.h)});
    const green=([r,g,b])=>g>95&&g>r+15&&g>b+12;
    assert(colors.every(row=>green(row[0])),JSON.stringify(colors));
    if(phase==='full')assert.deepEqual(colors[0],colors[1],'same actual green painted pixels');
    else assert(colors.every(row=>!green(row[1])),'both retain the same dark unfilled track when injured');
   }
   return s.cards.map(q=>[q.text,q.val,q.max,q.card.w,q.card.h]);
  };
  const full=await verify('full');
  assert.deepEqual(full.map(a=>a.slice(0,3)),[['100/100',100,100],['1050/1050',1050,1050]]);
  assert(await p.evaluate(()=>window.__editorTest.partyHPQA.injure()));
  await p.waitForFunction(()=>document.querySelector('#poiCompanionHudHp').value===887);
  const hurt=await verify('hurt');
  assert.deepEqual(hurt.map(a=>a.slice(0,3)),[['73/100',73,100],['887/1050',887,1050]]);
  assert.deepEqual(hurt.map(a=>a.slice(3)),full.map(a=>a.slice(3)));
  assert.deepEqual(errors,[]);console.log(when,JSON.stringify({full,hurt}));await ctx.close();
 }
 console.log('Actual responsive player + companion party HP cards share visual order, dimensions and accessible green meter');
}catch(e){console.error(when);throw e}
finally{await b?.close();await new Promise(r=>server.close(r))}
