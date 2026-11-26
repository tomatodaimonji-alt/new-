const a=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs'),{createServer}=require('node:http');
const mark="if(facilityParams.get('test')==='1')window.__editorTest={";
let h=fs.readFileSync('world-editor.html','utf8');a.equal(h.split(mark).length,2);
h=h.replace(mark,mark+`
 qa423:{
  ready:()=>facilitySite?.id==='frontier'&&poiWalkActive&&poiTownNpcActors.some(n=>n.role.id==='frontierregna'),
  audit:()=>{
   const out=['frontierregna','frontiersugimoto','frontiermiyamoto'].map(id=>{
    const n=poiTownNpcActors.find(a=>a.role.id===id),s=poiTownNpcStatus(n),attributes=poiTownAttributes(n);
    return {id,hp:s.hp,max:s.maxHP,rank:s.rank,atk:s.attack,def:s.defense,speed:s.speed,iq:s.intelligence,pace:poiHumanMovementFactor(attributes)};
   });
   const hp=frontierLifeDecode({frontierregna:{hp:130,items:[]}},null,true).frontierregna.hp;
   const party=poiHumanPartyDecode([{id:'human:frontierregna',hp:130,mode:'fight'}],true);
   const guarded=poiTownNpcMaxHp('frontiersugimoto','S');
   const kit=poiHotbarRead();
   const rows=['F','E','D','C','B','A','S'].map(adventureRank=>{
    const t={...kit,adventureRank},stats=poiPlayerAttributes(t);
    return [adventureRank,poiPlayerMaxHp(t),poiPlayerDefense(t),stats.intelligence,stats.speed,poiHumanMovementFactor(stats)];
   });
   return {out,hp,guarded,party,rows};
  },
  seed:()=>{
   const kit=poiHotbarRead(),slots=poiInventorySlots(kit).slice();
   slots[0]={type:'healingHerb',count:2};slots[1]={type:'cannedFood',count:2};
   if(!poiEconomyWrite(poiInventoryEdited({...kit,adventureRank:'S'},slots)))throw Error('seed failed');
   poiEconomyRefresh();poiPlayerHP=600;poiCombatHud();workshopResumeWrite();
  },
  gear:()=>{
   const n=poiTownNpcActors.find(a=>a.role.id==='frontierregna');
   const type='equipMithrilSword',profile=poiPlayerWeaponProfile(type),make=t=>{const m=mesh();deco(m,t,0,0,0,0);return m;};
   const mithril=make(type),iron=make('equipIronSword'),highest=m=>Math.max(...m.p.filter((_,i)=>i%3===1));
   const stance=poiPlayerProfilePose(type,profile.hit);stance.meleeReach=poiWorldMeleePlan(type,profile,profile.hit);
   const model=poiBuildPlayerMesh(type,stance,n.gear,0,0,0,0,0,0,true,'regna');
   const weapon=model.p.slice(-mithril.p.length),tip=mithril.p.findIndex((v,i)=>i%3===1&&v===highest(mithril));
   const pos={x:0,z:0},dir={x:0,z:1};
   return {range:profile.range,ironRange:poiPlayerWeaponRange('equipIronSword'),length:highest(mithril),iron:highest(iron),tipZ:weapon[tip+1],
    strike:poiSwordSweepContains(pos,dir,{x:0,z:2.09},profile.range),miss:poiSwordSweepContains(pos,dir,{x:0,z:2.11},profile.range),
    coat:poiInventoryItemName('armorMithrilTorso'),coatModel:make('armorMithrilTorso').p.length};
  },
  save:()=>workshopResumeWrite(),
  view:()=>({hp:poiPlayerHP,max:poiPlayerMaxHp(),hud:document.getElementById('poiPlayerHpValue').textContent,rank:poiHotbarRead().adventureRank}),
 },
`);
const server=createServer((_,r)=>{r.setHeader('Content-Type','text/html;charset=utf-8');r.end(h)});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true}),errors=[];
 p.on('pageerror',e=>{errors.push(String(e));console.error(e.stack)});
 await p.goto('http://127.0.0.1:'+server.address().port+'/?test=1',{waitUntil:'domcontentloaded'});
 const ready=async()=>{await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:40000});await p.waitForFunction(()=>window.__editorTest?.qa423?.ready(),null,{timeout:30000})};await ready();
 const via=m=>p.evaluate(m=>window.__editorTest.qa423[m](),m);
 const g=await via('gear');console.log('gear',g);
 a.equal(g.coat,'ミスリルの戦衣');a.ok(g.coatModel>1500);a.ok(g.length>g.iron);a.equal(g.range,2.1);a.equal(g.ironRange,2);a.ok(g.strike);a.equal(g.miss,false);
 a.ok(Math.abs(g.tipZ-g.range)<.25,JSON.stringify(g));
 const q=await via('audit');console.log(q);
 a.deepEqual(q.out.map(x=>[x.hp,x.max,x.rank,x.iq]),[[550,550,'B',7],[150,150,'F',1],[170,170,'F',0]]);
 a.equal(q.guarded,1050);a.equal(q.hp,500);a.equal(q.party[0].hp,500);
 a.deepEqual(q.rows.map(r=>r.slice(1,5)),[[100,1,5,1],[160,1,5,1],[250,1,5,1],[380,1,5,1],[550,1,5,2],[750,1,5,3],[1000,1,5,4]]);
 for(const [i,v] of [[0,1],[4,1.05],[5,1.1],[6,1.15]])a.ok(Math.abs(q.rows[i][5]-v)<1e-9);
 await via('seed');
 for(const [slot,hp] of [[0,620],[1,660]]){
  await p.locator('#poiHotbar [data-hotbar-slot="'+slot+'"]').tap();
  await p.waitForFunction(v=>window.__editorTest.qa423.view().hp===v,hp,{timeout:10000});
 }
 a.deepEqual(await via('view'),{hp:660,max:1000,hud:'660/1000',rank:'S'});
 await via('save');
 await p.reload({waitUntil:'domcontentloaded'});await ready();
 a.deepEqual(await via('view'),{hp:660,max:1000,hud:'660/1000',rank:'S'});
 a.deepEqual(errors,[]);console.log('PASS all rank stats, NPC personal HP, legacy migration, high-rank healing and resume');
}finally{await b?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
