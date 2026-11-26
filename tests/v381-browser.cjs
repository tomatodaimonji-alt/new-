const a=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs'),{createServer}=require('node:http');
let html=fs.readFileSync('world-editor.html','utf8'),marker="if(facilityParams.get('test')==='1')window.__editorTest={";
a.equal(html.split(marker).length,2);
html=html.replace(marker,marker+`
 allyQA:{
  moveTo:workshopResumeRestorePosition,
  step:()=>poiWalkStep(1,0),
  residents:()=>poiTownNpcActors.map(n=>({id:n.role.id,x:n.x,z:n.z,hp:n.hp,activity:n.activity})),
  dialogue:poiTownDialogueSnapshot,
  speech:()=>{const d=poiTownDialogueSnapshot();return {full:d?.text,visible:document.querySelector('#poiMessageLog [data-kind=dialogue]')?.textContent}},
  stats:()=>['equipWoodSpear','equipStick','equipWoodBow'].map(k=>[poiItemDetailWeaponStats(k).reach,poiPlayerWeaponRange(k),poiCompanionMeleeReach({id:k==='equipWoodBow'?'human:frontiersera':'human:frontierren'})]),
  sameSpear:()=>{
   const a=poiTownNpcActors.find(n=>n.role.id==='frontierren'),now=performance.now();
   if(!a)return false;
   const x=a.x+.5,z=a.z+.5,y=frontierWalkSurface(x,z)+.025;
   const resident=poiFrontierResidentSpear(a,now,x,y,z,0,0);
   const member=mesh();poiHumanPartyMesh(member,{id:'human:frontierren'},{x,y,z,heading:0},now);
   return resident.p.length===member.p.length&&resident.p.every((v,i)=>v===member.p[i]);
  },
  route:()=>{const a=poiTownNpcActors.find(n=>n.role.id==='frontierchief');
   return !a?null:{x:a.actorLeg?.x??a.x,z:a.actorLeg?.z??a.z,walking:a.frontierReturning,hasMarker:!!frontierLifeRecord(poiHotbarRead(),a.role.id).returnFrom}},

  party:()=>poiPartyMembers(poiHotbarRead()).map(n=>n.id),
  stageAlly:()=>{
   const id='human:frontierchief',kit=poiHotbarRead(),list=poiHumanPartyDecode(kit.humanParty),r=list.find(n=>n.id===id);
   if(!r)return false;r.hp=78;
   if(!poiEconomyWrite({...kit,humanParty:list}))return false;
   const a=poiPartyActorById(id);if(!a)return false;
   Object.assign(a,{x:52,z:30,px:52.18,pz:30.09,fx:52,fz:30,next:performance.now()+6000,freeGoal:null,freeMoving:false});
   return true;
  },
  collision:()=>{const clip=poiPlayerNpcBodyClip(performance.now());
   if(!clip)return null;
   return {blocked:!poiPlayerNpcCardinalClear(51,30,52,30,clip),
    before:poiFreeAdvance(51,30,1,0,POI_FREE_RADIUS,()=>true,()=>true,clip).x,
    side:poiFreeAdvance(51,30,0,1,POI_FREE_RADIUS,()=>true,()=>true,clip).z}},
  expected:()=>{const n=poiPartyActorById('human:frontierchief');return n&&poiCompanionPosition(n)},
 },
`);
const server=createServer((_,r)=>{r.setHeader('Content-Type','text/html;charset=utf-8');r.end(html)});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true});const errors=[];
 p.setDefaultTimeout(12000);
 p.on('pageerror',e=>{errors.push(e.message);console.log(e.stack)});p.on('console',m=>{if(m.type()==='error')console.log(m.text())});
 const url='http://127.0.0.1:'+server.address().port+'/?test=1';
 const run=(name,...args)=>p.evaluate(([name,args])=>window.__editorTest.allyQA[name](...args),[name,args]);
 const ready=async()=>{await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:35000});await p.waitForFunction(()=>window.__editorTest?.allyQA.residents().some(r=>r.id==='frontierchief'))};
 const menu=id=>p.locator('#poiNpcMenu [data-npc-action="'+id+'"]'),button=p.locator('#poiWalkAction');
 const talk=async()=>{await p.waitForFunction(()=>document.getElementById('poiWalkAction').textContent==='話す');await button.tap()};
 const meet=async()=>{const who=(await run('residents')).find(n=>n.id==='frontierchief');a(who);a(await run('moveTo',{x:who.x+1,z:who.z,y:0,facing:3}));await talk()};
 await p.goto(url,{waitUntil:'domcontentloaded'});await ready();
 a.deepEqual(await run('stats'),[[4,2.4,2.4],[3,1.55,2.4],[6,6,6]]);
 a(await run('sameSpear'),'Ren uses the exact same mesh on both sides of recruitment');
 await meet();await p.waitForFunction(()=>document.getElementById('poiWalkAction').textContent==='決定');await button.tap();
 await meet();const greeting=(await run('speech')).full;
 await menu('request').tap();a.equal((await run('speech')).full,greeting);
 await p.waitForFunction(text=>window.__editorTest.allyQA.speech().visible===text,greeting);
 await menu('recruit').tap();
 a.deepEqual(await run('party'),['human:frontierchief']);
 a(await run('moveTo',{x:51,z:30,y:0,facing:1}));a(await run('stageAlly'));
 const probe=await run('collision');a(probe.blocked&&probe.before>=51.72&&probe.before<=51.82);a(Math.abs(probe.side-31)<1e-7);a(!(await run('step')));
 await p.locator('progress.poiCompanionHealth[aria-label="仲間のロアンのHP"]').waitFor({state:'visible'});
 await talk();a.equal((await run('dialogue')).id,'frontierchief');
 await menu('request').tap();a.equal(await menu('dismiss').textContent(),'仲間から外す');a.equal(await menu('recruit').count(),0);
 await menu('dismiss').tap();
 a.deepEqual(await run('party'),[]);const group=(await run('residents')).filter(n=>n.id==='frontierchief');
 a.equal(group.length,1);a.equal(group[0].hp,78);a(group[0].x>=51,'dismissed actor remains physically at the handoff');
 const at=await run('route');a(at.walking&&at.hasMarker&&at.x>=51.90,JSON.stringify(at));
 a(await run('moveTo',{x:52,z:32,y:0,facing:1}));
 await p.waitForFunction(()=>{const a=window.__editorTest.allyQA.route();return a&&!a.walking&&!a.hasMarker&&a.x===45&&a.z===23},null,{timeout:22000});
 await p.reload({waitUntil:'domcontentloaded'});await ready();
 a.equal((await run('residents')).find(n=>n.id==='frontierchief').hp,78);a.deepEqual(await run('party'),[]);
 a.deepEqual(errors,[]);console.log('PASS shared resident and party spear, three reach grades, retained speech, fractional dismissal and walked home');
}finally{await b?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
