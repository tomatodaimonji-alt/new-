function poiSnowFrostAmount(region,x,z){
 if(region!=='base'&&region!=='snowpass')return 0;
 if(region==='snowpass'){x+=48;z+=139}
 // North and west are real shared edges, not a sphere around a portal.
 // Feather off naturally outside the owned Snow parcel as well.
 const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t)};
 const wobble=.75*Math.sin(x*.72+z*.33)+.45*Math.sin(z*1.03-x*.56);
 const distance=Math.min(x-48,z-139)+wobble;
 return smooth((distance+4)/11)*(1-smooth((x-72)/4))*(1-smooth((z-168)/4));
}
function poiSnowGroundEdgeTint(region,x,z,kind,normal){
 if(!/^grass/.test(kind)&&kind!=='poiSnowGround')return normal;
 if(region==='base'&&(x<43||x>74||z<134||z>170))return normal;
 if(region==='snowpass'&&x>10&&z>10)return normal;
 if(region!=='base'&&region!=='snowpass')return normal;
 return (x,z,stock)=>{
  const t=poiSnowFrostAmount(region,x,z),gx=x+(region==='snowpass'?48:0),gz=z+(region==='snowpass'?139:0);
  const r=smoothSurfaceNoise(gx*.21,gz*.21);
  const green=[.38+r*.07,.54+r*.06,.34+r*.06],white=[.83+r*.08,.90+r*.05,.95+r*.035];
  const smooth=q=>{const v=Math.max(0,Math.min(1,q));return v*v*(3-2*v)};
  const d=Math.min(gx-48,gz-139);
  let edge=region==='snowpass'?1-smooth((d-5)/5):smooth((d+5)/5);
  edge*=1-smooth((gz-168)/4);
  const original=normal?normal(x,z):stock;
  return green.map((v,i)=>original[i]+(v+(white[i]-v)*t-original[i])*edge);
 };
}
function poiSnowBiomeLightWeight(x,z){
 // Zero at the exact two crossing planes, then gently settle over seven
 // tiles. The established deep snow light and geographic audio stay the same.
 const d=Math.max(0,Math.min(1,Math.min(x+.5,z+.5)/7));
 return d*d*(3-2*d);
}
