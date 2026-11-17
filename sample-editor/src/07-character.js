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
 const rings=[0,.18,.55,.88,1],n=10;
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
 const n=14;
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
// Produces one avatar with natural forward direction; translation and heading happen once.
function renderDetailedPlayer(px,pz,heading,phase,effort,running){
 const start=vertices.length;
 const moving=effort>.12;
 const gait=moving?Math.sin(phase):0;
 const cadence=moving?Math.cos(phase):0;
 const stride=moving?(running?.30:.19)*Math.min(1,effort*1.15):0;
 const sway=moving?Math.sin(phase*.5)*.015:0;
 const bob=moving?Math.abs(cadence)*(running?.046:.024):0;
 const yOff=bob;
 const C=PLAYER_STYLE;
 // Pelvis and waist: the torso is a little narrower than the shoulders.
 playerOval(0,.885+yOff,.0,.25,.16,.165,C.trousers,12,7);
 playerTorso(yOff,sway);
 playerOval(0,1.41+yOff,-.004,.22,.095,.153,C.shirt,12,6);
 // Clothing details: collar, shirt placket, seams, pocket, dark waistline.
 playerOval(0,1.414+yOff,-.158,.099,.033,.027,C.shirtHighlight,8,5);
 playerOval(0,1.27+yOff,-.192,.010,.13,.010,C.shirtDark,6,4);
 playerOval(-.17,1.16+yOff,-.175,.054,.036,.013,C.shirtHighlight,7,4);
 playerOval(0,.842+yOff,-.004,.24,.026,.165,C.trouserShadow,10,5);
 // Neck and organic head: overall ~1.77m, face forward in local -Z.
 playerLimb([0,1.40+yOff,0],[0,1.56+yOff,-.006],.079,.075,C.skin);
 playerOval(0,1.615+yOff,-.006,.185,.235,.178,C.skin,16,12);
 // Lower jaw and cheek contours, separate ears.
 playerOval(0,1.505+yOff,-.054,.148,.077,.137,C.shadowSkin,11,6);
 playerOval(0,1.53+yOff,-.091,.140,.078,.095,C.skin,11,6);
 for(const side of [-1,1]){
  playerOval(side*.188,1.606+yOff,-.008,.038,.071,.038,C.shadowSkin,8,6);
  playerOval(side*.196,1.615+yOff,-.022,.022,.042,.025,C.skin,8,5);
  playerOval(side*.071,1.642+yOff,-.175,.027,.021,.015,0xf0ebdd,8,5);
  playerOval(side*.071,1.64+yOff,-.186,.013,.016,.008,C.eye,8,5);
  playerOval(side*.071,1.681+yOff,-.182,.047,.012,.011,C.hair,8,4);
 }
 // Nose is an actual protruding bridge and tip; mouth is a subtle flat arc.
 playerOval(0,1.596+yOff,-.185,.031,.069,.037,C.skin,10,8);
 playerOval(0,1.558+yOff,-.207,.041,.026,.037,C.shadowSkin,9,7);
 playerOval(0,1.509+yOff,-.183,.057,.008,.009,0x905e57,9,4);
 // Hair: scalp and irregular fringe rather than a spherical helmet.
 playerOval(0,1.771+yOff,.011,.192,.108,.180,C.hair,14,9);
 for(const side of [-1,1]){
  playerOval(side*.145,1.698+yOff,.045,.047,.110,.104,C.hair,9,6);
  playerOval(side*.09,1.718+yOff,-.143,.085,.050,.046,C.hair,8,5);
 }
 playerOval(.02,1.747+yOff,-.133,.130,.032,.053,0x3e3430,10,5);
 // Two jointed legs: hip-knee-ankle with contrasting knee flex and toe lifts.
 for(const side of [-1,1]){
  const footPhase=side*gait;
  const hip=[side*.132,.830+yOff,.006];
  const knee=[side*.138,.49+yOff,-footPhase*stride*.50+(running?.025:0)];
  const lifted=Math.max(0,side*cadence)*(running?.14:.058)*(moving?1:0);
  const ankle=[side*.135,.117+lifted+yOff,footPhase*stride];
  playerLimb(hip,knee,.122,.129,C.trousers);
  playerOval(...knee,.117,.127,.119,C.trousers,10,6);
  playerLimb(knee,ankle,.091,.104,C.trouserShadow);
  playerOval(side*.135,.14+lifted+yOff,footPhase*stride,.092,.093,.104,C.trousers,10,6);
  const shoeZ=footPhase*stride-.075;
  playerOval(side*.136,.072+lifted+yOff,shoeZ,.114,.071,.210,C.shoes,12,7);
  playerOval(side*.136,.037+lifted+yOff,shoeZ-.026,.116,.023,.210,C.sole,12,5);
  // Small lacing stripe (no texture or external image required).
  for(let lace=0;lace<2;lace++)
   playerOval(side*.136,.13+lifted+yOff,shoeZ-.06+lace*.046,.055,.009,.018,0xa7a9a6,7,4);
  // Arm swing opposes leg swing; shoulders, elbows and hands are jointed.
  const shoulder=[side*.317,1.336+yOff,.008];
  const elbow=[side*.385,1.080+yOff,-footPhase*stride*.78-.012];
  const hand=[side*.398,.865+yOff,-footPhase*stride*1.25-.044];
  playerOval(...shoulder,.126,.128,.127,C.shirt,10,7);
  playerLimb(shoulder,elbow,.113,.119,C.shirt);
  playerOval(...elbow,.094,.096,.093,C.shirt,9,6);
  playerLimb(elbow,hand,.076,.085,C.skin);
  playerOval(...hand,.079,.111,.057,C.skin,10,7);
  // Knuckle contour and thumb.
  playerOval(side*.347,.858+yOff,-footPhase*stride*1.25-.097,.029,.049,.041,C.shadowSkin,8,5);
  // Sleeve cuff.
  playerOval(...elbow,.099,.038,.101,C.shirtHighlight,9,5);
 }
 // Rotate locally sculpted vertices toward movement before world translation.
 const rotation=heading-Math.PI,cs=Math.cos(rotation),sn=Math.sin(rotation);
 for(let i=start;i<vertices.length;i+=6){
  const x=vertices[i],z=vertices[i+2];
  vertices[i]=px+x*cs+z*sn;
  vertices[i+2]=pz-x*sn+z*cs;
 }
 return (vertices.length-start)/6;
}
