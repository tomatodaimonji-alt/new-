function connectedRoofGeometry(m,o,lookup){
 const x=o.x+.5,z=o.z+.5,y=(o.y-1)*1.4,r=((o.rot||0)%4+4)%4;
 const mat=roofFamily(o.type),thatch=mat==='roofThatch',plank=mat==='roofPlank';
 const top=thatch?[.64,.54,.29]:plank?[.46,.30,.19]:[.59,.27,.23];
 const edge=thatch?[.42,.36,.19]:plank?[.29,.20,.13]:[.36,.23,.22];
 const has=(dx,dz)=>{const [xx,zz]=rot2(dx,dz,r),n=lookup.get((o.x+xx)+','+(o.z+zz)+','+o.y);return !!n&&roofFamily(n.type)===mat&&(((n.rot||0)%4+4)%4)===r};
 const north=has(0,-1),south=has(0,1),west=has(-1,0),east=has(1,0),t=mesh();
 const p=(dx,h,dz)=>[x+dx,y+h,z+dz];
 const a=p(-.5,1.45,-.5),b=p(-.5,1.45,.5),c=p(0,1.88,-.5),d=p(0,1.88,.5),e=p(.5,1.45,-.5),f=p(.5,1.45,.5);
 quad(t,a,b,d,c,top);quad(t,c,d,f,e,top.map(v=>v*.91));
 if(!north)tri(t,a,c,e,edge);
 if(!south)tri(t,f,d,b,edge);
 cube(t,x,y+1.87,z,.095,.085,1,edge);
 for(const dz of [-.25,0,.25]){
  naturalBranch(t,x-.49,y+1.46,z+dz,x,y+1.88,z+dz,.011,.011,edge);
  naturalBranch(t,x,y+1.88,z+dz,x+.49,y+1.46,z+dz,.011,.011,edge);
 }
 if(!west)cube(t,x-.484,y+1.42,z,.065,.065,1,edge);
 if(!east)cube(t,x+.484,y+1.42,z,.065,.065,1,edge);
 if(!north)cube(t,x,y+1.43,z-.483,.98,.07,.07,edge);
 if(!south)cube(t,x,y+1.43,z+.483,.98,.07,.07,edge);
 for(const [sx,sz,openX,openZ] of [[-1,-1,!west,!north],[1,-1,!east,!north],[-1,1,!west,!south],[1,1,!east,!south]]){
  if(openX&&openZ)cube(t,x+sx*.452,y+1.415,z+sz*.452,.10,.10,.10,edge);
 }
 for(let i=0;i<t.p.length;i+=3){
  const [dx,dz]=rot2(t.p[i]-x,t.p[i+2]-z,r),[nx,nz]=rot2(t.n[i],t.n[i+2],r);
  m.p.push(x+dx,t.p[i+1],z+dz);m.n.push(nx,t.n[i+1],nz);m.c.push(t.c[i],t.c[i+1],t.c[i+2]);
 }
}

// Discrete architectural accents placed only along exterior wall faces.
// Walls themselves are unchanged so legacy houses and saved files stay intact.
