// BEGIN SOUTH SNOW HORIZON
// Maiden profile in global tile units. Snow sector origin (37,128);
// the travel seam remains (49,127)->(49,128), below this skyline.
const POI_SNOW_HORIZON=Object.freeze({
 bounds:[28,-1,137,71,15,154],
 ridge:[[28,1.1,153],[32,3.8,151],[35,4.8,149],[38,7.7,147],[41,7.2,148],
  [44,9.8,148],[46,8.6,147],[49,13.2,145],[52,10.9,146],[54,11.8,148],
  [58,7.5,147],[61,8.4,148],[64,5.9,150],[68,3.2,152],[71,1.2,154]]
});
let poiSnowHorizonGpu=null,poiSnowHorizonLast=0;
function poiSnowHorizonMesh(){
 const m=mesh(),profile=POI_SNOW_HORIZON.ridge;
 const foot=([x,,z])=>[x,-.65,Math.max(137,z-9-(x%3))];
 const snowline=([x,y,z])=>[x,Math.min(y,.70+y*(.43+(x%5)*.031)),z-3.6];
 for(let i=1;i<profile.length;i++){
  const a=profile[i-1],b=profile[i],fa=foot(a),fb=foot(b),sa=snowline(a),sb=snowline(b);
  const rock=i%3===1?[.29,.38,.49]:[.31,.41,.52];
  const ice=i%4===1?[.73,.86,.96]:[.85,.94,.99];
  // Wound to face upward/north: downward normals washed pale snow into shadow.
  tri(m,fa,sb,fb,rock);tri(m,fa,sa,sb,rock);
  tri(m,sa,b,sb,ice);tri(m,sa,a,b,ice);
 }
 return m;
}
function poiSnowHorizonOpacity(region,floor,outdoor,x,z){
 if(region!=='base'||floor!==0||!outdoor)return 0;
 // Keep the main-world approach readable; replace no neighboring tiles.
 // Leave the last six tiles of the authored route clear for real neighbor LOD.
 const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t)};
 return .87*smooth((122-z)/10)*smooth((150-Math.hypot(x-49,z-143))/30);
}
function poiSnowHorizonInFrame(vp){
 const [x0,y0,z0,x1,y1,z1]=POI_SNOW_HORIZON.bounds;
 let reject=63;
 for(let i=0;i<8&&reject;i++){
  const x=i&1?x1:x0,y=i&2?y1:y0,z=i&4?z1:z0;
  const cx=vp[0]*x+vp[4]*y+vp[8]*z+vp[12],cy=vp[1]*x+vp[5]*y+vp[9]*z+vp[13],
   cz=vp[2]*x+vp[6]*y+vp[10]*z+vp[14],w=vp[3]*x+vp[7]*y+vp[11]*z+vp[15];
  reject&=(cx< -w?1:0)|(cx>w?2:0)|(cy< -w?4:0)|(cy>w?8:0)|(cz< -w?16:0)|(cz>w?32:0);
 }
 return reject===0;
}
function facilitySnowHorizonStatus(){
 return {visible:poiSnowHorizonLast>0,opacity:poiSnowHorizonLast,vertices:poiSnowHorizonGpu?.count??0};
}
function facilityDrawSnowHorizon(p){
 const {vp,skyHorizon}=p;
 const opacity=poiSnowHorizonOpacity(facilitySite?.id,poiWalkLevel,Number.isFinite(skyHorizon),poiWalkViewX,poiWalkViewZ);
 poiSnowHorizonLast=0;
 if(opacity<.005||!poiSnowHorizonInFrame(vp))return;
 if(!poiSnowHorizonGpu)poiSnowHorizonGpu=upload(poiSnowHorizonMesh());
 if(!poiSnowHorizonGpu?.count)return;
 gl.enable(gl.BLEND);gl.blendFunc(gl.CONSTANT_ALPHA,gl.ONE_MINUS_CONSTANT_ALPHA);gl.depthMask(false);
 try{gl.blendColor(0,0,0,opacity);draw(poiSnowHorizonGpu,vp);poiSnowHorizonLast=opacity}
 finally{
  gl.depthMask(true);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.blendColor(0,0,0,0);gl.disable(gl.BLEND);
 }
}
// END SOUTH SNOW HORIZON
