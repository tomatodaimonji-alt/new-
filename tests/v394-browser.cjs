const a=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs'),{createServer}=require('node:http');
const mark="if(facilityParams.get('test')==='1')window.__editorTest={";
let html=fs.readFileSync(process.argv[2]||'world-editor.html','utf8');
a.equal(html.split(mark).length,2);
html=html.replace(mark,mark+`
 qa394:{
  ready:()=>facilitySite?.id==='frontier'&&poiWalkActive&&poiTownNpcActors.some(a=>a.role.id===POI_FRONTIER_SHOP_ID),
  panels:()=>{
   const n=poiTownNpcActors.find(a=>a.role.id===POI_FRONTIER_SHOP_ID);
   const inspect=(type)=>{
    poiItemDetailRenderEquipment({type,count:1});poiItemDetailRenderWeaponStats(type);poiItemDetailRenderSoulStats({type,count:1});
    const ids=['SpeedModifier','IntelligenceModifier','WeaponSpeed','SoulSpeed','SoulIntelligence'];
    return Object.fromEntries(ids.map(k=>[k,document.querySelector('#poiItemDetail'+k).textContent]));
   };
   poiBagSetOpen(true);
   const bag=['Speed','Intelligence'].map(k=>document.querySelector('#poiBagPlayer'+k+'Value').textContent);
   const stats=poiNpcStatusView(n);
   return {bag,npc:[...stats.children].map(x=>x.textContent),boots:inspect('armorLeatherShoes'),pen:inspect('equipBallpointPen'),soul:inspect('slimeSoul')};
  },
  battle:()=>{
   poiTownNpcActors.forEach(n=>n.recessed=true);poiMonsterStates.clear();
   if(!workshopResumeRestorePosition({x:45,z:30,y:0,facing:1}))throw Error('invalid fight fixture');
   const start=performance.now()+1000;
   const make=(type='monsterSlime')=>{
    poiMonsterStates.clear();const o={x:46,z:30,y:0,type,rot:0},s=poiCombatActorMake(o);
    s.hp=500;s.nextAttack=start+9000;poiMonsterStates.set(o,s);return [o,s];
   };
   const melee=(type,t)=>{
    const k=poiHotbarRead(),slots=poiInventorySlots(k).map(c=>c?.type===type?null:c);
    slots[0]={type,count:1,durability:poiEquipmentDurabilityMax(type)};
    if(!poiEconomyWrite(poiInventoryEdited({...k,weapon:type},slots))||poiEquippedWeapon()!==type)throw Error('could not equip '+type);
    const [o,s]=make(),p=poiPlayerActionProfile(type),started=poiPlayerStartProfile(type,t);
    poiPlayerWeaponFrame(t+p.hit-1);const before=s.hp;
    poiPlayerWeaponFrame(t+p.hit);const after=s.hp;
    return {before,after,started,hit:p.hit,ready:poiAttackReady-t};
   };
   const pen=melee('equipBallpointPen',start),spear=melee('equipWoodSpear',start+2000);
   const [o,s]=make('monsterGoblin'),roll=Math.random;
   let hp=[],ally;
   Math.random=()=>0;
   try{
    for(const [weapon,t] of [['equipBallpointPen',0],['equipBallpointPen',1500],['equipWoodSpear',3000]]){
     poiPlayerDamageTarget([o,s],o.x,o.z,10,weapon,start+t,true,false,{started:start+t});hp.push(s.hp);
    }
    const actor={x:45.14,z:30,y:0,id:'human:frontiershopkeeper',px:45.14,pz:30};
    const [m,state]=make(),target={o:m,s:state,until:start+5100};
    const began=poiCompanionCommit(actor,target,start+4500);
    poiCompanionResolve(actor,start+4590,'fight');
    ally={began,after:state.hp,next:actor.nextHit-(start+4500)};
   }finally{Math.random=roll}
   return {pen,spear,hp,ally,lanes:poiDamageLabels.map(x=>x.value)};
  }
 },
`);
const server=createServer((_,r)=>{r.setHeader('Content-Type','text/html;charset=utf-8');r.end(html)});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let b;
try{
 b=await chromium.launch({headless:true,executablePath:process.env.POI_CHROMIUM, args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true});const errors=[];
 p.setDefaultTimeout(12000);p.on('pageerror',e=>{errors.push(e.message);console.log(e.stack)});
 await p.goto('http://127.0.0.1:'+server.address().port+'/?test=1',{waitUntil:'domcontentloaded'});
 await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:35000});
 await p.waitForFunction(()=>window.__editorTest?.qa394.ready());
 const run=key=>p.evaluate(key=>window.__editorTest.qa394[key](),key);
 const x=await run('panels');console.log(x);
 a(x.bag.every(r=>r.length===10));
 a.deepEqual(x.npc.filter((_,i)=>i%2===0),['名前','職業','HP','攻撃','防御','速度','知能']);
 a.equal(x.boots.SpeedModifier,'+1');a.equal(x.boots.IntelligenceModifier,'0');a.equal(x.pen.WeaponSpeed,'★★★★★★★☆☆☆');
 a.equal(x.soul.SoulIntelligence,'★☆☆☆☆☆☆☆☆☆');
 await p.reload({waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>window.__editorTest?.qa394.ready());
 const q=await run('battle');console.log(q);
 a(q.pen.started&&q.spear.started);
 a(q.pen.hit<q.spear.hit&&q.pen.ready<q.spear.ready);
 a.deepEqual([q.pen.before,q.pen.after,q.spear.before,q.spear.after],[500,488,500,482]);
 a.deepEqual(q.hp,[490,490,480]);a(q.lanes.includes('回避'));
 a(q.ally.began&&q.ally.after<500&&q.ally.next===q.pen.ready);
 a.deepEqual(errors,[]);
 console.log('PASS landscape actor panels, real melee contacts, shared party timing and learned dodge');
}finally{await b?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
