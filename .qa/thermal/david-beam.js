// BEGIN DAVID THERMAL BEAM
function poiDavidThermalBeam(q,ray,reach,now,reduced=false){
 const m=mesh();if(reach<=.42)return m;
 const base=terrainY(q.sx,q.sz)+q.y*1.4;
 const eye=typeof POI_DAVID_EYE_Y==='number'?POI_DAVID_EYE_Y:4.75;
 const front=typeof POI_DAVID_EYE_FRONT==='number'?POI_DAVID_EYE_FRONT:.29;
 const end=Math.max(front,reach-.025),phase=reduced?0:now*.010;
 const P=(d,u,h)=>[q.sx+.5+ray.x*d+ray.z*u,base+h,q.sz+.5+ray.z*d-ray.x*u];
 // The generous floor warning is untouched; this brighter filament is the
 // real depth-tested effect along its already-clipped center ray.
 const rings=(segments,sides,outer)=>{
  let prev;
  for(let k=0;k<=segments;k++){
   const t=k/segments,d=front+(end-front)*t,s=Math.sin(Math.PI*t),curl=Math.sin(t*11-phase);
   const radius=outer?(.085+.13*s+.03*t):(.038+.060*s+.008*t);
   const width=radius*(.90+.10*Math.sin(t*16-phase));
   const h=eye+(.68-eye)*t,offset=.033*curl*s,wave=.026*Math.cos(t*13-phase)*s;
   const row=[];
   for(let i=0;i<sides;i++){
    const a=i*Math.PI*2/sides+t*.68,widthHere=width*(1+.12*Math.sin(a*2+t*7-phase));
    row.push(P(d,offset+Math.cos(a)*widthHere,h+wave+Math.sin(a)*widthHere));
   }
   const heat=.5+.5*Math.sin(t*15-phase);
   if(prev)for(let i=0;i<sides;i++){
    const j=(i+1)%sides;
    const c=outer?[1,.135+.16*heat,.038+.03*heat]:i%2?[1.33,1.08+.10*heat,.60+.10*heat]:[1.25,.55+.27*heat,.11+.18*heat];
    quad(m,prev[i],prev[j],row[j],row[i],c);
   }
   prev=row;
  }
 };
 rings(8,5,false);
 // A small flare at the ray endpoint never places geometry past its wall/room limit.
 for(let i=0;i<5;i++){
  const spread=(i-2)*.032,step=.050*(i%3),h=.69+(i%3)*.045;
  tri(m,P(end-.08-step,spread,h),P(end-.065-step,spread+.039,h+.079),P(end-.009,spread-.021,h+.024),[1.16,.65,.23]);
 }
 m.coreCount=m.p.length/3;
 rings(5,4,true);
 return m;
}
function poiDavidBeamReduced(){return typeof poiEnemyCueReduced!=='undefined'&&!!poiEnemyCueReduced?.matches}
function poiDavidSweepBeamMesh(q,b,now=0){
 const ray=poiDavidBeamRay(q,q.sweep.angle);
 return poiDavidThermalBeam(q,ray,poiDavidBeamReach(q,b,ray),now,poiDavidBeamReduced());
}
function poiDavidBeamUpload(m,prior){
 if(!m.p.length)return null;
 const g=upload(m,prior?.buf??null,gl.DYNAMIC_DRAW);
 g.coreCount=m.coreCount;return g;
}
function poiDavidDrawThermalBeam(g,vp,alpha){
 if(!g)return;
 const tail=g.count-g.coreCount;
 if(tail>0){gl.blendColor(0,0,0,alpha*.26);draw(g,vp,g.coreCount,tail)}
 gl.blendColor(0,0,0,alpha*.78);draw(g,vp,0,g.coreCount);
}
// END DAVID THERMAL BEAM
