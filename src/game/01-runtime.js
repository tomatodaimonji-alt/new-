
(()=>{'use strict';
// Android WebView can report a taller CSS viewport than the visible screen.
 // Keep the game height synchronized with the actual visible viewport.
 function syncVisibleViewport(){
  const viewport=window.visualViewport;
  const h=viewport&&viewport.height>0?viewport.height:window.innerHeight;
  if(h<=0)return;
  const root=document.documentElement,gameTop=document.getElementById('gameTop');
  root.style.setProperty('--editor-visible-height',Math.floor(h)+'px');
  root.style.setProperty('--game-visible-height',Math.floor(h)+'px');
  // Leave top controls and the Android navigation gesture strip unobstructed.
  const screenW=viewport&&viewport.width>0?viewport.width:window.innerWidth;
  const safeBottom=Number.parseFloat(getComputedStyle(root).getPropertyValue('--game-safe-bottom'))||0;
  const topEnd=gameTop?gameTop.getBoundingClientRect().bottom:70;
  const bottom=Math.max(14,safeBottom+12);
  const upperReserve=Math.max(84,topEnd+12);
  const available=Math.max(0,h-upperReserve-bottom);
  const widthLimit=Math.max(0,screenW-24);
  const desired=Math.min(330,screenW*.76);
  const size=Math.max(0,Math.floor(Math.min(desired,widthLimit,available)));
  root.style.setProperty('--game-pad-size',size+'px');
  root.style.setProperty('--game-pad-bottom','max('+bottom+'px, calc(env(safe-area-inset-bottom) + 12px))');
 }
 const gameResize=()=>{
  syncVisibleViewport();
  // WebView may update safe insets/top-bar wrapping one layout frame later.
  requestAnimationFrame(syncVisibleViewport);
 };
 gameResize();
 window.addEventListener('resize',gameResize);
 window.addEventListener('orientationchange',gameResize);
 if(window.visualViewport){
  window.visualViewport.addEventListener('resize',gameResize);
  window.visualViewport.addEventListener('scroll',gameResize);
 }
 const canvas=document.getElementById('view'),gl=canvas.getContext('webgl',{antialias:true,alpha:true,powerPreference:'low-power'}),toastEl=document.getElementById('toast');
let MAP_W=16,MAP_H=16,terrainHeights=new Map();const TERRAIN_MAX=8,TERRAIN_STEP=1;const MIN_MAP=12,MAX_MAP=128,MAX_LEVEL=9,SAVE_KEY='forest-world-game-v1',TAU=Math.PI*2;
const $=id=>document.getElementById(id);
function toast(message){toastEl.textContent=message;toastEl.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>toastEl.classList.remove('show'),2200)}
if(!gl){$('canvasTip').textContent='この端末はWebGLに対応していません。3D編集を開始できません。';return}
