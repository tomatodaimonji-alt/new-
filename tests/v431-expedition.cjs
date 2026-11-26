const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm');
const h=fs.readFileSync(process.argv[2],'utf8');
const a=h.indexOf('// BEGIN LINEA SOUTH EXPEDITION'),b=h.indexOf('// END LINEA SOUTH EXPEDITION',a);
assert(a>=0&&b>a,'expedition implementation exists');
const actors=['frontierregna','frontierlyzel'].map((id,i)=>({role:{id},x:132+i,z:29,y:0,facing:2,hp:550}));
const route=[{x:160,z:76,y:0},{x:160,z:77,y:-1},{x:147,z:82,y:-1},{x:174,z:107,y:-1},{x:160,z:119,y:-1}];
const same=(a,b)=>a&&b&&a.x===b.x&&a.z===b.z&&a.y===b.y;
let kit={},cleared=false;
const c=vm.createContext({Math,poiHotbarRead:()=>kit,poiEconomyWrite:x=>(kit=x,true),frontierFallenDecode:x=>x||[],
 poiTownNpcActors:actors,poiHumanPartyDecode:x=>x||[],POI_HUMAN_PARTY_IDS:{'human:frontierregna':'frontierregna'},
 FRONTIER_SOUTH_EXPEDITION_ROUTE:route,poiTownNpcStance:()=>true,poiTownNpcHere:same,poiTownNpcStepT:()=>1,
 frontierSouthBossDefeated:()=>cleared,poiTownDialogue:null,poiTownNpcVersion:0});
vm.runInContext(h.slice(a,b)+';globalThis.f={frontierExpeditionDecode,frontierExpeditionWait,frontierExpeditionTick,frontierExpeditionGoal,FRONTIER_EXPEDITION_DEPART};',c);
const j=x=>JSON.parse(JSON.stringify(x));
const {frontierExpeditionDecode:decode,frontierExpeditionWait:wait,frontierExpeditionTick:tick,frontierExpeditionGoal:goal,FRONTIER_EXPEDITION_DEPART:depart}=c.f;
assert.equal(depart,1920);
assert.equal(wait(route[2]),1020);
assert.equal(wait(route[3]),2070);
assert.equal(wait(route[4]),2880);
assert.equal(wait(route[0]),0);
assert.equal(decode({version:1,started:depart,phase:'out',step:99}),null);
for(const phase of ['out','back','north','done']){
 const s={version:1,started:depart,phase,step:4,landed:true,result:phase==='out'?null:'success',
  positions:{frontierregna:{x:160,z:110,y:-1,facing:2},frontierlyzel:{x:160,z:0,y:0,facing:0}}};
 assert.deepEqual(j(decode(s)),s);
}
const t=x=>tick({absoluteMinute:x},1);
const arrive=()=>actors.forEach(a=>Object.assign(a,goal(kit.frontierExpedition,a.role.id)));
t(depart-1);assert.equal(kit.frontierExpedition,undefined);
t(depart);assert.equal(kit.frontierExpedition.phase,'out');
arrive();t(depart+100);arrive();t(depart+150);arrive();t(depart+300);
assert.equal(kit.frontierExpedition.step,2);
assert.equal(kit.frontierExpedition.landed,true);
assert.equal(kit.frontierExpedition.positions.frontierregna.y,-1);
t(depart+1020);assert.equal(kit.frontierExpedition.step,3);
arrive();t(depart+2070);assert.equal(kit.frontierExpedition.step,4);
arrive();t(depart+2510);t(depart+2879);assert.equal(kit.frontierExpedition.phase,'out');
cleared=true;t(depart+2880);assert.equal(kit.frontierExpedition.result,'success');
while(kit.frontierExpedition.phase!=='done'){arrive();t(depart+3050);}
assert.ok(actors.every(a=>a.recessed));assert.equal(kit.frontierExpedition.positions.frontierregna.z,0);
t(depart+6000);assert.equal(kit.frontierExpedition.phase,'done');
actors.forEach(a=>{a.recessed=false;a.death=null});kit={humanParty:[{id:'human:frontierregna'}]};
t(depart+1);assert.equal(kit.frontierExpedition,undefined);
kit={};t(depart+30);kit.frontierFallen=['frontierregna','frontierlyzel'];actors.forEach(a=>a.death={});
t(depart+31);assert.equal(kit.frontierExpedition.result,'defeat');
assert.match(h,/frontierExpeditionTick\(clock,now\)/);
assert.match(h,/frontierExpeditionDecode\(saved.frontierExpedition\)/);
assert.match(h,/frontierExpeditionPosition\(poiHotbarRead\(\),role.id\)/);
assert.match(h,/const y=actor\?\.y===-1\?-1:0;/);
assert.match(h,/明日、橋の南の石門から遺跡に入る/);
console.log('PASS expedition schedule, staged rests, persistent positions, actual boss outcome, North departure, death/layer and recruited-actor handling');
