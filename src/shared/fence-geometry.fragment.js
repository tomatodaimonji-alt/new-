function connectedFenceGeometry(m,o,lookup){
 const kind=o.type.startsWith('fenceWood')?'Wood':o.type.startsWith('fenceStone')?'Stone':'Iron';
 if(o.type.endsWith('Gate'))return false;
 const nbrs=[[0,-1],[1,0],[0,1],[-1,0]].filter(([dx,dz])=>{
  const n=lookup.get((o.x+dx)+','+(o.z+dz)+','+o.y);
  return n&&n.type.startsWith('fence'+kind);
 });
 if(!nbrs.length)return false;
 const x=o.x+.5,z=o.z+.5,y=o.y*1.4+terrainY(o.x,o.z),wood=kind==='Wood',stone=kind==='Stone';
 const post=wood?[.48,.31,.18]:stone?[.57,.60,.57]:[.31,.38,.43];
 const cap=wood?[.61,.42,.25]:stone?[.70,.72,.67]:[.54,.60,.63];
 const h=stone?.98:1.12,w=stone?.235:.145;
 cube(m,x,y,z,w,h,w,post);cube(m,x,y+h-.07,z,w+.05,.12,w+.05,cap);
 for(const [dx,dz] of nbrs){
  const horizontal=dx!==0,span=.51;
  if(wood){
   for(const yy of [.36,.83])cube(m,x+dx*.25,y+yy,z+dz*.25,horizontal?span:.11,.11,horizontal?.11:span,cap);
   for(const t of [.18,.36])cube(m,x+dx*t,y+.13,z+dz*t,.10,.94,.10,post);
  }else if(stone){
   cube(m,x+dx*.25,y+.06,z+dz*.25,horizontal?span:.18,.52,horizontal?.18:span,post);
   cube(m,x+dx*.25,y+.59,z+dz*.25,horizontal?span:.22,.12,horizontal?.22:span,cap);
  }else{
   for(const yy of [.28,.86])cube(m,x+dx*.25,y+yy,z+dz*.25,horizontal?span:.068,.06,horizontal?.068:span,cap);
   for(const t of [.13,.27,.41])cube(m,x+dx*t,y+.09,z+dz*t,.05,1.02,.05,post);
  }
 }
 return true;
}
