function startGame(){
  mode='move';selected='wall';hover=null;cursorDirty=false;
  hideUpper=false;level=0;yaw=Math.PI/4;zoom=1.05;
  gameMigratePineIsland();pineExtendWorld();gameRetrofitSampleStairs();gameSpawn();gameRestoreProgress();gameCheckOcclusion();gameResize();gameSessionReady=true;gamePersistProgress(true);gameAvatar=gameAvatarMesh();
  document.querySelectorAll('[data-game-dir]').forEach(b=>{
   const d=b.dataset.gameDir;
   b.addEventListener('pointerdown',e=>{e.preventDefault();if(!gameAmbientTouched){gameAmbientTouched=true;gameAmbientOn=true;gameInitAmbience();$('gameAmbienceToggle').textContent='環境音：ON'}b.setPointerCapture(e.pointerId);gameDirs.add(d);gameLastDir=d;gameNextStep=0;b.classList.add('gameActive')});
   const stop=()=>{gameDirs.delete(d);b.classList.remove('gameActive')};
   b.addEventListener('pointerup',stop);b.addEventListener('pointercancel',stop);b.addEventListener('lostpointercapture',stop);
  });

  const keys={ArrowUp:'n',ArrowDown:'s',ArrowLeft:'w',ArrowRight:'e',w:'n',a:'w',s:'s',d:'e',W:'n',A:'w',S:'s',D:'e'};
  window.addEventListener('keydown',e=>{if(keys[e.key]){e.preventDefault();if(!gameAmbientOn){gameAmbientOn=true;gameInitAmbience();$('gameAmbienceToggle').textContent='環境音：ON'}gameDirs.add(keys[e.key]);gameLastDir=keys[e.key];gameNextStep=0}});
  window.addEventListener('keyup',e=>{if(keys[e.key])gameDirs.delete(keys[e.key])});
  window.addEventListener('blur',()=>{gameDirs.clear();gameLastDir=null});
  $('gameReset').addEventListener('click',()=>{gameSpawn();if(gameAvatar)gl.deleteBuffer(gameAvatar.buf);gameAvatar=gameAvatarMesh()});
  $('gameTurn').addEventListener('click',()=>{yaw+=Math.PI/2;gameCheckOcclusion();gamePersistProgress(true)});
  $('gameZoomIn').addEventListener('click',()=>{zoom=Math.min(2.7,zoom*1.2);gamePersistProgress(true)});
  $('gameZoomOut').addEventListener('click',()=>{zoom=Math.max(.18,zoom/1.2);gamePersistProgress(true)});
  function contextualTarget(){
   const steps=[[0,-1],[1,0],[0,1],[-1,0]],d=steps[gameFacing];
   const tx=Math.floor(gameX+d[0]),tz=Math.floor(gameZ+d[1]);
   return gameZoneProps.find(o=>o.x===tx&&o.z===tz&&o.y===gameLevel)||world.find(o=>o.x===tx&&o.z===tz&&o.y===gameLevel&&!isFloor(o.type))||null;
  }
  function contextualLabel(){
   const obj=contextualTarget();
   return obj?.type.startsWith('monster')?'攻撃':obj?'調べる':'剣を振る';
  }
  function gamePrimaryAction(){
   const obj=contextualTarget();
   if(!obj){gameStartSwordAttack('miss');return}
   const names={pineTentTan:'避難民のテント',pineTentBlue:'避難民のテント',pineMilitaryTent:'軍用テント',pineCommand:'臨時司令部',pineMedical:'野戦診療所',pineRation:'配給所',pineSupplyCrate:'軍の物資箱',pineSupplies:'生活物資',pineGenerator:'発電設備',pineBarrier:'軍の検問柵',pineRadio:'通信設備',pineWatchtower:'監視塔',pineLighthouse:'古い灯台',pineScenicPine:'島の松'};
   const name=names[obj.type]||catalog.get(obj.type)?.name||obj.type;
   if(obj.type.startsWith('monster')){
    const hard=/skeleton|golem|armor|knight|metal|stone|rock/i.test(obj.type);
    if(gameStartSwordAttack(hard?'armor':'hit'))toast(name+' に斬撃（ダメージ処理は未実装）');
    return;
   }
   toast(name+' を調べた');
  }
  $('gameAct').addEventListener('click',gamePrimaryAction);
  $('pineBoatButton').addEventListener('click',pineBoatAction);
  $('gameAmbienceToggle').addEventListener('click',()=>{
   gameAmbientTouched=true;gameAmbientOn=!gameAmbientOn;
   if(gameAmbientOn)gameInitAmbience();
   $('gameAmbienceToggle').textContent='環境音：'+(gameAmbientOn?'ON':'OFF');
   gameAdjustAmbience();
  });
  $('gameSfxPreview').addEventListener('click',()=>{
   const options=['miss','hit','armor'],names=['空振り','通常命中','硬い敵'];
   const index=gameSfxStep%3,kind=options[index];
   gameAttackLast=-1000;gameStartSwordAttack(kind);
   gameSfxStep++;
   $('gameSfxPreview').textContent='SE試聴：'+names[gameSfxStep%3];
   toast('剣SE：'+names[index]);
  });
  $('gameDown').hidden=true;
  window.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();if(!e.repeat)gamePrimaryAction()}});
  let actionLabel='';
  function updateActionLabel(){
   const label=contextualLabel();
   if(label!==actionLabel){actionLabel=label;$('gameAct').textContent=label}
   $('gameDown').hidden=true;
  }
  setInterval(updateActionLabel,130);
  $('gameLoad').addEventListener('click',()=>$('gameImport').click());
  $('gameImport').addEventListener('change',async e=>{
   const f=e.target.files?.[0];if(!f)return;
   try{
    if(f.size>6*1024*1024)throw Error('6MB以下のJSONを選択してください');
    const obj=JSON.parse(await f.text());loadData(obj);commit();gameSpawn();
    if(gameAvatar)gl.deleteBuffer(gameAvatar.buf);gameAvatar=gameAvatarMesh();
    toast('ワールドを読み込みました');
   }catch(err){toast('読込失敗: '+err.message)}
   e.target.value='';
  });
  window.addEventListener('pagehide',()=>gamePersistProgress(true));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)gamePersistProgress(true)});
  // Disable single-finger editor taps and keep two-finger orbit/zoom gesture.
  canvas.addEventListener('pointerdown',e=>{if(e.isPrimary){mode='move';tapCandidate=null}},true);
  toast('街を自由に歩いてみよう');
 }

try{const saved=localStorage.getItem(SAVE_KEY)||localStorage.getItem('forest-world-editor-v1');if(saved)loadData(JSON.parse(saved));else makeCityNature64Demo()}catch(e){world=[];models=[];prefabs=[];terrainHeights=new Map();makeCityNature64Demo()}
refreshPalette();updateStats();updateSelected();showEntireMap();startGame();render();
if(location.search.includes('test=1'))window.__editorTest={state:()=>({world:world.map(p=>({...p})),models:models.map(m=>({...m})),prefabs:prefabs.map(p=>({...p})),selected,mode,rotation,level,glLink:gl.getProgramParameter(program,gl.LINK_STATUS)}),place:(x,z)=>changeCell(x,z),data};
})();
