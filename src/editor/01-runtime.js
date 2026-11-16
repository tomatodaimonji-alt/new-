
(()=>{'use strict';
// Android WebView can report a taller CSS viewport than the visible screen.
 // Keep the game height synchronized with the actual visible viewport.
 function syncVisibleViewport(){
  const viewport=window.visualViewport;
  const h=viewport&&viewport.height>0?viewport.height:window.innerHeight;
  if(h>0)document.documentElement.style.setProperty('--editor-visible-height',Math.floor(h)+'px');
 }
 syncVisibleViewport();
 window.addEventListener('resize',syncVisibleViewport);
 if(window.visualViewport)window.visualViewport.addEventListener('resize',syncVisibleViewport);
 const canvas=document.getElementById('view'),gl=canvas.getContext('webgl',{antialias:true,alpha:true,powerPreference:'low-power'}),toastEl=document.getElementById('toast');
let MAP_W=16,MAP_H=16,terrainHeights=new Map();const TERRAIN_MAX=8,TERRAIN_STEP=1;const MIN_MAP=12,MAX_MAP=128,MAX_LEVEL=9,SAVE_KEY='forest-world-editor-v1',TAU=Math.PI*2;
const $=id=>document.getElementById(id);
function toast(message){toastEl.textContent=message;toastEl.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>toastEl.classList.remove('show'),2200)}
if(!gl){$('canvasTip').textContent='この端末はWebGLに対応していません。3D編集を開始できません。';return}
