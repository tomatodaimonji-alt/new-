const fs=require('node:fs'),vm=require('node:vm'),a=require('node:assert/strict'),{test}=require('node:test');
const h=fs.readFileSync(process.env.HTML||process.argv[2]||'world-editor.html','utf8');
const cut=(s,e)=>{const i=h.indexOf(s),j=h.indexOf(e,i+1);a(i>=0&&j>i,s);return h.slice(i,j)};
function harness(id='innkeeper'){
 const actor={role:{id,role:'keeper'},activity:'work'},sounds=[],lines=[],steps=[];
 const menu={hidden:true,removeAttribute(){},replaceChildren(){}};
 const c=vm.createContext({actor,facilitySite:{id:'base',southPort:{name:'潮待ちの港',entrance:{x:91,z:123,y:0}}},poiTownDialogue:null,poiTownDialoguePrompt:null,
  testNow:1000,performance:{now:()=>c.testNow},poiTownDialogueTarget:()=>c.target??actor,poiTownNpcSleeping:a=>a.activity==='sleep-home',
  poiNpcMenuService(){return null},poiTownAmbientClose(){},poiBagSetOpen(){},poiStopRepeat(){},poiTownNpcFace(){},
  poiNpcMenuRender(){const d=c.poiTownDialogue;d.rows=c.poiNpcMenuRows(d);menu.hidden=d.page==='speech'||d.sleeping;lines.push(d.text)},
  poiShopSync(){},poiSound:(...v)=>sounds.push(v),$:()=>menu,poiNpcInventorySync(){},poiNpcTradePanelSync(){},
  poiMessageEndSpeech(){lines.push(null)},poiWalkActive:true,poiWalkFacing:1,poiWalkNextReady:0,poiWalkX:10,poiWalkZ:9,poiWalkLevel:0,
  poiShopIsOpen:()=>c.poiNpcMenuActive(),poiItemDetailIsOpen:()=>false,poiChestIsOpen:()=>false,
  poiWalkCanStep:()=>!c.wall,poiMiniUpdate(){},poiWalkAvatar(){},poiWalkEnterCell:(dx,dz,now)=>{steps.push([dx,dz,now]);return true}});
 vm.runInContext(cut('const POI_TOWN_SPEECH=','let poiTownDialogue=')+
  cut('const POI_NPC_EXTRA_SPEECH=','function poiNpcTradeSessionMatches(')+
  (h.includes('function poiPortMarekTopic(')?cut('function poiPortMarekTopic(','// END SOUTH PORT RESIDENTS'):'')+
  cut('function poiNpcMenuRows(','function poiTownNpcStatus(')+
  cut('function poiNpcMenuChoose(','// A flexible greeting')+
  cut('function poiTownDialogueClose(','// BEGIN SPEECH PLACEMENT')+
  cut('function poiWalkStepWithFallback(','function poiWalkEnterCell('),c);
 return {c,sounds,lines,menu,steps};
}
const greet=(c,t=1000)=>a.equal(c.poiTownDialogueAction(t),true);
test('successful greeting emits one cue and leaves original root choices; Talk hides choices and expires without repeat',()=>{
 const {c,menu,lines,sounds}=harness();greet(c);a.deepEqual(sounds,[['npc-greet']]);
 a.equal(c.poiNpcMenuActive(),true);a(menu.hidden===false);
 a(c.poiTownDialogue.rows.some(r=>r.id==='request'));
 a(c.poiNpcMenuChoose('talk',1100));a.equal(c.poiNpcMenuActive(),false);a(menu.hidden);
 a.match(c.poiTownDialogue.text,/東門.*川下.*西.*浅瀬/);
 a.equal(c.poiTownDialogue.rows.length,0);a.equal(sounds.length,1,'Talk click is not another greeting');
 const until=c.poiTownDialogue.until;a(until>=5300&&until<=8600);
 c.poiTownDialogueUpdate(until-1);a.notEqual(lines.at(-1),null);
 c.poiTownDialogueUpdate(until);a.equal(c.poiTownDialogue,null);a.equal(lines.at(-1),null);
});
test('only heard topics advance across new greetings; optional Marek port direction stays third',()=>{
 const {c}=harness('southmerchant');
 const hear=()=>{greet(c);a(c.poiNpcMenuChoose('talk',1100));const text=c.poiTownDialogue.text;c.poiTownDialogueClose();return text};
 greet(c);c.poiTownDialogueClose();
 a.match(hear(),/店の裏は荷ほどき場/);a.match(hear(),/向かいの宿/);a.match(hear(),/南.*西.*潮待ちの港/);
 a.match(hear(),/店の裏は荷ほどき場/);
});
test('direct directional movement clears root menu or speech and moves same event; blocked motion still dismisses',()=>{
 const {c,steps}=harness();greet(c);a(c.poiWalkStepWithFallback(1,0));a.equal(c.poiTownDialogue,null);a.deepEqual(steps,[[1,0,1000]]);
 greet(c);a(c.poiNpcMenuChoose('talk',1100));c.wall=true;
 a.equal(c.poiWalkStepWithFallback(0,1),false);a.equal(c.poiTownDialogue,null);
});
test('pending transactions/status never auto-accept on movement and submerged dialogs are guarded',()=>{
 const {c,steps,sounds}=harness();greet(c);
 c.poiTownDialogue.page='confirm';c.poiTownDialogue.pending={amount:7};
 c.poiWalkStepWithFallback(1,0);a.equal(c.poiTownDialogue.page,'confirm');a.equal(steps.length,0);
 c.poiTownDialogueClose();c.actor.activity='sleep-home';
 greet(c);a.equal(sounds.length,1,'the sleeping check is not a successful spoken greeting');
});
test('every awake NPC offers 依頼, including fishseller/fisher, without creating port item transactions',()=>{
 for(const id of ['innkeeper','portfisher','portfishseller']){
  const {c}=harness(id);
  if(id.startsWith('port'))c.actor.role.portBounds={x1:73,x2:92};
  greet(c);a(c.poiTownDialogue.rows.some(r=>r.id==='request'&&r.label==='依頼'),id);
  a(c.poiNpcMenuChoose('request',1100));
  if(id.startsWith('port')){
   a(c.poiTownDialogue.rows.some(r=>r.id==='local-help'));
   a(!c.poiTownDialogue.rows.some(r=>['sell','buy','shop'].includes(r.id)));
   a(c.poiNpcMenuChoose('local-help',1200));
   a.match(c.poiTownDialogue.text,id==='portfisher'?/網.*頼みごと/:/魚.*頼みごと/);
  }
 }
});
test('the real analog motion handler ignores a resting thumb, dismisses on deflection, then moves without re-touch',()=>{
 const {c}=harness();greet(c);
 Object.assign(c,{poiAnalogContact:{moved:false,dx:0,dy:0,last:null,failures:new Map()},poiFreePose:null,
  poiWalkNextReady:1050,poiAnalogAllowed:()=>true,poiThirdPerson:false,yaw:0,POI_ANALOG_DEADZONE:8,POI_ANALOG_RADIUS:35,
  POI_WALK_MS:175,POI_FREE_RADIUS:.20,POI_FREE_EPS:1e-6,poiFreeCell:v=>Math.floor(v+.5),poiOtherworldTravelSerial:0,
  poiFreeAdvance:(x,z,dx,dz)=>({x:x+dx,z:z+dz,distance:Math.hypot(dx,dz),stopped:false})});
 vm.runInContext(cut('function poiAnalogSample(','// END LANDSCAPE ANALOG MATH')+
  cut('function poiAnalogFrame(','// BEGIN EXPANDED ANALOG START AREA'),c);
 c.poiAnalogFrame(1010);a(c.poiTownDialogue);
 c.poiAnalogContact.dx=31;c.poiAnalogContact.moved=true;c.poiAnalogFrame(1030);
 a.equal(c.poiTownDialogue,null,'dismissal responds to physical intent despite prior step cooldown');
 const same=c.poiAnalogContact;
 c.poiAnalogFrame(1055);c.poiAnalogFrame(1071);
 a.equal(c.poiAnalogContact,same);a(c.poiFreePose.x>c.poiWalkX);a(c.poiFreePose.walking);
});
test('npc-greet uses only the existing effects bus, honors master and SE mute, and allocates no assets',()=>{
 const tones=[],effects={tag:'se'},c=vm.createContext({poiWalkActive:true,poiAudioEnabled:true,poiAudioAllowed:()=>true,poiAudioStart(){},
  poiAudioContext:{currentTime:1,state:'running'},poiAudioLevels:{master:90,se:80,bgm:0},
  poiAudioTone:(...v)=>tones.push(v),poiAudioEffects:effects});
 vm.runInContext(cut('function poiSound(','function poiAudioSyncLifecycle('),c);
 c.poiSound('npc-greet');a.equal(tones.length,2);
 a(tones.every(t=>t[5]===effects&&t[2]<.2&&t[3]<.1));
 c.poiAudioLevels.se=0;c.poiSound('npc-greet');a.equal(tones.length,2);
 c.poiAudioLevels.se=80;c.poiAudioLevels.master=0;c.poiSound('npc-greet');a.equal(tones.length,2);
});
