'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(process.argv[2],'utf8');
function extract(a,b){const x=html.indexOf(a),y=html.indexOf(b,x);assert.ok(x>=0&&y>x,a);return html.slice(x,y)}
const region=extract('const FRONTIER_SOUTH_MAIN=','const FRONTIER_SOUTH_BEDROCK=');
const study=extract('// BEGIN EXPEDITION LEARNED ROUTES','// END EXPEDITION LEARNED ROUTES');
const c=vm.createContext({Math});
vm.runInContext(region+study+`;globalThis.test={frontierExpeditionMapKey,frontierExpeditionMapPoint,frontierExpeditionLook,frontierExpeditionChoose,frontierExpeditionLearnPath,frontierExpeditionMapDecode,frontierSouthCells};`,c);
const {frontierExpeditionMapKey:key,frontierExpeditionMapPoint:point,frontierExpeditionLook:look,frontierExpeditionChoose:choose,frontierExpeditionLearnPath:path,frontierExpeditionMapDecode:decode,frontierSouthCells:cells}=c.test;
const grid=(lines,x0=130,z0=70)=>new Set(lines.flatMap((line,j)=>[...line].flatMap((v,i)=>v==='.'?[[(x0+i),(z0+j)].join(',')]:[])));
const can=set=>(x,z)=>set.has(x+','+z);
const mark=(p)=>key(p.x,p.z);
const empty=()=>({floor:new Set(),walls:new Set(),visited:new Set(),dx:0,dz:1});
const L=grid(['....#.....','.#..#..##.','.#..#..##.','.#..#.....','..........']);
const p={x:130,z:70},goal={x:139,z:70};
const m=empty();look(m,p,can(L));
assert.ok(!m.floor.has(mark(goal)),'blind around closed corner');
let at=p,n=0,firstLeft=false;
while(!m.visited.has(mark(goal))){
 const q=choose(m,at);assert(q,'can explore all reachable branches');
 const known=path(m,at,q);assert(known?.length&&known.length<=4);
 assert(known.every(node=>m.floor.has(mark(node))),'never routes along unseen cells');
 at=q;look(m,q,can(L),known);firstLeft||=q.z===74;
 assert(++n<140);
}
assert.ok(firstLeft,'learned the bend rather than crossing wall remotely');
assert.ok(path(m,at,p)?.length>9,'return uses visited map around wall');
const j=JSON.parse(JSON.stringify({floor:[...m.floor],walls:[...m.walls],visited:[...m.visited],dx:m.dx,dz:m.dz}));
const rebuilt=decode(j);
assert.ok(path(rebuilt,at,p)?.length>9,'persistent saved path');
assert.deepEqual([point(mark(goal)).x,point(mark(goal)).z],[goal.x,goal.z]);
console.log('PASS unexplored branch search, actual wall-only perception, learned backtrack and save reconstruction');
// Actual bundled expedition controller: launch with the first scout
// downstairs and the second on the preceding surface checkpoint.
vm.runInContext(extract('const FRONTIER_EXPEDITION_NPCS=','function frontierExpeditionEnemyTurn(')+
 ';globalThis.party={frontierExpeditionGoal,frontierExpeditionTick,frontierExpeditionRoute,frontierExpeditionDecode,FRONTIER_SOUTH_EXPEDITION_ROUTE,FRONTIER_SOUTH_ENEMIES};',c);
const {frontierExpeditionGoal:getGoal,frontierExpeditionTick:tick,frontierExpeditionRoute:route,frontierExpeditionDecode:read,
 FRONTIER_SOUTH_ENEMIES:enemies}=c.party;
const fixtureWalk=can(cells),boss=enemies.at(-1),bossKey=key(boss.x,boss.z);
const outRoute=route({phase:'out'});
assert.equal(outRoute.filter(p=>p.y===-1).length,1,'only the actual stairs are preknown');
const id1='frontierregna',id2='frontierlyzel';
const team=[{role:{id:id1},hp:550},{role:{id:id2},hp:550}];
let s={version:1,started:1920,phase:'out',step:outRoute.length-1,result:null,landed:false},kit={frontierExpedition:s},dead=false;
let saves=0;
Object.assign(c,{
    frontierSouthRuinsOwn:fixtureWalk,
    frontierSouthEnemyRecords:()=>enemies,
    frontierSouthBossDefeated:()=>dead,
    frontierSouthRestoreFloor:p=>p,
    FRONTIER_SOUTH_STAIR:{x:160,z:79},
    poiHotbarRead:()=>kit,poiEconomyWrite:next=>(kit=next,s=next.frontierExpedition,saves++,true),
    frontierFallenDecode:v=>v||[],poiHumanPartyDecode:()=>[],POI_HUMAN_PARTY_IDS:{},
    poiTownNpcActors:team,poiTownNpcHere:(a,b)=>a&&b&&a.x===b.x&&a.z===b.z&&a.y===b.y,
    poiTownNpcStepT:()=>1,poiTownNpcStance:p=>p.y===0||fixtureWalk(p.x,p.z)
});
const trigger=()=>tick({absoluteMinute:1921},0);
Object.assign(team[0],getGoal(s,id1));Object.assign(team[1],getGoal(s,id2),{y:0});
trigger();assert.ok(!s.studyActive,'leader waits for second NPC at the stairs');
Object.assign(team[1],getGoal(s,id2));trigger();assert.ok(s.studyActive&&s.studyGoal!==bossKey);
const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
function stepTo(actor,g,peer){
 if(!g||actor.x===g.x&&actor.z===g.z)return;
 assert.ok(fixtureWalk(g.x,g.z),'formation waypoint is visible floor');
 const start=[actor.x,actor.z],k=(x,z)=>x+','+z,target=k(g.x,g.z),q=[start],p=new Map([[k(...start),null]]);
 for(let i=0;i<q.length;i++){
  const [x,z]=q[i],here=k(x,z);
  if(here===target){let node=here,last=p.get(node);while(last&&p.get(last)){node=last;last=p.get(node)}
   if(last){const [x,z]=node.split(',').map(Number);Object.assign(actor,{x,z,y:-1})}
   return;
  }
  for(const [dx,dz] of dirs){
   const a=x+dx,b=z+dz,c=k(a,b);
   if(!fixtureWalk(a,b)||p.has(c)||a===peer.x&&b===peer.z)continue;
   p.set(c,here);q.push([a,b]);
  }
 }
}
let ticks=0,mileage=0,furthest=79;
while(s.studyActive){
 const prev=team.map(p=>[p.x,p.z]);
 stepTo(team[0],getGoal(s,id1),team[1]);stepTo(team[1],getGoal(s,id2),team[0]);
 mileage+=team.filter((p,i)=>p.x!==prev[i][0]||p.z!==prev[i][1]).length;
 furthest=Math.max(furthest,...team.map(p=>p.z));
 if(s.study?.floor.includes(bossKey)){
  dead=true;  // Stubs boss combat only after it becomes visible, never from a preknown checkpoint.
  if(s.phase==='out'){
   const old=s;s=read(JSON.parse(JSON.stringify(kit.frontierExpedition)));kit={frontierExpedition:s};
   assert.equal(s.studyGoal,old.studyGoal);assert.deepEqual(s.study.floor,old.study.floor);
  }
 }
 trigger();
 assert.ok(++ticks<850,`two-person exploration stalled: ${JSON.stringify(team)} goal ${s.studyGoal} ${s.phase}`);
}
assert.equal(s.phase,'back');assert.equal(s.result,'success');
assert.ok(team.some(a=>a.x===160&&a.z===79),'lead physically discovers and returns to stairs');
assert.ok(furthest>=116&&mileage>135&&saves<ticks,'walked multiple rooms/branches without writing every tick');
assert.equal(getGoal(s,id1).y,0,'only exit to surface after physically backtracking');
console.log(`PASS actual dungeon two-person test: followed first scout down, explored to boss, saved/resumed learning, backtracked to exit (${ticks} ticks, ${saves} saves)`);
