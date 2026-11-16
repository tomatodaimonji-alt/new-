function pineHarborGeometry(m,o){
 const x=o.x+.5,z=o.z+.5,deck=Math.max(1,terrainY(o.x,o.z));
 const B=(dx,dy,dz,w,h,d,c)=>cube(m,x+dx,dy,z+dz,w,h,d,c);
 const metal=[.43,.49,.49],dark=[.23,.27,.29],wood=[.58,.49,.38],pale=[.66,.69,.66],rust=[.47,.31,.23];
 if(o.type==='pineHarborPier'||o.type==='pineHarborQuay'){
  const cement=o.type==='pineHarborQuay';
  B(0,deck+.01,0,.992,.28,.992,cement?[.49,.52,.53]:[.41,.34,.28]);
  B(0,deck+.16,0,.982,.045,.982,cement?pale:wood);
  if(!cement){
   // Planks run across the pier's walking direction, not one fixed axis.
   if((o.rot||0)%2)for(const dx of [-.31,-.01,.29])B(dx,deck+.187,0,.015,.008,.93,[.37,.31,.25]);
   else for(const dz of [-.31,-.01,.29])B(0,deck+.187,dz,.93,.008,.015,[.37,.31,.25]);
  }
  else if((o.x+o.z)%7===0)B(0,deck+.193,-.40,.43,.012,.035,[.79,.72,.47]);
 }else if(o.type==='pineHarborBollard'){
  B(0,deck+.20,0,.30,.24,.31,dark);B(0,deck+.41,0,.48,.08,.34,metal);
 }else if(o.type==='pineHarborFender'){
  B(0,deck-.15,0,.40,.72,.27,dark);
  for(const h of [-.25,.04])B(0,deck+h,.16,.32,.05,.06,metal);
 }else if(o.type==='pineHarborLamp'){
  B(0,deck+.68,0,.10,1.40,.10,metal);
  B(0,deck+1.46,0,.42,.14,.42,dark);
  B(0,deck+1.38,0,.38,.05,.38,[.84,.75,.51]);
 }else if(o.type==='pineHarborPallet'){
  B(0,deck+.10,0,.78,.12,.78,rust);
  for(const dx of [-.25,.25])B(dx,deck+.30,0,.29,.32,.59,metal);
  B(0,deck+.49,0,.80,.06,.76,pale);
 }else if(o.type==='pineHarborSign'){
  B(0,deck+.65,0,.10,1.3,.12,dark);
  B(0,deck+1.35,0,.76,.35,.11,[.30,.42,.42]);
  B(0,deck+1.36,.06,.53,.035,.02,[.85,.77,.48]);
 }
}
