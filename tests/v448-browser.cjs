const a=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs'),{createServer}=require('node:http');
const mark="if(facilityParams.get('test')==='1')window.__editorTest={";
let h=fs.readFileSync('world-editor.html','utf8');a.equal(h.split(mark).length,2);
h=h.replace(mark,mark+`
 qa448:{
   ready:()=>facilitySite?.id==='frontier'&&poiWalkActive&&poiTownNpcActors.length>5,
   run:()=>{
    poiTownNpcNext=Infinity;
    const team=FRONTIER_EXPEDITION_NPCS.map(id=>poiTownNpcActors.find(a=>a.role.id===id));
    poiMonsterStates.clear();
    const start=performance.now();
    function put(a,x,z){
     Object.assign(a,{x,z,y:-1,fromX:x,fromZ:z,fromY:-1,facing:2,goalKey:null,goal:null,actorLeg:null,
      path:null,nextPlan:0,moveAt:start-5000,actorRetryCardinal:false,frontierCombat:null,frontierStrike:null});
    }
    put(team[0],159,81);put(team[1],161,81);
    let s={version:1,started:1920,phase:'out',step:0,landed:false,result:null},goals=0,fractional=0,maxFrame=0,wall=0;
    let last=team.map(a=>({x:a.x,z:a.z}));
    for(let i=0;i<1700&&goals<14;i++){
     const now=start+i*32,budget={plans:2};
     for(const a of team)if(a.actorLeg)poiTownNpcActorRun(a,now,poiTownNpcGraph());
     if(i%6===0){
      frontierExpeditionStudyTick(s,poiHotbarRead(),team,n=>{s=n;goals++;return true;},now);
      for(const a of team)frontierExpeditionMove(a,s,now,budget);
     }
     for(let j=0;j<team.length;j++){
      const p=poiTownNpcVisualPosition(team[j],now,true);
      if(Math.abs(p.x-Math.round(p.x))>.01||Math.abs(p.z-Math.round(p.z))>.01)fractional++;
      if(!frontierExpeditionWalk(poiFreeCell(p.x),poiFreeCell(p.z)))wall++;
      maxFrame=Math.max(maxFrame,Math.hypot(p.x-last[j].x,p.z-last[j].z));last[j]=p;
     }
    }
    const march={goals,fractional,maxFrame,wall,positions:team.map(a=>[a.x,a.z,a.y]),visited:s.study?.visited.length,anchor:s.studyAnchor};
    const o=FRONTIER_SOUTH_ENEMIES.find(o=>o.x===150&&o.z===82),r=team[1],now=start+90000;
    if(!o)throw Error('missing hound fixture');
    const attacker=[...frontierSouthCells].map(p=>p.split(',').map(Number)).find(([x,z])=>Math.hypot(x-o.x,z-o.z)>7&&Math.hypot(x-o.x,z-o.z)<8&&poiCompanionAttackClear({x,z},{x:o.x,z:o.z},-1));
    if(!attacker)throw Error('no clear long-range arc in authored dungeon');
    put(r,...attacker);put(team[0],160,79);team[0].recessed=true;
    const mob={x:o.x,z:o.z,fromX:o.x,fromZ:o.z,moveStarted:-1e6,hp:1000,nextAttack:0,facing:0};
    poiMonsterStates.set(o,mob);
    frontierSouthPursuitFrame(o,mob,now,frontierSouthPursuitSnapshot(now));
    const asleep=!mob.southPursuit&&!mob.actorFree;
    r.frontierStrike={obj:o,weapon:'equipBlackwingBow',range:8,hit:now};r.swingAt=now-300;
    frontierNpcStrike(r,now);
    frontierSouthPursuitFrame(o,mob,now+32,frontierSouthPursuitSnapshot(now+32));
    const away=Math.hypot(mob.x-r.x,mob.z-r.z),to=mob.actorFree;
    const ends=to&&poiMonsterActorPoint(to,to.at+10000);
    return {march,bow:{asleep,hp:mob.hp,tracked:mob.southPursuit,moved:!!to,away,ends:ends&&Math.hypot(ends.x-r.x,ends.z-r.z)}};
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
 await p.waitForFunction(()=>window.__editorTest?.qa448?.ready(),null,{timeout:40000});
 const q=await p.evaluate(()=>window.__editorTest.qa448.run());
 console.log(JSON.stringify(q));a.deepEqual(errors,[]);
 a.equal(q.march.goals,14);
 a.ok(q.march.fractional>30&&q.march.maxFrame<.36&&q.march.wall===0);
 a.ok(q.bow.asleep&&q.bow.hp<1000&&q.bow.moved&&q.bow.tracked==='npc/frontierlyzel'&&q.bow.away>6.8);
 console.log('PASS mobile runtime: continuous two-person ruins traversal and live long-range aggro');
}finally{if(b)await b.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
