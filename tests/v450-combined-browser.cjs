const a=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs'),{createServer}=require('node:http');
const mark="if(facilityParams.get('test')==='1')window.__editorTest={";
let h=fs.readFileSync('world-editor.html','utf8');
a.equal(h.split(mark).length,2);
h=h.replace(mark,mark+`
 qa450:{
  ready:()=>facilitySite?.id==='frontier'&&poiWalkActive&&poiTownNpcActors.length>5,
  hero:(turn)=>{
   poiTownNpcNext=Infinity;poiNextMobTick=Infinity;poiEnemyPending.clear();poiMonsterStates.clear();
   if(!workshopResumeRestorePosition({x:105,z:29,y:0,facing:turn?0:2,cave:false}))throw Error('hero restore');
   poiCameraYaw=0;poiCameraPitch=.24;poiCameraDistance=3.2;poiTownClockGameMs=710*POI_TOWN_MINUTE_MS;
   poiHotbarState={...poiHotbarRead(),weapon:turn?'equipIronSword':null,worn:{head:null,torso:null,legs:null,feet:null}};
   poiWalkAvatar();return {v:poiWalkMesh.count,s:poiTownNpcActors.length,dpr:devicePixelRatio};
  },
  run:()=>{
   poiTownNpcNext=Infinity;poiMonsterStates.clear();poiEnemyPending.clear();
   const boss=FRONTIER_SOUTH_ENEMIES.at(-1),type=boss.type,base=poiMonsterStatsAt(boss).hp;
   const team=FRONTIER_EXPEDITION_NPCS.map(id=>poiTownNpcActors.find(a=>a.role.id===id));
   const fresh=()=>({x:160,z:122,fromX:160,fromZ:122,hp:base,facing:2,moveStarted:-1e6,nextAttack:0});
   const locate=(x,z)=>{
    poiWalkX=x;poiWalkZ=z;poiWalkViewX=x;poiWalkViewZ=z;poiFreePose=null;
   };
   if(!workshopResumeRestorePosition({x:160,z:120,y:-1,facing:2,cave:false}))throw Error('need live boss room');
   poiHotbarState={...poiHotbarRead(),adventureRank:'F',weapon:'equipIronSword',worn:{head:'armorBandana',torso:'armorLeatherTorso',legs:'armorLeatherLegs',feet:'armorLeatherShoes'}};
   const iron=poiPlayerWeaponProfile('equipIronSword').damage,def=poiPlayerDefense();
   const t=performance.now()+1000,st=fresh();poiMonsterStates.set(boss,st);poiPlayerHP=poiPlayerMaxHp();
   const hitOnce=(at,move=null)=>{
    const ok=poiEnemyBeginPlayer(boss,st,at),p=st.playerAttack;
    if(!ok||!p?.southSentinel)throw Error('could not start boss attack '+JSON.stringify({x:poiWalkX,z:poiWalkZ,s:p,at,next:st.nextAttack}));
    if(move)locate(...move);
    poiEnemyResolvePlayer(p.hit);
    return {kind:p.southSentinel.key,damage:p.southSentinel.damage,hp:poiPlayerHP};
   };
   const before=poiPlayerHP,first=hitOnce(t),second=hitOnce(st.nextAttack+10),dead=poiPlayerDying();
   poiPlayerDeathClear();poiEnemyCancelPlayer();poiPlayerHP=poiPlayerMaxHp();
   Object.assign(st,fresh());st.hp=400;locate(160,117);
   const dodge=hitOnce(t+10000,[162,117]),afterSide=poiPlayerHP;
   locate(160,117);
   const line=hitOnce(st.nextAttack+10),afterLine=poiPlayerHP;
   // A controlled B-rank duel with real production attack/armor/contact
   // handlers, but fixed positions so both can attack the entire time.
   poiEnemyCancelPlayer();poiMonsterStates.clear();const mb=fresh();poiMonsterStates.set(boss,mb);
   const H=team.map((p,i)=>{
    const [x,z]=i?[162,119]:[160,120];
    const max=poiTownNpcMaxHp(p.role.id);
    Object.assign(p,{x,z,y:-1,fromX:x,fromZ:z,fromY:-1,hp:max,actorLeg:null,death:null,recessed:false,frontierSkillCast:null,frontierStrike:null});
    return {max,base:poiTownNpcAttackPower(p),def:poiTownNpcDefense(p)};
   });
   const started=t+20000, atk=team.map(()=>started);
   let elapsed=0;
   for(let d=0;d<=45000&&mb.hp>0&&team.every(p=>p.hp>0);d+=40){
    const now=started+d;elapsed=d;
    frontierExpeditionEnemyTurn(boss,mb,now,team[0]);
    for(const [i,p] of team.entries()){
     const profile=poiPlayerActionProfile(p.weapon);
     if(now>=atk[i]&&!p.frontierStrike){
      p.swingAt=now;p.frontierStrike={obj:boss,hit:now+profile.hit,weapon:p.weapon,range:profile.range,profile};
      atk[i]=now+profile.ready;
     }
     frontierNpcStrike(p,now);
    }
   }
   return {iron,def,before,first,second,dead,dodge,afterSide,line,afterLine,duo:{H,elapsed,bossHp:mb.hp,hp:team.map(p=>p.hp)}};
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
 await p.waitForFunction(()=>window.__editorTest?.qa450?.ready(),null,{timeout:40000});
 if(process.env.HERO_SHOTS==='1'){
  for(const turn of [1,0]){
   const t=await p.evaluate(v=>window.__editorTest.qa450.hero(v),turn);a.ok(t.v>1200&&t.s>5);
   await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const jpg=await p.screenshot({type:'jpeg',quality:62,clip:{x:268,y:85,width:308,height:212}});
   console.log((turn?'HERO_FRONT ':'HERO_BACK ')+jpg.toString('base64'));
  }
 }
 const q=await p.evaluate(()=>window.__editorTest.qa450.run());
 console.log('BALANCE '+JSON.stringify(q));a.deepEqual(errors,[]);
 a.equal(q.iron,26);a.equal(q.before,100);a.ok(q.def>1);a.equal(q.first.kind,'cleave');a.ok(q.first.hp<60);
 a.equal(q.second.kind,'pulse');a.ok(q.dead&&q.second.hp===0);
 a.equal(q.dodge.kind,'regent-rune');a.equal(q.afterSide,100);a.equal(q.line.kind,'regent-rune');a.ok(q.afterLine<70);
 a.equal(q.duo.bossHp,0);a.ok(q.duo.elapsed>4000&&q.duo.hp.every(h=>h>0&&h<550));

}finally{if(b)await b.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
