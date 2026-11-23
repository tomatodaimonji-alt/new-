const {test}=require('node:test'),a=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const h=fs.readFileSync(process.argv[2]||process.env.HTML||'world-editor.html','utf8');
const cut=(l,r)=>{const i=h.indexOf(l),j=h.indexOf(r,i+l.length);a(i>=0&&j>i,l);return h.slice(i,j)};
test('talk capture cannot become attack or switch targets, yet ordinary touch still attacks',()=>{
 const first={role:{id:'clerk'}},second={role:{id:'visitor'}},listeners={},calls=[],action={
  _shopPrompt:'talk',_talkActor:first,addEventListener(k,f){listeners[k]=f},
  getBoundingClientRect(){return {left:0,right:40,top:0,bottom:40}}
 };
 const c={action,performance:{now:()=>100},calls,toast:t=>calls.push(['toast',t]),
  poiShopSync:()=>calls.push(['sync']),poiWalkAction:()=>calls.push(['attack']),
  poiTownDialogueAction:(now,actor)=>{calls.push(['talk',actor]);return actor===second}};
 const src=cut("poiAnalogAction.addEventListener('pointerdown'", "for(const event of ['pointercancel','lostpointercapture'])");
 vm.runInNewContext('const poiAnalogAction=action,poiAnalogActionClick=[];let poiAnalogActionTouch=null;const poiAnalogActionLandscape=()=>true,poiAnalogActionAllowed=()=>true;'+src,c);
 const e={pointerType:'touch',pointerId:2,button:0,clientX:20,clientY:20,preventDefault(){}};
 listeners.pointerdown(e);action._talkActor=second;listeners.pointerup(e);
 a.deepEqual(calls,[['talk',first],['toast','少し近づいてから話してみよう。'],['sync']]);
 calls.length=0;listeners.pointerdown(e);listeners.pointerup(e);
 a.deepEqual(calls,[['talk',second]]);
 calls.length=0;action._shopPrompt='action';listeners.pointerdown(e);listeners.pointerup(e);
 a.deepEqual(calls,[['attack']]);
});
test('exact revalidation rejects another NPC, rear, wrong floor, and blocked LOS; keeps approved small movement',()=>{
 const npc={x:2,z:0,y:0,role:{id:'clerk'},activity:'work'},other={x:1,z:0,y:0,role:{id:'guest'},activity:'work'};
 let px=0,face=1,wall=false;
 const c={poiTownNpcActors:[npc,other],poiMonsterStates:new Map(),poiTownDialogue:null,poiWalkFacing:1,poiWalkX:0,poiWalkZ:0,poiWalkLevel:0,
  poiTownNpcActive:()=>true,poiTownNpcSleeping:()=>false,poiAimOrigin:()=>({x:px,z:0,y:0,dir:{x:face,z:0}}),
  poiTownNpcVisualPosition:a=>({x:a.x-.24,z:a.z,y:a.y}),
  poiAimWall:()=>()=>!wall,poiAimUnit:(x,z)=>({x,z}),
  poiAimWallLimit:(o,ray,d,pass)=>pass(1,0,0,0)?d:0,
  poiTownNpcGraph:()=>({cells:new Map()}),poiTownNpcKey:(...v)=>v.join(','),poiTownCounterTalkReachable:()=>false};
 const f=vm.runInNewContext(cut('// BEGIN NPC LIVE TALK','function poiTownDialogueSnapshot(')+';poiTownDialogueTarget',c);
 a.equal(f(100),other,'normal choice prefers adjacent competing actor');
 a.equal(f(140,null,npc),npc,'small broadening stays pinned to displayed actor');
 face=-1;a.equal(f(140,null,npc),null);face=1;
 wall=true;a.equal(f(140,null,npc),null);wall=false;
 npc.y=1;a.equal(f(140,null,npc),null);npc.y=0;
 npc.activity='fight';a.equal(f(140,null,npc),null);npc.activity='work';
 px=-.16;a.equal(f(140,null,npc),null,'bounded release tolerance');
});
test('active moving actor holds its actual occupied interpolation, then resumes without catching up',()=>{
 const leg={x:12.4,z:1.16,last:11,elapsed:75,duration:300},who={role:{id:'x'},actorLeg:leg},other={actorLeg:{last:11}};
 const moved=[];const c={poiTownNpcActors:[who,other],poiTownDialogue:{actor:who,sleeping:false},poiTownNpcActive:()=>true,
  poiTownNpcNext:9999,poiTownNpcVersion:0,poiTownNpcGraph:()=>({}),poiTownNpcActorSettle:()=>{throw Error('recenter would move occupant')},
  poiTownDialogueSyncPrompt(){},poiTownNpcActorRun:(a,now)=>moved.push([a,now])};
 const f=vm.runInNewContext(cut('let poiTownMotionClock=','function poiTownResidentsSnapshot(')+';poiTownResidentsFrame',c);
 f(1000);a.deepEqual([leg.x,leg.z,leg.last,leg.elapsed],[12.4,1.16,1000,75]);a.deepEqual(moved,[[other,1000]]);
 c.poiTownDialogue=null;f(1016);a.deepEqual(moved.slice(1),[[who,1016],[other,1016]]);
});
