// v19: shorts shot list and portrait preview. Capture setup only: no video encoder yet.
// Shot records are separate from the editable town model, with stable IDs and schema.
const SHOTS_KEY='sample-editor-shots-v1';
const shootState={enabled:false,portrait:true,playing:false,shots:[],elapsed:0,segment:0,
 focusX:0,focusZ:0,yaw:0,pitch:0,distance:12};
const shootButton=document.getElementById('shootToggle');
const shootPanel=document.getElementById('shootPanel');
const shootStatus=document.getElementById('shootStatus');
const shotCounter=document.getElementById('shotCounter');
const previewBorder=document.getElementById('portraitGuide');
function validateShot(shot){
 return shot&&typeof shot.id==='string'&&shot.id.length<64&&
 ['x','z','yaw','pitch','distance'].every(k=>Number.isFinite(shot[k]))&&
 Math.abs(shot.x)<200&&Math.abs(shot.z)<200&&shot.distance>=4.5&&shot.distance<=26&&
 shot.pitch>=-1.3&&shot.pitch<=1.54;
}
function restoreShots(){
 try{
  const value=JSON.parse(localStorage.getItem(SHOTS_KEY)||'null');
  if(value&&value.schema===1&&Array.isArray(value.shots))
   shootState.shots=value.shots.filter(validateShot).slice(0,12);
 }catch(e){console.warn('Shot data unavailable',e)}
}
function persistShots(){
 try{
  localStorage.setItem(SHOTS_KEY,JSON.stringify({schema:1,shots:shootState.shots}));
  return true;
 }catch(e){console.warn('Could not save shots',e);return false}
}
function shotAngle(from,to,t){
 const diff=Math.atan2(Math.sin(to-from),Math.cos(to-from));
 return from+diff*t;
}
function currentShot(){
 return {id:'shot-'+Date.now()+'-'+shootState.shots.length,
  x:shootState.focusX,z:shootState.focusZ,
  yaw:cameraYaw,pitch:cameraPitch,distance:cameraDistance};
}
// v23: camera positions are reusable shot presets, not duplicate scene geometry.
// Each preset targets an existing part of the convenience-study POI.
const STORE_SHOT_PRESETS={
 exterior:{label:'店外全景',x:0,z:77.2,yaw:Math.PI,pitch:-.21,distance:15.5},
 doorway:{label:'入口',x:0,z:72.4,yaw:Math.PI,pitch:-.11,distance:7.0},
 aisle:{label:'商品棚',x:-2.05,z:78.1,yaw:Math.PI/2,pitch:-.17,distance:5.0},
 checkout:{label:'レジ',x:-5.5,z:72.35,yaw:Math.PI*.64,pitch:-.20,distance:5.4},
 cold:{label:'冷蔵ケース',x:0.30,z:87.0,yaw:Math.PI,pitch:-.14,distance:6.8}
};
function chooseStoreCamera(name){
 const preset=STORE_SHOT_PRESETS[name];
 if(!preset||!shootState.enabled)return false;
 shootState.playing=false;
 shootState.focusX=preset.x;shootState.focusZ=preset.z;
 cameraYaw=preset.yaw;cameraPitch=preset.pitch;cameraDistance=preset.distance;
 cameraTouches.clear();pinchActive=false;pinchDistance=0;
 shootingUI(preset.label+'を表示中。カット追加で保存');
 return true;
}
function shootingUI(message){
 shootButton.textContent=shootState.enabled?'探索に戻る':'撮影';
 shootPanel.hidden=!shootState.enabled;
 previewBorder.hidden=!shootState.enabled||!shootState.portrait;
 document.body.classList.toggle('shooting',shootState.enabled);
 document.body.classList.toggle('portrait-preview',shootState.enabled&&shootState.portrait);
 shotCounter.textContent=shootState.shots.length+' カット / 最大12';
 shootStatus.textContent=message||(
  shootState.playing?'カメラ再生中':shootState.enabled?'構図を決めて「カット追加」':'撮影モードを終了');
 const play=document.getElementById('shootPlay');
 play.disabled=shootState.shots.length===0;
}
function startShooting(){
 shootState.enabled=true;shootState.playing=false;shootState.elapsed=0;
 shootState.focusX=player.x;shootState.focusZ=player.z;
 resetStick();cameraTouches.clear();pinchActive=false;pinchDistance=0;
 if(editorOpen){editorOpen=false;editPanel.hidden=true;editToggle.textContent='編集'}
 shootingUI();
}
function stopShooting(){
 shootState.playing=false;shootState.enabled=false;
 resetStick();shootingUI();
}
function addShot(){
 if(shootState.playing)return;
 if(shootState.shots.length>=12){shootingUI('カットは最大12個');return}
 const shot=currentShot();
 shootState.shots.push(shot);
 shootingUI(persistShots()?'カットを保存しました':'保存に失敗しました');
}
function playShots(){
 if(!shootState.shots.length)return;
 shootState.playing=true;shootState.elapsed=0;shootState.segment=0;
 const first=shootState.shots[0];
 shootState.focusX=first.x;shootState.focusZ=first.z;
 cameraYaw=first.yaw;cameraPitch=first.pitch;cameraDistance=first.distance;
 shootingUI('カットを再生中');
}
function stopShots(){
 shootState.playing=false;shootingUI('再生を停止');
}
function updateShots(dt){
 if(!shootState.enabled||!shootState.playing)return;
 const shots=shootState.shots;
 if(!shots.length){stopShots();return}
 // Hold a single cut for three seconds. With multiple cuts, smooth 3s travel per segment.
 shootState.elapsed+=dt;
 const duration=3,segments=Math.max(1,shots.length-1);
 const time=Math.min(shootState.elapsed,segments*duration);
 const idx=Math.min(segments-1,Math.floor(time/duration));
 const t=Math.min(1,(time-idx*duration)/duration);
 const eased=t*t*(3-2*t),a=shots[idx],b=shots[Math.min(idx+1,shots.length-1)];
 shootState.focusX=a.x+(b.x-a.x)*eased;
 shootState.focusZ=a.z+(b.z-a.z)*eased;
 cameraYaw=shotAngle(a.yaw,b.y,eased);
 cameraPitch=a.pitch+(b.pitch-a.pitch)*eased;
 cameraDistance=a.distance+(b.distance-a.distance)*eased;
 if(shootState.elapsed>=segments*duration){
  shootState.playing=false;
  shootingUI('再生完了');
 }
}
shootButton.addEventListener('click',()=>{
 if(shootState.enabled)stopShooting();else startShooting();
});
shootPanel.addEventListener('click',e=>{
 const button=e.target.closest('button[data-shot]');
 if(!button)return;
 const action=button.dataset.shot;
 if(action.startsWith('preset-')){chooseStoreCamera(action.slice(7));return;}
 if(action==='add')addShot();
 if(action==='play')playShots();
 if(action==='stop')stopShots();
 if(action==='delete'){
  shootState.playing=false;
  shootState.shots.pop();shootingUI(persistShots()?'最後のカットを削除':'保存失敗');
 }
 if(action==='portrait'){
  shootState.portrait=!shootState.portrait;
  shootingUI(shootState.portrait?'縦9:16プレビュー':'横画面プレビュー');
 }
});
restoreShots();shootingUI();
