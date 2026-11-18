function houseFacadeDetails(m,visible){
 const walls=visible.filter(o=>/^(?:plasterwall|woodwall|stonewall|brickwall)(?:Door|Window)$/.test(o.type));
 const all=new Map(visible.filter(o=>o.y>=0&&!isFloor(o.type)).map(o=>[o.x+','+o.z+','+o.y,o]));
 for(const o of walls){
  const type=o.type,material=type.startsWith('stone')?[.61,.60,.54]:
   type.startsWith('brick')?[.58,.38,.30]:[.43,.30,.20];
  const light=[.73,.66,.55],x=o.x+.5,z=o.z+.5,y=o.y*1.4+terrainY(o.x,o.z);
  const r=o.rot||0;
  // All trim is local to front (+Z) prior to rotation.
  const scratch=mesh();
  const front=.506;
  if(type.endsWith('Plain')||type.endsWith('Window')){
   for(const xx of [-.43,.43])cube(scratch,xx,y,.0+front,.055,1.30,.035,material);
   cube(scratch,0,y+.08,front,.91,.07,.04,material);
   cube(scratch,0,y+1.22,front,.92,.085,.04,light);
  }
  if(type.endsWith('Door')){
   cube(scratch,0,y+1.20,front+.01,.73,.095,.07,light);
   for(const xx of [-.40,.40])cube(scratch,xx,y,front,.07,1.26,.06,material);
   // Short threshold flush with ground, not a high doorstep.
   cube(scratch,0,y+.006,.61,.72,.055,.24,[.56,.56,.50]);
  }
  if(type.endsWith('Window')){
   cube(scratch,0,y+.44,front+.045,.64,.10,.12,light);
   cube(scratch,0,y+1.04,front+.04,.62,.07,.09,material);
  }
  // On upper floors, a shared horizontal beam reads as domestic construction.
  if(o.y>0)cube(scratch,0,y+.05,front,.90,.06,.05,material);
  for(let i=0;i<scratch.p.length;i+=3){
   const [dx,dz]=rot2(scratch.p[i],scratch.p[i+2],r);
   const [nx,nz]=rot2(scratch.n[i],scratch.n[i+2],r);
   m.p.push(x+dx,scratch.p[i+1],z+dz);
   m.n.push(nx,scratch.n[i+1],nz);m.c.push(...scratch.c.slice(i,i+3));
  }
 }
}


// Bridge orientation convention (identical for wood and stone):
// 0: north-south, 1: east-west, 2: south-north, 3: west-east.
// Bridge handrails are only on the outside edges of the complete bridge width.
