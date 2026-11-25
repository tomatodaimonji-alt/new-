import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
let h=readFileSync(process.argv[2]??'world-editor.html','utf8');
function insert(a,b){assert.equal(h.split(a).length,2);h=h.replace(a,a+b)}
insert('  freeMovementPose:()=>({x:poiWalkViewX,z:poiWalkViewZ,level:poiWalkLevel}),',`
 verifyParty:{
  ready:()=>poiCompanionAllowed(),
  state:()=>{const k=poiHotbarRead();return {
   members:poiPartyMembers(k).map(({id,hp,mode})=>({id,hp,mode})),
   actors:poiPartyActors().map(a=>({id:a.id,x:a.x,z:a.z,y:a.y})),
   hud:[...$('poiPartyCards').querySelectorAll('.poiPartyCard:not([hidden])')].map(x=>x.querySelector('strong').textContent),
   souls:poiInventorySlots(k).slice(0,4).map(c=>c&&[c.type,c.durability]),
   notice:$('poiMessageLog').textContent,npcs:poiTownNpcActors.map(a=>a.role.id)
  }},
  setSouls:()=>{
   const kit=poiHotbarRead(),slots=poiInventorySlots(kit).slice();
   // Retain the authored wooden sword and recovery items; a fixture without
   // sword/chest/drop ownership is intentionally rejected by the game loader.
   for(let i=0;i<4;i++)if(slots[i]){const open=slots.findIndex((x,j)=>j>=9&&!x);if(open<0)throw Error('fixture bag full');slots[open]=slots[i];slots[i]=null;}
   ['slimeSoul','goblinSoul','skeletonSoul','orvasSoul'].forEach((type,i)=>slots[i]={type,count:1,durability:poiCompanionType(type).hp-2});
   if(!poiEconomyWrite(poiInventoryEdited({...kit,goldHotbarSlot:null},slots)))throw Error('save inventory fixture');
   poiEconomyRefresh();
  },
  recruitReady:()=>{
   const a=poiTownNpcActors.find(a=>a.role.id==='resadventurer');
   if(!a)return false;
   const stand=[[0,1,0],[0,-1,2],[-1,0,1],[1,0,3]].map(([dx,dz,facing])=>({x:a.x+dx,z:a.z+dz,y:a.y,facing})).find(q=>poiTownNpcStance(q));
   if(!stand)return false;
   const {x,z,y,facing}=stand;
   poiWalkReset(x,z,y,facing);poiWalkFacing=facing;
   poiWalkX=poiWalkViewX=poiWalkFromX=x;poiWalkZ=poiWalkViewZ=poiWalkFromZ=z;poiWalkLevel=y;
   poiWalkAvatar();poiWalkCamera();poiWalkStatus();
   return true;
  },
  hurt:(id,n)=>poiPartyWith(id,()=>poiCompanionHurt(n,performance.now())),
  modes:()=>poiPartyMembers(poiHotbarRead()).map(x=>[x.id,x.mode]),
  saveRaw:()=>localStorage.getItem(POI_HOTBAR_KEY)
 },`);
for(const [,s] of h.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(s);
if(process.env.PARTY_SYNTAX_ONLY==='1'){console.log('Party test HTML parses');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>party seed</title>':h)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
let browser,page;
const errors=[];
try{
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const c=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:.65,isMobile:true,hasTouch:true,serviceWorkers:'block'});
 await c.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
 page=await c.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/seed');
 await page.evaluate(()=>{
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:45,z:41,y:0,facing:0},townLayout:5,townMapHeight:182,templeDepth:1}));
 });
 const api=(key,...a)=>page.evaluate(([key,a])=>window.__editorTest.verifyParty[key](...a),[key,a]);
 const wait=(f,a)=>page.waitForFunction(f,a,{timeout:20000,polling:60});
 const boot=async()=>{
  await page.goto(origin+'/?resume=1&test=1',{waitUntil:'domcontentloaded'});
  await page.locator('#pineStartupCover').waitFor({state:'hidden',timeout:35000});
  await wait(()=>window.__editorTest.verifyParty.ready());
 };
 await boot();
 await api('setSouls');
 const button=(mode)=>page.locator('#poiCompanionCommands [data-companion-command="'+mode+'"]');
 const slot=(i)=>page.locator('#poiHotbar [data-hotbar-slot="'+i+'"]');
 const summon=async i=>{await slot(i).tap();await button('summon').tap()};
 const waitCount=n=>wait(n=>window.__editorTest.verifyParty.state().members.length===n,n);
 await summon(0);await summon(1);await summon(2);await waitCount(3);
 await wait(()=>window.__editorTest.verifyParty.state().actors.length===3);
 let s=await api('state');assert.equal(s.hud.length,4);assert.equal(new Set(s.actors.map(a=>a.x+','+a.z)).size,3);
 await summon(3);
 await wait(()=>window.__editorTest.verifyParty.state().notice.includes('これ以上召喚できない。'));
 let rejected=await api('state');assert.deepEqual(rejected.members,s.members);assert.deepEqual(rejected.souls,s.souls);
 await slot(1).tap();await button('follow').tap();assert.equal((await api('modes'))[1][1],'follow');
 await slot(2).tap();await button('dismiss').tap();await waitCount(2);
 assert.equal((await api('state')).souls[2][1],43,'returning soul does not recover health');
 assert(await api('recruitReady'));
 await page.locator('#poiWalkAction').tap();
 await page.locator('#poiNpcMenu').getByText('依頼',{exact:true}).tap();
 await page.locator('#poiNpcMenu').getByText('仲間になってほしい',{exact:true}).tap();
 await waitCount(3);
 await wait(()=>window.__editorTest.verifyParty.state().actors.length===3);
 s=await api('state');assert(s.members.some(a=>a.id==='human:resadventurer'));
 assert(!s.npcs.includes('resadventurer'));
 const slime=s.members[0].hp;assert(await api('hurt','slimeSoul',3));s=await api('state');assert.equal(s.members[0].hp,slime-3);
 assert(await api('hurt','human:resadventurer',20));s=await api('state');assert(s.members.find(x=>x.id==='human:resadventurer').hp>0);
 await summon(3);await wait(()=>window.__editorTest.verifyParty.state().notice.includes('これ以上召喚できない。'));
 const raw=JSON.parse(await api('saveRaw'));assert.equal(raw.companionSoul.members.length,2);assert.equal(raw.humanParty[0].id,'human:resadventurer');
 await boot();await waitCount(3);s=await api('state');assert(!s.npcs.includes('resadventurer'));
 const human=page.locator('#poiPartyCards [data-companion="human:resadventurer"]');
 await human.tap();await button('dismiss').tap();await waitCount(2);
 await summon(3);await waitCount(3);
 const final=await api('state');assert(final.members.some(a=>a.id==='orvasSoul'));assert(!final.members.some(a=>a.id.startsWith('human:')));
 assert.deepEqual(errors,[]);
 console.log('PASS native mobile layout, three summons, fourth rejected, mixed recruitment, independent HP, unchanged soul, persistence and removal');
}catch(e){
 console.error('Party integration failure',errors,await page?.evaluate(()=>window.__editorTest?.verifyParty?.state()).catch(()=>null));
 throw e;
}finally{await browser?.close();await new Promise(ok=>server.close(ok))}
