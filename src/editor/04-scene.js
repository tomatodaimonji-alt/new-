// Editor walk-through uses the same bare avatar and stride/facing rules as PINE gameplay.
let poiWalkActive=false,poiWalkX=0,poiWalkZ=0,poiWalkMesh=null,poiWalkOldRoof=false;
let poiWalkFacing=2,poiWalkStarted=-10000,poiWalkFromX=0,poiWalkFromZ=0;
let poiWalkViewX=0,poiWalkViewZ=0,poiWalkNextReady=0,poiWalkActionStarted=-10000;
const POI_WALK_MS=160;

// v40: original offline soundscape and layered game sound design.
const PINE_AUDIO_SETTINGS_KEY='world-workshop-audio-v2';
let poiAudioContext=null,poiAudioMaster=null,poiAudioMusic=null,poiAudioAmbience=null,poiAudioEffects=null;
let poiAudioAmbient=[],poiAudioInterval=null,poiAudioNoise=null,poiAudioEnabled=true;
let poiAudioLevels={master:85,bgm:68,se:90};
try{
 const saved=JSON.parse(localStorage.getItem(PINE_AUDIO_SETTINGS_KEY)||'null');
 if(saved&&typeof saved==='object'){
  for(const k of ['master','bgm','se'])if(Number.isFinite(saved[k]))poiAudioLevels[k]=Math.max(0,Math.min(100,Math.round(saved[k])));
  if(typeof saved.enabled==='boolean')poiAudioEnabled=saved.enabled;
 }
}catch(e){}
function poiAudioSyncUI(){
 for(const k of ['master','bgm','se']){
  const slider=$('poiVolume'+k[0].toUpperCase()+k.slice(1)),label=$('poiVolume'+k[0].toUpperCase()+k.slice(1)+'Value');
  if(slider)slider.value=poiAudioLevels[k];
  if(label)label.textContent=poiAudioLevels[k]+'%';
 }
 const button=$('poiAudioToggle');
 if(button){button.textContent=poiAudioEnabled?'音 ON':'音 OFF';button.setAttribute('aria-pressed',String(poiAudioEnabled))}
}
function poiAudioApplyLevels(){
 if(!poiAudioContext)return;
 const now=poiAudioContext.currentTime;
 if(poiAudioMaster)poiAudioMaster.gain.setTargetAtTime(poiAudioEnabled?poiAudioLevels.master/100:0,now,.025);
 if(poiAudioMusic)poiAudioMusic.gain.setTargetAtTime(.38*poiAudioLevels.bgm/100,now,.045);
 if(poiAudioAmbience)poiAudioAmbience.gain.setTargetAtTime(.39*poiAudioLevels.bgm/100,now,.045);
 if(poiAudioEffects)poiAudioEffects.gain.setTargetAtTime(.90*poiAudioLevels.se/100,now,.02);
}
function poiAudioSaveSettings(){
 try{localStorage.setItem(PINE_AUDIO_SETTINGS_KEY,JSON.stringify({...poiAudioLevels,enabled:poiAudioEnabled}))}catch(e){}
}
function poiAudioSetVolume(kind,value){
 if(!Object.prototype.hasOwnProperty.call(poiAudioLevels,kind))return;
 poiAudioLevels[kind]=Math.max(0,Math.min(100,Math.round(Number(value)||0)));
 poiAudioApplyLevels();poiAudioSaveSettings();poiAudioSyncUI();
}
function poiAudioNoiseBuffer(){
 if(poiAudioNoise)return poiAudioNoise;
 const ctx=poiAudioContext,buffer=ctx.createBuffer(1,Math.round(ctx.sampleRate*2),ctx.sampleRate);
 const samples=buffer.getChannelData(0);
 // Gentle correlated noise rather than piercing raw white noise.
 let last=0;
 for(let i=0;i<samples.length;i++){last=(last*.65)+((Math.random()*2-1)*.35);samples[i]=last}
 poiAudioNoise=buffer;return buffer;
}
function poiAudioInitialize(){
 if(poiAudioContext)return true;
 const C=window.AudioContext||window.webkitAudioContext;if(!C)return false;
 const ctx=new C();poiAudioContext=ctx;
 const master=ctx.createGain(),limiter=ctx.createDynamicsCompressor();
 limiter.threshold.value=-12;limiter.knee.value=12;limiter.ratio.value=8;limiter.attack.value=.004;limiter.release.value=.18;
 master.connect(limiter).connect(ctx.destination);poiAudioMaster=master;
 poiAudioMusic=ctx.createGain();poiAudioAmbience=ctx.createGain();poiAudioEffects=ctx.createGain();
 poiAudioMusic.connect(master);poiAudioAmbience.connect(master);poiAudioEffects.connect(master);
 poiAudioApplyLevels();return true;
}
function poiAudioTone(freq,when,duration,volume,type='sine',dest=poiAudioMusic,attack=.05){
 const ctx=poiAudioContext,o=ctx.createOscillator(),gain=ctx.createGain();
 const end=when+duration;
 o.type=type;o.frequency.setValueAtTime(freq,when);
 gain.gain.setValueAtTime(.0001,when);
 gain.gain.linearRampToValueAtTime(volume,when+Math.min(attack,duration*.4));
 gain.gain.setTargetAtTime(.0001,Math.max(when+attack,end-.4),.13);
 o.connect(gain).connect(dest);o.start(when);o.stop(end+.08);
 o.onended=()=>{o.disconnect();gain.disconnect()};
 return o;
}
function poiAudioMusicPhrase(){
 if(!poiWalkActive||!poiAudioEnabled||!poiAudioContext)return;
 const ctx=poiAudioContext,t=ctx.currentTime+.08;
 // Original D minor / F major / C sus2 / G minor ambient progression.
 const chords=[[146.83,174.61,220,293.66],[174.61,220,261.63,349.23],[130.81,196,261.63,293.66],[146.83,196,233.08,293.66]];
 const phrase=chords[Math.floor(t/8)%chords.length];
 for(let i=0;i<phrase.length;i++){
  const f=phrase[i],start=t+i*.10;
  poiAudioTone(f,start,7.1,.095,'sine',poiAudioMusic,1.7);
  if(i<3)poiAudioTone(f/2,start,6.8,.037,'triangle',poiAudioMusic,1.4);
 }
 // Sparse, mellow glass-like tones, not repetitive sharp beeps.
 const lead=phrase[2]*2;
 poiAudioTone(lead,t+2.7,2.1,.07,'sine',poiAudioMusic,.045);
 poiAudioTone(lead*.75,t+4.65,2.15,.055,'sine',poiAudioMusic,.08);
}
function poiAudioStart(){
 if(!poiAudioEnabled||!poiWalkActive)return;
 try{
  if(!poiAudioInitialize())return;
  const ctx=poiAudioContext;
  if(ctx.state==='suspended')ctx.resume().catch(()=>{});
  if(poiAudioAmbient.length)return;
  // Long soft wind and leafy rustle. No remote media/network required.
  const wind=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),g=ctx.createGain();
  wind.buffer=poiAudioNoiseBuffer();wind.loop=true;
  filter.type='lowpass';filter.frequency.value=550;g.gain.value=.17;
  wind.connect(filter).connect(g).connect(poiAudioAmbience);
  wind.start();poiAudioAmbient.push(wind);
  const lfo=ctx.createOscillator(),lg=ctx.createGain();
  lfo.type='sine';lfo.frequency.value=.11;lg.gain.value=.055;
  lfo.connect(lg).connect(g.gain);lfo.start();poiAudioAmbient.push(lfo);
  const rustle=ctx.createBufferSource(),rf=ctx.createBiquadFilter(),rg=ctx.createGain();
  rustle.buffer=poiAudioNoiseBuffer();rustle.loop=true;
  rf.type='bandpass';rf.frequency.value=1450;rf.Q.value=.35;rg.gain.value=.05;
  rustle.connect(rf).connect(rg).connect(poiAudioAmbience);rustle.start();poiAudioAmbient.push(rustle);
  poiAudioMusicPhrase();poiAudioInterval=setInterval(poiAudioMusicPhrase,8000);
 }catch(e){console.warn('Audio unavailable',e)}
}
function poiAudioStop(){
 if(poiAudioInterval!==null){clearInterval(poiAudioInterval);poiAudioInterval=null}
 for(const node of poiAudioAmbient){try{node.stop()}catch(e){}try{node.disconnect()}catch(e){}}
 poiAudioAmbient=[];
}
function poiAudioNoiseBurst(when,duration,frequency,q,peak){
 const ctx=poiAudioContext,src=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
 src.buffer=poiAudioNoiseBuffer();filter.type='bandpass';filter.frequency.value=frequency;filter.Q.value=q;
 gain.gain.setValueAtTime(.0001,when);
 gain.gain.linearRampToValueAtTime(peak,when+.008);
 gain.gain.exponentialRampToValueAtTime(.0001,when+duration);
 src.connect(filter).connect(gain).connect(poiAudioEffects);
 src.start(when);src.stop(when+duration+.01);
 src.onended=()=>{src.disconnect();filter.disconnect();gain.disconnect()};
}
function poiAudioThud(when,startFrequency,endFrequency,duration,volume){
 const ctx=poiAudioContext,o=ctx.createOscillator(),g=ctx.createGain();
 o.type='sine';o.frequency.setValueAtTime(startFrequency,when);o.frequency.exponentialRampToValueAtTime(endFrequency,when+duration);
 g.gain.setValueAtTime(.0001,when);g.gain.linearRampToValueAtTime(volume,when+.008);
 g.gain.exponentialRampToValueAtTime(.0001,when+duration);
 o.connect(g).connect(poiAudioEffects);o.start(when);o.stop(when+duration+.015);
 o.onended=()=>{o.disconnect();g.disconnect()};
}
function poiSound(kind){
 if(!poiWalkActive||!poiAudioEnabled)return;
 poiAudioStart();const ctx=poiAudioContext;if(!ctx||ctx.state!=='running')return;
 const now=ctx.currentTime;
 try{
  if(kind==='step'){
   // Short filtered gravel/soil crunch plus sole impact; alternate tone subtly.
   poiAudioNoiseBurst(now,.12,650+Math.random()*320,.7,.40);
   poiAudioThud(now,105+Math.random()*24,62,.115,.21);
  }else if(kind==='attack'){
   // Sweeping whoosh plus low body, not a fixed-pitch electronic beep.
   poiAudioNoiseBurst(now,.24,1250, .55,.58);
   poiAudioNoiseBurst(now+.07,.15,2100,.7,.32);
   poiAudioThud(now+.04,180,70,.21,.26);
  }else if(kind==='hit'){
   poiAudioNoiseBurst(now,.13,1500,.65,.68);
   poiAudioThud(now,230,75,.18,.40);
  }else if(kind==='hurt'){
   poiAudioNoiseBurst(now,.19,420,.8,.42);
   poiAudioThud(now,180,52,.25,.46);
  }
 }catch(e){console.warn('Sound effect unavailable',e)}
}
function poiToggleAudio(){
 poiAudioEnabled=!poiAudioEnabled;
 if(!poiAudioEnabled)poiAudioStop();else if(poiWalkActive)poiAudioStart();
 poiAudioApplyLevels();poiAudioSaveSettings();poiAudioSyncUI();
}

const POI_PLAYER_MAX_HP=100,POI_PLAYER_ATTACK=20;
const POI_MONSTER_STATS={monsterSlime:{hp:35,attack:6},monsterGoblin:{hp:55,attack:10},monsterSkeleton:{hp:45,attack:9},monsterDragon:{hp:150,attack:22}};
let poiPlayerHP=POI_PLAYER_MAX_HP,poiSpawnX=0,poiSpawnZ=0,poiMonsterStates=new Map(),poiNextMobTick=0,poiAttackReady=0;
let poiDamageLabels=[];
function poiIsMonster(type){return Object.prototype.hasOwnProperty.call(POI_MONSTER_STATS,type)}
function poiResetCombat(){poiPlayerHP=POI_PLAYER_MAX_HP;poiMonsterStates=new Map();for(const o of world){if(poiIsMonster(o.type)){const stats=POI_MONSTER_STATS[o.type];poiMonsterStates.set(o,{x:o.x,z:o.z,hp:stats.hp,nextAttack:0})}}poiDamageLabels=[];poiNextMobTick=0;poiAttackReady=0;poiCombatHud();dirty=true}
function poiCombatHud(){const hud=$('poiCombatHud');if(!hud)return;hud.hidden=!poiWalkActive;hud.textContent='HP '+poiPlayerHP+'/'+POI_PLAYER_MAX_HP+'　攻撃力 '+POI_PLAYER_ATTACK}
function poiDamageNumber(x,z,y,value,isPlayer=false){poiDamageLabels.push({x,z,y,value,time:performance.now(),isPlayer});if(poiDamageLabels.length>24)poiDamageLabels.shift()}
function poiWorldToScreen(vp,x,y,z){const w=vp[3]*x+vp[7]*y+vp[11]*z+vp[15];if(w<=.05)return null;const a=(vp[0]*x+vp[4]*y+vp[8]*z+vp[12])/w,b=(vp[1]*x+vp[5]*y+vp[9]*z+vp[13])/w;if(Math.abs(a)>1.25||Math.abs(b)>1.25)return null;return {x:(a+1)*.5*canvas.clientWidth,y:(1-b)*.5*canvas.clientHeight}}
function poiRenderDamageLabels(now,vp){const layer=$('poiDamageLayer');if(!layer)return;const active=poiWalkActive?poiDamageLabels.filter(d=>now-d.time<950):[];poiDamageLabels=active;layer.replaceChildren();for(const d of active){const elapsed=(now-d.time)/950,point=poiWorldToScreen(vp,d.x,d.y+elapsed*.75,d.z);if(!point)continue;const el=document.createElement('span');el.className='poiDamageNumber'+(d.isPlayer?' playerDamage':'');el.textContent='-'+d.value;el.style.left=point.x+'px';el.style.top=point.y+'px';el.style.opacity=String(Math.min(1,(1-elapsed)*2.5));layer.append(el)}}
function poiMonsterAt(x,z){for(const [obj,state] of poiMonsterStates){if(state.hp>0&&state.x===x&&state.z===z)return [obj,state]}return null}
function poiMonsterCanMove(x,z,except){if(!poiWalkCanStep(x,z)||poiMonsterAt(x,z))return false;if(poiWalkX===x&&poiWalkZ===z)return false;return true}
function poiMobFrame(now){if(!poiWalkActive||now<poiNextMobTick)return;poiNextMobTick=now+380;let changed=false;for(const [obj,state] of poiMonsterStates){if(state.hp<=0)continue;const dx=poiWalkX-state.x,dz=poiWalkZ-state.z,dist=Math.hypot(dx,dz);if(dist>6.5){if(pineGameActive&&Math.random()<.32){const [rx,rz]=[[0,1],[0,-1],[1,0],[-1,0]][Math.floor(Math.random()*4)],nx=state.x+rx,nz=state.z+rz;if(Math.max(Math.abs(nx-24),Math.abs(nz-24))>=10&&poiMonsterCanMove(nx,nz,state)){state.x=nx;state.z=nz;changed=true}}continue;}if(dist<=1.45){if(now>=state.nextAttack){state.nextAttack=now+1150;const amount=POI_MONSTER_STATS[obj.type].attack;poiPlayerHP=Math.max(0,poiPlayerHP-amount);poiSound('hurt');poiDamageNumber(poiWalkViewX+.5,poiWalkViewZ+.5,terrainY(poiWalkX,poiWalkZ)+1.8,amount,true);poiCombatHud();if(!poiPlayerHP){poiPlayerHP=POI_PLAYER_MAX_HP;poiWalkReset(poiSpawnX,poiSpawnZ);poiDamageLabels=[];toast('倒されたため初期位置にリスポーン');poiCombatHud();break}}continue}
 const steps=[[Math.sign(dx),0],[0,Math.sign(dz)]].filter(([sx,sz])=>sx||sz).sort((a,b)=>Math.abs(a[0]*dx+a[1]*dz)>Math.abs(b[0]*dx+b[1]*dz)?-1:1);
 for(const [sx,sz] of steps){const nx=state.x+sx,nz=state.z+sz;if((!pineGameActive||Math.max(Math.abs(nx-24),Math.abs(nz-24))>=10)&&poiMonsterCanMove(nx,nz,state)){state.x=nx;state.z=nz;changed=true;break}}
 }if(changed)dirty=true;if(pineGameActive)pineGameSave()}

let cameraTopDown=false,poiThirdPerson=false;
let poiCameraYaw=0,poiCameraPitch=.35,poiCameraDistance=5.5;
function poiCameraRelativeStep(key){
 const forward=[Math.sin(poiCameraYaw),Math.cos(poiCameraYaw)];
 const vectors={n:forward,s:[-forward[0],-forward[1]],e:[-forward[1],forward[0]],w:[forward[1],-forward[0]]};
 const v=vectors[key]||forward;
 return Math.abs(v[0])>Math.abs(v[1])?[Math.sign(v[0]),0]:[0,Math.sign(v[1])];
}

function togglePoiThirdPerson(){
 if(!poiWalkActive)return;
 poiThirdPerson=!poiThirdPerson;
 $('poiThirdView').textContent=poiThirdPerson?'俯瞰視点':'三人称視点';
 $('poiThirdView').setAttribute('aria-pressed',String(poiThirdPerson));
 cursorDirty=true;
}

function toggleTopDown(){
 if(poiWalkActive)poiWalkSet(false);
 cameraTopDown=!cameraTopDown;
 showEntireMap();cursorDirty=true;
 $('topDownView').classList.toggle('active',cameraTopDown);
 $('topDownView').setAttribute('aria-pressed',String(cameraTopDown));
 toast(cameraTopDown?'真上から表示':'斜め視点に戻しました');
}

function poiWalkIndoor(){
 const a=world.filter(o=>o.type==='pineSuperRoof');if(!a.length)return false;
 let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
 for(const p of a){left=Math.min(left,p.x);right=Math.max(right,p.x);top=Math.min(top,p.z);bottom=Math.max(bottom,p.z)}
 return poiWalkX>left&&poiWalkX<right&&poiWalkZ>top&&poiWalkZ<bottom;
}
function poiWalkRoof(){
 if(!poiWalkActive)return;
 const next=poiWalkIndoor();
 if(hideUpper!==next){hideUpper=next;$('hideUpper').checked=next;dirty=true;cursorDirty=true}
 $('poiRoofToggle').textContent=next?'屋根を表示':'屋根を隠す';
}
function poiWalkAvatar(now=performance.now()){
 if(poiWalkMesh){gl.deleteBuffer(poiWalkMesh.buf);poiWalkMesh=null}
 if(!poiWalkActive)return;
 const m=mesh(),body=mesh();
 characterHuman(body,0,0,0,false);
 const t=Math.max(0,Math.min(1,(now-poiWalkStarted)/POI_WALK_MS)),smooth=t*t*(3-2*t);
 const x=poiWalkViewX+.5;
 const z=poiWalkViewZ+.5;
 const y=terrainY(poiWalkX,poiWalkZ)+.03;
 const walking=t<1&&(poiWalkFromX!==poiWalkX||poiWalkFromZ!==poiWalkZ);
 const stride=walking?Math.sin(t*Math.PI*2)*.18:0;
 const actionPhase=Math.max(0,1-(now-poiWalkActionStarted)/260);
 const r=[2,3,0,1][poiWalkFacing];
 for(let i=0;i<body.p.length;i+=3){
  const lx=body.p[i],ly=body.p[i+1],lz=body.p[i+2];
  const swing=ly<.54&&Math.abs(lx)<.22?(lx<0?-stride:stride):
    ly>.45&&ly<.85&&Math.abs(lx)>.23?(lx<0?stride:-stride)*.40:0;
  const punch=actionPhase>0&&ly>.45&&ly<.85&&lx>.23?actionPhase*.40:0;
  const [rx,rz]=rot2(lx,lz+swing+punch,r);
  m.p.push(x+rx,y+ly+(walking?.015*Math.abs(stride):0),z+rz);
  const [nx,nz]=rot2(body.n[i],body.n[i+2],r);
  m.n.push(nx,body.n[i+1],nz);
  m.c.push(body.c[i],body.c[i+1],body.c[i+2]);
 }
 poiWalkMesh=upload(m);
}
function poiWalkFrame(now){
 if(!poiWalkActive)return;
 const t=Math.max(0,Math.min(1,(now-poiWalkStarted)/POI_WALK_MS)),smooth=t*t*(3-2*t);
 poiWalkViewX=poiWalkFromX+(poiWalkX-poiWalkFromX)*smooth;
 poiWalkViewZ=poiWalkFromZ+(poiWalkZ-poiWalkFromZ)*smooth;
 panX=poiWalkViewX+.5-MAP_W/2;panZ=poiWalkViewZ+.5-MAP_H/2;
 if(now-poiWalkStarted<=POI_WALK_MS+32||now-poiWalkActionStarted<290)poiWalkAvatar(now);
 poiMobFrame(now);
}
function poiWalkPassableDoor(type){
 // Pass through door/entrance cells across all material families, including
 // already-saved wall doors and older town door designs.
 return type==='door'||type==='pineSuperDoor'||type==='ruinDoorBroken'||
  type==='ruinDoorHanging'||/(?:Door|DoorOpen|Entrance)$/.test(type)||
  /^oldTown(?:Cream|Ochre|Rose|Mint|Blue|Sand)Shop$/.test(type);
}
function poiWalkCanStep(x,z){
 if(!validPos(x,z))return false;
 // Vehicles occupy more than one tile and cannot be walked through.
 if(world.some(o=>pineSuperVehicleType(o.type)&&Math.abs(o.x-x)<=1&&Math.abs(o.z-z)<=1))return false;
 const nonBlocking=new Set(['pineSuperLogo','pineSuperStripe','pineSuperBayEnd',
  'pineSuperCurb','pineSuperBollard','pineSuperSign']);
 // Check every occupied object on this cell. Door frames are walkable, but
 // an unrelated solid object placed in the doorway must still block passage.
 const cell=world.filter(o=>o.y===0&&o.x===x&&o.z===z&&(!poiWalkActive||!poiIsMonster(o.type)));
 if(poiWalkActive&&poiMonsterAt(x,z))return false;
 const hasDoor=cell.some(o=>poiWalkPassableDoor(o.type));
 // A door shares its cell with wall/trim pieces in some saved maps.
 // Those wall pieces must not seal the entrance; unrelated obstacles still block.
 return !cell.some(o=>{
  if(isFloor(o.type)||poiWalkPassableDoor(o.type)||nonBlocking.has(o.type))return false;
  if(hasDoor&&(isWallId(o.type)||/(?:wall|Wall|Frame|Trim|Lintel|Facade)/.test(o.type)))return false;
  return true;
 });
}
function poiWalkCamera(){panX=poiWalkViewX+.5-MAP_W/2;panZ=poiWalkViewZ+.5-MAP_H/2;zoom=Math.max(zoom,.82);cursorDirty=true}
function poiWalkStatus(){const e=$('poiWalkCoords');if(e)e.textContent='位置 '+(poiWalkX+1)+','+(poiWalkZ+1)+(poiWalkIndoor()?'・店内':'・屋外')}
function poiWalkStep(dx,dz){
 if(!poiWalkActive)return;
 const now=performance.now();
 if(now<poiWalkNextReady)return;
 poiWalkFacing=dx===1?1:dx===-1?3:dz===-1?0:2;
 if(!poiWalkCanStep(poiWalkX+dx,poiWalkZ+dz)){poiWalkAvatar();return}
 poiWalkFromX=poiWalkX;poiWalkFromZ=poiWalkZ;poiWalkX+=dx;poiWalkZ+=dz;
 poiWalkStarted=now;poiWalkNextReady=now+POI_WALK_MS;
 poiSound('step');poiWalkRoof();poiWalkAvatar(poiWalkStarted);poiWalkStatus();if(pineGameActive)pineGameSave(true);
}
function poiWalkAction(){
 if(!poiWalkActive)return;
 const now=performance.now();if(now<poiAttackReady)return;poiAttackReady=now+300;poiWalkActionStarted=now;poiWalkAvatar(now);poiSound('attack');
 const delta=[[0,-1],[1,0],[0,1],[-1,0]][poiWalkFacing];
 const x=poiWalkX+delta[0],z=poiWalkZ+delta[1];
 const monster=poiMonsterAt(x,z);
 if(monster){const [obj,state]=monster;state.hp=Math.max(0,state.hp-POI_PLAYER_ATTACK);poiSound('hit');poiDamageNumber(state.x+.5,state.z+.5,terrainY(state.x,state.z)+1.8,POI_PLAYER_ATTACK);dirty=true;if(!state.hp)toast('モンスターを倒した');if(pineGameActive)pineGameSave(true);return}
 const target=world.find(o=>o.x===x&&o.z===z&&o.y===0&&!isFloor(o.type)&&!poiIsMonster(o.type));
 if(target){
  const item=palette.find(p=>p.id===target.type);
  toast((item?.name||'目の前のオブジェクト')+'を調べた');
 }else{
  toast('攻撃');
 }
}
function poiWalkReset(x,z){
 poiWalkX=x;poiWalkZ=z;poiWalkFromX=x;poiWalkFromZ=z;poiWalkViewX=x;poiWalkViewZ=z;poiWalkStarted=-10000;poiWalkNextReady=0;
 if(poiWalkActive){poiWalkRoof();poiWalkAvatar();poiWalkCamera();poiWalkStatus()}
}
function poiWalkSpawnNearCenter(){
 const cx=Math.floor((MAP_W-1)/2),cz=Math.floor((MAP_H-1)/2);
 const maxRadius=MAP_W+MAP_H;
 for(let radius=0;radius<=maxRadius;radius++){
  let fallback=null;
  for(let dz=-radius;dz<=radius;dz++){
   const offset=radius-Math.abs(dz);
   for(const dx of offset===0?[0]:[-offset,offset]){
    const x=cx+dx,z=cz+dz;
    if(!poiWalkCanStep(x,z))continue;
    const open=[[1,0],[-1,0],[0,1],[0,-1]].filter(([nx,nz])=>poiWalkCanStep(x+nx,z+nz)).length;
    if(open>=2)return{x,z};
    if(open>=1&&!fallback)fallback={x,z};
   }
  }
  if(fallback)return fallback;
 }
 return null;
}
function poiWalkSet(active){
 if(active===poiWalkActive)return;
 if(active){
  const spawn=poiWalkSpawnNearCenter();
  if(!spawn){toast('プレイ可能な空きマスがありません');return}
  poiSpawnX=spawn.x;poiSpawnZ=spawn.z;
  poiWalkReset(spawn.x,spawn.z);
  poiCameraYaw=0;poiCameraPitch=.35;poiCameraDistance=5.5;
  poiThirdPerson=false;
  $('poiThirdView').textContent='三人称視点';
  $('poiThirdView').setAttribute('aria-pressed','false');
  cameraTopDown=false;
  $('topDownView').classList.remove('active');
  $('topDownView').setAttribute('aria-pressed','false');
 }
 poiWalkActive=active;
 if(active)poiAudioStart();else poiAudioStop();
 if(active)poiResetCombat();else{poiMonsterStates.clear();poiDamageLabels=[];}
 poiCombatHud();
 if(active){
  poiWalkOldRoof=hideUpper;
  hideUpper=false;$('hideUpper').checked=false;
  level=0;$('level').value='0';mode='move';
  poiWalkFromX=poiWalkX;poiWalkFromZ=poiWalkZ;poiWalkViewX=poiWalkX;poiWalkViewZ=poiWalkZ;
  poiWalkRoof();poiWalkCamera();
 }else{
  hideUpper=poiWalkOldRoof;$('hideUpper').checked=hideUpper;
  if(poiWalkMesh){gl.deleteBuffer(poiWalkMesh.buf);poiWalkMesh=null}
  poiThirdPerson=false;
  $('poiThirdView').textContent='三人称視点';
  $('poiThirdView').setAttribute('aria-pressed','false');
  showEntireMap();
 }
 $('poiWalkPad').classList.toggle('active',active);
 $('poiWalkToggle').textContent=active?'プレイ中':'プレイ';
 $('poiRoofToggle').textContent=hideUpper?'屋根を表示':'屋根を隠す';
 poiWalkAvatar();poiWalkStatus();dirty=true;cursorDirty=true;updateSelected();
}
// Exterior cells are flood-filled independently on each floor. A face pointing
// into a closed room is smooth; a face pointing into connected outdoor air is
// decorated. This is recalculated when blocks or dimensions change.
function wallExteriorLookup(visible){
 const layers=new Map(),blocking=t=>isWallId(t)||/^(?:wall|stonewall|woodwall|brickwall|plasterwall|mosswall|ironwall)(?:Window|Door|Counter)$/.test(t)||t==='door'||t==='window';
 for(const o of visible){
  if(!blocking(o.type))continue;
  if(!layers.has(o.y))layers.set(o.y,new Map());
  layers.get(o.y).set(o.x+','+o.z,o);
 }
 const outdoors=new Map(),count=MAP_W*MAP_H;
 for(const [level,blocks] of layers){
  const blocked=new Uint8Array(count),outside=new Uint8Array(count),queue=new Int32Array(count);
  for(const o of blocks.values())if(validPos(o.x,o.z))blocked[o.z*MAP_W+o.x]=1;
  let head=0,tail=0;
  const add=(x,z)=>{
   const i=z*MAP_W+x;
   if(!blocked[i]&&!outside[i]){outside[i]=1;queue[tail++]=i}
  };
  for(let x=0;x<MAP_W;x++){add(x,0);add(x,MAP_H-1)}
  for(let z=0;z<MAP_H;z++){add(0,z);add(MAP_W-1,z)}
  while(head<tail){
   const idx=queue[head++],x=idx%MAP_W,z=(idx-x)/MAP_W;
   if(x>0)add(x-1,z);
   if(x+1<MAP_W)add(x+1,z);
   if(z>0)add(x,z-1);
   if(z+1<MAP_H)add(x,z+1);
  }
  outdoors.set(level,outside);
 }
 return{layers,outdoors};
}
function wallFaceState(o,lookup){
 const neighbors=lookup.layers.get(o.y),outdoor=lookup.outdoors.get(o.y);
 const visible=[],exterior=[];
 for(const [dx,dz] of [[0,1],[-1,0],[0,-1],[1,0]]){
  const x=o.x+dx,z=o.z+dz,inBounds=validPos(x,z);
  const occupied=inBounds&&neighbors.has(x+','+z)&&terrainLevel(x,z)===terrainLevel(o.x,o.z);
  visible.push(!occupied);
  exterior.push(!occupied&&(!inBounds||outdoor[z*MAP_W+x]===1));
 }
 return{visible,exterior};
}
function makeScene(){
 const m=mesh(),visible=world.filter(o=>!hideUpper||o.y<=level).filter(o=>!poiWalkActive||!poiIsMonster(o.type)||!poiMonsterStates.has(o)||poiMonsterStates.get(o).hp>0).map(o=>{const state=poiWalkActive&&poiMonsterStates.get(o);return state?{...o,x:state.x,z:state.z}:o});
 const floors=new Map(world.filter(o=>o.y===0&&isFloor(o.type)).map(o=>[o.x+','+o.z,o.type]));
 for(let z=0;z<MAP_H;z++)for(let x=0;x<MAP_W;x++){
  const kind=floors.get(x+','+z)||'grass';
  const tmp=mesh();
  addFloorTile(tmp,x,z,kind,MAP_W*MAP_H,ROAD_DIAGONALS.has(kind)?roadDiagonalConnections(floors,x,z,kind):ROAD_IDS.has(kind)&&!kind.endsWith('Full')?roadConnections(floors,x,z,kind):0);
  if(floors.has(x+','+z))shoreline(tmp,x,z,floors);
  shiftMesh(m,tmp,terrainY(x,z));
  const isWater=['river','water','lake','sea'].includes(kind);
  if(isWater){
   for(const [dx,dz] of [[0,-1],[1,0],[0,1],[-1,0]]){
    const nx=x+dx,nz=z+dz;
    if(nx<0||nz<0||nx>=MAP_W||nz>=MAP_H)continue;
    const neighbor=floors.get(nx+','+nz);
    if(['river','water','lake','sea'].includes(neighbor)&&terrainLevel(x,z)>terrainLevel(nx,nz))
     waterfallFace(m,x,z,dx,dz,terrainLevel(x,z),terrainLevel(nx,nz));
   }
  }
  const h=terrainLevel(x,z);
  if(h)for(const [dx,dz,face] of [[-1,0,3],[1,0,1],[0,-1,0],[0,1,2]]){
   const nx=x+dx,nz=z+dz,nh=validPos(nx,nz)?terrainLevel(nx,nz):0;
   if(validPos(nx,nz)&&h-nh===1&&terrainPassable(x,z,nx,nz))continue;
   terrainSide(m,x,z,h,nh,face);
  }

 }
 // Light scuffed-earth patches appear near grazing sheep, without replacing paths.
 for(const animal of visible.filter(o=>o.y===0&&o.type==='sheep')){
  for(const [dx,dz] of [[0,0],[-1,0],[1,0],[0,-1],[0,1]]){
   const xx=animal.x+dx,zz=animal.z+dz;
   if(!validPos(xx,zz))continue;
   const floor=floors.get(xx+','+zz)||'grass';
   if(!['grass','grassMeadow','grassTrampled','grassPatch','grassWild'].includes(floor))continue;
   if(surfaceNoise(xx*19+11,zz*17+3)<.32)continue;
   const t=mesh();roadRect(t,xx,zz,.20,.39,.46,.54,.019,[.47,.43,.32]);
   roadRect(t,xx,zz,.57,.20,.72,.32,.020,[.40,.49,.34]);
   shiftMesh(m,t,terrainY(xx,zz));
  }
 }
 // Upper-level floors are independent of the ground and share the same
 // road/stone/wood material renderer. Translate a local mesh vertically.
 const raised=visible.filter(o=>o.y>0&&isFloor(o.type));
 const floorLayers=new Map();
 for(const o of raised){
  if(!floorLayers.has(o.y))floorLayers.set(o.y,new Map());
  floorLayers.get(o.y).set(o.x+','+o.z,o.type);
 }
 for(const o of raised){
  const layer=floorLayers.get(o.y),tmp=mesh(),kind=o.type;
  addFloorTile(tmp,o.x,o.z,kind,MAP_W*MAP_H,ROAD_IDS.has(kind)&&!kind.endsWith('Full')?roadConnections(layer,o.x,o.z,kind):0);
  shiftMesh(m,tmp,o.y*1.4+terrainY(o.x,o.z));
 }
 const bridgeLookup=new Map(visible.filter(o=>BRIDGE_IDS.has(o.type)).map(o=>[o.x+','+o.z,o]));
 const fenceLookup=new Map(visible.filter(o=>/^fence(Wood|Stone|Iron)/.test(o.type)).map(o=>[o.x+','+o.z+','+o.y,o]));
 const roofs=new Map(visible.filter(o=>roofFamily(o.type)).map(o=>[o.x+','+o.z+','+o.y,o]));
 const wallLookup=wallExteriorLookup(visible);
 houseFacadeDetails(m,visible);
 const groups=residentialRoofComponents(visible.filter(o=>RESIDENTIAL_ROOFS.has(o.type)));
 const allRoofLookup=new Map(visible.filter(o=>RESIDENTIAL_ROOFS.has(o.type)).map(o=>[o.x+','+o.z+','+o.y,o]));
 for(const group of groups)residentialRoofGeometry(m,group,allRoofLookup);
 for(const o of visible){
  if(isFloor(o.type)||RESIDENTIAL_ROOFS.has(o.type))continue;
  if(AUTO_ROOFS.has(o.type)){const temp=mesh();connectedRoofGeometry(temp,o,roofs);shiftMesh(m,temp,terrainY(o.x,o.z))}
  else if(BRIDGE_IDS.has(o.type))bridgeConnectedGeometry(m,o,bridgeLookup);
  else if(o.type==='pineLandingCraft')pineLandingCraftGeometry(m,o.x+.5,o.z+.5);
  else if(o.type.startsWith('pineHarbor'))pineHarborGeometry(m,o);
  else if(o.type.startsWith('pineSuper'))pineSupermarketGeometry(m,o);
  else if(isWallId(o.type)){const faces=wallFaceState(o,wallLookup);wallBlock(m,o.type,o.x+.5,o.y*1.4+terrainY(o.x,o.z),o.z+.5,o.rot||0,faces.visible,faces.exterior)}
  else if(o.type==='terrainStairs')elevationStairGeometry(m,o.x,o.z,o.y*1.4+terrainY(o.x,o.z),o.rot||0);
  else if(/^fence(Wood|Stone|Iron)/.test(o.type)&&connectedFenceGeometry(m,o,fenceLookup)){} 
  else deco(m,o.type,o.x+.5,o.y*1.4+terrainY(o.x,o.z),o.z+.5,o.rot||0);
 }
 return upload(m);
}
function upload(m){const n=m.p.length/3,data=new Float32Array(n*9);for(let i=0;i<n;i++){const a=i*9,b=i*3;for(let j=0;j<3;j++){data[a+j]=m.p[b+j];data[a+3+j]=m.n[b+j];data[a+6+j]=m.c[b+j]}}const vbo=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);return{buf:vbo,count:n}}
const VERT='precision mediump float;attribute vec3 aPos;attribute vec3 aNorm;attribute vec3 aCol;uniform mat4 uMVP;varying vec3 vCol;void main(){gl_Position=uMVP*vec4(aPos,1.0);float l=.60+.40*max(dot(normalize(aNorm),normalize(vec3(-.4,1.0,.35))),0.0);vCol=aCol*l;}';
const FRAG='precision mediump float;varying vec3 vCol;void main(){gl_FragColor=vec4(pow(max(vCol,vec3(0.0)),vec3(.92)),1.0);}';
function sh(t,src){const s=gl.createShader(t);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s}
let program;try{program=gl.createProgram();gl.attachShader(program,sh(gl.VERTEX_SHADER,VERT));gl.attachShader(program,sh(gl.FRAGMENT_SHADER,FRAG));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program))}catch(e){$('canvasTip').textContent='WebGLシェーダーエラー: '+e.message;return}
gl.useProgram(program);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LESS);gl.clearColor(0,0,0,0);const loc={p:gl.getAttribLocation(program,'aPos'),n:gl.getAttribLocation(program,'aNorm'),c:gl.getAttribLocation(program,'aCol'),mvp:gl.getUniformLocation(program,'uMVP')};
try{initSignProgram()}catch(e){console.warn('2D sign textures unavailable',e)}
function mult(a,b){const c=new Float32Array(16);for(let i=0;i<4;i++)for(let j=0;j<4;j++)for(let k=0;k<4;k++)c[j*4+i]+=a[k*4+i]*b[j*4+k];return c}
function ortho(l,r,b,t,n,f){return new Float32Array([2/(r-l),0,0,0,0,2/(t-b),0,0,0,0,-2/(f-n),0,-(r+l)/(r-l),-(t+b)/(t-b),-(f+n)/(f-n),1])}
function look(eye,target){let f=eye.map((v,i)=>v-target[i]),len=Math.hypot(...f);f=f.map(v=>v/len);let right=[f[2],0,-f[0]];len=Math.hypot(...right);right=right.map(v=>v/len);const up=[f[1]*right[2]-f[2]*right[1],f[2]*right[0]-f[0]*right[2],f[0]*right[1]-f[1]*right[0]];return new Float32Array([right[0],up[0],f[0],0,right[1],up[1],f[1],0,right[2],up[2],f[2],0,-right.reduce((s,v,i)=>s+v*eye[i],0),-up.reduce((s,v,i)=>s+v*eye[i],0),-f.reduce((s,v,i)=>s+v*eye[i],0),1])}
function draw(mesh,vp){if(!mesh||!mesh.count)return;gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buf);for(const [a,offset] of [[loc.p,0],[loc.n,12],[loc.c,24]]){gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,3,gl.FLOAT,false,36,offset)}gl.uniformMatrix4fv(loc.mvp,false,vp);gl.drawArrays(gl.TRIANGLES,0,mesh.count)}
function layout(){const dpr=Math.min(devicePixelRatio||1,1.5),w=Math.max(1,Math.round(canvas.clientWidth*dpr)),h=Math.max(1,Math.round(canvas.clientHeight*dpr));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h)}return{w:canvas.clientWidth,h:canvas.clientHeight,aspect:canvas.clientWidth/canvas.clientHeight}}
function zoomForFullMap(){
 const aspect=Math.max(.25,canvas.clientWidth/Math.max(1,canvas.clientHeight));
 const c=Math.abs(Math.cos(yaw)),sn=Math.abs(Math.sin(yaw));
 const horizontal=(MAP_W*c+MAP_H*sn)/2/aspect;
 const vertical=(MAP_W*sn+MAP_H*c)*Math.sin(cameraTopDown?Math.PI/2-.001:.86)/2;
 const height=world.reduce((top,o)=>Math.max(top,o.y),0)*1.4+Math.max(0,...terrainHeights.values())*TERRAIN_STEP;// Extra margin prevents bottom map corners from being clipped on tall mobile screens.
 return Math.max(.025,Math.min(4,9/(Math.max(horizontal,vertical)+height*.55+1.2)*.84));
}
function showEntireMap(){panX=panZ=0;zoom=zoomForFullMap();cursorDirty=true}
function perspective(fov,aspect,near,far){
 const f=1/Math.tan(fov/2);
 return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0]);
}
function parameters(){
 const q=layout(),halfH=9/zoom,halfW=halfH*q.aspect;
 const centerX=MAP_W/2+panX,centerZ=MAP_H/2+panZ;
 const elev=cameraTopDown?Math.PI/2-.001:.86;
 const targetY=poiWalkActive?0:hideUpper?level*1.4:Math.min(8.5,worldMaxLevel*.7+Math.max(0,...terrainHeights.values())*TERRAIN_STEP*.5);
 const sceneReach=Math.hypot(MAP_W,MAP_H)+Math.max(0,worldMaxLevel)*1.4+TERRAIN_MAX*TERRAIN_STEP;
 if(poiWalkActive&&poiThirdPerson){
  // Independent orbit camera: walking changes the avatar's direction, not the camera.
  const x=poiWalkViewX+.5,z=poiWalkViewZ+.5;
  const ground=terrainY(poiWalkX,poiWalkZ);
  const horizontal=poiCameraDistance*Math.cos(poiCameraPitch);
  const eye=[x-horizontal*Math.sin(poiCameraYaw),ground+1.1+poiCameraDistance*Math.sin(poiCameraPitch),z-horizontal*Math.cos(poiCameraYaw)];
  const target=[x,ground+1.1,z];
  return{...q,halfH,halfW,centerX,centerZ,elev,targetY,vp:mult(perspective(Math.PI/3,Math.max(.1,q.aspect),.12,Math.max(250,sceneReach*3)),look(eye,target))};
 }
 const cameraDistance=Math.max(80,sceneReach*1.6+24);
 const eye=[centerX+cameraDistance*Math.sin(yaw)*Math.cos(elev),targetY+cameraDistance*Math.sin(elev),centerZ+cameraDistance*Math.cos(yaw)*Math.cos(elev)];
 return{...q,halfH,halfW,centerX,centerZ,elev,targetY,vp:mult(ortho(-halfW,halfW,-halfH,halfH,.1,cameraDistance+sceneReach*2+80),look(eye,[centerX,targetY,centerZ]))};
}
function cursorAt(clientX,clientY){
 const b=canvas.getBoundingClientRect(),p=parameters(),nx=(clientX-b.left)/b.width*2-1,ny=1-(clientY-b.top)/b.height*2,a=nx*p.halfW;
 let x=0,z=0,height=0;
 for(let i=0;i<5;i++){
  const c=(-ny*p.halfH+(level*1.4+height-p.targetY)*Math.cos(p.elev))/Math.sin(p.elev);
  x=Math.floor(p.centerX+a*Math.cos(yaw)+c*Math.sin(yaw));
  z=Math.floor(p.centerZ-a*Math.sin(yaw)+c*Math.cos(yaw));
  height=validPos(x,z)?terrainY(x,z):0;
 }
 return{x,z};
}
function makeCursor(){const m=mesh();if(!hover||!validPos(hover.x,hover.z))return upload(m);const x=hover.x+.5,z=hover.z+.5,y=level*1.4+terrainY(hover.x,hover.z)+.205;const c=[.96,.73,.30],t=.045;cube(m,x,y,z-.45,.95,t,.055,c);cube(m,x,y,z+.45,.95,t,.055,c);cube(m,x-.45,y,z,.055,t,.95,c);cube(m,x+.45,y,z,.055,t,.95,c);return upload(m)}
