// v15: self-contained procedural pedestrian, ~1.76 world units tall.
// Local forward is -Z; the final vertex transform applies heading and world position.
// Articulated knees/elbows, tapered organic silhouette, layered clothes and facial detail.
const PLAYER_STYLE=Object.freeze({
 skin:0xc99c7d,shadowSkin:0xb7866b,hair:0x302a28,
 shirt:0x45667e,shirtDark:0x385368,shirtHighlight:0x62839a,
 trousers:0x424c5b,trouserShadow:0x303a46,
 shoes:0x383d41,sole:0xc1c2bb,eye:0x292b30
});
function playerShade(hex,nx,ny,nz){
 const base=color(hex);
 const diffuse=Math.max(0,nx*-.48+ny*.75+nz*-.46);
 const f=.62+diffuse*.35;
 return base.map(v=>Math.min(1,v*f));
}
function playerOval(x,y,z,rx,ry,rz,tint,longitude=10,latitude=7){
 // Use intentionally limited tessellation for Android WebView.
 longitude=Math.max(6,Math.round(longitude*.67));
 latitude=Math.max(4,Math.round(latitude*.70));
 const start=vertices.length;
 for(let v=0;v<latitude;v++){
  const a=v*Math.PI/latitude,b=(v+1)*Math.PI/latitude;
  for(let u=0;u<longitude;u++){
   const p=u*2*Math.PI/longitude,q=(u+1)*2*Math.PI/longitude;
   const pos=(t,ang)=>[x+rx*Math.sin(t)*Math.cos(ang),y+ry*Math.cos(t),
    z+rz*Math.sin(t)*Math.sin(ang)];
   const mid=(a+b)*.5,ang=(p+q)*.5;
   const shade=playerShade(tint,Math.sin(mid)*Math.cos(ang),Math.cos(mid),Math.sin(mid)*Math.sin(ang));
   quad(pos(a,p),pos(b,p),pos(b,q),pos(a,q),shade);
  }
 }
 return vertices.length-start;
}
// Organic tapered limb mesh aligned between animated joints rather than stacked cubes.
// Radii are horizontal/vertical cross-section widths and are tapered near both ends.
function playerLimb(a,b,rx,rz,tint){
 const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2];
 const length=Math.hypot(dx,dy,dz)||1;
 const ux=dx/length,uy=dy/length,uz=dz/length;
 let e1=[uz,0,-ux],l=Math.hypot(e1[0],e1[2]);
 if(l<.001){e1=[1,0,0];l=1}
 e1=e1.map(v=>v/l);
 const e2=[uy*e1[2]-uz*e1[1],uz*e1[0]-ux*e1[2],ux*e1[1]-uy*e1[0]];
 const rings=[0,.23,.72,1],n=7;
 const point=(t,angle,mult)=>{
  const c=Math.cos(angle),s=Math.sin(angle);
  return [a[0]+dx*t+(e1[0]*rx*c+e2[0]*rz*s)*mult,
   a[1]+dy*t+(e1[1]*rx*c+e2[1]*rz*s)*mult,
   a[2]+dz*t+(e1[2]*rx*c+e2[2]*rz*s)*mult];
 };
 for(let i=0;i<rings.length-1;i++)for(let j=0;j<n;j++){
  const t=rings[i],u=rings[i+1],p=j*2*Math.PI/n,q=(j+1)*2*Math.PI/n;
  const m=(t===0?.79: t>.8?.86:1),k=u===1?.79: u>.8?.86:1;
  const n1=[e1[0]*Math.cos((p+q)*.5)+e2[0]*Math.sin((p+q)*.5),
   e1[1]*Math.cos((p+q)*.5)+e2[1]*Math.sin((p+q)*.5),
   e1[2]*Math.cos((p+q)*.5)+e2[2]*Math.sin((p+q)*.5)];
  quad(point(t,p,m),point(u,p,k),point(u,q,k),point(t,q,m),playerShade(tint,...n1));
 }
}
// A softly tapered fabric torso, narrower at the waist than the shoulders.
function playerTorso(hip,lean,skinny=1){
 const rings=[
  [.84,.246,.165],[.95,.255,.176],[1.14,.285,.194],
  [1.34,.335,.205],[1.43,.235,.158]
 ];
 const n=10;
 for(let i=0;i<rings.length-1;i++)for(let j=0;j<n;j++){
  const a=rings[i],b=rings[i+1],p=j*2*Math.PI/n,q=(j+1)*2*Math.PI/n;
  const point=(r,angle)=>[Math.cos(angle)*r[1]*skinny,
   r[0]+hip,Math.sin(angle)*r[2]+lean+(r[0]-1)*-.025];
  const mid=(p+q)*.5;
  const tone=j%5===0?PLAYER_STYLE.shirtDark:PLAYER_STYLE.shirt;
  quad(point(a,p),point(b,p),point(b,q),point(a,q),
   playerShade(tone,Math.cos(mid),.15,Math.sin(mid)));
 }
}
// Locomotion timing uses a planted stance, short toe-off and lifted swing.
// One full 2*PI phase is one stride per foot; the two feet are half a cycle apart.
function footCycle(phase,amount,running){
 const f=((phase/(Math.PI*2))%1+1)%1;
 const stance=running?.48:.62;
 const step=running?.33:.235;
 if(f<stance){
  const t=f/stance; // heel strike -> flat foot -> toe off
  return {z:-step+2*step*t,lift:0,
   heel:Math.max(0,(.12-t)*.16)*amount,
   toe:Math.max(0,(t-.82)/.18)*.064*amount};
 }
 const t=(f-stance)/(1-stance);
 const easing=t*t*(3-2*t);
 return {z:step-2*step*easing,
  lift:Math.sin(Math.PI*t)*(running?.165:.092)*amount,
  heel:0,toe:Math.max(0,1-t)*.020*amount};
}
// Knee bends toward the front of the body while retaining two bone lengths.
function solveWalkingKnee(hip,ankle){
 const dy=ankle[1]-hip[1],dz=ankle[2]-hip[2];
 const d=Math.max(.001,Math.hypot(dy,dz));
 const upper=.402,lower=.419,limited=Math.min(d,upper+lower-.001);
 const along=(upper*upper-lower*lower+limited*limited)/(2*limited);
 const normal=Math.sqrt(Math.max(0,upper*upper-along*along));
 const uy=dy/d,uz=dz/d;
 return [hip[0]*.51+ankle[0]*.49,
  hip[1]+uy*along-uz*normal,
  hip[2]+uz*along+uy*normal];
}
// Procedural skinned-like pose: separate meshes share moving anatomical joints.
// Rendering is built each frame without external models, Web APIs or textures.
function renderDetailedPlayer(px,pz,heading,phase,effort,running){
 const start=vertices.length;
 const amount=clamp((effort-.08)/.62,0,1);
 const moving=amount>.015;
 const stridePhase=phase;
 const weight=Math.cos(stridePhase)*amount;
 const hipShift=Math.sin(stridePhase)*.038*amount;
 const hipHeight=moving?(running?.021:.013)*(1-Math.cos(stridePhase*2)) : 0;
 const torsoLean=(running?-.065:-.018)*amount;
 const headCounter=Math.sin(stridePhase)*.016*amount;
 const C=PLAYER_STYLE;
 // Waist moves over the planted foot while shoulders counter-sway.
 playerOval(hipShift,.884+hipHeight,.008,.244,.153,.164,C.trousers,12,7);
 playerTorso(hipHeight,torsoLean);
 playerOval(0,1.408+hipHeight,torsoLean-.009,.218,.088,.151,C.shirt,12,6);
 playerOval(0,1.413+hipHeight,torsoLean-.164,.099,.031,.026,C.shirtHighlight,8,5);
 playerOval(0,1.267+hipHeight,torsoLean-.192,.010,.125,.010,C.shirtDark,6,4);
 playerOval(-.168,1.157+hipHeight,torsoLean-.172,.054,.032,.012,C.shirtHighlight,7,4);
 playerOval(hipShift,.845+hipHeight,0,.241,.024,.164,C.trouserShadow,10,5);
 // Natural neck and head with mild counter-motion, rather than bobbing identically.
 const headX=-headCounter,headY=hipHeight*.55;
 const faceZ=torsoLean*.48;
 playerLimb([0,1.40+hipHeight,torsoLean*.35],[headX,1.56+headY,faceZ],.075,.074,C.skin);
 playerOval(headX,1.615+headY,faceZ-.006,.181,.232,.173,C.skin,16,12);
 playerOval(headX,1.505+headY,faceZ-.054,.146,.074,.133,C.shadowSkin,11,6);
 playerOval(headX,1.529+headY,faceZ-.091,.138,.077,.094,C.skin,11,6);
 for(const side of [-1,1]){
  playerOval(headX+side*.187,1.604+headY,faceZ-.008,.036,.067,.038,C.shadowSkin,8,6);
  playerOval(headX+side*.194,1.611+headY,faceZ-.022,.023,.041,.025,C.skin,8,5);
  playerOval(headX+side*.071,1.642+headY,faceZ-.174,.027,.021,.015,0xf0ebdd,8,5);
  playerOval(headX+side*.071,1.641+headY,faceZ-.185,.013,.015,.009,C.eye,8,5);
  playerOval(headX+side*.071,1.681+headY,faceZ-.181,.045,.011,.011,C.hair,8,4);
 }
 playerOval(headX,1.596+headY,faceZ-.184,.030,.068,.035,C.skin,10,8);
 playerOval(headX,1.557+headY,faceZ-.205,.040,.025,.035,C.shadowSkin,9,7);
 playerOval(headX,1.508+headY,faceZ-.180,.054,.008,.008,0x905e57,9,4);
 playerOval(headX,1.770+headY,faceZ+.011,.188,.107,.177,C.hair,14,9);
 for(const side of [-1,1]){
  playerOval(headX+side*.144,1.695+headY,faceZ+.046,.046,.108,.103,C.hair,9,6);
  playerOval(headX+side*.089,1.717+headY,faceZ-.141,.085,.047,.045,C.hair,8,5);
 }
 playerOval(headX+.02,1.744+headY,faceZ-.129,.125,.031,.051,0x3e3430,10,5);
 // Each foot has independent stance/swing and a small heel/toe roll.
 for(const side of [-1,1]){
  const foot=footCycle(stridePhase+(side===1?Math.PI:0),amount,running);
  const ankleZ=moving?foot.z:0;
  const footRise=foot.lift;
  const h=[hipShift+side*.133,.823+hipHeight,.012];
  const a=[side*.137,.121+footRise,ankleZ];
  const k=moving?solveWalkingKnee(h,a):[side*.136,.458,0];
  playerLimb(h,k,.118,.126,C.trousers);
  playerOval(...k,.112,.116,.113,C.trousers,10,6);
  playerLimb(k,a,.090,.105,C.trouserShadow);
  playerOval(side*.137,.151+footRise,ankleZ,.091,.089,.099,C.trousers,10,6);
  // Sole stays close to the ground in stance, and clears it in swing.
  const heelZ=ankleZ+.064,toeZ=ankleZ-.112;
  playerOval(side*.137,.069+footRise+foot.heel,heelZ,.112,.066,.118,C.shoes,11,6);
  playerOval(side*.137,.061+footRise+foot.toe,toeZ,.112,.057,.133,C.shoes,11,6);
  playerOval(side*.137,.026+footRise+foot.heel,heelZ,.114,.022,.119,C.sole,10,5);
  playerOval(side*.137,.023+footRise+foot.toe,toeZ,.115,.021,.132,C.sole,10,5);
  for(let lace=0;lace<2;lace++)
   playerOval(side*.137,.123+footRise+foot.toe*.6,ankleZ-.079+lace*.042,
    .050,.009,.015,0xa7a9a6,7,4);
  // Elbow follows but slightly lags shoulder; swing is opposite the same-side leg.
  const armSwing=moving?Math.sin(stridePhase+(side===1?Math.PI:0))*.155*amount:0;
  const shoulder=[side*.313,1.331+hipHeight,torsoLean*.50];
  const elbow=[side*.366,1.079+hipHeight,armSwing*.78+.006];
  const hand=[side*.391,.859+hipHeight,armSwing*1.28-.018];
  playerOval(...shoulder,.119,.126,.122,C.shirt,10,7);
  playerLimb(shoulder,elbow,.110,.116,C.shirt);
  playerOval(...elbow,.086,.088,.092,C.shirt,9,6);
  playerLimb(elbow,hand,.075,.082,C.skin);
  playerOval(...hand,.077,.106,.057,C.skin,10,7);
  playerOval(side*.348,.856+hipHeight,hand[2]-.052,.028,.048,.040,C.shadowSkin,8,5);
  playerOval(...elbow,.099,.037,.097,C.shirtHighlight,9,5);
 }
 // Very small whole-body counter-twist: shoulders turn against pelvic stride.
 // Rotate locally sculpted vertices toward the gameplay heading once.
 const rotation=heading-Math.PI,cs=Math.cos(rotation),sn=Math.sin(rotation);
 for(let i=start;i<vertices.length;i+=6){
  const x=vertices[i],z=vertices[i+2];
  const height=vertices[i+1],upper=clamp((height-.86)/.62,0,1);
  const twist=weight*.035*(upper-.35);
  const cx=Math.cos(twist),sx=Math.sin(twist);
  const tx=x*cx+z*sx,tz=-x*sx+z*cx;
  vertices[i]=px+tx*cs+tz*sn;
  vertices[i+2]=pz-tx*sn+tz*cs;
 }
 return (vertices.length-start)/6;
}
