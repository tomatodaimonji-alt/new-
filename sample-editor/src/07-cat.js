// v31: a single scalable, original low-poly cat; offline WebGL geometry.
const cat={x:0,z:12,scale:1.5,time:0,heading:Math.PI,walkPhase:0,
 punch:0,punchTime:0,purr:true,purrIntensity:0,step:0,controlled:false,impactDone:false,impactCount:0};
const catScaleInput=document.getElementById('catScale');
const catSizeText=document.getElementById('catSizeText');
const catPurrButton=document.getElementById('catPurr');
const catPunchButton=document.getElementById('catPunch');
const catFindButton=document.getElementById('catFind');
const catControlButton=document.getElementById('catControl');
const catActionButton=document.getElementById('catAction');
catScaleInput.addEventListener('input',()=>{
 cat.scale=Math.max(.5,Math.min(12,Number(catScaleInput.value)||1));
 catSizeText.textContent=cat.scale.toFixed(1)+'倍';
});
catPunchButton.addEventListener('click',()=>{
 unlockAudio();
 startCatPunch();
});
catControlButton.addEventListener('click',()=>{
 if(shootState.enabled)return;
 cat.controlled=!cat.controlled;
 resetStick();
 if(cat.controlled){cameraDistance=Math.max(cameraDistance,cat.scale*2+4);cameraYaw=cat.heading+Math.PI;}
 catControlButton.textContent=cat.controlled?'人間に戻る':'猫を操作';
 catActionButton.hidden=!cat.controlled;
 catFindButton.hidden=cat.controlled;
});
catActionButton.addEventListener('click',()=>{unlockAudio();startCatPunch()});
window.addEventListener('keydown',e=>{if((e.code==='Space'||e.key===' ')&&cat.controlled&&!e.repeat){e.preventDefault();unlockAudio();startCatPunch()}});
function startCatPunch(){
 if(shootState.enabled||cat.punchTime)return false;
 cat.punchTime=.001;cat.punch=0;cat.impactDone=false;
 return true;
}
catPurrButton.addEventListener('click',()=>{
 unlockAudio();
 cat.purr=!cat.purr;
 catPurrButton.textContent=cat.purr?'ゴロゴロ ON':'ゴロゴロ OFF';
});
catFindButton.addEventListener('click',()=>{
 if(shootState.enabled)return;
 // Stay on the open central road rather than teleporting into a storefront.
 player.x=cat.x;
 player.z=cat.z-Math.max(3,cat.scale*1.1);
 resetStick();
});
function catBlocks(x,z){
 return Math.hypot(x-cat.x,z-cat.z)<.43*cat.scale+.25;
}
function updateCat(dt){
 const t=Math.max(0,Math.min(.05,dt));
 cat.time+=t;
 // Keep a stationary idle cat when human-controlled mode is selected.
 if(!cat.controlled){
  cat.walkPhase+=t*(cat.punchTime?0:.85);
  cat.x=Math.sin(cat.time*.12)*1.8;
  cat.z=12+Math.sin(cat.time*.17)*1.5;
  cat.heading=Math.PI+Math.sin(cat.time*.12)*.4;
 }
 if(cat.punchTime){
  cat.punchTime+=t;
  const q=cat.punchTime/.36;
  // Snappy acceleration: 0.12 seconds to contact, fast recoil.
  cat.punch=q<1?Math.pow(Math.sin(Math.PI*Math.min(1,q)),.67):0;
  if(q>=.32&&!cat.impactDone){cat.impactDone=true;cat.impactCount=catStrike()}
  if(q>=1)cat.punchTime=0;
 }
 cat.purrIntensity+=((cat.purr?1:0)-cat.purrIntensity)*Math.min(1,t*3);
 updateCatAudio();
}
function catTriangle(a,b,c,tint){tri(a,b,c,color(tint));tri(c,b,a,color(tint))}
function renderCat(){
 const start=vertices.length;
 const pace=cat.punchTime?0:Math.sin(cat.walkPhase*2)*.075;
 // Local cat faces -Z; all geometry is scaled/rotated as one unit.
 const fur=0xb9a490,highlight=0xd5c4ad,dark=0x6d635b;
 playerOval(0,.64,.07,.35,.36,.64,fur,14,10); // trunk
 playerOval(0,.64,-.31,.345,.30,.33,highlight,12,9); // chest
 playerOval(0,.86,-.52,.37,.33,.35,fur,16,12); // cheeked head
 playerOval(0,.77,-.81,.27,.19,.115,highlight,12,8); // broad muzzle
 // Pointed feline ears rather than rounded human ears.
 for(const side of [-1,1]){
  catTriangle([side*.16,1.11,-.57],[side*.31,1.39,-.55],
   [side*.35,1.02,-.55],fur);
  catTriangle([side*.20,1.10,-.575],[side*.30,1.31,-.574],
   [side*.32,1.08,-.576],0xc38e86);
  // Almond eyes, black pupils and glints.
  playerOval(side*.153,.91,-.84,.072,.049,.020,0x88a374,11,7);
  playerOval(side*.153,.91,-.859,.018,.040,.012,0x282724,8,5);
  playerOval(side*.137,.927,-.869,.009,.012,.007,0xf5f1e8,7,4);
  playerOval(side*.091,.737,-.917,.102,.070,.054,highlight,10,7);
  // Whiskers: thin tapered geometry.
  for(let w=0;w<3;w++)playerLimb(
   [side*.12,.76+(w-1)*.026,-.937],
   [side*(.44+w*.045),.77+(w-1)*.060,-.9],.004,.004,0xede1cf);
 }
 catTriangle([-.043,.806,-.943],[.043,.806,-.943],[0,.759,-.971],0x9f7070);
 playerLimb([0,.759,-.97],[0,.728,-.97],.007,.006,dark);
 for(const side of [-1,1])playerLimb([0,.728,-.97],[side*.055,.711,-.962],.006,.006,dark);
 // Animated paws and shins. Right foreleg reaches forward to swat.
 for(const side of [-1,1]){
  for(const back of [false,true]){
   const z=back?.48:-.38;
   const swing=pace*(back?-1:1)*side;
   const swat=!back&&side===1?cat.punch:0;
   const y=back?.42:.46;
   playerOval(side*.25,y,z,.14,.29,.18,fur,10,7);
   playerLimb([side*.25,y,z],[side*(.26+swat*.4),.17+swat*.44,z-swat*.58+swing],
    .085,.092,fur);
   playerOval(side*(.26+swat*.4),.12+swat*.44,z-swat*.58+swing,
    .124,.115,.151,highlight,10,7);
   for(let toe=-1;toe<=1;toe++)playerOval(
    side*(.26+swat*.4)+toe*.066,.067+swat*.44,z-.12-swat*.58+swing,
    .037,.042,.055,0xe0d2bd,7,5);
  }
 }
 // Curved, flexible tail built from linked tapered sections.
 let prev=[0,.75,.59];
 for(let i=1;i<=7;i++){
  const u=i/7;
  const next=[Math.sin(cat.time*1.6+u*3)*.16*u,.75+u*.72+.18*Math.sin(u*Math.PI),.59+u*.64];
  playerLimb(prev,next,.10*(1-u*.30),.09*(1-u*.22),i===7?dark:fur);
  prev=next;
 }
 // Small tabby stripe accents on back, not texture downloads.
 for(let i=0;i<3;i++)playerOval(0,.93,.03+i*.23,.23,.012,.042,dark,10,5);
 const rot=cat.heading-Math.PI,cs=Math.cos(rot),sn=Math.sin(rot);
 for(let i=start;i<vertices.length;i+=6){
  const x=vertices[i]*cat.scale,z=vertices[i+2]*cat.scale;
  vertices[i]=cat.x+x*cs+z*sn;
  vertices[i+1]*=cat.scale;
  vertices[i+2]=cat.z-x*sn+z*cs;
 }
}
function renderCatShadow(){
 const radius=.70*cat.scale,seg=20,y=.005;
 for(let i=0;i<seg;i++){
  const a=i*2*Math.PI/seg,b=(i+1)*2*Math.PI/seg;
  tri([cat.x,y,cat.z],
   [cat.x+Math.cos(a)*radius,y,cat.z+Math.sin(a)*radius*.63],
   [cat.x+Math.cos(b)*radius,y,cat.z+Math.sin(b)*radius*.63],
   color(0x444039));
 }
}
// AudioContext only starts after user taps a cat control.
let catPurrOsc=null,catPurrGain=null,catPurrLfo=null;
function updateCatAudio(){
 if(!audio||audio.state!=='running')return;
 if(!catPurrOsc){
  catPurrOsc=audio.createOscillator();
  catPurrOsc.type='sine';
  catPurrOsc.frequency.value=34;
  const filter=audio.createBiquadFilter();filter.type='lowpass';filter.frequency.value=100;
  catPurrGain=audio.createGain();catPurrGain.gain.value=0;
  catPurrOsc.connect(filter);filter.connect(catPurrGain);catPurrGain.connect(audio.destination);
  catPurrOsc.start();
 }
 // A sub-bass rumble that grows with scale; bounded to avoid clipping.
 const scalePower=Math.min(1,(cat.scale/12)**1.3);
 const rhythmic=.72+.28*Math.sin(cat.time*2*Math.PI*22);
 const amplitude=cat.purrIntensity*(.008+.11*scalePower)*rhythmic;
 catPurrGain.gain.setTargetAtTime(amplitude,audio.currentTime,.055);
 catPurrOsc.frequency.setTargetAtTime(27+14/Math.sqrt(cat.scale),audio.currentTime,.07);
}
function catCameraShake(dt){
 // Visual-only micro shake; giant purr and active punch shake the view.
 const magnitude=Math.min(.095,Math.max(0,cat.scale-2)/10*.075)*
  (cat.purrIntensity*.30+cat.punch*.95);
 return Math.sin(cat.time*57)*magnitude;
}
