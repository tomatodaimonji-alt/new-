function poiPlayerFireGeometry(m,p,now,impact){
 const {x,y,z,dx,dz}=p;
 const phase=(typeof poiEnemyCueReduced!=='undefined'&&poiEnemyCueReduced?.matches)?0:now*.018;
 const death=impact===undefined?0:Math.max(0,Math.min(1,(now-impact)/160));
 if(death>=1)return;
 const alpha=1-death,swell=impact===undefined?1:1+.66*Math.sin(Math.PI*Math.min(.9,death+.12));
 const pulse=.91+.09*Math.sin(phase*.8),length=1-.60*death;
 const W=(d,u,h)=>[x+dx*d+dz*u,y+h,z+dz*d-dx*u];
 const hot=[1.40*pulse,1.14*pulse,.46],gold=[1.22,.66+.10*pulse,.15],orange=[1.13,.34+.07*pulse,.038],red=[.68,.12,.024];
 // Two twisted, contoured ribbons share the same rolling center line.
 // The tapered head stays bright; the longer tail folds and cools.
 const profile=[[.49,.028],[.31,.17],[.02,.32],[-.27,.25],[-.60,.15],[-.90,.09],[-1.18,.025]];
 const point=(node,i,axis,sign)=>{
  const [d,w]=node,k=i/(profile.length-1),a=axis*Math.PI/2+k*.71;
  const v=w*swell*(1+.13*Math.sin(phase-i*.8+axis))*Math.sqrt(alpha);
  const u=Math.sin(phase-i*.77)*k*.14*swell,h=.024+k*k*.39*swell+.07*Math.sin(phase-i*.54)*k;
  return W(d*length,u+Math.cos(a)*v*sign,h+Math.sin(a)*v*sign);
 };
 for(let axis=0;axis<2;axis++)for(let i=1;i<profile.length;i++){
  const a=point(profile[i-1],i-1,axis,-1),b=point(profile[i-1],i-1,axis,1),
   c=point(profile[i],i,axis,1),d=point(profile[i],i,axis,-1);
  const c0=i<=2?gold:i<=4?orange:red;
  tri(m,a,b,c,c0);tri(m,a,c,d,c0);
 }
 for(let k=0;k<6;k++){
  const a=k*Math.PI/3+phase*.16,b=a+Math.PI/3;
  const V=(ang)=>W(.075*length,Math.cos(ang)*.145*swell*alpha,Math.sin(ang)*.154*swell*alpha+.036);
  tri(m,W(.45*length,0,.041),V(a),V(b),k%3?hot:gold);
  tri(m,V(a),W(-.33*length,0,.11),V(b),orange);
 }
 // Independent curled tongues and small warm sparks, never used for hits.
 for(let i=0;i<6;i++){
  const a=i*2.39996,t=phase-i*.72,s=i%2?1:-1;
  const r=(.165+.048*(i%3))*swell*alpha,u=s*r*(1+.43*Math.sin(t));
  const h=(.105+.032*i+.13*Math.sin(a+t))*swell*alpha;
  const root=W((.06-i*.074)*length,u*.25,.08);
  const elbow=W((-.22-i*.095)*length,u*.61,h*.62);
  const tip=W((-.41-i*.122)*length,u,h+.15),tail=W((-.29-i*.095)*length,u*.41,h*.47);
  tri(m,root,elbow,tip,i%2?red:orange);tri(m,root,tip,tail,orange);
  const d=(-.53-i*.097)*length,su=u*.85,sh=h+.18;
  tri(m,W(d-.021,su,sh),W(d+.032,su+.019,sh+.042),W(d+.026,su-.026,sh-.020),i%2?gold:red);
 }
 if(impact!==undefined){
  const reach=.27+.44*Math.sin(Math.PI*death*.91);
  for(let i=0;i<7;i++){
   const a=i*2.39996+phase*.052,d=Math.cos(a)*reach,u=Math.sin(a)*reach,h=(.12+.13*(i%3)+.36*death)*alpha;
   tri(m,W(d-.040*alpha,u,h),W(d+.045*alpha,u+.024*alpha,h+.092*alpha),W(d+.023*alpha,u-.034*alpha,h),i%2?gold:orange);
  }
 }
 const aura=m.fireGlow||(m.fireGlow=mesh());
 aura.alpha=(impact===undefined?.13+.023*pulse:.21)*alpha;
 const n=6,A=W(.41*length,0,.04),B=W(-1.09*length,.024*Math.sin(phase),.20*swell);
 for(let i=0;i<n;i++){
  const V=(j)=>{const a=j*Math.PI*2/n;return W(-.14*length,Math.cos(a)*.36*swell*alpha,Math.sin(a)*.31*swell*alpha+.095)};
  tri(aura,A,V(i),V(i+1),[.84,.29,.073]);tri(aura,B,V(i+1),V(i),[.66,.17,.036]);
 }
}
let poiWeaponFireGlowGpu=null;
function poiDrawPlayerFireGlow(glow,vp){
 if(!glow?.p.length||!(glow.alpha>0))return;
 poiWeaponFireGlowGpu=upload(glow,poiWeaponFireGlowGpu?.buf??null,gl.DYNAMIC_DRAW);
 gl.enable(gl.BLEND);gl.blendColor(0,0,0,glow.alpha);
 gl.blendFunc(gl.CONSTANT_ALPHA,gl.ONE);gl.depthMask(false);
 try{draw(poiWeaponFireGlowGpu,vp)}finally{
  gl.depthMask(true);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.blendColor(0,0,0,0);gl.disable(gl.BLEND);
 }
}
