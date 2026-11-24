function poiLocalModalOpen(){return !!$('poiLocalMapDialog')?.open}
function poiLocalOpen(){
 const dialog=$('poiLocalMapDialog');
 if(!poiLocalFrame||poiLocalModalOpen()||!poiWalkActive||pineAIActive||poiPlayerDying()||
    typeof poiScreenNoteFrozen==='function'&&poiScreenNoteFrozen()||
    document.querySelector('dialog[open],.modal.open,:is(#poiBagPanel,#poiNpcMenu,#poiLandscapeMenu,#poiSoundPanel):not([hidden])'))return;
 poiStopRepeat();
 tapCandidate=null;multiGesture=null;
 const captured=[...touchPositions.keys()];touchPositions.clear();
 for(const id of captured)if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);
 poiLocalOverlay={frame:poiLocalFrame,view:poiLocalView()};
 dialog.showModal();poiLocalOverlayDraw();
}
function poiLocalClose(){if(poiLocalModalOpen())$('poiLocalMapDialog').close()}
function poiLocalOverlayDraw(){
 if(!poiLocalOverlay)return;
 const {frame,view}=poiLocalOverlay;
 poiLocalPaint($('poiLocalMapLarge'),frame,view);
 $('poiLocalMapZoomIn').disabled=view.zoom>=4;
 $('poiLocalMapZoomOut').disabled=view.zoom<=1;
 $('poiLocalMapScale').textContent=Math.round(view.zoom*100)+'%';
}
function poiLocalOverlayView(zoom,x,z){
 if(!poiLocalOverlay)return;
 poiLocalOverlay.view=poiLocalView(zoom,x,z);poiLocalOverlayDraw();
}
function poiLocalOverlayZoom(zoom,ax=.5,az=.5,base=poiLocalOverlay?.view){
 if(!base)return;
 const n=poiLocalView(zoom).zoom;
 const delta=POI_LOCAL_SIDE/base.zoom-POI_LOCAL_SIDE/n;
 poiLocalOverlayView(n,base.x+delta*ax,base.z+delta*az);
}
function poiLocalBind(){
 const dialog=$('poiLocalMapDialog'),cv=$('poiLocalMapLarge'),open=$('poiMiniOpen');
 open.addEventListener('click',poiLocalOpen);
 $('poiLocalMapClose').addEventListener('click',poiLocalClose);
 dialog.addEventListener('close',()=>{poiLocalOverlay=null;clear();if(poiWalkActive&&!$('poiMiniHud').hidden)open.focus({preventScroll:true})});
 dialog.addEventListener('click',e=>{if(e.target===dialog)poiLocalClose()});
 $('poiLocalMapZoomOut').addEventListener('click',()=>poiLocalOverlayZoom(poiLocalOverlay.view.zoom/2));
 $('poiLocalMapZoomIn').addEventListener('click',()=>poiLocalOverlayZoom(poiLocalOverlay.view.zoom*2));
 const contacts=new Map();
 let origin=null;
 function start(){
  if(!poiLocalOverlay||contacts.size===0){origin=null;return}
  const [a,b]=contacts.values();
  origin={x:b?(a.x+b.x)/2:a.x,z:b?(a.z+b.z)/2:a.z,gap:b?Math.max(.02,Math.hypot(a.x-b.x,a.z-b.z)):0,view:poiLocalOverlay.view};
 }
 function clear(){contacts.clear();origin=null}
 function point(e){const r=cv.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width,z:(e.clientY-r.top)/r.height}}
 cv.addEventListener('pointerdown',e=>{
  if(e.button!==0||contacts.size>=2)return;e.preventDefault();cv.setPointerCapture(e.pointerId);
  contacts.set(e.pointerId,point(e));start();
 });
 cv.addEventListener('pointermove',e=>{
  if(!contacts.has(e.pointerId)||!origin)return;
  contacts.set(e.pointerId,point(e));
  const [a,b]=contacts.values(),x=b?(a.x+b.x)/2:a.x,z=b?(a.z+b.z)/2:a.z;
  const zoom=b?poiLocalView(origin.view.zoom*Math.hypot(a.x-b.x,a.z-b.z)/origin.gap).zoom:origin.view.zoom;
  poiLocalOverlayView(zoom,origin.view.x+origin.x*POI_LOCAL_SIDE/origin.view.zoom-x*POI_LOCAL_SIDE/zoom,
   origin.view.z+origin.z*POI_LOCAL_SIDE/origin.view.zoom-z*POI_LOCAL_SIDE/zoom);
 });
 for(const event of ['pointerup','pointercancel','lostpointercapture'])cv.addEventListener(event,e=>{if(contacts.delete(e.pointerId))start()});
 document.addEventListener('keydown',e=>{
  if(!poiLocalOverlay||!poiLocalModalOpen())return;
  const {view}=poiLocalOverlay,step=POI_LOCAL_SIDE/view.zoom/6;
  if(e.key==='+'||e.key==='-'||e.key==='='){
   e.preventDefault();e.stopPropagation();poiLocalOverlayZoom(view.zoom*(e.key==='-'?.5:2));return;
  }
  const d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
  if(d){e.preventDefault();e.stopPropagation();poiLocalOverlayView(view.zoom,view.x+d[0]*step,view.z+d[1]*step)}
 },true);
 window.addEventListener('pagehide',()=>{poiLocalClose();poiLocalSave()});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){poiLocalClose();poiLocalSave()}});
}
