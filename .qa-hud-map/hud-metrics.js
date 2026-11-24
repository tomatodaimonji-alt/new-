// BEGIN WIDE HUD MAP
function poiLocalHudMetrics(cssWidth,cssHeight,height){
 const ratio=cssWidth>0&&cssHeight>0?Math.max(1,Math.min(2.5,cssWidth/cssHeight)):1;
 const width=Math.round(height*ratio),shift=(width-height)/2,scale=height/POI_LOCAL_SIDE;
 return {width,height,shift,scale,wing:Math.ceil(shift/scale)};
}
// END WIDE HUD MAP
function poiLocalPaintHud(cv,frame){
 const hud=poiLocalHudMetrics(cv.clientWidth,cv.clientHeight,cv.height);
 if(cv.width!==hud.width)cv.width=hud.width;
 poiLocalPaint(cv,frame,undefined,hud);
}
