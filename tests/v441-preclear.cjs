const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const h=fs.readFileSync(process.argv[2],'utf8');
function ext(a,b){const x=h.indexOf(a),y=h.indexOf(b,x);assert(x>=0&&y>x,a);return h.slice(x,y)}
for(const m of h.matchAll(/<script(?:\s[^>]*?)?>([\s\S]*?)<\/script>/gi)){if(!m[0].includes('<script type="application/json"'))new vm.Script(m[1])}
const actors=['frontierregna','frontierlyzel'].map(id=>({role:{id}}));
const c=vm.createContext({poiTownNpcActors:actors,poiTownNpcVersion:0,poiTownDialogue:null,
 poiHotbarRead:()=>c.kit,poiEconomyWrite:k=>(c.kit=k,true),poiMonsterStates:new Map(),
 frontierFallenDecode:()=>[],poiHumanPartyDecode:()=>[],frontierSouthRestoreFloor:p=>p,
 poiTownNpcHere:(a,p)=>a.x===p.x&&a.z===p.z&&a.y===p.y,
 poiTownNpcFaces:()=>1,poiTownNpcFace:(a,f)=>a.facing=f,frontierLifeSpeech:new Map(),
 poiTownNpcStepT:()=>1,poiTownNpcStance:()=>true,poiTownNpcAct:()=>{},
 facilitySite:{id:'frontier'},poiNpcTalkCursor:new Map()});
vm.runInContext(
 ext('const FRONTIER_SOUTH_MAIN=','const FRONTIER_SOUTH_BEDROCK=')+
 ext('function frontierSouthEnemyRecords()', 'function frontierSouthRemember(')+
 ext('function frontierSouthRemember(', '\n}',)+
 '}\n'+
 ext('// BEGIN EXPEDITION LEARNED ROUTES','// END EXPEDITION LEARNED ROUTES')+
 ext('const FRONTIER_EXPEDITION_NPCS=','function frontierExpeditionEnemyTurn(')+
 ext('function frontierExpeditionClearTopic(', 'function poiNpcOpeningTopic(')+
 ';globalThis.f={frontierExpeditionGoal,frontierExpeditionTick,frontierExpeditionRoute,frontierExpeditionDecode,frontierSouthRemember,frontierExpeditionClearTopic,boss:FRONTIER_SOUTH_ENEMIES.at(-1)};',c);
const f=c.f;
function fresh(){c.kit={frontierExpedition:{version:1,phase:'out',started:1920,step:0,landed:false,result:null}};for(const a of actors){a.recessed=false}}
function tick(now){f.frontierExpeditionTick({absoluteMinute:1920},now)}
function arrive(){for(const a of actors)Object.assign(a,f.frontierExpeditionGoal(c.kit.frontierExpedition,a.role.id))}
fresh();
assert(f.frontierSouthRemember(f.boss,{hp:0},{companion:true,actorId:'frontierregna'}));
assert.equal(c.kit.southClearBy,'other','player allied damage is not independent expedition');
assert.equal(f.frontierExpeditionClearTopic(actors[0]),null);
for(let n=0;n<6;n++){arrive();assert.equal(actors[0].y,0);tick(n);}
assert.equal(c.kit.frontierExpedition.result,'precleared');assert.equal(c.kit.frontierExpedition.gateTalk,0);
assert.match(f.frontierExpeditionClearTopic(actors[0]),/先を越され/);
tick(100);assert.match(c.frontierLifeSpeech.get('frontierregna').text,/もう攻略/);
tick(3000);assert.equal(c.kit.frontierExpedition.gateTalk,1);
c.kit.frontierExpedition=f.frontierExpeditionDecode(JSON.parse(JSON.stringify(c.kit.frontierExpedition)));
tick(3001);assert.match(c.frontierLifeSpeech.get('frontierlyzel').text,/帰りましょう/);
tick(7000);assert.equal(c.kit.frontierExpedition.gateTalk,null);
for(let n=0;n<20&&c.kit.frontierExpedition.phase!=='done';n++){arrive();assert.equal(actors[0].y,0);tick(7001+n)}
assert.equal(c.kit.frontierExpedition.phase,'done');assert(actors.every(a=>a.recessed));
fresh();
assert(f.frontierSouthRemember(f.boss,{hp:0},{companion:true,resident:true,actorId:'frontierlyzel'}));
assert.equal(c.kit.southClearBy,'expedition');
for(let n=0;n<6;n++){arrive();tick(n);}
assert.equal(c.kit.frontierExpedition.phase,'out');
fresh();
for(let n=0;n<6;n++){arrive();tick(n);}
assert.equal(c.kit.frontierExpedition.phase,'out');
console.log('PASS arrival at gate, dialog and reload, northward exit without descending, independent quest kill and no preclear preserve outbound');
