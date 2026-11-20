function connectedRoofGeometry(m,o,lookup){
 const x=o.x+.5,z=o.z+.5,y=(o.y-1)*1.4,r=((o.rot||0)%4+4)%4;
 const mat=roofFamily(o.type),thatch=mat==='roofThatch',plank=mat==='roofPlank';
 const top=thatch?[.64,.54,.29]:plank?[.46,.30,.19]:[.59,.27,.23];
 const edge=thatch?[.42,.36,.19]:plank?[.29,.20,.13]:[.36,.23,.22];
 // Neighbor matching uses material, orientation and height; no saved layout changes.
 const has=(dx,dz)=>{
  const [xx,zz]=rot2(dx,dz,r);
  const n=lookup.get((o.x+xx)+','+(o.z+zz)+','+o.y);
  return !!n&&roofFamily(n.type)===mat&&(((n.rot||0)%4+4)%4)===r&&
   terrainLevel(n.x,n.z)===terrainLevel(o.x,o.z);
 };
 const north=has(0,-1),south=has(0,1),west=has(-1,0),east=has(1,0),t=mesh();
 const p=(dx,h,dz)=>[x+dx,y+h,z+dz];
 const slope=dx=>1.88-Math.abs(dx)*.86;
 const a=p(-.5,1.45,-.5),b=p(-.5,1.45,.5),c=p(0,1.88,-.5),
       d=p(0,1.88,.5),e=p(.5,1.45,-.5),f=p(.5,1.45,.5);
 quad(t,a,b,d,c,top);quad(t,c,d,f,e,top.map(v=>v*.91));
 if(!north)tri(t,a,c,e,edge);
 if(!south)tri(t,f,d,b,edge);
 // Color/height variations on each pitched surface: wood boards, clay tiles,
 // or bundled thatch. Light top-only strips avoid adding roof undersides.
 const tones=thatch?[[.73,.61,.34],[.67,.55,.30],[.61,.51,.27],[.71,.58,.31]]:
  plank?[[.54,.36,.22],[.48,.32,.19],[.51,.34,.21],[.45,.29,.18]]:
  [[.65,.30,.25],[.60,.26,.21],[.56,.25,.21],[.63,.28,.23]];
 const rows=thatch?4:5,cols=2;
 for(const side of [-1,1])for(let row=0;row<rows;row++){
  const near=row/rows*.5,far=(row+1)/rows*.5;
  const xa=side*near,xb=side*far;
  const yyA=slope(xa)+.008+row*.001,yyB=slope(xb)+.008+row*.001;
  for(let col=0;col<cols;col++){
   const zz0=-.5+col/cols,zz1=-.5+(col+1)/cols;
   const inset=thatch?.009:plank?.011:.007;
   const zl=zz0+(col===0&&!north?0:inset);
   const zr=zz1-(col===cols-1&&!south?0:inset);
   const tone=tones[(row*3+col+o.z+o.x*2+9)%tones.length];
   quad(t,p(xa,yyA,zl),p(xa,yyA,zr),p(xb,yyB,zr),p(xb,yyB,zl),tone);
   if(plank||!thatch){
    // Staggered narrow separation lines; unlike the old full diagonal grid,
    // these follow actual courses and stay above the pitched surface.
    const xLine=xb-side*.005;
    const yLine=slope(xLine)+.014+row*.001;
    naturalBranch(t,x+xLine,y+yLine,z+zl,x+xLine,y+yLine,z+zr,
     plank?.004:.003,plank?.004:.003,edge);
   }
  }
 }
 // Small material-specific relief: straw tips for thatch, plank grain for
 // timber and occasional raised tile ribs. Bounded for mobile performance.
 for(const side of [-1,1])for(let i=0;i<3;i++){
  const dx=side*(.115+i*.125),h=slope(dx)+.018;
  const zz=-.32+((o.x+o.z+i*3)%5)*.13;
  const count=thatch?2:1;
  for(let j=0;j<count;j++){
   const len=thatch?.21:plank?.29:.23;
   naturalBranch(t,x+dx,y+h,z+zz+j*.09,x+dx,y+h,z+Math.min(.49,zz+j*.09+len),
    thatch?.006:plank?.004:.004,thatch?.006:plank?.004:.004,
    thatch?[.78,.67,.40]:plank?[.36,.24,.15]:[.43,.23,.20]);
  }
 }
 // Continuous ridge; neighboring roofs share flush endpoint positions.
 cube(t,x,y+1.87,z,.097,.078,1.016,edge);
 if(!north)cube(t,x,y+1.86,z-.506,.17,.085,.058,edge);
 if(!south)cube(t,x,y+1.86,z+.506,.17,.085,.058,edge);
 // Overhangs only on exposed edges, never inside a connected roof.
 for(const side of [-1,1]){
  const open=side<0?!west:!east;
  if(!open)continue;
  const outer=side*.585;
  quad(t,p(side*.5,1.456,-.5),p(side*.5,1.456,.5),
   p(outer,slope(outer),.5),p(outer,slope(outer),-.5),top.map(v=>v*.89));
  cube(t,x+outer,y+slope(outer)-.043,z,.055,.085,1.12,edge);
  // A fascia along the eave, with end caps but no underside decoration.
  for(const zz of [-.47,.47])cube(t,x+outer,y+slope(outer)-.080,z+zz,.085,.085,.045,edge);
 }
 if(!north||!south){
  for(const side of [-1,1]){
   const dz=side*.548,open=side<0?!north:!south;
   if(!open)continue;
   for(const flank of [-1,1]){
    naturalBranch(t,x,y+1.88,z+dz,x+flank*.575,y+slope(.575),z+dz,
     .037,.037,edge);
   }
   cube(t,x,y+1.405,z+dz,1.11,.064,.045,edge);
  }
 }
 for(let i=0;i<t.p.length;i+=3){
  const [dx,dz]=rot2(t.p[i]-x,t.p[i+2]-z,r),[nx,nz]=rot2(t.n[i],t.n[i+2],r);
  m.p.push(x+dx,t.p[i+1],z+dz);m.n.push(nx,t.n[i+1],nz);m.c.push(t.c[i],t.c[i+1],t.c[i+2]);
 }
}

// Discrete architectural accents placed only along exterior wall faces.
// Walls themselves are unchanged so legacy houses and saved files stay intact.
