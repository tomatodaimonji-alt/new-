const a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.argv[2],'utf8');
const from=h.indexOf('// BEGIN EXPEDITION LEARNED ROUTES'),to=h.indexOf('function frontierExpeditionEnemyTurn(',from);
const id='frontierregna',sid='frontierlyzel',role=id=>({id}),at=(x,z,id)=>({x,z,y:-1,role:role(id),facing:2});
const floor=new Set(['160,80','160,81','160,82','161,82','162,82','162,81','159,80']);
const team=[at(160,81,id),at(160,80,sid)], moves=[];
const c=vm.createContext({poiTownNpcActors:team,frontierSouthRuinsOwn:(x,z)=>floor.has(x+','+z),frontierSouthChestAt:()=>false,poiTownNpcStepT:()=>1,poiTownNpcAct:()=>{},poiTownNpcMove:(...args)=>{moves.push(args);return false;}});
vm.runInContext(h.slice(from,to)+';globalThis.q={frontierExpeditionGoal,frontierExpeditionMapKey,frontierExpeditionMove};',c);
const {frontierExpeditionGoal:goal,frontierExpeditionMapKey:key,frontierExpeditionMove:move}=c.q;
const s={phase:'out',started:1920,studyActive:true,studyLead:id,studyFacing:1,studyAnchor:key(160,81),studyGoal:key(162,82),
 study:{floor:[...floor].map(v=>key(...v.split(',').map(Number))),walls:[],visited:[key(160,80),key(160,81)]}};
const rear=goal(s,sid);
a.deepEqual([rear.x,rear.z],[160,81], 'the follower must seek the leader’s previous waypoint, not stand beside the leader’s future target');
move(team[0],s,1000,{plans:2});
const planner=moves[0][5];
a.equal(typeof planner,'function','the expedition should supply its learned route rather than the omniscient town BFS');
const path=planner(team[0],goal(s,id));
a.deepEqual(Array.from(path,p=>[p.x,p.z]),[[160,82],[161,82],[162,82]]);
console.log('PASS follower stays behind; leader route avoids the blind corner');
