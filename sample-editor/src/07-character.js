// v18: self-contained procedural pedestrian, ~1.76 world units tall.
// Local forward is -Z; the final vertex transform applies heading and world position.
// Articulated knees/elbows, tapered organic silhouette, layered clothes and facial detail.
const PLAYER_STYLE=Object.freeze({
 skin:0xc99c7d,shadowSkin:0xb7866b,hair:0x302a28,
 shirt:0x45667e,shirtDark:0x385368,shirtHighlight:0x62839a,
 trousers:0x424c5b,trouserShadow:0x303a46,
 shoes:0x383d41,sole:0xc1c2bb,eye:0x292b30
});
// NPCs share the same geometry, gait and pose with lightweight palette overrides.
let currentCharacterStyle=PLAYER_STYLE;
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
 // Clothing follows a human torso: soft belly, rib cage, continuous shoulder
 // and a narrow neckline. Avoid spherical deltoids at the shoulder seam.
 const rings=[
  [.84,.226,.148],[.92,.248,.168],[1.04,.258,.181],
  [1.16,.272,.190],[1.27,.297,.189],[1.34,.305,.178],
  [1.39,.255,.151],[1.43,.124,.118]
 ];
 const n=12;
 for(let i=0;i<rings.length-1;i++)for(let j=0;j<n;j++){
  const a=rings[i],b=rings[i+1],p=j*2*Math.PI/n,q=(j+1)*2*Math.PI/n;
  const point=(r,angle)=>[Math.cos(angle)*r[1]*skinny,
   r[0]+hip,Math.sin(angle)*r[2]+lean+(r[0]-1)*-.025];
  const mid=(p+q)*.5;
  const tone=j%6===0?currentCharacterStyle.shirtDark:currentCharacterStyle.shirt;
  quad(point(a,p),point(b,p),point(b,q),point(a,q),
   playerShade(tone,Math.cos(mid),.15,Math.sin(mid)));
 }
}
// Soft oval ground contact shadow built from small rings. The shared shader blends
// the shaded triangles with the street; no textures or additional draw buffers.
// World surface ranges from -0.055 (lane) to -0.005 (sidewalk), so -0.002 sits above it.
function renderPlayerShadow(x,z,heading,effort,phase){
 const start=vertices.length;
 const step=clamp(effort,0,1);
 const radiusX=.34+step*.08,radiusZ=.22+step*.10;
 const cs=Math.cos(heading),sn=Math.sin(heading);
 const rings=[{rx:1,rz:1,tint:0x55544d},{rx:.73,rz:.71,tint:0x35342e},
  {rx:.39,rz:.40,tint:0x20221f}];
 const segments=16,y=-.002;
 const point=(rx,rz,a)=>[x+(Math.cos(a)*rx)*cs+(Math.sin(a)*rz)*sn,
  y,z-(Math.cos(a)*rx)*sn+(Math.sin(a)*rz)*cs];
 for(let band=0;band<rings.length;band++){
  const outer=rings[band],inner=rings[band+1];
  const colorRing=color(outer.tint);
  for(let i=0;i<segments;i++){
   const a=i*2*Math.PI/segments,b=(i+1)*2*Math.PI/segments;
   const p=point(radiusX*outer.rx,radiusZ*outer.rz,a);
   const q=point(radiusX*outer.rx,radiusZ*outer.rz,b);
   if(inner){
    const r=point(radiusX*inner.rx,radiusZ*inner.rz,b);
    const t=point(radiusX*inner.rx,radiusZ*inner.rz,a);
    quad(p,q,r,t,colorRing);
   }else{
    tri([x,y,z],p,q,colorRing);
   }
  }
 }
 return (vertices.length-start)/6;
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
function renderDetailedPlayer(px,pz,heading,phase,effort,running,style=PLAYER_STYLE,action='idle'){
 currentCharacterStyle=style;
 const start=vertices.length;
 const amount=clamp((effort-.035)/.78,0,1);
 const moving=amount>.015;
 const stridePhase=phase;
 const weight=Math.cos(stridePhase)*amount;
 const hipShift=Math.sin(stridePhase)*.038*amount;
 const hipHeight=moving?(running?.021:.013)*(1-Math.cos(stridePhase*2)) : 0;
 const torsoLean=(running?-.065:-.018)*amount;
 const headCounter=Math.sin(stridePhase)*.016*amount;
 const C=style;
 // Waist moves over the planted foot while shoulders counter-sway.
 playerOval(hipShift,.880+hipHeight,.008,.217,.115,.148,C.trousers,12,7);
 playerTorso(hipHeight,torsoLean);
 // Upper chest is part of the tapered torso; no detached sphere at collarbone.
 playerOval(0,1.413+hipHeight,torsoLean-.006,.125,.031,.111,C.shirt,10,5);
 playerOval(0,1.410+hipHeight,torsoLean-.119,.075,.021,.018,C.shirtDark,8,5);
 playerOval(0,1.219+hipHeight,torsoLean-.183,.006,.079,.009,C.shirtDark,6,4);
 playerOval(-.143,1.147+hipHeight,torsoLean-.160,.033,.012,.009,C.shirtHighlight,7,4);
 playerOval(hipShift,.850+hipHeight,0,.225,.020,.153,C.trouserShadow,10,5);
 // v29: restrained semi-realistic face; no protruding sphere-eyes, swollen
 // mouth, or thick cheek blobs. Most facial features sit close to the skull.
 const headX=-headCounter,headY=hipHeight*.55;
 const faceZ=torsoLean*.48;
 playerLimb([0,1.41+hipHeight,torsoLean*.35],[headX,1.54+headY,faceZ],.068,.065,C.skin);
 // Skull and soft lower jaw; the upper skull supplies the continuous silhouette.
 playerOval(headX,1.616+headY,faceZ-.006,.145,.207,.137,C.skin,19,14);
 playerOval(headX,1.512+headY,faceZ-.035,.108,.063,.105,C.skin,12,7);
 // Small ears close to the head rather than floating knobs.
 for(const side of [-1,1]){
  playerOval(headX+side*.145,1.589+headY,faceZ-.002,.017,.041,.024,C.skin,9,6);
  playerOval(headX+side*.157,1.586+headY,faceZ-.019,.006,.019,.009,C.shadowSkin,7,5);
  // Subtle almond-shaped eyes: only the dark upper lash and the tiny iris.
  playerOval(headX+side*.056,1.638+headY,faceZ-.134,.025,.008,.006,
   C.shadowSkin,11,5);
  playerOval(headX+side*.056,1.637+headY,faceZ-.140,.010,.008,.005,
   C.eye,9,5);
  playerOval(headX+side*.058,1.666+headY,faceZ-.129,.029,.007,.007,
   C.hair,11,5);
 }
 // A narrow bridge and small nose tip give depth without the old bulb.
 playerOval(headX,1.600+headY,faceZ-.139,.016,.039,.012,C.skin,10,7);
 playerOval(headX,1.569+headY,faceZ-.151,.021,.012,.012,C.shadowSkin,10,6);
 playerOval(headX,1.573+headY,faceZ-.159,.019,.010,.008,C.skin,9,5);
 // Short, desaturated lip seam; avoid the previous thick painted smile.
 playerOval(headX,1.531+headY,faceZ-.133,.029,.0038,.005,0x936b61,11,5);
 playerOval(headX,1.519+headY,faceZ-.128,.023,.006,.004,C.skin,9,5);
 // Hair is a single close-fitting cap plus lightweight swept locks.
 // NPC style determines haircut silhouette while sharing one humanoid mesh.
 const haircut=C.haircut||'short';
 const hairHeight=haircut==='long'?.092:.067;
 playerOval(headX,1.781+headY,faceZ+.012,.145,hairHeight,.139,C.hair,15,9);
 for(const side of [-1,1]){
  playerOval(headX+side*.123,1.706+headY,faceZ+.050,
   .022,haircut==='long'?.119:.060,.074,C.hair,10,7);
 }
 if(haircut==='sidepart'){
  playerOval(headX-.043,1.750+headY,faceZ-.095,.093,.029,.052,C.hair,13,6);
  playerOval(headX+.051,1.750+headY,faceZ-.091,.055,.020,.037,C.hair,10,5);
 }else if(haircut==='long'){
  playerOval(headX,1.743+headY,faceZ-.108,.113,.033,.040,C.hair,13,6);
  for(const side of [-1,1])
   playerOval(headX+side*.128,1.584+headY,faceZ+.047,.025,.107,.063,
    C.hair,11,7);
 }else{
  playerOval(headX,1.744+headY,faceZ-.103,.116,.030,.040,C.hair,13,6);
 }
 // Each foot has independent stance/swing and a small heel/toe roll.
 for(const side of [-1,1]){
  const foot=footCycle(stridePhase+(side===1?Math.PI:0),amount,running);
  const ankleZ=moving?foot.z:0;
  const footRise=foot.lift;
  const h=[hipShift+side*.133,.823+hipHeight,.012];
  const a=[side*.137,.121+footRise,ankleZ];
  const k=moving?solveWalkingKnee(h,a):[side*.136,.458,0];
  playerLimb(h,k,.110,.113,C.trousers);
  // Smaller knee transitions and tapering shin, without the previous ball joints.
  playerOval(...k,.093,.071,.093,C.trousers,9,5);
  playerLimb(k,a,.083,.091,C.trouserShadow);
  playerOval(side*.137,.151+footRise,ankleZ,.078,.055,.080,C.trousers,9,5);
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
  // The sleeve begins inside the shoulder line, joining the tapered chest.
  const shoulder=[side*.274,1.337+hipHeight,torsoLean*.50];
  const sleeveEnd=[side*.350,1.150+hipHeight,armSwing*.48+.004];
  // Action weights change continuously; transition without snapping the arm.
  const pickWeight=typeof action==='object'?clamp(action.pick||0,0,1):(action==='pick'?1:0);
  const carryWeight=typeof action==='object'?clamp(action.carry||0,0,1):(action==='carry'?1:0);
  const payWeight=typeof action==='object'?clamp(action.pay||0,0,1):(action==='pay'?1:0);
  const reach=Math.min(1,pickWeight+carryWeight+payWeight);
  const reachZ=pickWeight*.58+carryWeight*.22+payWeight*.45;
  const baseElbow=[side*.363,1.047+hipHeight,armSwing*.76+.006];
  const baseHand=[side*.376,.871+hipHeight,armSwing*1.18-.018];
  const elbow=[baseElbow[0]*(1-reach)+side*.32*reach,
   baseElbow[1]*(1-reach)+(1.10+hipHeight)*reach,
   baseElbow[2]*(1-reach)-.16*reach];
  const hand=[baseHand[0]*(1-reach)+side*.35*reach,
   baseHand[1]*(1-reach)+(1.00+hipHeight+.06*pickWeight)*reach,
   baseHand[2]*(1-reach)-reachZ];
  playerLimb(shoulder,sleeveEnd,.106,.109,C.shirt);
  playerOval(...sleeveEnd,.086,.027,.084,C.shirtDark,9,5);
  playerLimb(sleeveEnd,elbow,.077,.083,C.skin);
  playerOval(...elbow,.061,.041,.065,C.skin,9,5);
  playerLimb(elbow,hand,.061,.068,C.skin);
  playerOval(...hand,.048,.070,.038,C.skin,10,7);
  playerOval(hand[0]-side*.034,hand[1]-.01,hand[2]-.043,.022,.037,.031,C.shadowSkin,8,5);
  // Three short curved grip segments close toward a carried can or bottle.
  // They are local limb geometry and follow the same body rotation/pose blend.
  if(side===1&&reach>.08){
   for(let finger=0;finger<3;finger++){
    const fx=hand[0]-.030+finger*.030;
    const base=[fx,hand[1]-.015,hand[2]-.031];
    const tip=[fx+.008,hand[1]-.046*reach,hand[2]-.071*reach];
    playerLimb(base,tip,.013,.014,C.skin);
   }
   // Thumb opposes the fingers; fade its curl as the arm relaxes.
   playerLimb([hand[0]-.052,hand[1]+.015,hand[2]],
    [hand[0]-.030,hand[1]-.022*reach,hand[2]-.052*reach],
    .017,.015,C.skin);
  }
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
