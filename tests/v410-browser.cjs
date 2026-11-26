const a=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs'),{createServer}=require('node:http');
const mark="if(facilityParams.get('test')==='1')window.__editorTest={";
let h=fs.readFileSync('world-editor.html','utf8');a.equal(h.split(mark).length,2);
h=h.replace(mark,mark+`
 qa410:{
  ready:()=>facilitySite?.id==='frontier'&&poiWalkActive&&poiTownNpcActors.some(a=>a.role.id==='frontiersugimoto'),
  clock:(hour)=>{poiTownClockGameMs=hour*60*POI_TOWN_MINUTE_MS},
  details:()=>{
   const g=poiTownNpcGraph(),home=facilitySite.buildings.find(b=>b.id==='frontierWatchHouse'),guards=poiTownNpcActors.filter(a=>FRONTIER_GUARD_STATS[a.role.id]);
   const plants=world.filter(o=>o.x<64&&o.type==='bushFern');
   return {guards:guards.map(a=>({id:a.role.id,status:poiTownNpcStatus(a),base:poiTownNpcAttackPower({...a,weapon:null}),post:[a.role.public.x,a.role.public.z],
     home:[a.role.home.x,a.role.home.z],bed:[a.role.bed.x,a.role.bed.z],
     valid:poiTownNpcStance(a.role.home,g)&&poiTownNpcStance(a.role.public,g),x:a.x,z:a.z,activity:a.activity})),
     beds:home.furniture.filter(f=>f[3]==='bed').length,
     plants:plants.filter(o=>poiWalkCanStep(o.x,o.z,null,null,null,true,true,false)).map(o=>[o.x,o.z]),
     gearMeshes:['armorKnitCap','armorMilitaryCap','armorLeatherTorso','equipIronSpear'].map(id=>{const m=mesh();deco(m,id,0,0,0);return m.p.length}),
     gl:gl.getError()};
  },
  bedtime:()=>{
   const id='frontiermiyamoto',g=poiTownNpcActors.find(a=>a.role.id===id);
   const p=g.role.home,now=performance.now();
   if(!workshopResumeRestorePosition({x:p.x,z:p.z,y:0,facing:2,cave:false}))throw Error('bedside placement rejected');
   const target=poiTownDialogueTarget(now)?.role.id;
   const speak=poiTownDialogueAction(now),zzz=poiTownDialogueSnapshot();
   const next=poiTownDialogueAction(now+3),topic=poiTownDialogueSnapshot();
   poiNpcMenuChoose('request',now+4);const menu=poiTownDialogueSnapshot();
   poiNpcMenuChoose('recruit',now+5);
   const invitation=poiTownDialogueSnapshot();
   poiTownDialogueAction(now+6);
   return {target,speak,zzz,next,topic,menu,invitation,party:poiHumanPartyMembers(poiHotbarRead()).map(x=>[x.id,x.hp,x.maxHp])};
  },
  party:()=>poiHumanPartyMembers(poiHotbarRead()).map(x=>[x.id,x.hp,x.maxHp]),
 },
`);
const server=createServer((_,r)=>{r.setHeader('Content-Type','text/html;charset=utf-8');r.end(h)});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true}); const e=[];
 p.on('pageerror',err=>{e.push(String(err));console.error(err.stack)});
 await p.goto('http://127.0.0.1:'+server.address().port+'/?test=1',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>window.__editorTest?.qa410?.ready(),{},{timeout:60000});
 const state=()=>p.evaluate(()=>window.__editorTest.qa410.details());
 const s=await state(); console.log(JSON.stringify(s)); a.equal(s.beds,2); a.equal(s.gl,0); a.ok(s.plants.length>=3); a.ok(s.gearMeshes.every(x=>x>20)); a.equal(s.guards.length,2);
 for(const [i,g] of s.guards.entries()){a.ok(g.valid);a.deepEqual([g.status.hp,g.status.maxHP,g.base,g.status.intelligence,g.status.speed],i?[170,170,3,0,2]:[150,150,5,1,2]);a.equal(g.status.weapon,'equipIronSpear');}
 await p.evaluate(()=>window.__editorTest.qa410.clock(21));
 await p.waitForFunction(()=>window.__editorTest.qa410.details().guards.every(g=>g.activity==='watch'&&g.x===g.post[0]&&g.z===g.post[1]),{},{timeout:40000,polling:600});
 await p.evaluate(()=>window.__editorTest.qa410.clock(10));
 await p.waitForFunction(()=>window.__editorTest.qa410.details().guards.every(g=>g.activity==='sleep-home'&&g.x===g.home[0]&&g.z===g.home[1]),{},{timeout:40000,polling:600});
 const v=await p.evaluate(()=>window.__editorTest.qa410.bedtime()); console.log(JSON.stringify(v));
 a.equal(v.target,'frontiermiyamoto');a.equal(v.zzz.text,'ZZZ…');a.match(v.topic.text,/遺跡/);a.ok(v.menu.actions.some(x=>x.id==='recruit'));a.deepEqual(v.party,[['human:frontiermiyamoto',170,170]]);
 await p.reload({waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.__editorTest?.qa410?.ready(),{},{timeout:60000});
 a.deepEqual(await p.evaluate(()=>window.__editorTest.qa410.party()),[['human:frontiermiyamoto',170,170]]); a.deepEqual(e,[]);
 console.log('real browser: beds, night walk, dialogue, recruit+reload, passable ferns and equipment meshes');
}finally{await b?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
