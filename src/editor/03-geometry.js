const mesh=()=>({p:[],n:[],c:[]});
const terrainKey=(x,z)=>x+','+z;
const terrainLevel=(x,z)=>terrainHeights.get(terrainKey(x,z))||0;
const terrainY=(x,z)=>terrainLevel(x,z)*TERRAIN_STEP;
function shiftMesh(m,t,h){for(let i=0;i<t.p.length;i+=3){m.p.push(t.p[i],t.p[i+1]+h,t.p[i+2]);m.n.push(t.n[i],t.n[i+1],t.n[i+2]);m.c.push(t.c[i],t.c[i+1],t.c[i+2])}}
function terrainSide(m,x,z,h,neighbor,face){
 if(h<=neighbor)return;
 // Cohesive grass/earth/rock cross-section; continuous faces, no dark stripe decals.
 const p=(u,v)=>face===0?[x+u,v,z]:face===1?[x+1,v,z+u]:
                   face===2?[x+1-u,v,z+1]:[x,v,z+1-u];
 const high=h*TERRAIN_STEP,low=neighbor*TERRAIN_STEP;
 const tone=surfaceNoise(x*7+face*13,z*11+h*3);
 const grass=[.33+tone*.07,.48+tone*.07,.28+tone*.04];
 const soil=[.43+tone*.06,.34+tone*.05,.25+tone*.035];
 const clay=[.48+tone*.06,.39+tone*.04,.30+tone*.03];
 const rock=[.43+tone*.09,.44+tone*.08,.41+tone*.07];
 const layers=[
  [low,Math.min(high,high-.70),rock],
  [Math.max(low,high-.70),Math.max(low,high-.22),clay],
  [Math.max(low,high-.22),Math.max(low,high-.045),soil],
  [Math.max(low,high-.045),high,grass]
 ];
 for(const [bottom,top,color] of layers){
  if(top-bottom<.003)continue;
  // Neighboring faces share exactly the same corner vertices.
  quad(m,p(0,bottom),p(1,bottom),p(1,top),p(0,top),color);
 }
 // Staggered earthy seams soften tall cliffs, offset to avoid Z-fighting.
 if(high-low>.65){
  const v=low+Math.min((high-low)*.38,.46),u=.12+tone*.31,u2=Math.min(.91,u+.23);
  const off=face===0?[0,0,-.003]:face===1?[.003,0,0]:face===2?[0,0,.003]:[-.003,0,0];
  const q=(u,h)=>p(u,h).map((n,i)=>n+off[i]);
  quad(m,q(u,v),q(u2,v+.025),q(u2-.045,v+.12),q(u+.018,v+.09),[.48+tone*.055,.44+tone*.045,.37+tone*.035]);
 }
 // Occasional subtle stone patches stay flush with the rock, never protrude.
 if(high-low>1.2&&tone>.67){
  const c=[.51,.51,.47],yb=low+.24,yt=Math.min(high-.72,yb+.22);
  if(yt>yb)quad(m,p(.29,yb),p(.63,yb),p(.63,yt),p(.29,yt),c);
 }
}
function terrainPassable(x,z,nx,nz){
 if(Math.abs(x-nx)+Math.abs(z-nz)!==1)return false;
 const diff=terrainLevel(nx,nz)-terrainLevel(x,z);
 if(diff===0)return true;
 if(Math.abs(diff)!==1)return false;
 const low=diff>0?[x,z]:[nx,nz],high=diff>0?[nx,nz]:[x,z];
 const rotation=staircaseRotation(low[0],low[1],high[0],high[1]);
 return world.some(o=>o.type==='terrainStairs'&&o.x===low[0]&&o.z===low[1]&&o.rot===rotation);
}
function waterfallFace(m,x,z,dx,dz,high,low){
 if(high<=low)return;
 const yBottom=low*TERRAIN_STEP+.035,yTop=high*TERRAIN_STEP+.028;
 const side=dx===1?[x+1,z,x+1,z+1]:dx===-1?[x,z+1,x,z]:
  dz===1?[x+1,z+1,x,z+1]:[x,z,x+1,z];
 const offsetX=dx*.014,offsetZ=dz*.014;
 const a=[side[0]+offsetX,yBottom,side[1]+offsetZ],b=[side[2]+offsetX,yBottom,side[3]+offsetZ];
 const c=[side[2]+offsetX,yTop,side[3]+offsetZ],d=[side[0]+offsetX,yTop,side[1]+offsetZ];
 quad(m,a,b,c,d,[.23,.56,.70]);
 // Lightweight pale strips; vertical waterfalls only at descending water edges.
 for(let i=1;i<5;i++){
  const t=i/5,p=[a[0]+(b[0]-a[0])*t,a[2]+(b[2]-a[2])*t],v=[.62,.83,.84];
  const q=[p[0]+(b[0]-a[0])*.034,p[1]+(b[2]-a[2])*.034];
  quad(m,[p[0],yBottom,p[1]],[q[0],yBottom,q[1]],
   [q[0],yTop,q[1]],[p[0],yTop,p[1]],v);
 }
}
const STAIR_DIRECTIONS=[[0,-1],[1,0],[0,1],[-1,0]];
function staircaseRotation(x,z,nx,nz){
 const i=STAIR_DIRECTIONS.findIndex(([dx,dz])=>x+dx===nx&&z+dz===nz);
 return i;
}
function elevationStairGeometry(m,x,z,base,rot){
 const t=mesh(),steps=5,depth=1/steps;
 for(let i=0;i<steps;i++){
  const zz=.5-(i+.5)*depth,rise=(i+1)*TERRAIN_STEP/steps;
  cube(t,0,-.032,zz,.91,rise+.032,depth+.002,i%2?[.67,.66,.60]:[.62,.61,.55]);
  cube(t,0,rise-.024,zz+depth*.45,.92,.023,.029,[.72,.71,.65]);
  for(const sx of [-1,1]){
   cube(t,sx*.476,-.045,zz,.072,rise+.045,depth+.004,[.46,.36,.27]);
   cube(t,sx*.478,rise-.014,zz,.084,.026,depth+.007,[.36,.50,.31]);
  }
 }
 for(let i=0;i<t.p.length;i+=3){
  const [vx,vz]=rot2(t.p[i],t.p[i+2],rot);
  const [nx,nz]=rot2(t.n[i],t.n[i+2],rot);
  m.p.push(x+.5+vx,base+t.p[i+1],z+.5+vz);
  m.n.push(nx,t.n[i+1],nz);m.c.push(...t.c.slice(i,i+3));
 }
}
function tri(m,a,b,c,col){const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,l=Math.hypot(nx,ny,nz)||1;for(const v of [a,b,c]){m.p.push(...v);m.n.push(nx/l,ny/l,nz/l);m.c.push(...col)}}
function quad(m,a,b,c,d,col){tri(m,a,b,c,col);tri(m,a,c,d,col)}
function cube(m,x,y,z,w,h,d,col){const x0=x-w/2,x1=x+w/2,y0=y,y1=y+h,z0=z-d/2,z1=z+d/2;const scale=(p,k)=>p.map(v=>Math.min(1,v*k));
quad(m,[x0,y1,z0],[x0,y1,z1],[x1,y1,z1],[x1,y1,z0],scale(col,1.08));quad(m,[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],col);quad(m,[x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],scale(col,.72));quad(m,[x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],scale(col,.88));quad(m,[x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],scale(col,.83))}
function diamond(m,x,y,z,r,col){const p=[[x,y+r,z],[x-r,y,z],[x,y,z+r],[x+r,y,z],[x,y,z-r],[x,y-r*.65,z]];for(let i=1;i<=4;i++){const j=i===4?1:i+1;tri(m,p[0],p[i],p[j],col);tri(m,p[5],p[j],p[i],col.map(v=>v*.76))}}
function rot2(x,z,r){const a=((r%4)+4)%4;return a===0?[x,z]:a===1?[-z,x]:a===2?[-x,-z]:[z,-x]}
function addPart(m,p,cx,cz,base=0,rot=0){const [x,z]=rot2(p.x,p.z,rot),[w,d]=rot%2?[p.d,p.w]:[p.w,p.d];cube(m,cx+x,base+p.y,cz+z,w,p.h,d,hexRGB(p.color))}

// Low-poly natural assets: tapered branch meshes and varied faceted crowns;
// all generated locally without texture files or external assets.
function naturalBranch(m,ax,ay,az,bx,by,bz,r1,r2,color){
 const vx=bx-ax,vy=by-ay,vz=bz-az,le=Math.hypot(vx,vy,vz)||1;
 let ux=-vz/le,uy=0,uz=vx/le;
 if(Math.hypot(ux,uz)<.05){ux=1;uz=0}
 const wx=uy*vz/le-uz*vy/le,wy=uz*vx/le-ux*vz/le,wz=ux*vy/le-uy*vx/le;
 const n=6,lower=[],upper=[];
 for(let i=0;i<n;i++){const a=i*Math.PI*2/n,co=Math.cos(a),si=Math.sin(a);
 lower.push([ax+r1*(co*ux+si*wx),ay+r1*(co*uy+si*wy),az+r1*(co*uz+si*wz)]);
 upper.push([bx+r2*(co*ux+si*wx),by+r2*(co*uy+si*wy),bz+r2*(co*uz+si*wz)])}
 for(let i=0;i<n;i++){const j=(i+1)%n,c=color.map(v=>v*(.82+.04*(i%4)));
 quad(m,lower[i],lower[j],upper[j],upper[i],c)}
 for(let i=1;i<n-1;i++)tri(m,upper[0],upper[i],upper[i+1],color);
}
function naturalCrown(m,x,y,z,rx,ry,rz,color,seed=0){
 // Eight-sided rings make a rounded irregular volume, unlike octahedron foliage.
 const n=8, rings=[[-.90,.32],[-.42,.83],[.20,1],[.67,.71],[.98,.12]],points=[];
 for(let j=0;j<rings.length;j++){const [height,rad]=rings[j],ring=[];
  for(let i=0;i<n;i++){const a=i*Math.PI*2/n,noise=.91+.10*Math.sin(seed*3+i*5.3+j*2.1);
   ring.push([x+Math.cos(a)*rx*rad*noise,y+height*ry,z+Math.sin(a)*rz*rad*noise])}
  points.push(ring);
 }
 for(let j=0;j<points.length-1;j++)for(let i=0;i<n;i++){
  const k=(i+1)%n,shade=.88+.12*((i+j+seed)%4)/3;
  quad(m,points[j][i],points[j][k],points[j+1][k],points[j+1][i],color.map(v=>v*shade));
 }
 for(let i=1;i<n-1;i++){tri(m,points[0][0],points[0][i+1],points[0][i],color.map(v=>v*.67));tri(m,points[points.length-1][0],points[points.length-1][i],points[points.length-1][i+1],color)}
}
function naturalRock(m,x,y,z,rx,ry,rz,color,seed=0){
 const n=7,points=[],levels=[0,.28,.72,1],radius=[.65,1,.82,.3];
 for(let j=0;j<levels.length;j++){const layer=[];
  for(let i=0;i<n;i++){const a=i*2*Math.PI/n,wiggle=.82+.22*Math.abs(Math.sin(i*3.7+j*2.9+seed));
   layer.push([x+Math.cos(a)*rx*radius[j]*wiggle,y+ry*levels[j]*(.88+.1*Math.sin(i+seed)),z+Math.sin(a)*rz*radius[j]*wiggle])}
  points.push(layer);
 }
 for(let j=0;j<points.length-1;j++)for(let i=0;i<n;i++){
  const k=(i+1)%n,shade=.76+.08*((i*3+j*2+seed)%5);
  quad(m,points[j][i],points[j][k],points[j+1][k],points[j+1][i],color.map(v=>Math.min(1,v*shade)));
 }
 for(let i=1;i<n-1;i++)tri(m,points[3][0],points[3][i],points[3][i+1],color);
}
function detailedTree(m,id,x,y,z){
 const bark=id==='treeBamboo'?[.40,.53,.29]:id==='treeCedar'?[.37,.25,.18]:[.42,.29,.20];
 const cherry=id==='treeCherry',autumn=id==='treeAutumn',willow=id==='treeWillow',cedar=id==='treeCedar',bamboo=id==='treeBamboo';
 const maple=id==='treeMaple';
 if(bamboo){
  for(const [i,px,pz] of [[0,-.23,-.13],[1,.05,.14],[2,.28,-.09]]){
   const tall=1.92+.16*i;
   naturalBranch(m,x+px,y,z+pz,x+px+.025,y+tall,z+pz,.058,.045,bark);
   for(let j=1;j<5;j+=2){const h=.36*j;
    cube(m,x+px+.015,y+h,z+pz,.11,.042,.10,[.28,.39,.21]);
    for(const side of [-1,1])naturalCrown(m,x+px+side*.21,y+h+.13,z+pz,.26,.055,.11,[.25,.49,.28],j+i);
   }
  }
  return;
 }
 const height=cedar?2.35:willow?1.9:2.02;
 naturalBranch(m,x,y,z,x+.03,y+height,z-.025,cedar?.18:.22,cedar?.045:.065,bark);
 if(cedar){
  for(let i=0;i<6;i++)naturalCrown(m,x+.035,y+.78+i*.24,z-.025,.69-i*.075,.31,.67-i*.068,[.17+i*.008,.36+i*.012,.28+i*.006],i);
  return;
 }
 const colors=cherry?[[.84,.62,.66],[.92,.73,.74],[.79,.52,.60]]:
 autumn?[[.76,.34,.12],[.86,.47,.15],[.65,.27,.12]]:
 willow?[[.34,.54,.27],[.40,.59,.30],[.28,.47,.23]]:
 maple?[[.31,.56,.28],[.42,.65,.32],[.29,.51,.31]]:
 [[.31,.57,.32],[.40,.63,.35]];
 const limbs=[[-.45,1.26,-.12],[-.22,1.51,.33],[.42,1.32,.16],[.29,1.65,-.32],[0,1.85,.05]];
 for(let i=0;i<limbs.length;i++){
  const [xx,yy,zz]=limbs[i];const from=1.03+i*.10;
  naturalBranch(m,x,y+from,z,x+xx,y+yy,z+zz,.095,.026,bark);
  naturalCrown(m,x+xx,y+yy+.18,z+zz,.38+(i%2)*.04,willow?.27:.38,.36,colors[i%colors.length],i+1);
  if(willow)for(let a=0;a<3;a++){
   const dd=a*2*Math.PI/3+i*.36;
   naturalBranch(m,x+xx+Math.cos(dd)*.22,y+yy+.12,z+zz+Math.sin(dd)*.22,x+xx+Math.cos(dd)*.25,y+yy-.45,z+zz+Math.sin(dd)*.26,.027,.008,[.31,.49,.24]);
  }
 }
}

// Characters use low-poly silhouettes. +Z is front; the ordinary deco()
// rotation path handles all four placement directions.
function characterHuman(m,x,y,z,villager){
 const skin=[.77,.59,.43],shade=[.63,.46,.35],hair=[.28,.20,.13];
 const cloth=[.32,.47,.39],linen=[.75,.71,.57],boot=[.26,.21,.18];
 for(const side of [-1,1]){
  const xx=x+side*.115;
  cube(m,xx,y,z,.155,.52,.19,villager?boot:skin);
  if(villager)cube(m,xx,y+.37,z,.17,.24,.21,cloth);
 }
 cube(m,x,y+.49,z,.39,.48,.26,villager?cloth:skin);
 for(const side of [-1,1]){
  cube(m,x+side*.272,y+.53,z,.135,.46,.17,villager?linen:skin);
  cube(m,x+side*.272,y+.49,z+.028,.145,.12,.17,skin);
 }
 cube(m,x,y+.94,z,.14,.11,.14,skin);
 cube(m,x,y+1.05,z,.35,.37,.34,skin);
 cube(m,x,y+1.365,z-.035,.38,.10,.37,hair);
 for(const side of [-1,1]){
  cube(m,x+side*.086,y+1.225,z+.176,.036,.041,.014,[.19,.19,.17]);
 }
 cube(m,x,y+1.095,z+.179,.09,.028,.01,shade);
 if(villager){
  // Simple tunic, belt and cap distinguish a working villager.
  cube(m,x,y+.48,z+.142,.405,.15,.039,[.46,.30,.20]);
  cube(m,x,y+.53,z+.164,.09,.11,.025,[.79,.68,.37]);
  cube(m,x,y+1.38,z,.43,.13,.40,[.39,.30,.20]);
  cube(m,x,y+1.32,z+.14,.44,.05,.16,[.39,.30,.20]);
 }
}


// Expansion assets: each identifier is a self-contained model. Local-world
// coordinates rotate through deco() just like the existing furniture pieces.
const EXPANSION_IDS=new Set(["roofTile","roofThatch","roofPlank","roofTileRidge","roofThatchRidge","roofPlankRidge","roofTileEnd","roofThatchEnd","roofPlankEnd","roofCorner","chimney","archStone","timberWall","balcony","roofRuin","fallenLog","exposedRoots","mushroomPatch","giantMushroom","vineWall","watersideRock","flowerField","tallGrass","bedLuxury","chairWood","chairClassic","stoolRound","benchWood","bookshelf","wardrobe","fireplace","lantern","candleStand","barrel","crate","sack","displayShelf","brokenPillar","crackedWall","ironGate","gravestone","sarcophagus","stairDown","ancientAltar","rubble"]);
// Faceted ring loft: rounded silhouettes built from light-weight triangle meshes.
function roundStack(m,x,y,z,levels,sides,baseColor,capTop=true){
 const rings=levels.map(([h,rx,rz])=>Array.from({length:sides},(_,i)=>{const a=2*Math.PI*i/sides;return [x+Math.cos(a)*rx,y+h,z+Math.sin(a)*rz]}));
 for(let k=0;k<rings.length-1;k++)for(let i=0;i<sides;i++){
  const j=(i+1)%sides,shade=.83+.045*(i%4)+.027*(k%2),color=baseColor.map(v=>Math.min(1,v*shade));
  quad(m,rings[k][i],rings[k][j],rings[k+1][j],rings[k+1][i],color);
 }
 if(capTop){const top=rings[rings.length-1],cy=y+levels[levels.length-1][0];for(let i=0;i<sides;i++)tri(m,[x,cy,z],top[i],top[(i+1)%sides],baseColor.map(v=>Math.min(1,v*1.07)));}
}
function roundBand(m,x,y,z,radius,thick,sides,color){
 const lo=[],hi=[];for(let i=0;i<sides;i++){const a=2*Math.PI*i/sides;lo.push([x+radius*Math.cos(a),y,z+radius*Math.sin(a)]);hi.push([x+radius*Math.cos(a),y+thick,z+radius*Math.sin(a)]);}
 for(let i=0;i<sides;i++){const j=(i+1)%sides;quad(m,lo[i],lo[j],hi[j],hi[i],color);}
}
function expansionGeometry(m,id,x,y,z){
 const wood=[.47,.30,.17],dark=[.29,.20,.12],stone=[.55,.58,.55],light=[.76,.73,.63],iron=[.33,.39,.42],green=[.30,.50,.28],brick=[.54,.29,.24];
 const B=(dx,dy,dz,w,h,d,col)=>cube(m,x+dx,y+dy,z+dz,w,h,d,col);
 const D=(dx,dy,dz,r,col)=>diamond(m,x+dx,y+dy,z+dz,r,col);
 const branch=(a,b,r1,r2,col)=>naturalBranch(m,x+a[0],y+a[1],z+a[2],x+b[0],y+b[1],z+b[2],r1,r2,col);
 if(id.startsWith('roof')&&id!=='roofRuin'){
  const thatch=id.includes('Thatch'),plank=id.includes('Plank');
  const top=thatch?[.64,.54,.29]:plank?[.46,.30,.19]:[.59,.27,.23];
  const trim=thatch?[.42,.36,.19]:plank?[.29,.20,.13]:[.36,.23,.22];
  const end=id.endsWith('End'),ridge=id.endsWith('Ridge'),corner=id==='roofCorner';
  // Ridge runs along Z. Four pitched planes share exact edge vertices.
  const yy=y-.01,peak=yy+.49,edge=yy+.06;
  const v=(dx,h,dz)=>[x+dx,h,z+dz];
  const left0=v(-.5,edge,-.5),left1=v(-.5,edge,.5),high0=v(0,peak,-.5),high1=v(0,peak,.5);
  const right0=v(.5,edge,-.5),right1=v(.5,edge,.5);
  quad(m,left0,left1,high1,high0,top);
  quad(m,high0,high1,right1,right0,top.map(n=>n*.91));
  tri(m,left0,high0,right0,trim);tri(m,right1,high1,left1,trim);
  for(let i=1;i<=3;i++){
   const zt=-.5+i*.25,off=corner?.055:0;
   branch([-.49,.06,zt],[0,.47-off,zt],.010,.010,trim);
   branch([0,.47-off,zt],[.49,.06,zt],.010,.010,trim);
  }
  if(ridge||end||corner)B(0,.46,0,.11,.09,1.02,trim);
  if(end||corner){B(0,-.01,.47,.98,.09,.085,trim);B(0,-.01,-.47,.98,.09,.085,trim)}
  if(corner)B(.46,-.01,0,.09,.08,.98,trim);
  return;
 }
 switch(id){
 case 'chimney':
  B(0,0,0,.61,1.9,.58,brick);B(0,1.82,0,.72,.17,.69,stone);B(0,2.00,0,.42,.025,.40,dark);
  for(let k=1;k<=6;k++)B(0,k*.26,.298,.61,.018,.016,dark);break;
 case 'archStone':
  for(let s of [-1,1])B(s*.37,0,0,.24,1.65,.52,stone);
  B(0,1.58,0,1,.22,.55,stone);B(0,1.78,0,.8,.12,.58,light);break;
 case 'timberWall':
  B(0,0,0,.98,1.36,.96,[.84,.80,.68]);
  for(let s of [-1,1])B(s*.44,0,.497,.10,1.38,.11,dark);
  B(0,.54,.5,.95,.09,.10,wood);B(0,1.25,.5,.95,.12,.10,dark);
  branch([-.40,.10,.555],[.40,1.20,.555],.033,.033,wood);break;
 case 'balcony':
  B(0,.72,0,1,.11,.99,wood);
  for(let s of [-1,1])for(let t of [-1,1])B(s*.43,.82,t*.42,.09,.66,.09,dark);
  B(0,1.42,.43,.99,.10,.10,wood);B(0,1.42,-.43,.99,.10,.10,wood);break;
 case 'roofRuin':
  B(0,.02,0,.98,.12,.98,dark);
  for(let i=0;i<4;i++)B(-.35+i*.22,.09,-.24+i*.10,.20,.08,.43,i%2?brick:wood);
  D(.26,.18,.23,.20,stone);break;
 case 'fallenLog':
  branch([-.55,.19,0],[.51,.31,.05],.25,.19,wood);
  for(let i=0;i<3;i++)B(-.30+i*.30,.12,.14,.08,.12,.05,dark);
  D(.48,.32,.04,.21,[.69,.52,.34]);break;
 case 'exposedRoots':
  B(0,0,0,.23,.38,.23,wood);
  for(let i=0;i<5;i++){const a=i*Math.PI*2/5;branch([0,.23,0],[Math.cos(a)*.54,.025,Math.sin(a)*.54],.10,.045,dark)}break;
 case 'mushroomPatch':
  for(const [dx,dz,h] of [[-.24,-.12,.30],[.18,.22,.38],[.23,-.22,.23],[-.13,.28,.22]]){
   B(dx,0,dz,.08,h,.08,light);D(dx,h,dz,.16,[.64,.23,.21]);D(dx,h+.07,dz,.08,[.87,.60,.40])}break;
 case 'giantMushroom':
  B(0,0,0,.22,.90,.24,light);D(0,1.00,0,.53,[.69,.27,.24]);
  for(const [dx,dz] of [[-.18,.11],[.18,-.11],[0,.25]])D(dx,1.21,dz,.085,[.95,.82,.64]);break;
 case 'vineWall':
  for(let i=0;i<4;i++){const dz=-.33+i*.21;branch([dz*.25,.03,dz],[dz*.31,1.30,dz+.08],.020,.010,wood);
   for(let j=0;j<5;j++)D(dz*.30+Math.sin(i+j)*.11,.12+j*.23,dz,.105,green)}break;
 case 'watersideRock':
  D(-.13,.22,0,.40,stone);D(.26,.12,.16,.27,[.47,.57,.55]);
  for(let i=0;i<3;i++)B(-.36+i*.3,.02,.29,.06,.45,.06,green);break;
 case 'flowerField':
  for(let i=0;i<9;i++){const dx=(i%3-1)*.26,dz=(Math.floor(i/3)-1)*.27;
   B(dx,0,dz,.025,.18+(i%3)*.04,.025,green);D(dx,.22+(i%3)*.04,dz,.08,i%3===0?[.87,.52,.31]:i%3===1?[.79,.59,.77]:[.93,.85,.48])}break;
 case 'tallGrass':
  for(let i=0;i<12;i++){const a=i*2.4,r=.12+(i%4)*.10;
   branch([Math.cos(a)*r,0,Math.sin(a)*r],[Math.cos(a)*r+.1,.48+(i%5)*.10,Math.sin(a)*r-.08],.023,.008,i%3?green:[.60,.65,.34])}break;
 case 'bedLuxury':
  B(0,.12,0,.94,.20,1.48,dark);B(0,.32,0,.85,.25,1.34,[.56,.26,.33]);
  B(0,.58,-.39,.79,.12,.38,light);B(0,.0,-.66,.95,.94,.15,wood);
  B(0,.92,-.68,1.06,.12,.18,[.76,.63,.34]);break;
 case 'chairClassic':{
  // Broad-backed chair with a cushioned seat; distinguishable from plain wooden chair.
  const frame=[.38,.26,.17],seat=[.54,.39,.27],fabric=[.43,.35,.28],trim=[.69,.51,.34];
  for(const xx of [-.31,.31])for(const zz of [-.28,.28])B(xx,0,zz,.085,.53,.09,frame);
  B(0,.48,0,.78,.12,.69,seat);
  B(0,.605,.025,.67,.055,.55,fabric);
  for(const xx of [-.33,.33])B(xx,.52,-.29,.075,.74,.09,frame);
  B(0,.86,-.285,.72,.34,.09,seat);
  B(0,.91,-.228,.58,.21,.028,fabric);
  B(0,1.13,-.288,.77,.07,.11,trim);
  break;}
 case 'stoolRound':{
  // Eight-sided round stool: radial seat, separate legs and circular footrest.
  const seat=[.57,.38,.22],rim=[.39,.25,.15],legs=[.34,.23,.15],top=[.68,.49,.31];
  const ring=(height,radius)=>Array.from({length:12},(_,i)=>{const a=i*Math.PI/6;return [x+Math.cos(a)*radius,y+height,z+Math.sin(a)*radius]});
  const low=ring(.46,.365),high=ring(.57,.365),inset=ring(.583,.31);
  for(let i=0;i<12;i++){
   const j=(i+1)%12;
   quad(m,low[i],low[j],high[j],high[i],i%3?seat:rim);
   tri(m,[x,y+.583,z],inset[i],inset[j],top);
   quad(m,inset[i],high[i],high[j],inset[j],seat);
  }
  for(let i=0;i<4;i++){
   const a=Math.PI/4+i*Math.PI/2,xx=Math.cos(a)*.235,zz=Math.sin(a)*.235;
   B(xx,0,zz,.085,.48,.085,legs);
  }
  for(let i=0;i<4;i++){
   const a=Math.PI/4+i*Math.PI/2,b=a+Math.PI/2;
   branch([Math.cos(a)*.235,.21,Math.sin(a)*.235],[Math.cos(b)*.235,.21,Math.sin(b)*.235],.025,.025,rim);
  }
  break;}
 case 'chairWood':
  for(const dx of [-.32,.32])for(const dz of [-.28,.28])B(dx,0,dz,.09,.58,.10,dark);
  B(0,.50,0,.78,.11,.70,wood);B(0,.58,-.30,.78,.75,.12,wood);break;
 case 'benchWood':
  for(let dx of [-.37,.37])B(dx,0,0,.12,.49,.29,dark);
  B(0,.46,0,.96,.13,.51,wood);B(0,.60,-.22,.97,.45,.12,dark);break;
 case 'bookshelf':
  B(0,0,0,.93,1.55,.36,dark);
  for(let yy of [.11,.60,1.10]){B(0,yy,.04,.91,.075,.43,wood);
   for(let i=0;i<7;i++)B(-.35+i*.115,yy+.08,.14,.077,.34+(i%3)*.07,.15,i%3===0?[.51,.29,.19]:i%3===1?[.30,.41,.39]:[.65,.51,.28])}break;
 case 'wardrobe':
  B(0,0,0,.86,1.65,.50,wood);B(0,.14,.258,.81,1.40,.045,dark);
  B(-.20,.19,.29,.36,1.29,.025,wood);B(.20,.19,.29,.36,1.29,.025,wood);
  for(let xx of [-.07,.07])B(xx,.81,.325,.035,.055,.02,light);break;
 case 'fireplace':
  B(0,0,0,.96,1.08,.54,stone);B(0,.12,.287,.64,.65,.045,dark);
  B(0,.23,.305,.39,.28,.04,[.77,.33,.16]);D(0,.35,.337,.19,[.99,.69,.19]);
  B(0,1.06,.04,1.10,.15,.66,light);break;
 case 'lantern':
  B(0,.05,0,.21,.12,.21,dark);B(0,.20,0,.20,.30,.20,[.93,.70,.35]);
  for(let s of [-1,1]){B(s*.13,.16,0,.04,.36,.04,iron);B(0,.16,s*.13,.04,.36,.04,iron)}
  B(0,.51,0,.30,.08,.30,iron);B(0,.59,0,.07,.14,.07,iron);break;
 case 'candleStand':
  B(0,0,0,.35,.08,.34,iron);B(0,.08,0,.07,.73,.07,iron);
  B(0,.78,0,.21,.06,.21,iron);B(0,.84,0,.10,.29,.10,light);
  D(0,1.20,0,.11,[.97,.72,.26]);break;
 case 'barrel':{
  // Twelve-sided stave body with a generous middle bulge, flat round lid and curved iron hoops.
  const n=12;
  roundStack(m,x,y,z,[[.025,.285,.285],[.12,.34,.34],[.33,.405,.405],[.52,.405,.405],[.72,.335,.335],[.80,.29,.29]],n,wood);
  for(let yy of [.115,.39,.70])roundBand(m,x,y+yy,z,yy===.39?.417:.35,.055,n,iron);
  roundStack(m,x,y,z,[[.807,.292,.292],[.835,.292,.292]],n,[.60,.42,.25]);
  roundBand(m,x,y+.807,z,.305,.033,n,dark);
  for(let i=0;i<n;i++){const a=(i+.5)*Math.PI*2/n;naturalBranch(m,x+Math.cos(a)*.33,y+.13,z+Math.sin(a)*.33,x+Math.cos(a)*.305,y+.70,z+Math.sin(a)*.305,.009,.009,dark);}
  break;}
 case 'crate':
  B(0,.04,0,.76,.73,.77,wood);
  for(let xx of [-.35,.35])B(xx,.10,.40,.09,.65,.04,dark);
  for(let yy of [.10,.70])B(0,yy,.41,.79,.07,.05,dark);break;
 case 'sack':{
  // Soft gathered fabric: wide swollen base, pinched neck and tied mouth.
  const burlap=[.66,.57,.40],fold=[.76,.67,.48],twine=[.42,.30,.17],n=12;
  roundStack(m,x,y,z,[[.01,.23,.25],[.09,.345,.35],[.25,.415,.39],[.43,.38,.355],[.56,.28,.27],[.65,.17,.17],[.70,.14,.14]],n,burlap);
  roundBand(m,x,y+.615,z,.185,.055,n,twine);
  roundStack(m,x,y,z,[[.71,.145,.15],[.78,.20,.195],[.825,.15,.14]],n,fold);
  naturalBranch(m,x+.18,y+.66,z,x+.32,y+.58,z+.07,.025,.015,twine);
  naturalBranch(m,x+.18,y+.66,z,x+.29,y+.61,z-.12,.025,.014,twine);
  for(let i=0;i<6;i++){const a=i*Math.PI/3;naturalBranch(m,x+Math.cos(a)*.23,y+.12,z+Math.sin(a)*.23,x+Math.cos(a)*.17,y+.60,z+Math.sin(a)*.17,.010,.008,fold);}
  break;}
 case 'displayShelf':
  for(let s of [-1,1])B(s*.44,0,0,.09,1.36,.47,dark);
  for(let yy of [.12,.58,1.08])B(0,yy,0,.95,.09,.55,wood);
  for(let xx of [-.24,.24])for(let yy of [.24,.70])B(xx,yy,.05,.24,.21,.21,yy<.5?[.55,.31,.18]:[.48,.55,.30]);break;
 case 'brokenPillar':
  B(0,0,0,.65,.90,.66,stone);B(0,.78,0,.72,.13,.70,light);
  D(.18,.93,-.1,.25,stone);D(-.25,.10,.30,.23,stone);break;
 case 'crackedWall':
  B(0,0,0,.97,1.30,.97,stone);
  for(let i=0;i<4;i++)branch([-.20+i*.12,.12+i*.25,.52],[-.08+i*.11,.34+i*.22,.52],.018,.018,dark);
  D(.36,1.31,.14,.22,stone);break;
 case 'ironGate':
  for(let xx of [-.43,.43])B(xx,0,0,.12,1.60,.12,stone);
  for(let xx of [-.33,-.17,0,.17,.33])B(xx,.07,0,.045,1.43,.06,iron);
  for(let yy of [.36,1.22])B(0,yy,.02,.90,.075,.07,iron);break;
 case 'gravestone':
  B(0,0,0,.56,.76,.20,stone);D(0,.71,0,.33,light);
  B(0,.25,.117,.28,.05,.015,dark);B(0,.15,.117,.05,.24,.015,dark);break;
 case 'sarcophagus':
  B(0,.04,0,.83,.54,1.16,stone);B(0,.56,0,.88,.14,1.20,light);
  B(0,.70,0,.37,.035,.67,dark);break;
 case 'stairDown':
  B(0,0,0,1,.05,1,dark);
  for(let i=0;i<5;i++)B(0,.015+i*.10,-.40+i*.19,.94,.10,.18,stone);break;
 case 'ancientAltar':
  B(0,0,0,.95,.23,.95,stone);B(0,.20,0,.69,.73,.69,stone);
  B(0,.93,0,1,.18,1,light);D(0,1.16,0,.19,[.44,.63,.55]);break;
 case 'rubble':
  for(let i=0;i<7;i++){let dx=(i%3-1)*.28,dz=(Math.floor(i/3)-1)*.30;
   D(dx,.09+(i%3)*.07,dz,.16+(i%3)*.045,i%2?stone:light)}break;
 }
}


const TOWER_PARTS=new Set(["stairStraight","stairSwitchback","stairSpiral","towerWall","towerWindow","towerBattlement","towerSpire","towerPillar"]);
function towerPartGeometry(m,id,x,y,z){
 const stone=[.56,.59,.57],rim=[.71,.72,.67],dark=[.30,.34,.36],wood=[.48,.33,.21],roof=[.35,.39,.50];
 const B=(dx,dy,dz,w,h,d,col)=>cube(m,x+dx,y+dy,z+dz,w,h,d,col);
 const P=(dx,dy,dz)=>[x+dx,y+dy,z+dz];
 const beam=(a,b,r,col)=>naturalBranch(m,...P(...a),...P(...b),r,r,col);
 if(id==='stairStraight'||id==='stairSwitchback'){
  const half=id==='stairSwitchback';
  for(let i=0;i<8;i++){
   const z0=-.40+i*.115,side=half?(i<4?-.25:.25):0,run=half?.43:.83;
   const height=half?(i%4+1)*.30:(i+1)*.145;
   B(side,height-.10,z0,half?.42:.87,.13,.11,wood);
  }
  for(const s of [-1,1]){
   B(s*.46,0,0,.065,1.33,.065,dark);
   beam([s*.45,.28,-.45],[s*.45,1.42,.45],.028,wood);
  }
  return;
 }
 if(id==='stairSpiral'){
  B(0,0,0,.14,1.43,.14,dark);
  for(let i=0;i<10;i++){
   const a=i*Math.PI*.37,yh=i*.129,rr=.27;
   const cx=Math.cos(a)*rr,cz=Math.sin(a)*rr;
   B(cx,yh,cz,.40,.10,.24,stone);
  }
  B(0,1.36,0,.19,.11,.19,rim);return;
 }
 if(id==='towerSpire'){
  B(0,1.22,0,.95,.17,.95,dark);
  const rings=[[1.28,.50],[1.59,.34],[1.94,.14],[2.24,.02]];
  for(let k=0;k<rings.length-1;k++){
   const [h,r]=rings[k],[h2,r2]=rings[k+1],n=8;
   for(let i=0;i<n;i++){
    const a=i*Math.PI*2/n,b=(i+1)*Math.PI*2/n;
    quad(m,P(Math.cos(a)*r,h,Math.sin(a)*r),P(Math.cos(b)*r,h,Math.sin(b)*r),P(Math.cos(b)*r2,h2,Math.sin(b)*r2),P(Math.cos(a)*r2,h2,Math.sin(a)*r2),roof.map(v=>v*(.85+(i%3)*.06)));
   }
  }
  B(0,2.24,0,.06,.29,.06,rim);return;
 }
 if(id==='towerBattlement'){
  B(0,0,0,.98,.90,.97,stone);
  B(0,.90,0,.99,.13,.99,rim);
  for(const sx of [-.36,0,.36])B(sx,1.03,.41,.23,.27,.17,stone);
  return;
 }
 if(id==='towerPillar'){
  const n=8,r=.29;
  for(let i=0;i<n;i++){
   const a=i*2*Math.PI/n,b=(i+1)*2*Math.PI/n;
   quad(m,P(Math.cos(a)*r,.10,Math.sin(a)*r),P(Math.cos(b)*r,.10,Math.sin(b)*r),P(Math.cos(b)*r,1.30,Math.sin(b)*r),P(Math.cos(a)*r,1.30,Math.sin(a)*r),stone);
  }
  B(0,0,0,.72,.13,.72,rim);B(0,1.29,0,.74,.15,.74,rim);return;
 }
 if(id==='towerWall'||id==='towerWindow'){
  // Faceted curved wall segment with a visibly recessed dark window.
  const pts=[[-.48,.36],[-.29,.48],[.29,.48],[.48,.36]];
  for(let i=0;i<pts.length-1;i++){
   const [ax,az]=pts[i],[bx,bz]=pts[i+1];
   quad(m,P(ax,0,az),P(bx,0,bz),P(bx,1.32,bz),P(ax,1.32,az),stone);
   quad(m,P(ax,1.32,az),P(bx,1.32,bz),P(bx,1.38,bz-.09),P(ax,1.38,az-.09),rim);
  }
  if(id==='towerWindow'){
   B(0,.64,.49,.21,.47,.028,dark);
   B(0,1.04,.52,.35,.055,.045,rim);
   for(const sx of [-.14,.14])B(sx,.63,.51,.052,.50,.045,rim);
   B(0,.62,.535,.045,.46,.020,rim);
  }else{
   for(let h of [.32,.69,1.06])B(0,h,.487,.44,.026,.017,rim);
  }
 }
}



// Village-life objects. Geometry is local to a single tile and is rotated by deco().
// Priority 3: circular tables, tableware, and small lived-in objects.
// Individual tableware is one-tile floor decoration; the prepared table keeps
// its dishes above the tabletop without requiring overlapping tile placements.
// Priority 4 tile-sized modular terrain. The editor uses a fixed base plane:
// ramps/cliffs are visual mesh pieces (not a change to world elevation).

// Priority 5: modular ruined building material. Each piece fits in one tile,
// respects standard 90-degree object rotation, and uses existing save-format IDs.
const RUIN_PART_IDS=new Set(['ruinWallLow','ruinWallJagged','ruinRoofHole','ruinRoofCollapse','ruinWoodPost','ruinStonePost','ruinFloorCrack','ruinFloorHole','ruinDoorHanging','ruinDoorBroken','ruinWindowEmpty','ruinWindowShattered']);
function ruinPartGeometry(m,id,x,y,z){
 const stone=[.58,.60,.55],light=[.74,.74,.66],darkStone=[.35,.38,.36],
 wood=[.49,.33,.20],woodHi=[.66,.46,.28],woodDark=[.30,.21,.14],
 plaster=[.77,.76,.66],brick=[.58,.31,.26],iron=[.29,.34,.36],glass=[.45,.65,.67];
 const B=(dx,dy,dz,w,h,d,c)=>cube(m,x+dx,y+dy,z+dz,w,h,d,c);
 const D=(dx,dy,dz,r,c)=>diamond(m,x+dx,y+dy,z+dz,r,c);
 const beam=(a,b,r,c)=>naturalBranch(m,x+a[0],y+a[1],z+a[2],x+b[0],y+b[1],z+b[2],r,r,c);
 // Broken walls are thin wall strips, rather than solid tile cubes.
 if(id==='ruinWallLow'||id==='ruinWallJagged'){
  const half=id==='ruinWallLow';
  const pieces=half?[[-.38,.56,.22],[ -.10,.70,.31],[.18,.49,.25],[.39,.37,.17]]:
   [[-.38,1.25,.22],[-.12,.91,.30],[.12,.60,.22],[.33,1.10,.32]];
  B(0,.02,0,.99,.13,.31,darkStone);
  for(const [dx,h,w] of pieces){
   B(dx,.09,0,w,h,.29,stone);
   B(dx,.09+h,0,w*.92,.075,.30,light);
   B(dx,.19+h*.48,.157,w*.75,.026,.015,darkStone);
  }
  for(const [dx,dz,r] of [[-.34,.27,.12],[.31,-.21,.18],[.12,.23,.09]])D(dx,.06,dz,r,stone);
  return;
 }
 if(id==='ruinRoofHole'||id==='ruinRoofCollapse'){
  const collapsed=id==='ruinRoofCollapse';
  // Split roof into perimeter sections; hole is physically open, not drawn black.
  const roof=collapsed?wood:[.53,.29,.24];
  B(0,0,-.40,.98,.14,.20,roof);
  B(0,0,.40,.98,.14,.20,roof);
  B(-.40,0,0,.20,.14,.65,roof);
  if(!collapsed)B(.40,0,0,.20,.14,.65,roof);
  else{
   B(.33,-.10,-.02,.17,.10,.62,woodDark);
   B(.21,-.23,.26,.37,.09,.34,wood);
  }
  for(const dx of [-.34,.32]){
   if(collapsed&&dx>0)continue;
   beam([dx,-.02,-.47],[dx,.17,.47],.042,woodDark);
  }
  B(-.36,.145,-.36,.18,.05,.16,woodHi);
  D(.12,-.10,.12,.12,brick);
  return;
 }
 if(id==='ruinWoodPost'||id==='ruinStonePost'){
  const timber=id==='ruinWoodPost',c=timber?wood:stone,h=timber?.86:1.00;
  B(0,.0,0,timber?.27:.43,h,timber?.27:.42,c);
  // Irregular splintered break, with fallen pieces at the base.
  for(let i=0;i<3;i++){
   const dx=(i-1)*.085;
   if(timber)beam([dx,h-.14,0],[dx+(i-1)*.05,h+.10+(i%2)*.12,.02],.035,woodHi);
   else D(dx,h-.04,.01,.15,light);
  }
  if(timber){beam([.14,.04,.26],[.46,.07,.30],.095,woodDark);B(-.26,.03,.24,.22,.09,.11,wood);}
  else{D(-.33,.08,.27,.20,stone);D(.27,.04,-.30,.16,darkStone);}
  return;
 }
 if(id==='ruinFloorCrack'||id==='ruinFloorHole'){
  const hole=id==='ruinFloorHole';
  const floor=hole?wood:stone;
  // Visual cutaway: four separate rim planks/tiles preserve a dark center.
  B(0,.012,0,.99,.015,.99,woodDark);
  if(hole){
   B(0,.03,-.40,.98,.10,.18,floor);
   B(0,.03,.40,.98,.10,.18,floor);
   B(-.40,.03,0,.18,.10,.64,floor);
   B(.40,.03,0,.18,.10,.64,floor);
   B(.10,.045,.15,.14,.10,.42,woodHi);
   B(-.19,.045,-.22,.09,.11,.27,woodHi);
  }else{
   B(0,.03,0,.98,.11,.98,floor);
   for(const [a,b] of [
    [[-.41,.145,-.39],[-.14,.148,-.07]],[[-.14,.148,-.07],[.11,.151,-.13]],
    [[.11,.151,-.13],[.34,.153,.25]],[[-.14,.149,-.07],[-.29,.152,.34]]
   ])beam(a,b,.015,darkStone);
   D(.28,.10,-.27,.095,light);
  }
  return;
 }
 if(id==='ruinDoorHanging'||id==='ruinDoorBroken'){
  const hanging=id==='ruinDoorHanging';
  B(-.43,0,0,.12,1.45,.19,woodDark);B(.43,0,0,.12,1.46,.19,woodDark);
  B(0,1.39,0,.99,.15,.20,wood);
  if(hanging){
   // A skewed door made from stepped plank strips, one hinge still attached.
   for(let i=0;i<4;i++)B(-.29+i*.19,.06+i*.05,.07+i*.06,.17,1.13-i*.10,.12,i%2?wood:woodHi);
   B(-.39,1.20,.07,.08,.11,.09,iron);
   B(.19,.64,.30,.07,.07,.07,iron);
  }else{
   B(-.23,0,.10,.39,.77,.14,wood);
   B(.19,0,.20,.38,.48,.14,woodHi);
   beam([-.33,.73,.13],[.16,.88,.28],.07,woodDark);
   beam([.09,.08,.15],[.44,.16,.38],.07,woodDark);
   B(0,.10,.43,.29,.08,.14,wood);
  }
  return;
 }
 if(id==='ruinWindowEmpty'||id==='ruinWindowShattered'){
  const shattered=id==='ruinWindowShattered';
  // No opaque wall in the center: open frame remains legible on existing walls.
  for(const xx of [-.38,.38])B(xx,.36,0,.13,.93,.17,woodDark);
  B(0,.34,0,.89,.12,.20,wood);
  B(0,1.21,0,.89,.12,.20,woodHi);
  if(shattered){
   B(0,.43,0,.055,.77,.08,wood);
   B(0,.78,0,.77,.065,.08,wood);
   D(-.18,.96,.045,.15,glass);
   D(.19,.50,.045,.12,glass);
   for(const [dx,dy] of [[-.25,.42],[.31,1.03]])D(dx,dy,.16,.07,glass);
  }else{
   B(-.18,.36,.08,.075,.29,.10,woodHi);
   beam([.37,.40,.12],[.19,.57,.22],.04,wood);
  }
 }
}

const TERRAIN_PART_IDS=new Set(['slopeGrass','slopeStone','terrainStep','cliffEdge','cliffFace','streamBank','streamBend','streamShallow','streamFord','bridgeWood','bridgeWoodEnd','bridgeStone','bridgeStoneEnd']);
function terrainPartGeometry(m,id,x,y,z){
 const grass=[.36,.50,.29],grassHi=[.49,.61,.35],soil=[.43,.34,.24],soilDark=[.34,.26,.19],rock=[.54,.56,.51],rockHi=[.68,.69,.61],wood=[.49,.33,.19],woodHi=[.64,.45,.25],dark=[.29,.23,.18],iron=[.30,.36,.38],water=[.18,.47,.58],waterHi=[.39,.67,.71],sand=[.68,.59,.41];
 const B=(dx,dy,dz,w,h,d,c)=>cube(m,x+dx,y+dy,z+dz,w,h,d,c);
 const face=(a,b,c,d,color)=>quad(m,...[a,b,c,d].map(p=>[x+p[0],y+p[1],z+p[2]]),color);
 const line=(a,b,w,c)=>naturalBranch(m,x+a[0],y+a[1],z+a[2],x+b[0],y+b[1],z+b[2],w,w,c);
 if(id==='slopeGrass'||id==='slopeStone'){
  const upper=id==='slopeGrass'?grassHi:rockHi,side=id==='slopeGrass'?soil:rock;
  // Front (-Z) low, back (+Z) high. Rotate 90 degrees to align adjacent edges.
  face([-.49,.055,-.49],[.49,.055,-.49],[.49,.63,.49],[-.49,.63,.49],upper);
  face([-.49,.02,-.49],[-.49,.02,.49],[-.49,.63,.49],[-.49,.055,-.49],side);
  face([.49,.02,-.49],[.49,.055,-.49],[.49,.63,.49],[.49,.02,.49],side);
  B(0,.02,.47,.98,.60,.055,side);
  for(let i=0;i<4;i++){const px=-.37+i*.23;line([px,.12,-.30],[px+.06,.43,.24],.012,id==='slopeGrass'?grass:rock);}
  return;
 }
 if(id==='terrainStep'||id==='cliffEdge'||id==='cliffFace'){
  const cliff=id!=='terrainStep',height=id==='cliffFace'?1.28:id==='cliffEdge'?.80:.43;
  B(0,.01,0,.98,height,.98,cliff?rock:soil);
  B(0,height-.05,0,.99,.095,.99,cliff?rockHi:grassHi);
  // Irregular strata on front vertical face.
  for(let i=0;i<4;i++){
   const h=.13+i*(height-.19)/4;
   B(-.19+(i%2)*.12,h,-.497,.56,.026,.025,cliff?(i%2?soilDark:rockHi):soilDark);
  }
  if(id==='cliffEdge'){
   for(const dx of [-.37,.13,.34])B(dx,height-.02,-.34,.13,.08,.12,grass);
  }
  return;
 }
 if(['streamBank','streamBend','streamShallow','streamFord'].includes(id)){
  // Water plane is inset, never z-fights with the ground plane.
  B(0,.025,0,.99,.036,.99,id==='streamFord'?sand:soil);
  B(0,.061,0,.98,.016,.97,water);
  if(id==='streamBank'){
   B(0,.082,.34,.99,.22,.30,soil);
   B(0,.294,.35,.99,.07,.29,grass);
   for(const dx of [-.35,.10,.37])B(dx,.11,-.32,.13,.09,.17,rock);
  }else if(id==='streamBend'){
   B(-.34,.075,0,.30,.20,.98,soil);B(0,.075,.34,.98,.20,.30,soil);
   B(-.34,.28,0,.30,.06,.98,grass);B(0,.28,.34,.98,.06,.30,grass);
  }else{
   // Shallow and ford tiles read as visible stones and sediment.
   for(const [dx,dz,w] of [[-.29,-.21,.23],[.16,.17,.29],[.32,-.28,.18],[-.14,.30,.19]]){
    B(dx,.08,dz,w,.09,w*.75,id==='streamFord'?sand:rockHi);
   }
   if(id==='streamFord'){B(0,.084,0,.72,.037,.79,sand);}
  }
  for(let i=0;i<3;i++)B(-.33+i*.32,.092,-.06+i*.13,.19,.008,.023,waterHi);
  return;
 }
 if(id.startsWith('bridgeWood')){
  const end=id.endsWith('End');
  // Bridge direction is Z; repeated center pieces connect seamlessly.
  for(const dx of [-.39,.39])B(dx,.10,0,.12,.24,.99,dark);
  for(let j=0;j<5;j++){
   const zz=-.40+j*.20;
   B(0,.29,zz,.97,.11,.175,j%2?wood:woodHi);
   B(0,.395,zz,.98,.018,.015,dark);
  }
  for(const dx of [-.43,.43]){
   for(const zz of (end?[-.37]:[-.37,.37]))B(dx,.40,zz,.105,.56,.10,wood);
   B(dx,.91,0,.105,.12,.99,woodHi);
  }
  if(end){B(0,.21,-.49,.99,.12,.075,woodHi);}
  return;
 }
 if(id.startsWith('bridgeStone')){
  const end=id.endsWith('End');
  B(0,.04,0,.98,.30,.99,rock);
  B(0,.35,0,.98,.09,.99,rockHi);
  for(let j=0;j<4;j++){
   const zz=-.38+j*.25;
   B(0,.45,zz,.95,.015,.018,soilDark);
   B(0,.12,zz,.95,.022,.015,rockHi);
  }
  for(const dx of [-.45,.45]){
   B(dx,.38,0,.115,.42,.99,rock);
   B(dx,.81,0,.16,.07,.99,rockHi);
   if(end)B(dx,.78,-.39,.20,.14,.18,rockHi);
  }
  if(end)B(0,.36,-.47,.98,.12,.07,rock);
 }
}

const TABLEWARE_IDS=new Set(['roundTableWood','roundTableStone','roundTableSet','plateWood','plateCeramic','bowlClay','cupWood','mugCeramic','jugClay','basketProduce','breadBoard','smallFlowerVase']);
function tablewareGeometry(m,id,x,y,z){
 const wood=[.49,.33,.20],woodTop=[.65,.46,.29],dark=[.31,.22,.15],stone=[.58,.61,.57],
 pale=[.83,.78,.66],ceramic=[.82,.78,.64],clay=[.60,.36,.27],lip=[.40,.26,.19],
 green=[.36,.52,.25],gold=[.83,.64,.28],red=[.70,.29,.21];
 const B=(dx,dy,dz,w,h,d,c)=>cube(m,x+dx,y+dy,z+dz,w,h,d,c);
 const R=(dx,dy,dz,r1,r2,h,c,n=12)=>roundStack(m,x+dx,y+dy,z+dz,[[0,r1,r1],[h,r2,r2]],n,c);
 const plate=(dx,dy,dz,c)=>{roundStack(m,x+dx,y+dy,z+dz,[[0,.22,.22],[.035,.25,.25],[.075,.22,.22]],12,c);roundBand(m,x+dx,y+dy+.062,z+dz,.225,.02,12,lip)};
 const bowl=(dx,dy,dz,c)=>{roundStack(m,x+dx,y+dy,z+dz,[[0,.12,.12],[.045,.19,.19],[.15,.23,.23]],12,c,false);roundBand(m,x+dx,y+dy+.145,z+dz,.225,.035,12,lip);R(dx,dy+.065,dz,.15,.19,.018,[.29,.24,.18]);};
 const mug=(dx,dy,dz,c)=>{R(dx,dy,dz,.13,.15,.28,c);roundBand(m,x+dx,y+dy+.26,z+dz,.151,.032,12,pale);B(dx+.20,dy+.10,dz,.08,.13,.07,c);B(dx+.245,dy+.13,dz,.035,.11,.075,c)};
 const jug=(dx,dy,dz)=>{roundStack(m,x+dx,y+dy,z+dz,[[0,.17,.17],[.06,.245,.245],[.27,.25,.25],[.43,.16,.16],[.58,.135,.135]],12,clay);roundBand(m,x+dx,y+dy+.56,z+dz,.145,.05,12,lip);B(dx+.29,dy+.27,dz,.10,.22,.10,clay);B(dx+.33,dy+.40,dz,.08,.09,.10,clay)};
 const table=(c,top)=>{R(0,.08,0,.25,.29,.07,c);R(0,.13,0,.17,.16,.60,c);roundStack(m,x,y,z,[[.70,.44,.44],[.80,.46,.46]],16,top);roundBand(m,x,y+.71,z,.462,.075,16,c);};
 if(id==='roundTableWood'||id==='roundTableStone'||id==='roundTableSet'){
  const rocky=id==='roundTableStone';table(rocky?stone:dark,rocky?[.72,.72,.65]:woodTop);
  if(id==='roundTableSet'){
   plate(-.19,.803,-.12,ceramic);plate(.20,.803,.10,pale);
   mug(-.13,.812,.23,clay);bowl(.13,.807,-.20,wood);
   B(.01,.835,.01,.16,.06,.12,[.76,.54,.26]);
  }
  return;
 }
 if(id==='plateWood'){plate(0,.02,0,woodTop);return}
 if(id==='plateCeramic'){plate(0,.02,0,ceramic);return}
 if(id==='bowlClay'){bowl(0,.02,0,clay);return}
 if(id==='cupWood'){R(0,.015,0,.135,.155,.25,wood);roundBand(m,x,y+.24,z,.159,.024,12,dark);return}
 if(id==='mugCeramic'){mug(0,.015,0,ceramic);return}
 if(id==='jugClay'){jug(0,.015,0);return}
 if(id==='basketProduce'){
  roundStack(m,x,y,z,[[.01,.27,.22],[.13,.34,.28],[.37,.35,.29]],12,wood,false);
  roundBand(m,x,y+.36,z,.34,.065,12,dark);
  for(const [dx,dz,col] of [[-.13,-.07,green],[.16,-.04,red],[0,.14,gold],[-.13,.16,red],[.1,-.16,green]])roundStack(m,x+dx,y+.30,z+dz,[[0,.11,.11],[.15,.095,.095],[.19,.04,.04]],8,col);
  return;
 }
 if(id==='breadBoard'){
  B(0,.02,0,.79,.08,.57,wood);B(.38,.05,0,.21,.06,.18,dark);
  for(const [dx,dz,w] of [[-.20,-.07,.28],[.08,.10,.33]]){roundStack(m,x+dx,y+.11,z+dz,[[0,w*.70,.145],[.10,w*.75,.16],[.20,w*.50,.12]],10,[.76,.51,.27]);}
  return;
 }
 if(id==='smallFlowerVase'){
  roundStack(m,x,y,z,[[.01,.13,.13],[.08,.19,.19],[.23,.18,.18],[.38,.10,.10],[.50,.095,.095]],10,clay);
  roundBand(m,x,y+.48,z,.11,.045,10,lip);
  for(const [dx,dz,c] of [[-.12,0,red],[.10,.02,gold],[0,-.12,pale]]){
   naturalBranch(m,x,y+.47,z,x+dx,y+.77,z+dz,.014,.007,green);
   diamond(m,x+dx,y+.78,z+dz,.075,c);
  }
 }
}

const VILLAGE_LIFE_IDS=new Set(['wellStone','wellWood','marketStallCloth','marketStallWood','handcartEmpty','handcartLoaded']);
function villageLifeGeometry(m,id,x,y,z){
 const wood=[.47,.30,.17],bright=[.65,.44,.26],dark=[.29,.20,.12],stone=[.58,.60,.57],stoneHi=[.72,.73,.67],iron=[.28,.34,.36],cloth=[.70,.35,.24],clothLite=[.83,.70,.44],rope=[.70,.61,.43];
 const B=(dx,dy,dz,w,h,d,c)=>cube(m,x+dx,y+dy,z+dz,w,h,d,c);
 const beam=(a,b,r,c)=>naturalBranch(m,x+a[0],y+a[1],z+a[2],x+b[0],y+b[1],z+b[2],r,r,c);
 if(id==='wellStone'||id==='wellWood'){
  const masonry=id==='wellStone';
  // Open square shaft with distinct rim and dark water below the opening.
  B(0,.08,0,.72,.11,.72,[.12,.21,.22]);
  for(const side of [-1,1]){
   B(side*.39,.07,0,.19,.73,.96,masonry?stone:wood);
   B(0,.07,side*.39,.96,.73,.19,masonry?stone:wood);
   B(side*.39,.76,0,.21,.13,1.01,masonry?stoneHi:bright);
   B(0,.76,side*.39,1.01,.13,.21,masonry?stoneHi:bright);
   B(side*.40,.79,0,.10,1.02,.11,wood);
  }
  B(0,1.72,0,.96,.12,.25,dark);
  for(const sx of [-1,1])B(sx*.26,1.83,0,.50,.07,.76,masonry?[.51,.32,.23]:bright);
  B(0,1.26,0,.075,.45,.075,rope);
  B(0,.99,0,.24,.28,.23,wood);
  B(0,1.03,.135,.32,.08,.07,iron);
  return;
 }
 if(id==='marketStallCloth'||id==='marketStallWood'){
  const clothRoof=id==='marketStallCloth';
  for(const sx of [-1,1])for(const sz of [-1,1]){
   B(sx*.43,0,sz*.39,.11,1.76,.12,wood);
   B(sx*.43,.06,sz*.39,.19,.12,.20,dark);
  }
  B(0,.72,-.05,.93,.16,.76,wood);
  B(0,.87,-.05,.88,.035,.71,bright);
  B(0,.66,.36,.92,.075,.10,dark);
  for(const sx of [-1,1])B(sx*.37,.79,-.02,.06,.12,.66,dark);
  // Roof is separated above the counter; alternating bands for a textile awning.
  B(0,1.69,0,1.07,.10,.94,clothRoof?cloth:wood);
  for(let i=0;i<5;i++)B(-.42+i*.21,1.80,0,.17,.045,.97,clothRoof?(i%2?cloth:clothLite):(i%2?bright:wood));
  B(0,1.60,.46,1.12,.20,.07,clothRoof?clothLite:dark);
  for(const sx of [-1,0,1])B(sx*.25,.90,-.04,.16,.12,.18,sx===0?[.45,.54,.25]:[.73,.52,.28]);
  return;
 }
 if(id==='handcartEmpty'||id==='handcartLoaded'){
  // Axle and two polygonal wheel silhouettes support the shallow tray.
  B(0,.21,0,.91,.13,.66,dark);
  B(0,.40,0,.90,.14,.65,wood);
  B(0,.53,-.28,.94,.19,.11,bright);
  B(0,.53,.28,.94,.19,.11,bright);
  B(-.40,.53,0,.11,.19,.64,wood);
  B(.40,.53,0,.11,.19,.64,wood);
  for(const sx of [-1,1]){
   // Eight spokes/rim sections on either wheel.
   for(let i=0;i<8;i++){
    const a=i*Math.PI/4,b=(i+1)*Math.PI/4;
    beam([sx*.51,.30+Math.sin(a)*.22,Math.cos(a)*.22],
         [sx*.51,.30+Math.sin(b)*.22,Math.cos(b)*.22],.045,dark);
    beam([sx*.51,.30,0],[sx*.51,.30+Math.sin(a)*.20,Math.cos(a)*.20],.027,bright);
   }
   B(sx*.525,.26,0,.065,.14,.14,iron);
  }
  for(const sx of [-1,1])B(sx*.30,.20,.66,.10,.13,.80,wood);
  B(0,.18,.97,.66,.11,.12,bright);
  if(id==='handcartLoaded'){
   for(const p of [[-.19,.57,-.13],[.18,.57,-.10],[0,.69,.14]])
    B(p[0],p[1],p[2],.34,.29,.28,[.67,.56,.36]);
   B(.12,.86,.06,.25,.12,.22,[.48,.59,.29]);
  }
 }
}

const FENCE_IDS=new Set(["fenceWood","fenceWoodCorner","fenceWoodEnd","fenceWoodGate","fenceStone","fenceStoneCorner","fenceStoneEnd","fenceStoneGate","fenceIron","fenceIronCorner","fenceIronEnd","fenceIronGate","frameWoodPost","frameWoodBeam","frameWoodBrace"]);
function fenceGeometry(m,id,x,y,z){
 const stone=[.57,.60,.57],pale=[.70,.72,.67],wood=[.48,.31,.18],woodLight=[.61,.42,.25],dark=[.29,.20,.14],iron=[.31,.38,.43],ironLight=[.54,.60,.63],bronze=[.76,.59,.31];
 const B=(dx,dy,dz,w,h,d,c)=>cube(m,x+dx,y+dy,z+dz,w,h,d,c);
 const beam=(a,b,w,col)=>naturalBranch(m,x+a[0],y+a[1],z+a[2],x+b[0],y+b[1],z+b[2],w,w,col);
 if(id==='frameWoodPost'){
  B(0,0,0,.27,1.42,.27,wood);
  B(0,.02,0,.36,.10,.36,dark);B(0,1.33,0,.36,.12,.36,woodLight);
  B(0,.48,.145,.27,.06,.025,dark);breakFence: {} return;
 }
 if(id==='frameWoodBeam'){
  B(0,1.09,0,.99,.27,.28,wood);
  for(const s of [-1,1])B(s*.42,.94,0,.13,.44,.34,dark);
  B(0,1.35,0,1.04,.085,.31,woodLight);return;
 }
 if(id==='frameWoodBrace'){
  B(-.40,0,0,.16,1.39,.17,wood);
  B(0,1.25,0,.95,.15,.18,wood);
  beam([-.36,.15,0],[.39,1.25,0],.087,woodLight);
  B(.40,1.22,0,.14,.18,.24,dark);return;
 }
 const material=id.startsWith('fenceWood')?'wood':id.startsWith('fenceStone')?'stone':'iron';
 const corner=id.endsWith('Corner'),end=id.endsWith('End'),gate=id.endsWith('Gate');
 const post=material==='wood'?wood:material==='stone'?stone:iron;
 const bright=material==='wood'?woodLight:material==='stone'?pale:ironLight;
 const shadow=material==='wood'?dark:material==='stone'?[.38,.43,.41]:[.22,.28,.32];
 const height=material==='stone'?.98:1.12;
 const P=(dx,dz)=>{
  B(dx,0,dz,material==='stone'?.24:.14,height,material==='stone'?.24:.14,post);
  B(dx,height-.07,dz,material==='stone'?.28:.18,.12,material==='stone'?.28:.18,bright);
  if(material==='stone')B(dx,0,dz,.29,.16,.29,shadow);
 };
 // All fences face along local X and rotate in the shared object renderer.
 const segment=(a,b,offsetZ=0)=>{
  if(material==='wood'){
   for(const h of [.36,.83])B((a+b)/2,h,offsetZ,b-a,.115,.115,woodLight);
   for(const pos of [a+(b-a)*.25,a+(b-a)*.5,a+(b-a)*.75])B(pos,.15,offsetZ,.10,.95,.15,wood);
  }else if(material==='stone'){
   B((a+b)/2,0,offsetZ,b-a,.53,.18,stone);
   B((a+b)/2,.55,offsetZ,b-a,.12,.22,pale);
   for(const pos of [a+(b-a)/3,a+2*(b-a)/3])B(pos,.11,offsetZ+.101,.023,.40,.018,shadow);
  }else{
   for(const h of [.27,.86])B((a+b)/2,h,offsetZ,b-a,.055,.08,ironLight);
   for(let i=1;i<=5;i++){
    const pos=a+(b-a)*i/6;
    B(pos,.09,offsetZ,.045,1.01,.047,iron);
    B(pos,1.1,offsetZ,.09,.09,.09,bronze);
   }
  }
 };
 if(gate){
  P(-.46,0);P(.46,0);
  B(0,.03,0,.93,.09,.22,shadow);
  const leaf=material==='stone'?wood:material==='iron'?iron:woodLight;
  for(const sx of [-1,1]){
   const cx=sx*.23;
   B(cx,.18,.015,.425,.88,.12,leaf);
   if(material!=='iron')for(const xx of [-.125,0,.125])B(cx+xx,.22,.083,.07,.76,.025,shadow);
   else for(const xx of [-.13,-.04,.05,.14])B(cx+xx,.23,.085,.033,.70,.027,ironLight);
   B(cx,.91,.10,.39,.085,.04,shadow);
   B(cx-sx*.085,.61,.125,.065,.07,.036,bronze);
  }
  if(material==='stone')B(0,height+.045,0,1.17,.18,.28,pale);
  return;
 }
 if(corner){
  P(-.43,0);P(.42,0);P(-.43,.43);
  segment(-.38,.36,0);
  // Perpendicular half leg shares its corner post.
  if(material==='wood'){
   for(const h of [.36,.83])B(-.43,h,.23,.115,.115,.44,woodLight);
  }else if(material==='stone')B(-.43,.20,.23,.18,.48,.44,stone);
  else for(const h of [.27,.86])B(-.43,h,.23,.07,.06,.44,ironLight);
  return;
 }
 P(-.43,0);
 if(!end)P(.43,0);
 segment(-.36,end?.39:.36,0);
 if(end)B(.42,.10,0,.095,.75,.14,post);
}

function oldTownFacadeGeometry(m,id,x,y,z){
 const match=id.match(/^oldTown(Cream|Ochre|Rose|Mint|Blue|Sand)(Wall|Window|Door|Shop)$/);
 if(!match)return false;
 const color={
  Cream:[.84,.78,.64],Ochre:[.84,.66,.35],Rose:[.72,.43,.41],
  Mint:[.57,.73,.66],Blue:[.56,.68,.72],Sand:[.74,.61,.50]
 }[match[1]],kind=match[2],stone=[.60,.59,.55],trim=[.38,.31,.27],
  frames=[.37,.27,.22],glass=[.30,.52,.58];
 const B=(dx,dy,dz,w,h,d,c)=>cube(m,x+dx,y+dy,z+dz,w,h,d,c);
 // Full-width wall shell: adjacent townhouses touch without holes at corners.
 B(0,0,0,1.003,1.39,1.003,color);
 B(0,.04,.508,.99,.115,.038,stone);
 B(0,1.26,.508,.99,.10,.042,trim);
 for(const xx of [-.455,.455])B(xx,.07,.512,.055,1.24,.048,trim);
 if(kind==='Shop'){
  // The glass frontage and narrow entrance read as ground-floor businesses.
  B(0,.08,.548,.91,1.10,.060,frames);
  for(const xx of [-.27,.27]){
   B(xx,.39,.585,.38,.72,.026,glass);
   B(xx,.40,.612,.035,.71,.031,trim);
   B(xx,.76,.614,.37,.036,.031,stone);
  }
  B(0,.15,.616,.17,.98,.05,trim);
  B(0,1.13,.590,.93,.075,.08,stone);
  B(0,.02,.630,.74,.045,.18,stone);
 }else if(kind==='Window'){
  B(0,.44,.54,.66,.63,.065,frames);
  B(0,.51,.576,.52,.48,.034,glass);
  B(0,.52,.60,.042,.49,.036,trim);
  B(0,.745,.60,.58,.04,.038,trim);
  B(0,.43,.59,.75,.09,.12,stone);
  // Small colored shutters beside a window.
  for(const xx of [-.355,.355])B(xx,.55,.571,.09,.48,.055,frames);
 }else if(kind==='Door'){
  B(0,.02,.551,.68,1.19,.05,trim);
  B(0,.02,.58,.52,1.08,.04,[.33,.24,.19]);
  for(const xx of [-.27,.27])B(xx,.03,.60,.048,1.10,.045,stone);
  B(0,1.16,.589,.69,.095,.075,stone);
  B(.16,.54,.608,.047,.065,.035,[.75,.68,.47]);
  B(0,.014,.68,.76,.045,.28,stone);
 }else{
  // Deliberately plain sidewalls to avoid a false window between buildings.
  B(0,.65,.523,.84,.035,.036,trim);
 }
 return true;
}
function oldTownTowerGeometry(m,x,y,z){
 const stone=[.80,.76,.66],dark=[.38,.40,.39],roof=[.34,.59,.52];
 cube(m,x,y,z,.91,1.20,.91,stone);
 for(const dx of [-.29,.29])for(const dz of [-.29,.29])
  cube(m,x+dx,y+.15,z+dz,.09,1.06,.09,dark);
 cube(m,x,y+1.17,z,1.05,.14,1.05,stone);
 // Compact pitched copper-green cap with a pointed finial.
 const base=y+1.31,top=y+2.13;
 for(const [a,b,c] of [
  [[-.55,0,-.55],[.55,0,-.55],[0,top-base,0]],
  [[.55,0,-.55],[.55,0,.55],[0,top-base,0]],
  [[.55,0,.55],[-.55,0,.55],[0,top-base,0]],
  [[-.55,0,.55],[-.55,0,-.55],[0,top-base,0]]])
  tri(m,[x+a[0],base+a[1],z+a[2]],[x+b[0],base+b[1],z+b[2]],[x+c[0],base+c[1],z+c[2]],roof);
 cube(m,x,top,z,.065,.23,.065,[.77,.65,.32]);
}
function oldTownShopDetails(m,id,x,y,z){
 const B=(dx,dy,dz,w,h,d,c)=>cube(m,x+dx,y+dy,z+dz,w,h,d,c);
 const timber=[.38,.26,.18],stone=[.72,.68,.59],glass=[.29,.53,.61],
 red=[.70,.30,.26],gold=[.78,.61,.32],foliage=[.30,.54,.27];
 if(id==='oldTownShop'){
  B(0,0,.505,.97,1.31,.038,timber);
  // Large storefront on either side of a centered entrance.
  for(const xx of [-.29,.29]){
   B(xx,.35,.539,.38,.72,.032,glass);
   B(xx,.35,.562,.42,.055,.045,stone);
   B(xx,1.05,.562,.43,.07,.045,gold);
  }
  B(0,.02,.595,.25,1.14,.07,timber);
  B(0,1.21,.573,.95,.09,.08,stone);
  B(0,.009,.65,.61,.055,.25,stone);
  return true;
 }
 if(id==='oldTownSign'){
  B(.27,1.04,.56,.06,.07,.48,timber);
  B(.27,.74,.78,.59,.46,.065,gold);
  B(.27,.74,.82,.41,.31,.02,red);
  return true;
 }
 if(id==='oldTownAwning'){
  B(0,1.12,.70,1.02,.06,.46,timber);
  for(let i=0;i<5;i++)
   B(-.405+i*.205,1.10,.78,.20,.035,.48,i%2?stone:red);
  for(const dx of [-.46,.46])B(dx,.86,.87,.045,.30,.045,timber);
  return true;
 }
 if(id==='oldTownFlowerBox'){
  B(0,.37,.57,.74,.16,.23,timber);
  B(0,.51,.57,.67,.12,.20,[.37,.31,.25]);
  for(let i=-2;i<=2;i++){
   const xx=i*.13;
   B(xx,.53,.57,.055,.16,.055,foliage);
   if(i%2===0)diamond(m,x+xx,y+.69,z+.57,.055,i===0?red:gold);
  }
  return true;
 }
 if(id==='oldTownShutters'){
  for(const dx of [-.43,.43]){
   B(dx,.52,.57,.18,.63,.07,timber);
   for(let j=0;j<4;j++)B(dx,.58+j*.12,.62,.15,.018,.015,stone);
  }
  return true;
 }
 if(id==='oldTownStreetLamp'){
  B(.37,.93,.53,.09,.09,.34,timber);
  B(.37,.65,.75,.18,.40,.16,[.42,.40,.35]);
  B(.37,.77,.84,.12,.20,.012,gold);
  B(.37,1.07,.75,.23,.075,.23,timber);
  return true;
 }
 return false;
}
function decoBase(m,id,x,y,z,r=0){
 if(oldTownShopDetails(m,id,x,y,z))return;
 if(oldTownFacadeGeometry(m,id,x,y,z))return;
 if(id==='oldTownTower'){oldTownTowerGeometry(m,x,y,z);return;}
 if(id==='oldTownQuay'){cube(m,x,y+.045,z+.43,1.0,.13,.15,[.72,.72,.67]);cube(m,x,y+.16,z+.43,1,.045,.18,[.80,.79,.72]);return;}

 if(id==='cropWheat'||id==='cropVegetable'){
  const green=[.29,.50,.23],gold=[.76,.64,.28],leaf=[.39,.65,.28],soil=[.43,.32,.22];
  for(let j=0;j<3;j++)for(let i=0;i<3;i++){
   const dx=(i-1)*.25,dz=(j-1)*.25,variation=(i+j)%3;
   cube(m,x+dx,y+.025,z+dz,.16,.065,.16,soil);
   if(id==='cropWheat'){
    cube(m,x+dx,y+.09,z+dz,.025,.36+variation*.045,.03,green);
    diamond(m,x+dx,y+.44+variation*.035,z+dz,.075,gold);
   }else{
    cube(m,x+dx,y+.09,z+dz,.07,.12,.07,green);
    diamond(m,x+dx,y+.20,z+dz,.13,leaf);
   }
  }
  return;
 }
 if(id==='sheepWool'){
  const fleece=[.86,.85,.77],shadow=[.68,.67,.61],face=[.31,.29,.28];
  for(const sx of [-.25,.25])for(const sz of [-.22,.22])
   cube(m,x+sx,y+.02,z+sz,.12,.33,.12,face);
  cube(m,x,y+.30,z,.71,.54,.53,fleece);
  for(const dx of [-.24,0,.24])for(const dz of [-.18,.18])
   diamond(m,x+dx,y+.65,z+dz,.20,fleece);
  cube(m,x,y+.47,z-.34,.29,.30,.24,face);
  for(const sx of [-.09,.09])cube(m,x+sx,y+.66,z-.455,.035,.035,.03,shadow);
  return;
 }

 if(id==='terrainStairs'){
  // The -Z side is low and the +Z side is high.
  for(let i=0;i<4;i++)cube(m,x,y,z-.38+i*.245,.94,(i+1)*TERRAIN_STEP/4,.24,[.62,.62,.57]);
  for(const dx of [-.48,.48])cube(m,x+dx,y,z,.05,TERRAIN_STEP,.99,[.47,.48,.43]);
  return;
 }
if(RUIN_PART_IDS.has(id)){ruinPartGeometry(m,id,x,y,z);return;}if(TERRAIN_PART_IDS.has(id)){terrainPartGeometry(m,id,x,y,z);return;}if(TABLEWARE_IDS.has(id)){tablewareGeometry(m,id,x,y,z);return;}if(VILLAGE_LIFE_IDS.has(id)){villageLifeGeometry(m,id,x,y,z);return;}if(FENCE_IDS.has(id)){fenceGeometry(m,id,x,y,z);return;}if(TOWER_PARTS.has(id)){towerPartGeometry(m,id,x,y,z);return;}if(EXPANSION_IDS.has(id)){expansionGeometry(m,id,x,y,z);return;}const wood=[.42,.30,.19],darkWood=[.29,.19,.12],leaf=[.29,.53,.31];
switch(id){
case 'grass':break;
case 'earth':break;
case 'moss':break;
case 'stone':break;
case 'woodfloor':case 'woodfloorLight':case 'woodfloorDark':break;
case 'wall':cube(m,x,y,z,.98,1.32,.98,[.81,.82,.74]);cube(m,x,y+1.31,z,.99,.11,.99,[.88,.89,.78]);break;
case 'stonewall':{
 cube(m,x,y,z,.98,1.32,.98,[.54,.57,.54]);
 for(let row=0;row<5;row++){const yy=y+row*.255;for(let i=0;i<3;i++){
 const xx=x-.34+i*.34+(row%2?.1:0);
 if(xx>x+.46)continue;
 cube(m,xx,yy,z+.503,.30,.018,.015,[.25,.30,.28]);
 }}cube(m,x,y+1.30,z,1,.09,1,[.68,.69,.63]);break;}
case 'woodwall':{
 cube(m,x,y,z,.94,1.33,.91,[.45,.30,.18]);
 for(let i=-2;i<=2;i++){cube(m,x+i*.185,y,z+.468,.15,1.33,.065,[.58+(i%2)*.04,.38,.22]);}
 for(const yy of [.25,.91])cube(m,x,y+yy,z+.517,.98,.075,.07,[.30,.20,.12]);break;}
case 'brickwall':{
 cube(m,x,y,z,.98,1.33,.98,[.47,.36,.31]);
 for(let row=0;row<6;row++)for(let i=0;i<4;i++){
 const xx=x-.385+i*.255+(row%2?.09:0);
 if(xx>x+.47)continue;
 cube(m,xx,y+row*.216,z+.505,.235,.182,.03,[(row+i)%3===0?.68:.59,.26+(i%2)*.035,.20]);
 }break;}
case 'plasterwall':{
 cube(m,x,y,z,.98,1.34,.98,[.87,.84,.72]);
 cube(m,x,y+1.28,z,.99,.09,1,[.65,.57,.44]);
 cube(m,x-.41,y,z+.505,.07,1.30,.065,[.55,.44,.31]);
 cube(m,x+.41,y,z+.505,.07,1.30,.065,[.55,.44,.31]);break;}
case 'mosswall':{
 cube(m,x,y,z,.98,1.34,.98,[.48,.51,.45]);
 for(let i=0;i<5;i++){const xx=x-.37+i*.19;
 cube(m,xx,y+.22+(i%3)*.35,z+.51,.17,.19,.045,[.23+(i%2)*.03,.43,.22]);
 }cube(m,x,y+1.32,z,.99,.10,.99,[.37,.49,.32]);break;}
case 'ironwall':{
 cube(m,x,y,z,.98,1.35,.98,[.34,.40,.43]);
 for(let i=-1;i<=1;i++){cube(m,x+i*.32,y+.06,z+.505,.30,1.22,.037,[.45,.50,.52]);}
 for(let xx of [-.43,.43])for(let yy of [.18,1.16])cube(m,x+xx,y+yy,z+.535,.055,.055,.04,[.76,.72,.52]);break;}
case 'corner':cube(m,x,y,z,1,1.42,1,[.84,.85,.76]);cube(m,x,y+1.42,z,1,.10,1,[.94,.92,.81]);break;
case 'door':{cube(m,x-.38,y,z,.22,1.4,.85,[.86,.82,.67]);cube(m,x+.38,y,z,.22,1.4,.85,[.86,.82,.67]);cube(m,x,y+1.32,z,.98,.17,.85,[.87,.82,.71]);cube(m,x-.03,y,z+.19,.56,.85,.10,[.45,.31,.21]);break}
case 'window':{
 // Full 1x1 tile with a genuinely open center, not a window buried in a solid wall.
 const stone=[.79,.80,.72],shade=[.58,.62,.57],wood=[.42,.31,.22];
 const sill=.31,top=1.28,openingWidth=.72,side=(1.002-openingWidth)/2;
 // Structural masonry: bottom sill, top lintel and both side piers.
 cube(m,x,y,z,1.002,sill,1.002,stone);
 cube(m,x,y+top,z,1.002,1.40-top,1.002,stone);
 for(const sign of [-1,1])cube(m,x+sign*(.5-side/2),y+sill,z,side,top-sill,1.002,stone);
 // Visible reveals on the inside edges emphasize real depth through the opening.
 for(const sign of [-1,1])cube(m,x+sign*(openingWidth/2+.014),y+sill,z,.048,top-sill,.94,shade);
 cube(m,x,y+sill,z,openingWidth,.065,.94,wood);
 cube(m,x,y+top-.065,z,openingWidth,.065,.94,wood);
 // Two pane surfaces near BOTH outside faces, with highlights for glass sheen.
 // The renderer uses opaque colors, so visual translucency is suggested by
 // blue-green glass, light streaks, and bright rims rather than actual alpha.
 for(const sign of [-1,1]){
  const faceZ=z+sign*.497,edgeZ=z+sign*.512,shineZ=z+sign*.526;
  cube(m,x,y+.36,faceZ,.686,.83,.026,[.35,.66,.70]);
  cube(m,x-.19,y+.41,shineZ,.085,.62,.010,[.70,.91,.92]);
  cube(m,x+.225,y+.85,shineZ,.045,.26,.010,[.57,.83,.87]);
  for(const xx of [-.365,.365])cube(m,x+xx,y+.30,edgeZ,.074,.99,.095,wood);
  for(const yy of [.30,1.25])cube(m,x,y+yy,edgeZ,.80,.075,.095,wood);
  cube(m,x,y+.32,edgeZ,.056,.90,.105,[.54,.42,.31]);
  cube(m,x,y+.80,edgeZ,.76,.052,.09,[.54,.42,.31]);
 }
 break;}
case 'shopCounter':{
 // One-tile shop counter: the ornate customer-facing front points toward +Z.
 // The standard deco() rotation path turns the entire counter through 90-degree steps.
 const base=[.43,.27,.15],front=[.54,.34,.18],trim=[.77,.57,.32],top=[.66,.46,.27],dark=[.27,.17,.11];
 // Solid cabinet, inset front panels, and supporting kickboard.
 cube(m,x,y+.055,z,.96,.79,.80,base);
 cube(m,x,y+.055,z+.404,.91,.71,.025,front);
 cube(m,x,y+.055,z+.443,.91,.075,.055,dark);
 for(const px of [-.315,0,.315]){
  cube(m,x+px,y+.19,z+.434,.255,.42,.035,[.49,.30,.16]);
  cube(m,x+px,y+.19,z+.457,.205,.33,.015,[.62,.41,.23]);
 }
 for(const px of [-.465,.465])cube(m,x+px,y+.045,z+.441,.045,.72,.065,trim);
 cube(m,x,y+.725,z+.439,.97,.058,.075,trim);
 // Thick polished overhanging service surface, with a slim lighter edge.
 cube(m,x,y+.82,z,.99,.13,.96,top);
 cube(m,x,y+.832,z+.49,1.002,.065,.045,trim);
 cube(m,x,y+.92,z-.015,.92,.025,.85,[.80,.62,.39]);
 // Customer-side foot rail.
 cube(m,x,y+.08,z+.49,.89,.045,.06,[.62,.53,.35]);
 break;}
case 'pillar':cube(m,x,y,z,.27,1.8,.27,[.64,.57,.44]);break;
case 'roof':cube(m,x,y,z,1,.23,1,[.43,.49,.43]);cube(m,x,y+.19,z,.95,.15,.95,[.34,.43,.39]);break;
case 'stairs':for(let i=0;i<4;i++)cube(m,x,y+i*.2,z+.32-i*.22,1,.2,.26,[.68,.64,.56]);break;
case 'treeRound':cube(m,x,y,z,.20,1.5,.22,wood);diamond(m,x,y+1.48,z,.83,leaf);diamond(m,x-.27,y+1.64,z+.22,.55,[.37,.59,.35]);diamond(m,x+.27,y+1.70,z-.21,.60,[.33,.58,.33]);break;
case 'treeBranch':cube(m,x,y,z,.24,1.47,.25,wood);cube(m,x-.29,y+1.04,z,.54,.15,.17,darkWood);cube(m,x+.25,y+1.26,z-.11,.48,.13,.17,darkWood);diamond(m,x-.55,y+1.36,z,.47,[.30,.56,.29]);diamond(m,x+.48,y+1.53,z-.18,.53,[.36,.64,.36]);diamond(m,x,y+1.77,z,.63,[.40,.65,.38]);break;

case 'treePine':{
 cube(m,x,y,z,.19,1.72,.20,[.36,.26,.17]);
 for(let i=0;i<3;i++)diamond(m,x,y+.88+i*.39,z,.73-i*.15,[.20+i*.025,.42+i*.025,.29+i*.014]);
 break;}
case 'treeBirch':{
 cube(m,x,y,z,.17,1.58,.17,[.85,.84,.74]);
 for(const yy of [.29,.66,1.03,1.39])cube(m,x+.085,y+yy,z,.018,.085,.11,[.28,.31,.29]);
 diamond(m,x,y+1.49,z,.66,[.49,.69,.36]);
 diamond(m,x+.22,y+1.60,z-.12,.43,[.56,.74,.42]);
 break;}
case 'treeOak':{
 cube(m,x,y,z,.31,1.62,.31,[.37,.25,.17]);
 cube(m,x-.20,y+1.18,z,.44,.13,.14,[.37,.25,.17]);
 diamond(m,x,y+1.63,z,.91,[.30,.55,.30]);
 diamond(m,x-.34,y+1.57,z+.22,.62,[.36,.62,.34]);
 diamond(m,x+.30,y+1.72,z-.21,.65,[.35,.59,.32]);
 break;}
case 'treeDead':{
 cube(m,x,y,z,.19,1.77,.20,[.37,.33,.29]);
 cube(m,x-.23,y+1.16,z,.48,.115,.11,[.40,.35,.31]);
 cube(m,x+.21,y+1.38,z-.06,.44,.11,.12,[.37,.33,.29]);
 cube(m,x-.42,y+1.23,z,.1,.39,.10,[.40,.35,.31]);
 cube(m,x+.40,y+1.45,z-.06,.08,.33,.08,[.37,.33,.29]);
 break;}
case 'treeStump':{
 cube(m,x,y,z,.52,.42,.50,[.47,.31,.20]);
 cube(m,x,y+.415,z,.51,.045,.49,[.72,.54,.33]);
 cube(m,x,y+.461,z,.31,.009,.30,[.51,.35,.23]);
 cube(m,x,y+.470,z,.10,.011,.11,[.76,.60,.40]);
 break;}
case 'innSign':case 'shopHerbSign':case 'shopChestSign':case 'shopBagSign':{
 // Shared hanging sign with flat, legible pixel lettering / pictograms.
 const dark=[.25,.15,.095],wood=[.52,.32,.17],rim=[.73,.51,.29],metal=[.53,.53,.48];
 cube(m,x-.405,y,z,.12,1.96,.13,dark);
 cube(m,x-.038,y+1.84,z,.82,.095,.12,dark);
 for(const xx of [.035,.329])cube(m,x+xx,y+1.65,z,.05,.23,.052,metal);
 cube(m,x+.183,y+1.13,z,.63,.51,.085,dark);
 cube(m,x+.183,y+1.17,z,.59,.42,.095,wood);
 for(const xx of [-.105,.471])cube(m,x+xx,y+1.11,z,.037,.55,.11,rim);
 for(const yy of [1.11,1.62])cube(m,x+.183,y+yy,z,.60,.041,.11,rim);
 // Sign artwork is rendered separately from a 2D canvas texture.
 // No voxel glyph polygons are added to the 3D mesh.
 break;}
case 'treeMaple':case 'treeCherry':case 'treeWillow':case 'treeCedar':case 'treeBamboo':case 'treeAutumn':
 detailedTree(m,id,x,y,z);break;
case 'rockGranite':naturalRock(m,x,y,z,.49,.53,.39,[.62,.65,.65],1);break;
case 'rockSandstone':{
 naturalRock(m,x,y,z,.46,.48,.38,[.74,.57,.39],2);
 for(const yy of [.15,.29])cube(m,x,y+yy,z+.33,.60,.018,.018,[.60,.43,.29]);
 break;}
case 'rockBasalt':{
 for(let i=0;i<4;i++){const px=[-.22,.17,-.10,.31][i],pz=[-.14,-.14,.22,.18][i];
 naturalRock(m,x+px,y,z+pz,.18,.38+(i%3)*.15,.20,[.31,.35,.38],i)}
 break;}
case 'rockMossy':{
 naturalRock(m,x,y,z,.48,.45,.44,[.48,.54,.49],3);
 for(const [xx,zz] of [[-.14,-.22],[.24,.05],[-.18,.25]])
 naturalCrown(m,x+xx,y+.36,z+zz,.12,.045,.12,[.30,.48,.29],4);
 break;}
case 'rockCluster':{
 for(const [i,xx,zz,rx,ry] of [[0,-.22,-.13,.27,.35],[1,.25,-.05,.32,.41],[2,.02,.28,.24,.23]])
 naturalRock(m,x+xx,y,z+zz,rx,ry,rx,[.48+i*.04,.52+i*.035,.51+i*.025],i);
 break;}
case 'rockCliff':{
 naturalRock(m,x,y,z,.57,1.05,.54,[.51,.54,.53],1);
 naturalRock(m,x-.13,y+.54,z+.06,.38,.49,.37,[.61,.62,.59],3);
 break;}
case 'bushFlower':{
 for(let i=0;i<4;i++){const px=[-.24,.20,-.08,.26][i],pz=[-.09,-.19,.21,.19][i];
 naturalCrown(m,x+px,y+.30,z+pz,.25,.23,.24,[.31,.55,.30],i);
 cube(m,x+px,y+.47,z+pz,.065,.05,.055,i%2?[.93,.66,.57]:[.91,.83,.52]);}
 break;}
case 'bushFern':{
 for(let i=0;i<7;i++){const angle=i*Math.PI*2/7,xx=Math.cos(angle)*.21,zz=Math.sin(angle)*.21;
 naturalBranch(m,x,y,z,x+xx,y+.35,z+zz,.025,.008,[.30,.47,.24]);
 naturalCrown(m,x+xx,y+.34,z+zz,.14,.055,.23,[.31,.56,.29],i);}
 break;}
case 'rock':diamond(m,x,y+.22,z,.43,[.49,.56,.50]);break;
case 'bush':diamond(m,x-.16,y+.23,z,.28,[.29,.56,.31]);diamond(m,x+.18,y+.29,z+.1,.30,[.35,.62,.35]);break;
case 'table':cube(m,x,y+.38,z,.85,.10,.65,[.62,.44,.27]);for(let a of [-.31,.31])for(let b of [-.21,.21])cube(m,x+a,y,z+b,.08,.38,.08,wood);break;
case 'chest':cube(m,x,y,z,.66,.48,.48,[.58,.37,.19]);cube(m,x,y+.48,z,.70,.10,.52,[.76,.57,.28]);cube(m,x,y+.21,z+.255,.12,.20,.06,[.86,.72,.40]);break;
case 'rewardChest':{
 // Distinctive dungeon reward chest; all surfaces are real low-poly geometry,
 // with gilded fittings, layered vaulted lid, jewel and engraved side panels.
 const ebony=[.22,.13,.10],walnut=[.39,.22,.14],wood=[.51,.30,.18];
 const gold=[.89,.67,.23],bright=[.99,.86,.45],bronze=[.59,.39,.14];
 const red=[.80,.13,.22],ruby=[.99,.30,.38],shadow=[.14,.08,.07];
 // Plinth, weighty feet and reinforced lower chest.
 cube(m,x,y+.025,z,.88,.09,.70,shadow);
 for(const xx of [-.32,.32])for(const zz of [-.24,.24])cube(m,x+xx,y,z+zz,.13,.13,.12,bronze);
 cube(m,x,y+.10,z,.85,.43,.64,ebony);
 cube(m,x,y+.16,z,.79,.33,.58,walnut);
 // Three inset front wooden panels with gold separators.
 for(const xx of [-.25,0,.25]){
  cube(m,x+xx,y+.15,z+.326,.222,.31,.020,wood);
  cube(m,x+xx,y+.15,z+.339,.18,.26,.011,walnut);
 }
 for(const xx of [-.405,.405])cube(m,x+xx,y+.07,z,.042,.49,.66,gold);
 for(const zz of [-.302,.302])cube(m,x,y+.08,z+zz,.84,.045,.05,bronze);
 cube(m,x,y+.095,z+.343,.81,.055,.053,gold);
 cube(m,x,y+.425,z+.345,.83,.075,.055,bright);
 // Layered raised lid: five stepped levels suggest an arched treasure chest.
 cube(m,x,y+.51,z,.91,.13,.72,ebony);
 cube(m,x,y+.60,z,.88,.12,.68,gold);
 cube(m,x,y+.68,z,.80,.09,.61,walnut);
 cube(m,x,y+.75,z,.68,.075,.55,wood);
 cube(m,x,y+.80,z,.49,.045,.45,walnut);
 // Long golden ribs wrap over the lid.
 for(const xx of [-.285,.285]){
  cube(m,x+xx,y+.61,z,.064,.14,.72,bright);
  cube(m,x+xx,y+.746,z,.064,.055,.53,gold);
  cube(m,x+xx,y+.80,z,.064,.035,.39,bright);
 }
 for(const zz of [-.337,.337])cube(m,x,y+.58,z+zz,.85,.052,.044,bronze);
 // Visible front lock, bright surround and prominent red jewel.
 cube(m,x,y+.33,z+.36,.19,.25,.035,gold);
 cube(m,x,y+.36,z+.391,.13,.17,.020,bronze);
 cube(m,x,y+.45,z+.414,.14,.14,.032,bright);
 diamond(m,x,y+.51,z+.447,.077,ruby);
 cube(m,x,y+.342,z+.428,.04,.055,.012,shadow);
 // Front-facing corner studs, clasps and matching side ornaments.
 for(const xx of [-.345,.345]){
  for(const yy of [.21,.38,.57])cube(m,x+xx,y+yy,z+.368,.075,.075,.03,bright);
 }
 for(const xx of [-.431,.431]){
  cube(m,x+xx,y+.24,z,.036,.31,.47,bronze);
  for(const zz of [-.19,.19])cube(m,x+xx,y+.33,z+zz,.045,.095,.10,gold);
 }
 break;}

case 'kitchenStove':{
 // Stone-built cooking hearth, open firebox faces +Z; iron cooking plate on top.
 const stone=[.52,.54,.51],lighter=[.68,.69,.62],mortar=[.30,.33,.31],iron=[.22,.27,.28];
 cube(m,x,y+.04,z,.94,.79,.86,stone);
 for(let row=0;row<3;row++){
  cube(m,x,y+.11+row*.23,z+.437,.91,.014,.018,mortar);
  for(let j=0;j<3;j++)cube(m,x-.31+j*.31+(row%2?.13:0),y+.1+row*.23,z+.447,.015,.20,.018,mortar);
 }
 // Dark arched-looking hearth mouth plus embers and short flames.
 cube(m,x,y+.10,z+.456,.51,.38,.024,[.12,.12,.11]);
 for(const xx of [-.16,.14])cube(m,x+xx,y+.14,z+.475,.15,.095,.016,[.78,.26,.12]);
 diamond(m,x+.01,y+.24,z+.483,.115,[.99,.58,.15]);
 cube(m,x,y+.80,z,.99,.12,.91,iron);
 for(const xx of [-.25,.25])cube(m,x+xx,y+.925,z,.055,.025,.70,lighter);
 for(const zz of [-.23,.23])cube(m,x,y+.925,z+zz,.61,.025,.05,lighter);
 // Cooking pot, with a visible shallow metal rim and handles.
 cube(m,x+.12,y+.94,z-.04,.35,.20,.33,[.27,.30,.30]);
 cube(m,x+.12,y+1.14,z-.04,.38,.035,.36,[.57,.60,.57]);
 cube(m,x+.12,y+1.176,z-.04,.25,.012,.23,[.17,.21,.21]);
 for(const xx of [-.105,.345])cube(m,x+xx,y+1.03,z-.04,.095,.05,.08,[.58,.60,.54]);
 break;}
case 'kitchenCounter':{
 // Wooden preparation bench with cutting board, knife and a storage shelf.
 const frame=[.36,.22,.13],oak=[.63,.43,.25],top=[.77,.56,.35];
 for(const xx of [-.39,.39])for(const zz of [-.33,.33])cube(m,x+xx,y,z+zz,.11,.78,.11,frame);
 cube(m,x,y+.15,z,.88,.055,.73,oak);
 cube(m,x,y+.77,z,.98,.13,.91,top);
 for(const zz of [-.405,.405])cube(m,x,y+.775,z+zz,.96,.05,.045,frame);
 cube(m,x-.11,y+.912,z+.02,.43,.025,.36,[.82,.65,.39]);
 cube(m,x-.10,y+.943,z+.03,.34,.009,.26,[.67,.46,.27]);
 // A small knife beside the cutting board.
 cube(m,x+.29,y+.914,z+.10,.045,.017,.30,[.66,.70,.69]);
 cube(m,x+.29,y+.914,z-.18,.065,.025,.13,frame);
 // Front drawers, each with brass pulls.
 for(const xx of [-.25,.25]){
  cube(m,x+xx,y+.55,z+.407,.41,.15,.025,[.46,.28,.16]);
  cube(m,x+xx,y+.62,z+.428,.12,.025,.027,[.86,.69,.33]);
 }
 break;}
case 'kitchenSink':{
 // Counter-height stone sink, visibly inset dark basin, and brass faucet.
 const stone=[.59,.60,.55],edge=[.79,.78,.70],basin=[.26,.36,.38],water=[.35,.62,.70],brass=[.79,.66,.37];
 cube(m,x,y+.05,z,.92,.72,.82,stone);
 for(const xx of [-.28,.28])cube(m,x+xx,y+.15,z+.426,.26,.47,.022,[.48,.49,.45]);
 cube(m,x,y+.76,z,.99,.13,.93,edge);
 // Draw a recessed illusion: dark basin, water, raised four-sided lip.
 cube(m,x,y+.895,z+.08,.65,.008,.56,basin);
 cube(m,x,y+.902,z+.08,.56,.008,.47,water);
 for(const xx of [-.345,.345])cube(m,x+xx,y+.88,z+.08,.064,.055,.60,edge);
 for(const zz of [-.225,.385])cube(m,x,y+.88,z+zz,.75,.055,.062,edge);
 cube(m,x,y+.895,z-.34,.07,.27,.07,brass);
 cube(m,x,y+1.15,z-.29,.065,.06,.22,brass);
 cube(m,x,y+1.10,z-.17,.07,.09,.07,brass);
 for(const xx of [-.20,.20])cube(m,x+xx,y+.9,z-.35,.10,.06,.10,brass);
 break;}
case 'bathWood':case 'bathStone':case 'bathLuxury':{
 // Three distinct 1x1 open-top baths. Water plane sits below the rim.
 const timber=id==='bathWood',luxury=id==='bathLuxury';
 const body=timber?[.52,.32,.18]:luxury?[.92,.88,.78]:[.54,.57,.55];
 const trim=timber?[.27,.22,.17]:luxury?[.86,.67,.28]:[.73,.75,.70];
 const interior=timber?[.28,.20,.15]:luxury?[.72,.78,.76]:[.34,.42,.43];
 const water=luxury?[.44,.72,.79]:[.31,.56,.65];
 cube(m,x,y+.05,z,.89,.57,.85,body);
 // Open hollow cavity as an inset dark surface (rather than a solid-color lid).
 cube(m,x,y+.618,z,.72,.012,.67,interior);
 cube(m,x,y+.632,z,.66,.011,.61,water);
 // Thick rim: four visible rails surround the lowered water surface.
 for(const xx of [-.43,.43])cube(m,x+xx,y+.61,z,.10,.13,.94,trim);
 for(const zz of [-.43,.43])cube(m,x,y+.61,z+zz,.95,.13,.10,trim);
 for(const xx of [-.40,.40])for(const zz of [-.39,.39])cube(m,x+xx,y+.55,z+zz,.13,.20,.13,trim);
 if(timber){
  // Vertical staves and iron binding bands on all four faces.
  for(const xx of [-.30,-.10,.10,.30]){
   cube(m,x+xx,y+.10,z+.431,.15,.43,.024,[.59,.37,.21]);
   cube(m,x+xx,y+.10,z-.431,.15,.43,.024,[.59,.37,.21]);
  }
  for(const yy of [.16,.44]){
   cube(m,x,y+yy,z+.453,.87,.050,.033,trim);
   cube(m,x,y+yy,z-.453,.87,.050,.033,trim);
  }
 }else if(luxury){
  // Polished ivory and ornamental golden highlights.
  for(const yy of [.16,.48]){
   cube(m,x,y+yy,z+.445,.88,.044,.035,trim);
   cube(m,x,y+yy,z-.445,.88,.044,.035,trim);
  }
  for(const xx of [-.36,.36])cube(m,x+xx,y+.12,z+.453,.07,.45,.025,trim);
  // Elegant faucet and bright knob at the back edge.
  cube(m,x+.23,y+.73,z-.38,.075,.21,.075,trim);
  cube(m,x+.23,y+.93,z-.30,.07,.055,.22,trim);
  cube(m,x+.23,y+.88,z-.20,.075,.075,.07,trim);
  cube(m,x+.08,y+.73,z-.38,.09,.045,.09,[.98,.92,.67]);
 }else{
  // Stone masonry joints and a capped corner on each side.
  for(const yy of [.19,.42]){
   cube(m,x,y+yy,z+.446,.86,.018,.023,[.33,.37,.37]);
   cube(m,x,y+yy,z-.446,.86,.018,.023,[.33,.37,.37]);
  }
  for(const xx of [-.22,.22])cube(m,x+xx,y+.07,z+.450,.025,.51,.026,[.37,.39,.39]);
 }
 // Reflected glints on still water surface.
 for(const xx of [-.21,.15])cube(m,x+xx,y+.646,z+.06,.18,.008,.018,[.72,.88,.88]);
 break;}

case 'equipStick':{
 // Newly crafted, straight wooden striking stick. Its octagonal shaft is
 // thick enough to read clearly in the item thumbnail and on the map.
 const brown=[.56,.36,.21],light=[.65,.44,.27],grip=[.36,.23,.14];
 naturalBranch(m,x,y+.045,z,x,y+1.17,z,.070,.095,brown);
 naturalBranch(m,x,y+1.17,z,x,y+1.31,z,.095,.070,light);
 // Subtle carved grip, raised slightly from the shaft surface.
 for(const yy of [.12,.21,.30]){
  cube(m,x,y+yy,z+.074,.095,.020,.016,grip);
 }
 break;}
case 'equipClub':{
 // A visibly heavier club: narrow handle and broad weighted wooden head.
 const handle=[.39,.25,.14],head=[.53,.32,.17],tip=[.61,.41,.24];
 naturalBranch(m,x,y+.04,z,x,y+.53,z,.075,.085,handle);
 naturalBranch(m,x,y+.53,z,x,y+1.08,z,.085,.165,head);
 naturalBranch(m,x,y+1.08,z,x,y+1.29,z,.165,.125,tip);
 // Shallow dark grip binding. Kept below the weighted head.
 for(const yy of [.14,.24,.34]){
  cube(m,x,y+yy,z+.078,.105,.021,.016,[.28,.18,.11]);
 }
 break;}
case 'equipWoodSword':{
 const wood=[.58,.37,.20],edge=[.74,.53,.29],handle=[.34,.20,.12];
 cube(m,x,y+.055,z,.13,.42,.13,handle);
 cube(m,x,y+.045,z,.24,.10,.18,wood);
 cube(m,x,y+.47,z,.64,.095,.18,edge);
 cube(m,x,y+.53,z,.19,.72,.18,wood);
 cube(m,x,y+.53,z+.098,.060,.65,.016,edge);
 // Narrow, angular wooden point above the blade.
 const point=[x,y+1.43,z],L=[x-.095,y+1.25,z+.02],R=[x+.095,y+1.25,z+.02];
 tri(m,L,R,point,edge);tri(m,R,L,[x,y+1.25,z-.055],wood);
 break;}
case 'equipStoneSword':{
 const rock=[.51,.56,.58],ridge=[.77,.80,.77],dark=[.28,.32,.32],wood=[.37,.25,.17];
 cube(m,x,y+.07,z,.13,.42,.13,wood);
 for(const yy of [.12,.27])cube(m,x,y+yy,z+.075,.15,.043,.020,[.65,.54,.33]);
 cube(m,x,y+.45,z,.58,.11,.20,dark);
 cube(m,x,y+.53,z,.30,.72,.125,rock);
 cube(m,x,y+.54,z+.070,.06,.66,.012,ridge);
 cube(m,x-.132,y+.74,z+.068,.043,.15,.010,[.38,.42,.43]);
 const point=[x,y+1.43,z],left=[x-.15,y+1.23,z],right=[x+.15,y+1.23,z];
 tri(m,left,right,point,ridge);tri(m,right,left,[x,y+1.24,z-.06],rock);
 break;}
case 'equipIronSword':{
 const steel=[.64,.72,.76],shine=[.91,.95,.95],shadow=[.39,.47,.53],gold=[.83,.67,.33];
 cube(m,x,y+.055,z,.14,.41,.12,[.28,.22,.19]);
 for(const yy of [.11,.22,.33])cube(m,x,y+yy,z+.073,.145,.033,.017,gold);
 cube(m,x,y+.035,z,.25,.10,.16,gold);
 cube(m,x,y+.47,z,.65,.095,.18,gold);
 for(const xx of [-.27,.27])cube(m,x+xx,y+.445,z,.09,.15,.15,[.66,.51,.23]);
 cube(m,x,y+.52,z,.225,.78,.090,steel);
 cube(m,x,y+.54,z+.052,.048,.75,.014,shine);
 cube(m,x-.101,y+.56,z+.047,.018,.70,.011,shadow);
 // Sharp faceted steel tip.
 const point=[x,y+1.50,z],left=[x-.113,y+1.30,z],right=[x+.113,y+1.30,z];
 tri(m,left,right,point,shine);tri(m,right,left,[x,y+1.30,z-.043],steel);
 break;}
case 'humanBare':case 'humanVillager':
 // Simplified, non-explicit anatomical mannequin for bare human.
 characterHuman(m,x,y,z,id==='humanVillager');break;
case 'humanMerchant':{
 // Brown tunic, pale apron, shoulder pack and money pouch: recognizable from above.
 const cloth=[.47,.30,.19],apron=[.73,.60,.39],skin=[.78,.58,.41],hair=[.29,.19,.12],bag=[.42,.27,.16];
 for(const s of [-1,1]){cube(m,x+s*.13,y,z,.13,.41,.18,[.30,.25,.20]);cube(m,x+s*.30,y+.53,z,.13,.40,.16,cloth);cube(m,x+s*.30,y+.20,z+.055,.13,.12,.14,skin)}
 cube(m,x,y+.43,z,.45,.57,.32,cloth);
 cube(m,x,y+.46,z+.174,.29,.40,.026,apron);
 cube(m,x,y+.96,z,.15,.13,.15,skin);
 cube(m,x,y+1.08,z,.34,.32,.32,skin);
 cube(m,x,y+1.34,z-.04,.39,.12,.37,hair);
 cube(m,x,y+1.38,z,.46,.055,.43,[.52,.35,.19]);
 cube(m,x-.105,y+1.16,z+.169,.037,.033,.014,hair);cube(m,x+.105,y+1.16,z+.169,.037,.033,.014,hair);
 cube(m,x-.34,y+.48,z-.12,.22,.34,.27,bag);
 cube(m,x-.34,y+.53,z+.03,.18,.10,.035,[.78,.61,.30]);
 cube(m,x+.32,y+.35,z+.10,.19,.23,.16,bag);
 cube(m,x+.32,y+.48,z+.19,.10,.09,.025,[.75,.58,.26]);
 break;}
case 'humanKnight':{
 const steel=[.60,.68,.72],bright=[.79,.85,.86],shade=[.33,.40,.46],blue=[.25,.36,.52],gold=[.79,.64,.34];
 for(const s of [-1,1]){cube(m,x+s*.135,y,z,.17,.45,.22,shade);cube(m,x+s*.135,y+.12,z+.127,.19,.29,.038,steel)}
 cube(m,x,y+.43,z,.49,.59,.34,steel);
 cube(m,x,y+.48,z+.186,.25,.41,.026,blue);
 cube(m,x,y+.76,z+.208,.29,.044,.028,gold);
 cube(m,x,y+.99,z,.18,.13,.19,shade);
 cube(m,x,y+1.07,z,.38,.38,.36,steel);
 cube(m,x,y+1.25,z+.184,.28,.080,.025,shade);
 cube(m,x,y+1.40,z,.40,.14,.39,bright);
 for(const s of [-1,1]){cube(m,x+s*.335,y+.78,z,.22,.23,.30,bright);cube(m,x+s*.32,y+.35,z+.035,.13,.39,.16,steel)}
 // Sword and shield are distinct silhouette elements.
 cube(m,x+.42,y+.11,z+.09,.09,.87,.085,bright);
 cube(m,x+.42,y+.87,z+.09,.29,.09,.16,gold);
 cube(m,x+.42,y+.07,z+.09,.12,.20,.12,[.38,.26,.17]);
 cube(m,x-.43,y+.44,z+.16,.34,.52,.14,shade);
 cube(m,x-.43,y+.51,z+.238,.21,.32,.024,blue);
 cube(m,x-.43,y+.56,z+.254,.07,.17,.018,gold);
 break;}
case 'monsterSkeleton':{
 // Bone body with conspicuous ribs, hollow eyes and jaw.
 const bone=[.83,.82,.69],light=[.94,.91,.77],dark=[.19,.23,.22];
 for(const s of [-1,1]){
  cube(m,x+s*.13,y+.03,z,.075,.41,.088,bone);
  cube(m,x+s*.13,y+.42,z,.13,.12,.12,light);
  cube(m,x+s*.30,y+.55,z,.07,.47,.075,bone);
  cube(m,x+s*.31,y+.16,z+.02,.075,.12,.075,light);
 }
 cube(m,x,y+.49,z,.34,.15,.18,bone);
 cube(m,x,y+.59,z,.10,.43,.105,light);
 for(const yy of [.69,.80,.91]){
  cube(m,x,y+yy,z+.075,.39,.050,.075,bone);
  cube(m,x,y+yy,z+.125,.10,.037,.020,dark);
 }
 cube(m,x,y+1.06,z,.12,.13,.12,bone);
 cube(m,x,y+1.17,z,.40,.40,.35,light);
 for(const s of [-1,1])cube(m,x+s*.105,y+1.36,z+.180,.094,.105,.020,dark);
 cube(m,x,y+1.20,z+.185,.21,.066,.021,dark);
 cube(m,x,y+1.13,z+.15,.31,.09,.22,bone);
 for(const s of [-1,1])cube(m,x+s*.085,y+1.17,z+.275,.018,.05,.018,dark);
 break;}
case 'monsterSlime':{
 const base=[.26,.73,.88],light=[.57,.91,.98],shadow=[.13,.46,.63];
 // Rounded faceted blob with a domed crown and glossy highlight.
 naturalCrown(m,x,y+.33,z,.43,.36,.42,base,3);
 naturalCrown(m,x,y+.51,z,.32,.25,.33,light,8);
 for(const xx of [-.135,.135])cube(m,x+xx,y+.46,z+.363,.067,.105,.04,[.09,.21,.20]);
 cube(m,x,y+.33,z+.397,.15,.035,.026,shadow);
 cube(m,x-.14,y+.67,z+.23,.11,.045,.03,[.86,.99,1.0]);
 break;}
case 'monsterGoblin':{
 const green=[.37,.61,.32],dark=[.18,.34,.23],shirt=[.43,.30,.20],metal=[.63,.67,.59];
 for(const xx of [-.14,.14]){
  cube(m,x+xx,y,z,.16,.42,.21,dark);
  cube(m,x+xx,y+.42,z,.16,.12,.21,shirt);
 }
 cube(m,x,y+.49,z,.43,.42,.32,shirt);
 for(const xx of [-.31,.31])cube(m,x+xx,y+.48,z,.14,.38,.16,green);
 cube(m,x,y+.93,z,.17,.10,.17,green);
 cube(m,x,y+1.01,z,.44,.36,.37,green);
 // Pointy ears and mischievous eyes.
 for(const sign of [-1,1]){
  const xx=x+sign*.31;
  diamond(m,xx,y+1.17,z,.14,green);
  cube(m,x+sign*.11,y+1.20,z+.19,.085,.058,.025,[.95,.75,.32]);
  cube(m,x+sign*.11,y+1.204,z+.211,.04,.042,.009,[.20,.17,.11]);
 }
 cube(m,x,y+1.07,z+.203,.17,.034,.026,dark);
 cube(m,x,y+.58,z+.17,.34,.055,.04,[.65,.49,.24]);
 // Crude club held in the right hand.
 cube(m,x+.37,y+.10,z+.065,.09,.88,.10,[.40,.26,.15]);
 cube(m,x+.37,y+.85,z+.065,.19,.26,.18,[.50,.31,.17]);
 break;}
case 'monsterDragon':{
 const scale=[.23,.48,.32],belly=[.54,.68,.43],dark=[.13,.30,.25],horn=[.82,.77,.53];
 // Large fantasy silhouette within a nominal 1-tile placement footprint.
 cube(m,x,y+.40,z,.68,.48,.76,scale);
 cube(m,x,y+.85,z-.14,.50,.52,.50,scale);
 cube(m,x,y+.92,z+.30,.43,.31,.33,belly);
 cube(m,x,y+1.26,z+.23,.20,.41,.22,scale);
 cube(m,x,y+1.54,z+.28,.43,.34,.44,scale);
 cube(m,x,y+1.47,z+.56,.33,.19,.31,belly);
 for(const side of [-1,1]){
  cube(m,x+side*.32,y+.04,z+.20,.19,.65,.24,scale);
  cube(m,x+side*.32,y+.09,z-.29,.22,.60,.25,scale);
  // Oversized bat-like wings: pointed tips, branching fingers and a deeply
  // scalloped trailing edge. Visible from the editor's overhead camera.
  // Span is about 3.10 tiles, compared with the .68-tile torso.
  const wingMem=[.29,.59,.41],wingShadow=[.17,.38,.28],wingClaw=[.94,.86,.63];
  const root=[x+side*.24,y+1.22,z-.10];
  const elbow=[x+side*.86,y+1.72,z-.32];
  const tip=[x+side*1.55,y+2.04,z-.62];
  const outerFinger=[x+side*1.38,y+1.28,z-.84];
  const valleyOuter=[x+side*1.10,y+1.19,z-.60];
  const middleFinger=[x+side*1.04,y+.98,z-.99];
  const valleyMiddle=[x+side*.81,y+1.04,z-.69];
  const innerFinger=[x+side*.68,y+.89,z-.86];
  const valleyInner=[x+side*.49,y+1.00,z-.54];
  const back=[x+side*.34,y+1.08,z-.64];
  // Membranes follow fingers and recess into the valleys, making a sawtooth silhouette.
  for(const [p,q,tone] of [
   [tip,outerFinger,wingMem],
   [outerFinger,valleyOuter,wingShadow],
   [valleyOuter,middleFinger,wingMem],
   [middleFinger,valleyMiddle,wingShadow],
   [valleyMiddle,innerFinger,wingMem],
   [innerFinger,valleyInner,wingShadow],
   [valleyInner,back,wingMem]
  ])tri(m,elbow,p,q,tone);
  tri(m,root,elbow,back,wingMem);
  // Raised wing spars read as a skeleton over the coloured membrane.
  naturalBranch(m,...root,...elbow,.065,.034,dark);
  for(const [point,radius] of [[tip,.034],[outerFinger,.026],
   [middleFinger,.024],[innerFinger,.022]]){
   naturalBranch(m,...elbow,...point,radius,.009,dark);
  }
  naturalBranch(m,...root,...back,.035,.012,dark);
  diamond(m,...tip,.105,wingClaw);
  diamond(m,...outerFinger,.065,wingClaw);
  diamond(m,x+side*.18,y+1.78,z+.19,.12,horn);
  cube(m,x+side*.13,y+1.61,z+.508,.073,.060,.036,[.94,.68,.25]);
 }
 // Tail and row of dorsal spikes.
 naturalBranch(m,x,y+.62,z-.36,x,y+.34,z-.98,.20,.055,scale);
 diamond(m,x,y+.39,z-1.10,.17,dark);
 for(let i=0;i<5;i++)diamond(m,x,y+1.30-i*.15,z-.28-i*.13,.11-i*.01,dark);
 break;}
case 'bed':{
 cube(m,x,y+.10,z,.90,.18,1.5,[.40,.31,.23]);
 cube(m,x,y+.28,z,.80,.22,1.35,[.70,.77,.67]);
 // Raise the pillow above the mattress surface (mattress top: y+.50).
 // A soft, lighter inset top makes its thickness readable from the overhead camera.
 cube(m,x,y+.465,z-.45,.74,.185,.35,[.83,.84,.77]);
 cube(m,x,y+.635,z-.45,.68,.032,.30,[.92,.92,.86]);
 break;}
default:{const custom=models.find(q=>q.id===id);if(custom)for(const p of custom.parts)addPart(m,p,x,z,y,r)}
}}

const WALL_MATERIAL_IDS=['wall','stonewall','woodwall','brickwall','plasterwall','mosswall','ironwall'];
const WALL_EXTRA_SUFFIXES=['Plain','Double','All'];
function wallMaterialForId(id){
 if(id==='corner')return 'wall';
 if(WALL_MATERIAL_IDS.includes(id))return id;
 if(id.endsWith('corner')&&WALL_MATERIAL_IDS.includes(id.slice(0,-6)))return id.slice(0,-6);
 for(const suffix of WALL_EXTRA_SUFFIXES)if(id.endsWith(suffix)){
  const base=id.slice(0,-suffix.length);if(WALL_MATERIAL_IDS.includes(base))return base;
 }
 return null;
}
function isWallId(id){return wallMaterialForId(id)!==null}
function wallBlock(m,id,x,y,z,r=0,faceVisible=null,faceExterior=null){
 const mat=wallMaterialForId(id)||'wall';
 const colors={
  wall:[.81,.82,.74],stonewall:[.54,.57,.54],woodwall:[.43,.29,.17],
  brickwall:[.50,.27,.21],plasterwall:[.87,.84,.72],
  mosswall:[.45,.51,.44],ironwall:[.35,.40,.44]
 };
 const base=colors[mat],turn=((r%4)+4)%4,height=1.4;
 // One wall material covers all four sides. Adjacent wall faces are not
 // generated at all; enclosed room faces are flat, exterior faces carry relief.
 // Side order: +Z, -X, -Z, +X (the same order as rot2).
 const visible=faceVisible||[true,true,true,true];
 const exterior=faceExterior||[true,true,true,true];
 const x0=x-.501,x1=x+.501,z0=z-.501,z1=z+.501,y1=y+height;
 quad(m,[x0,y1,z0],[x0,y1,z1],[x1,y1,z1],[x1,y1,z0],base.map(v=>Math.min(1,v*1.08)));
 if(visible[0])quad(m,[x0,y,z1],[x1,y,z1],[x1,y1,z1],[x0,y1,z1],base);
 if(visible[1])quad(m,[x0,y,z0],[x0,y,z1],[x0,y1,z1],[x0,y1,z0],base.map(v=>v*.88));
 if(visible[2])quad(m,[x1,y,z0],[x0,y,z0],[x0,y1,z0],[x1,y1,z0],base.map(v=>v*.72));
 if(visible[3])quad(m,[x1,y,z1],[x1,y,z0],[x1,y1,z0],[x1,y1,z1],base.map(v=>v*.83));
 for(let direction=0;direction<4;direction++){
  if(!visible[direction]||!exterior[direction])continue;
  function panel(u,yy,w,h,depth,color){
   // The relief is laid against the surface; no overlapping inner half walls.
   // Limit surface relief to 0.035 tiles so adjoining wall blocks fit closely.
   const relief=Math.min(depth,.035);
   const [dx,dz]=rot2(u,.501+relief/2,direction);
   const dims=direction%2?[relief,w]:[w,relief];
   cube(m,x+dx,y+yy,z+dz,dims[0],h,dims[1],color);
  }
  if(mat==='wall'||mat==='stonewall'){
   const joint=mat==='wall'?[.62,.64,.58]:[.38,.42,.40];
   for(let row=1;row<5;row++)panel(0,row*.264,1,.012,.012,joint);
   for(let row=0;row<5;row++){
    const offset=row%2?.17:0;
    for(const uu of [-.29+offset,.06+offset,.39+offset]){
     if(Math.abs(uu)>.46)continue;
     panel(uu,row*.264,.013,.244,.011,joint);
    }
   }
   panel(0,1.331,.98,.047,.028,mat==='wall'?[.88,.87,.78]:[.65,.67,.62]);
  }else if(mat==='woodwall'){
   for(let i=0;i<5;i++){
    const u=-.4+i*.2;
    panel(u,0,.176,1.32,.026,[.46+(i%3)*.035,.30+(i%3)*.024,.18+(i%2)*.016]);
   }
   for(const yy of [.20,1.17])panel(0,yy,.98,.065,.030,[.33,.23,.15]);
  }else if(mat==='brickwall'){
   const course=.219;
   for(let row=0;row<6;row++){
    const shift=row%2?.125:0;
    for(let i=-2;i<3;i++){
     const at=i*.248+shift;
     const left=Math.max(-.495,at-.112),right=Math.min(.495,at+.112);
     if(right<=left)continue;
     panel((left+right)/2,row*course+.009,right-left,.191,.021,
      [(row+i+9)%3===0?.63:.57,.26+(i%2===0?.025:0),.21]);
    }
   }
  }else if(mat==='plasterwall'){
   for(const uu of [-.445,.445])panel(uu,0,.086,1.37,.060,[.56,.43,.30]);
   panel(0,1.260,.99,.096,.06,[.66,.53,.37]);
   panel(0,.20,.99,.052,.041,[.66,.53,.37]);
  }else if(mat==='mosswall'){
   for(let row=1;row<5;row++)panel(0,row*.264,.99,.017,.015,[.31,.34,.31]);
   for(let i=0;i<5;i++){
    const u=-.39+i*.19;
    panel(u,.13+(i%3)*.34,.13,.16,.037,[.23+(i%2)*.04,.43,.22]);
   }
   panel(0,1.31,1,.066,.03,[.36,.48,.32]);
  }else if(mat==='ironwall'){
   for(let i=0;i<3;i++){
    panel(-.33+i*.33,.07,.31,1.22,.041,[.45+i*.012,.50+i*.010,.52+i*.01]);
   }
   for(const uu of [-.43,.43])for(const yy of [.17,1.19])
    panel(uu,yy,.052,.052,.051,[.76,.72,.52]);
   panel(0,1.28,1,.05,.044,[.27,.31,.34]);
  }
 }
}

// Material variations use the same one-tile footprint and the same shared
// construction geometry, so all nine are interchangeable and rotatable.
const MATERIAL_FIXTURE_IDS=new Set(['windowWood','windowStone','windowBrick','doorWood','doorIron','doorStone','counterWood','counterStone','counterLuxury']);
function materialFixture(m,id,x,y,z){
 const windowMode=id.startsWith('window');
 const doorMode=id.startsWith('door');
 if(windowMode){
  const wood=id==='windowWood',brick=id==='windowBrick';
  const shell=wood?[.46,.32,.20]:brick?[.57,.29,.22]:[.66,.68,.63];
  const frame=wood?[.40,.25,.14]:brick?[.76,.50,.34]:[.49,.52,.50];
  const shade=wood?[.30,.20,.12]:brick?[.38,.22,.19]:[.41,.43,.40];
  const sill=.25,top=1.31,opening=.73,pier=(1.002-opening)/2;
  cube(m,x,y,z,1.002,sill,1.002,shell);
  cube(m,x,y+top,z,1.002,1.41-top,1.002,shell);
  for(const sign of [-1,1])cube(m,x+sign*(.5-pier/2),y+sill,z,pier,top-sill,1.002,shell);
  // For wood, tall boards; for brick, raised courses; for stone, cut blocks.
  for(const face of [-1,1]){
   const faceZ=z+face*.479;
   if(brick){
    for(let row=0;row<3;row++){
     const yy=row===0?.05:1.32+row*.038;
     cube(m,x,yy,faceZ,.96,.018,.027,[.37,.19,.15]);
    }
   }else if(wood){
    for(const xx of [-.45,.45])cube(m,x+xx,y+.05,faceZ,.065,1.32,.038,shade);
   }else{
    for(const xx of [-.443,.443])cube(m,x+xx,y+.34,faceZ,.05,.85,.038,shade);
   }
  }
  // The opening remains open through the middle; glass faces and bright
  // highlights sit near both ends of the wall thickness.
  for(const face of [-1,1]){
   const glassZ=z+face*.447,frameZ=z+face*.475,shineZ=z+face*.467;
   cube(m,x,y+.32,glassZ,.695,.89,.025,[.37,.69,.73]);
   cube(m,x-.18,y+.39,shineZ,.078,.63,.014,[.76,.92,.94]);
   cube(m,x+.225,y+.91,shineZ,.047,.24,.014,[.61,.84,.89]);
   for(const xx of [-.37,.37])cube(m,x+xx,y+.27,frameZ,.079,1.01,.045,frame);
   for(const yy of [.27,1.25])cube(m,x,y+yy,frameZ,.83,.08,.045,frame);
   cube(m,x,y+.32,frameZ,.053,.92,.045,frame);
   cube(m,x,y+.79,frameZ,.75,.048,.045,frame);
  }
  return;
 }
 if(doorMode){
  const iron=id==='doorIron',stone=id==='doorStone';
  const shell=stone?[.60,.63,.59]:iron?[.39,.42,.44]:[.56,.39,.23];
  const front=stone?[.44,.30,.20]:iron?[.32,.38,.41]:[.51,.32,.17];
  const accent=stone?[.75,.72,.61]:iron?[.70,.72,.65]:[.72,.50,.27];
  // Side jambs and a lintel leave room for a distinct closed door.
  for(const side of [-1,1])cube(m,x+side*.43,y,z,.13,1.4,.86,shell);
  cube(m,x,y+1.285,z,1.002,.115,.88,shell);
  cube(m,x,y,z,.79,1.29,.18,front);
  for(const face of [-1,1]){
   const faceZ=z+face*.101;
   for(const xx of [-.32,.32])cube(m,x+xx,y+.10,faceZ,.06,1.08,.027,accent);
   for(const yy of [.17,1.12])cube(m,x,y+yy,faceZ,.70,.059,.032,accent);
   if(iron){
    for(const yy of [.28,.96])for(const xx of [-.25,.25])cube(m,x+xx,y+yy,z+face*.137,.055,.052,.035,[.78,.71,.49]);
    cube(m,x,y+.64,z+face*.141,.62,.05,.025,[.58,.63,.63]);
   }else{
    cube(m,x,y+.68,faceZ,.48,.66,.016,stone?[.51,.36,.22]:[.59,.39,.23]);
   }
   // Brass handle on both sides.
   cube(m,x+.23,y+.65,z+face*.16,.065,.065,.08,[.87,.72,.37]);
  }
  if(stone)for(const px of [-.435,.435])for(const yy of [.24,.75,1.15])cube(m,x+px,y+yy,z+.425,.13,.029,.03,[.42,.45,.42]);
  return;
 }
 const stone=id==='counterStone',luxury=id==='counterLuxury';
 const body=stone?[.54,.56,.54]:luxury?[.26,.17,.12]:[.45,.29,.18];
 const panel=stone?[.64,.66,.62]:luxury?[.41,.25,.16]:[.59,.39,.22];
 const trim=stone?[.75,.77,.72]:luxury?[.78,.61,.32]:[.72,.54,.31];
 const top=stone?[.76,.77,.71]:luxury?[.48,.31,.20]:[.66,.46,.28];
 cube(m,x,y+.06,z,.965,.78,.83,body);
 for(const px of [-.31,0,.31]){
  cube(m,x+px,y+.18,z+.434,.28,.48,.032,trim);
  cube(m,x+px,y+.20,z+.459,.22,.39,.02,panel);
  if(luxury)cube(m,x+px,y+.28,z+.482,.15,.16,.02,[.63,.46,.25]);
 }
 for(const px of [-.46,.46])cube(m,x+px,y+.05,z+.443,.044,.73,.056,trim);
 cube(m,x,y+.76,z+.435,.97,.055,.06,trim);
 cube(m,x,y+.83,z,1.0,.14,.95,top);
 cube(m,x,y+.96,z,.94,.028,.86,stone?[.88,.87,.83]:luxury?[.62,.43,.25]:[.79,.61,.38]);
 cube(m,x,y+.83,z+.476,1.0,.068,.040,trim);
 cube(m,x,y+.095,z+.465,.89,.045,.06,stone?[.46,.48,.47]:[.62,.50,.34]);
}

const MATCHED_OPENING_MATERIALS={
 wall:{shell:[.81,.82,.74],edge:[.65,.68,.62],frame:[.57,.48,.35],door:[.51,.35,.23],detail:[.73,.69,.54]},
 stonewall:{shell:[.54,.57,.54],edge:[.34,.39,.37],frame:[.68,.69,.64],door:[.46,.31,.22],detail:[.39,.43,.40]},
 woodwall:{shell:[.43,.29,.17],edge:[.29,.19,.12],frame:[.67,.46,.26],door:[.45,.29,.17],detail:[.75,.55,.33]},
 brickwall:{shell:[.50,.27,.21],edge:[.37,.20,.17],frame:[.72,.47,.31],door:[.48,.30,.18],detail:[.75,.44,.30]},
 plasterwall:{shell:[.87,.84,.72],edge:[.65,.57,.44],frame:[.55,.42,.30],door:[.56,.36,.23],detail:[.92,.88,.77]},
 mosswall:{shell:[.45,.51,.44],edge:[.31,.41,.31],frame:[.48,.53,.38],door:[.41,.29,.19],detail:[.30,.46,.28]},
 ironwall:{shell:[.35,.40,.44],edge:[.24,.28,.32],frame:[.57,.62,.65],door:[.38,.43,.46],detail:[.76,.71,.51]}
};
const MATCHED_OPENING_IDS=new Set(Object.keys(MATCHED_OPENING_MATERIALS).flatMap(id=>[id+'Window',id+'Door']));
function matchedOpening(m,id,x,y,z){
 const isWindow=id.endsWith('Window'),material=id.slice(0,isWindow?-6:-4);
 const c=MATCHED_OPENING_MATERIALS[material];if(!c)return;
 const iron=material==='ironwall',brick=material==='brickwall';
 const glass=[.34,.67,.74],glow=[.75,.94,.97],metal=[.82,.73,.49];
 const h=1.4;
 // Continuous wall-size side posts and lintel, shared between both block styles.
 const post=.14,half=.501-post/2;
 for(const side of [-1,1])cube(m,x+side*half,y,z,post,h,1.002,c.shell);
 cube(m,x,y+1.28,z,1.002,.12,1.002,c.shell);
 if(isWindow){
  // Sill + open central cavity + a large, visible blue glass pane on BOTH sides.
  cube(m,x,y,z,1.002,.26,1.002,c.shell);
  for(const face of [-1,1]){
   const zFace=z+face*.478;
   cube(m,x,y+.31,z+face*.441,.73,.88,.026,glass);
   cube(m,x-.19,y+.40,z+face*.461,.085,.62,.012,glow);
   cube(m,x+.22,y+.88,z+face*.461,.045,.24,.012,[.59,.86,.93]);
   for(const side of [-1,1])cube(m,x+side*.373,y+.28,zFace,.07,.99,.044,c.frame);
   for(const yy of [.27,1.24])cube(m,x,y+yy,zFace,.81,.076,.044,c.frame);
   cube(m,x,y+.29,zFace,.053,.94,.048,c.frame);
   cube(m,x,y+.78,zFace,.75,.047,.045,c.frame);
  }
 }else{
  // Solid inset door leaf with two-sided decorated paneling and a handle.
  cube(m,x,y,z,.73,1.29,.18,c.door);
  for(const face of [-1,1]){
   const zFace=z+face*.106;
   for(const side of [-1,1])cube(m,x+side*.332,y+.11,zFace,.05,1.07,.025,c.frame);
   for(const yy of [.13,1.14])cube(m,x,y+yy,zFace,.69,.055,.026,c.frame);
   cube(m,x,y+.60,z+face*.122,.49,.75,.019,c.detail);
   if(!iron){
    cube(m,x,y+.66,z+face*.14,.43,.62,.016,c.door);
   }else{
    for(const px of [-.23,.23])for(const yy of [.24,.98])
     cube(m,x+px,y+yy,z+face*.14,.052,.052,.025,metal);
   }
   cube(m,x+.24,y+.67,z+face*.158,.065,.065,.065,metal);
  }
 }
 // Two-sided material finishing: recognizable masonry, planks, metal or moss.
 for(const face of [-1,1]){
  const dz=z+face*.49;
  if(material==='stonewall'||material==='wall'){
   // Match the masonry course heights on adjacent full wall blocks.
   const joint=material==='wall'?[.62,.64,.58]:[.38,.42,.40];
   for(let row=1;row<5;row++)for(const side of [-1,1])
    cube(m,x+side*.443,y+row*.264,dz,.116,.012,.014,joint);
   cube(m,x,y+1.331,dz,.99,.047,.016,material==='wall'?[.88,.87,.78]:[.65,.67,.62]);
  }else if(brick){
   for(const yy of [.05,1.34])cube(m,x,y+yy,dz,.94,.025,.014,c.edge);
   for(const side of [-1,1])for(const yy of [.36,.77,1.12])
    cube(m,x+side*.45,y+yy,dz,.085,.024,.018,c.edge);
  }else if(material==='woodwall'){
   for(const side of [-1,1])cube(m,x+side*.445,y+.03,dz,.055,1.24,.02,c.edge);
  }else if(material==='mosswall'){
   for(const side of [-1,1])for(const yy of [.33,1.01])
    cube(m,x+side*.44,y+yy,dz,.075,.14,.02,[.26,.47,.27]);
  }else if(iron){
   for(const side of [-1,1])for(const yy of [.16,1.17])
    cube(m,x+side*.45,y+yy,dz,.055,.055,.025,metal);
  }else{
   for(const side of [-1,1])cube(m,x+side*.445,y+.03,dz,.06,1.24,.02,c.edge);
  }
 }
}

const MATCHED_COUNTER_IDS=new Set(Object.keys(MATCHED_OPENING_MATERIALS).map(id=>id+'Counter'));
function matchedCounter(m,id,x,y,z){
 const material=id.slice(0,-7);
 const c=MATCHED_OPENING_MATERIALS[material];
 if(!c)return;
 const wood=material==='woodwall',iron=material==='ironwall',stone=material==='stonewall',brick=material==='brickwall';
 const dark=material==='plasterwall'?[.45,.32,.21]:c.edge;
 const face=wood?[.52,.34,.20]:c.shell;
 const countertop=wood?[.70,.49,.29]:iron?[.58,.63,.65]:stone?[.75,.76,.70]:brick?[.72,.43,.30]:material==='mosswall'?[.58,.65,.49]:material==='plasterwall'?[.73,.60,.43]:[.84,.80,.66];
 // One 1x1 block: solid counter at waist height; the front is toward +Z.
 cube(m,x,y+.07,z,.975,.74,.82,c.shell);
 cube(m,x,y+.12,z+.414,.95,.60,.025,face);
 // Material-matched facing and panel seams.
 if(brick||stone){
  // The same staggered masonry courses as the matching full-height wall.
  const joints=brick?[.35,.20,.17]:[.29,.34,.33];
  const courses=3,step=.195,blocks=brick?4:3;
  for(let row=0;row<courses;row++){
   const yy=y+.13+row*step;
   const size=.93/blocks;
   for(let col=0;col<blocks+1;col++){
    const center=-.465+(col+.5)*size+(row%2?size*.37:0);
    const start=Math.max(-.466,center-size*.46),finish=Math.min(.466,center+size*.46);
    if(start>=finish)continue;
    const tone=brick?(row+col)%3===0?[.66,.32,.25]:c.shell.map(v=>v*.98):
      (row+col)%3===0?[.62,.65,.61]:c.shell;
    cube(m,x+(start+finish)/2,yy,z+.443,finish-start,.17,.032,tone);
   }
   cube(m,x,yy+step-.02,z+.46,.93,.017,.013,joints);
  }
 }else if(wood||material==='plasterwall'){
  for(const xx of [-.32,0,.32])cube(m,x+xx,y+.13,z+.44,.045,.60,.035,c.edge);
  for(const yy of [.16,.63])cube(m,x,yy,z+.445,.91,.05,.035,c.frame);
  if(wood)for(const xx of [-.31,0,.31])cube(m,x+xx,y+.20,z+.461,.25,.39,.023,[.57,.37,.21]);
  if(material==='plasterwall')for(const xx of [-.44,.44])cube(m,x+xx,y+.12,z+.461,.05,.62,.031,[.54,.41,.29]);
 }else if(iron){
  for(const xx of [-.30,.30])cube(m,x+xx,y+.12,z+.445,.035,.62,.03,c.edge);
  for(const yy of [.19,.63])cube(m,x,yy,z+.445,.88,.042,.03,c.frame);
  for(const xx of [-.42,.42])for(const yy of [.22,.59])cube(m,x+xx,y+yy,z+.46,.052,.045,.025,[.79,.72,.49]);
 }else{
  for(const xx of [-.32,0,.32])cube(m,x+xx,y+.13,z+.442,.035,.60,.031,c.edge);
  for(const yy of [.16,.63])cube(m,x,yy,z+.443,.92,.043,.033,c.frame);
  if(material==='mosswall')for(const xx of [-.31,.33])cube(m,x+xx,y+.48,z+.46,.12,.15,.026,[.29,.48,.29]);
 }
 // Matching top with an overhang, light rim and subtle upper inset.
 cube(m,x,y+.82,z,1.0,.135,.95,countertop);
 cube(m,x,y+.823,z+.469,1.0,.075,.045,c.frame);
 cube(m,x,y+.961,z-.015,.91,.023,.85,c.detail);
 cube(m,x,y+.085,z+.475,.85,.04,.037,c.edge);
}
function deco(m,id,x,y,z,r=0){
 if(MATCHED_COUNTER_IDS.has(id)){
  if(!r){matchedCounter(m,id,x,y,z);return}
  const tmp=mesh();matchedCounter(tmp,id,x,y,z);
  for(let i=0;i<tmp.p.length;i+=3){
   const [xx,zz]=rot2(tmp.p[i]-x,tmp.p[i+2]-z,r),[nx,nz]=rot2(tmp.n[i],tmp.n[i+2],r);
   m.p.push(x+xx,tmp.p[i+1],z+zz);
   m.n.push(nx,tmp.n[i+1],nz);
   m.c.push(tmp.c[i],tmp.c[i+1],tmp.c[i+2]);
  }
  return;
 }
 if(MATCHED_OPENING_IDS.has(id)){
  if(!r){matchedOpening(m,id,x,y,z);return}
  const temp=mesh();matchedOpening(temp,id,x,y,z);
  for(let i=0;i<temp.p.length;i+=3){
   const [xx,zz]=rot2(temp.p[i]-x,temp.p[i+2]-z,r),[nx,nz]=rot2(temp.n[i],temp.n[i+2],r);
   m.p.push(x+xx,temp.p[i+1],z+zz);
   m.n.push(nx,temp.n[i+1],nz);
   m.c.push(temp.c[i],temp.c[i+1],temp.c[i+2]);
  }
  return;
 }
 if(MATERIAL_FIXTURE_IDS.has(id)){
  if(!r){materialFixture(m,id,x,y,z);return}
  const tmp=mesh();materialFixture(tmp,id,x,y,z);
  for(let i=0;i<tmp.p.length;i+=3){const [xx,zz]=rot2(tmp.p[i]-x,tmp.p[i+2]-z,r);const [nx,nz]=rot2(tmp.n[i],tmp.n[i+2],r);m.p.push(x+xx,tmp.p[i+1],z+zz);m.n.push(nx,tmp.n[i+1],nz);m.c.push(tmp.c[i],tmp.c[i+1],tmp.c[i+2])}
  return;
 }
 if(isWallId(id)){wallBlock(m,id,x,y,z,r);return}
 // Rotate all fixed-prop geometry in world space. Custom models already rotate in addPart.
 if(!r||models.some(model=>model.id===id)){decoBase(m,id,x,y,z,r);return}
 const tmp=mesh();decoBase(tmp,id,x,y,z,0);
 for(let i=0;i<tmp.p.length;i+=3){
  const [vx,vz]=rot2(tmp.p[i]-x,tmp.p[i+2]-z,r);
  const [nx,nz]=rot2(tmp.n[i],tmp.n[i+2],r);
  m.p.push(x+vx,tmp.p[i+1],z+vz);
  m.n.push(nx,tmp.n[i+1],nz);
  m.c.push(tmp.c[i],tmp.c[i+1],tmp.c[i+2]);
 }
}
// Deterministic micro-variation: stable between reloads and map rotations.
function surfaceNoise(x,z){const n=Math.sin(x*127.1+z*311.7)*43758.5453;return n-Math.floor(n)}
function smoothSurfaceNoise(x,z){
 const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz;
 const sx=fx*fx*(3-2*fx),sz=fz*fz*(3-2*fz);
 const a=surfaceNoise(ix,iz)*(1-sx)+surfaceNoise(ix+1,iz)*sx;
 const b=surfaceNoise(ix,iz+1)*(1-sx)+surfaceNoise(ix+1,iz+1)*sx;
 return a*(1-sz)+b*sz;
}

const ROAD_BASES=["roadDirt","roadGravel","roadMoss","roadMud","roadCobble","roadCutStone","roadBrick","roadPlank","roadBroken","roadAncient","roadBasalt","roadRoyal"];
const ROAD_DIAGONALS=new Set(['roadDirtDiagA','roadDirtDiagB','roadGravelDiagA','roadGravelDiagB']);
const ROAD_IDS=new Set([...ROAD_BASES,...ROAD_BASES.map(id=>id+"Full"),...ROAD_DIAGONALS]);
const baseRoad=id=>id.endsWith("Full")?id.slice(0,-4):id;
const ROAD_COLORS=[
 [[.43,.32,.23],[.58,.45,.30]],[[.46,.44,.39],[.67,.65,.57]],
 [[.30,.40,.30],[.52,.62,.42]],[[.26,.27,.25],[.45,.37,.30]],
 [[.38,.41,.40],[.72,.73,.68]],[[.43,.46,.45],[.79,.79,.73]],
 [[.42,.27,.22],[.70,.36,.28]],[[.34,.25,.16],[.68,.46,.29]],
 [[.34,.39,.35],[.65,.69,.62]],[[.38,.43,.37],[.69,.74,.66]],
 [[.18,.20,.22],[.42,.44,.46]],[[.59,.54,.44],[.90,.84,.67]]
];
function roadConnections(floors,x,z,id){
 return (floors.get(x+','+(z-1))===id?1:0)|
 (floors.get((x+1)+','+z)===id?2:0)|
 (floors.get(x+','+(z+1))===id?4:0)|
 (floors.get((x-1)+','+z)===id?8:0);
}
function roadDiagonalConnections(floors,x,z,id){
 const gravel=id.startsWith('roadGravel');
 const match=(dx,dz)=>{
  const t=floors.get((x+dx)+','+(z+dz));
  return t&&(t.startsWith(gravel?'roadGravel':'roadDirt'))?1:0;
 };
 return match(0,-1)|match(1,0)<<1|match(0,1)<<2|match(-1,0)<<3|
  match(1,-1)<<4|match(1,1)<<5|match(-1,1)<<6|match(-1,-1)<<7;
}
// Shoreline is drawn flush with the land instead of raised box-like banks.
function shoreline(m,x,z,floors){
 const water=t=>['river','water','lake','sea'].includes(t);
 if(water(floors.get(x+','+z)))return;
 const dirs=[[0,-1],[1,0],[0,1],[-1,0]];
 const has=dirs.map(([dx,dz])=>water(floors.get((x+dx)+','+(z+dz))));
 if(!has.some(Boolean))return;
 const sand=[.53,.50,.35],mud=[.40,.38,.27],grass=[.33,.48,.29];
 // Bands edge-inward: slightly irregular, but no geometry exceeds tile borders.
 for(let side=0;side<4;side++)if(has[side]){
  for(let i=0;i<3;i++){
   const a=i/3,b=(i+1)/3,variation=.04*Math.sin((x*7+z*11+i*3+side*5)*.8);
   const w=.09+variation,span=.33;
   if(side===0)roadRect(m,x,z,a,0,b,span+w,.018,i%2?sand:mud);
   if(side===2)roadRect(m,x,z,a,1-span-w,b,1,.018,i%2?sand:mud);
   if(side===1)roadRect(m,x,z,1-span-w,a,1,b,.018,i%2?sand:mud);
   if(side===3)roadRect(m,x,z,0,a,span+w,b,.018,i%2?sand:mud);
  }
  const stripe=.022;
  if(side===0)roadRect(m,x,z,0,.28,1,.28+stripe,.021,grass);
  if(side===2)roadRect(m,x,z,0,.70,1,.70+stripe,.021,grass);
  if(side===1)roadRect(m,x,z,.70,0,.70+stripe,1,.021,grass);
  if(side===3)roadRect(m,x,z,.28,0,.28+stripe,1,.021,grass);
 }
}

function roadRect(m,x,z,l,t,r,b,h,c){
 quad(m,[x+l,h,z+t],[x+l,h,z+b],[x+r,h,z+b],[x+r,h,z+t],c);
}
function roadTile(m,x,z,id,mask,area){
 if(ROAD_DIAGONALS.has(id)){
  const gravel=id.startsWith('roadGravel'),tone=gravel?[.60,.57,.49]:[.52,.41,.30],trim=gravel?[.45,.44,.39]:[.40,.33,.25];
  const natural=gravel?[.38,.52,.34]:[.35,.50,.31];
  roadRect(m,x,z,0,0,1,1,0,natural);
  // One continuous clipped strip per link, with an inset center cap.
  // Neighbor masks contain N E S W NE SE SW NW (bits 0..7).
  const dirs=[[0,-1],[1,0],[0,1],[-1,0],[1,-1],[1,1],[-1,1],[-1,-1]];
  const clip=(poly,axis,bound,keepGreater)=>{
   const out=[],inside=p=>keepGreater?p[axis]>=bound-1e-9:p[axis]<=bound+1e-9;
   for(let i=0;i<poly.length;i++){
    const p=poly[i],q=poly[(i+1)%poly.length],a=inside(p),b=inside(q);
    if(a)out.push(p);
    if(a!==b){const t=(bound-p[axis])/(q[axis]-p[axis]);out.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);}
   }
   return out;
  };
  const paint=(p,color,h)=>{
   for(const [axis,v,greater] of [[0,0,true],[0,1,false],[1,0,true],[1,1,false]])p=clip(p,axis,v,greater);
   if(p.length<3)return;
   for(let j=1;j<p.length-1;j++)tri(m,[x+p[0][0],h,z+p[0][1]],[x+p[j][0],h,z+p[j][1]],[x+p[j+1][0],h,z+p[j+1][1]],color);
  };
  const cap=(radius,c,h)=>{
   const p=[];for(let i=11;i>=0;i--){const ang=i*Math.PI/6;p.push([.5+radius*Math.cos(ang),.5+radius*Math.sin(ang)]);}paint(p,c,h);
  };
  // A little earth underneath avoids hairline cracks on mobile GPUs.
  cap(.33,trim,.055);cap(.285,tone,.115);
  for(let i=0;i<8;i++){
   if(!(mask&(1<<i)))continue;
   const [dx,dz]=dirs[i],length=Math.hypot(dx,dz),nx=-dz/length,nz=dx/length;
   const rect=(half)=>[[.5+nx*half,.5+nz*half],[.5+dx+nx*half,.5+dz+nz*half],
    [.5+dx-nx*half,.5+dz-nz*half],[.5-nx*half,.5-nz*half]];
   paint(rect(.34),trim,.055);paint(rect(.285),tone,.115);
  }
  return;
 }
 const full=id.endsWith('Full'),base=baseRoad(id),idx=ROAD_BASES.indexOf(base);
 const [grout,color]=ROAD_COLORS[idx],grass=(base==='roadMoss'||base==='roadAncient')?[.35,.48,.34]:[.43,.57,.39];
 roadRect(m,x,z,0,0,1,1,0,grass);
 // Small irregular grass and earth flecks break up the straight verge.
 if(!full&&['roadDirt','roadGravel','roadMoss','roadMud','roadBroken'].includes(base)){
  for(let i=0;i<4;i++){
   const noise=surfaceNoise(x*13+i*7,z*19-i*11);
   if(noise<.37)continue;
   const a=.07+(i%2)*.79,b=.07+Math.floor(i/2)*.79;
   roadRect(m,x,z,a,b,a+.075+noise*.07,b+.035,.021,
     noise>.7?[.46,.43,.31]:[.37,.51,.32]);
  }
 }
 // Disjoint subcells prevent Z-fighting at corners and intersections.
 const cuts=full?[0,1]:[0,.34,.66,1],cnt=cuts.length-1;
 const on=(i,j)=>full||(i===1&&j===1)||(i===1&&j===0&&!!(mask&1))||
   (i===2&&j===1&&!!(mask&2))||(i===1&&j===2&&!!(mask&4))||(i===0&&j===1&&!!(mask&8));
 for(let j=0;j<cnt;j++)for(let i=0;i<cnt;i++){
  if(!on(i,j))continue;
  const a=cuts[i],b=cuts[j],cc=cuts[i+1],d=cuts[j+1];
  const left=i>0&&on(i-1,j),right=i<cnt-1&&on(i+1,j);
  const up=j>0&&on(i,j-1),down=j<cnt-1&&on(i,j+1);
  // A narrow gravel/soil perimeter separates paving from grass.
  const edge=.036,il=a+(left?0:edge),ir=cc-(right?0:edge),it=b+(up?0:edge),ib=d-(down?0:edge);
  if(ir-il<.04||ib-it<.04)continue;
  roadRect(m,x,z,il,it,ir,ib,.035,grout);
  const inset=.010,seed=surfaceNoise(x*12+i*7,z*15+j*5);
  roadRect(m,x,z,il+inset,it+inset,ir-inset,ib-inset,.13,
    color.map(n=>Math.min(1,n*(.88+.17*seed))));
  if(area<=4096){
   if(['roadCobble','roadCutStone','roadBrick','roadBroken','roadAncient','roadBasalt','roadRoyal'].includes(base)){
    const mid=(il+ir)/2;
    roadRect(m,x,z,mid-.006,it+.02,mid+.006,ib-.02,.15,grout);
    if(full)for(let k=1;k<4;k++){const zz=it+(ib-it)*k/4;roadRect(m,x,z,il+.015,zz-.006,ir-.015,zz+.006,.15,grout)}
   }else if(base==='roadPlank'){
    for(let k=1;k<=3;k++){const xx=il+(ir-il)*k/4;roadRect(m,x,z,xx-.006,it+.02,xx+.006,ib-.02,.15,grout)}
   }else if(seed>.7){
    const xx=il+(ir-il)*.35,zz=it+(ib-it)*.6;
    roadRect(m,x,z,xx,zz,xx+.018,zz+.018,.15,grout);
   }
  }
 }
}

function addFloorTile(m,x,z,kind,area=256,roadMask=0){if(ROAD_IDS.has(kind)){roadTile(m,x,z,kind,roadMask,area);return;}
const r=.25+smoothSurfaceNoise(x*.16,z*.16)*.55+smoothSurfaceNoise(x*.42+13,z*.42-7)*.20;
const c=kind==='earth'?[.43+r*.09,.35+r*.07,.25+r*.05]:kind==='moss'?[.33+r*.07,.49+r*.08,.31+r*.05]:kind==='stone'?[.55+r*.07,.58+r*.08,.53+r*.06]:kind==='woodfloor'?[.51+r*.05,.39+r*.07,.26+r*.04]:kind==='woodfloorLight'?[.70+r*.05,.55+r*.07,.37+r*.04]:kind==='woodfloorDark'?[.30+r*.05,.21+r*.04,.13+r*.03]:kind==='brickfloor'?[.40+r*.045,.23+r*.03,.19+r*.02]:
kind==='basicfloor'?[.75+r*.045,.77+r*.035,.70+r*.035]:
kind==='plasterfloor'?[.86+r*.038,.82+r*.035,.70+r*.025]:
kind==='mossfloor'?[.42+r*.055,.52+r*.055,.41+r*.035]:
kind==='ironfloor'?[.37+r*.045,.42+r*.045,.45+r*.035]:
kind==='water'?[.21+r*.035,.57+r*.045,.70+r*.04]:
kind==='river'?[.16+r*.04,.46+r*.05,.65+r*.045]:
kind==='lake'?[.15+r*.03,.43+r*.045,.53+r*.04]:
kind==='sea'?[.10+r*.02,.30+r*.035,.56+r*.05]:
 kind==='grassTuft'?[.34+r*.08,.52+r*.09,.29+r*.06]:
kind==='grassFlowers'?[.39+r*.07,.54+r*.09,.31+r*.07]:
kind==='grassPebbles'?[.36+r*.09,.49+r*.09,.29+r*.06]:
kind==='grassPatch'?[.39+r*.08,.46+r*.07,.28+r*.05]:
kind==='grassWeeds'?[.28+r*.07,.44+r*.07,.26+r*.05]:
kind==='grassTrampled'?[.46+r*.06,.48+r*.07,.29+r*.04]:
kind==='grassMeadow'?[.36+r*.09,.54+r*.11,.29+r*.07]:
 kind==='grassWild'?[.34+r*.10,.47+r*.10,.27+r*.07]:
 kind==='grassForest'?[.25+r*.08,.40+r*.09,.24+r*.06]:
 kind==='grassDry'?[.49+r*.11,.54+r*.09,.29+r*.06]:
 [.33+r*.13,.56+r*.12,.30+r*.09];const groutColor=kind==='stone'?[.36,.40,.38]:kind==='brickfloor'?[.35,.31,.28]:
['woodfloor','woodfloorLight','woodfloorDark'].includes(kind)?[.30,.25,.20]:
kind==='ironfloor'?[.24,.28,.31]:kind==='mossfloor'?[.32,.41,.33]:
kind==='plasterfloor'?[.63,.60,.53]:kind==='basicfloor'?[.51,.55,.51]:null;
if(groutColor)c.splice(0,3,...groutColor);
const x0=x+.006,x1=x+.994,z0=z+.006,z1=z+.994;
quad(m,[x0,0,z0],[x0,0,z1],[x1,0,z1],[x1,0,z0],c);
// Baked-in lightweight vegetation details: deterministic, sparse and non-colliding.
const naturalGrass=new Set(['grass','grassMeadow','grassWild','grassForest','grassDry',
 'grassTuft','grassFlowers','grassPebbles','grassPatch','grassWeeds','grassTrampled']);
if(naturalGrass.has(kind)&&area<=16384){
 const n=surfaceNoise(x*13+7,z*19+3),n2=surfaceNoise(x*23+5,z*17+11);
 const isFlower=kind==='grassFlowers'||(kind==='grassMeadow'&&n>.91);
 const isStony=kind==='grassPebbles'||(kind==='grassForest'&&n>.93);
 const isPatch=kind==='grassPatch'||kind==='grassTrampled';
 const count=['grassTuft','grassWeeds','grassFlowers'].includes(kind)?3:
  kind==='grass'? (n>.72?1:0):n>.53?2:1;
 if(isPatch){
  const soil=[.45,.36,.25];
  for(let i=0;i<2;i++){
   const dx=.20+i*.37,dz=.30+(i%2)*.29;
   quad(m,[x+dx-.12,.009,z+dz-.09],[x+dx-.10,.009,z+dz+.10],
    [x+dx+.13,.009,z+dz+.08],[x+dx+.14,.009,z+dz-.08],soil);
  }
 }
 for(let i=0;i<count;i++){
  const a=surfaceNoise(x*11+i*7,z*23+i*5),b=surfaceNoise(x*29+i*13,z*9+i*17);
  const xx=x+.15+a*.70,zz=z+.15+b*.70;
  if(isStony&&i===0){
   diamond(m,xx,.045,zz,.065,[.58,.60,.54]);continue;
  }
  const green=i%2?[.31,.50,.26]:[.28,.43,.24];
  const height=.055+.055*a;
  cube(m,xx,.012,zz,.025,height,.025,green);
  if(isFlower&&i===1)diamond(m,xx,.045+height,zz,.035,n2>.5?[.85,.70,.43]:[.82,.62,.69]);
 }
}

if(kind==='grass'&&area<=1024){const rr=Math.abs(Math.sin(x*44.3+z*27.8));if(rr>.25){cube(m,x+.30,.005,z+.32,.05,.12,.05,[.26,.49,.24]);cube(m,x+.69,.005,z+.65,.035,.09,.045,[.34,.57,.30])}}
if(['water','river','lake','sea'].includes(kind)){
 // Surface-only water tiles, deliberately flat so existing world editing remains unchanged.
 // Neighboring tiles share their colored edge. Short wavelets are static and low-poly.
 const wave=kind==='sea'?[.36,.56,.76]:kind==='lake'?[.36,.63,.65]:kind==='river'?[.44,.73,.79]:[.55,.83,.85];
 const count=kind==='sea'?4:kind==='river'?3:kind==='lake'?2:3;
 for(let i=0;i<count;i++){
  const seed=Math.abs(Math.sin((x+1)*17.31+(z+2)*23.19+i*9.8));
  const wx=x+.16+((i*.293+seed*.31)%.66);
  const wz=z+.17+((i*.211+seed*.41)%.66);
  const length=(kind==='river'?.25:.12)+seed*.12;
  const dx=kind==='river'?.026:length, dz=kind==='river'?length:.026;
  cube(m,wx,.006,wz,dx,.008,dz,wave);
 }
}
if(kind==='earth'){cube(m,x+.2,.009,z+.7,.10,.022,.07,[.54,.42,.29]);cube(m,x+.65,.009,z+.25,.14,.017,.06,[.48,.36,.22])}
if(kind==='moss'){diamond(m,x+.31,.06,z+.25,.14,[.59,.65,.57]);cube(m,x+.70,.015,z+.67,.23,.05,.17,[.29,.49,.28])}
if(kind==='stone'){
 // Stable, non-self-intersecting paved-stone mesh. Rectangular slabs do not
 // overlap each other, and mortar remains a separate base layer.
 // The previous per-corner jitter could cause dark triangular artifacts on
 // mobile WebGL when the floor was viewed at shallow angles.
 for(let row=0;row<3;row++)for(let col=-1;col<4;col++){
  const shift=(row%2)*.165;
  const left=Math.max(.014,col/3+shift+.013);
  const right=Math.min(.986,(col+1)/3+shift-.013);
  if(right-left<.035)continue;
  const front=row/3+.014,back=(row+1)/3-.014;
  const seed=surfaceNoise(x*11+col*7,z*13+row*3);
  const tone=[.52+seed*.17,.55+seed*.16,.51+seed*.13];
  // One perfectly planar quad for each stone. No randomized vertex positions.
  const yTop=.13;
  quad(m,[x+left,yTop,z+front],[x+left,yTop,z+back],
       [x+right,yTop,z+back],[x+right,yTop,z+front],tone);
  // Small surface chips are inset to avoid crossing neighbouring stone edges.
  if(seed>.85&&right-left>.18){
   const px=x+left+(right-left)*.31,pz=z+front+(back-front)*.45;
   quad(m,[px,.17,pz],[px+.025,.17,pz+.011],
        [px+.042,.17,pz+.036],[px-.006,.17,pz+.029],[.43,.47,.45]);
  }
 }
}
if(kind==='basicfloor'||kind==='plasterfloor'||kind==='mossfloor'||kind==='ironfloor'){
 const mortar=kind==='basicfloor'?[.45,.49,.46]:kind==='plasterfloor'?[.64,.59,.51]:kind==='mossfloor'?[.28,.39,.31]:[.20,.25,.29];
 const base=kind==='basicfloor'?[.76,.78,.72]:kind==='plasterfloor'?[.86,.82,.72]:kind==='mossfloor'?[.48,.57,.46]:[.43,.48,.52];
 // Inset stone slabs, lime plaster squares or riveted plates. Keep shallow relief.

 for(let rz=0;rz<2;rz++)for(let rx=0;rx<2;rx++){
  const rand=surfaceNoise(x*2+rx,z*2+rz);
  const light=.91+rand*.16,shade=base.map(v=>Math.min(1,v*light));
  const l=x+.012+rx*.49,r=l+.475,t=z+.012+rz*.49,b=t+.475;
  quad(m,[l,.13,t],[l,.13,b],[r,.13,b],[r,.13,t],shade);
  if(kind==='ironfloor'){
   for(const [px,pz] of [[l+.045,t+.045],[r-.045,t+.045],[l+.045,b-.045],[r-.045,b-.045]])
    cube(m,px,.16,pz,.026,.018,.026,[.68,.68,.60]);
   // Subtle rolled-steel crease, not a thick raised object.
   if(area<=2048)cube(m,(l+r)/2,.16,(t+b)/2,.008,.009,.28,[.34,.39,.43]);
  }else if(kind==='mossfloor'&&rand>.42){
   const cx=l+.11+rand*.18,cz=t+.08+rand*.23;
   quad(m,[cx,.17,cz],[cx+.12,.17,cz-.02],[cx+.18,.17,cz+.07],[cx+.02,.17,cz+.09],[.28,.46,.30]);
  }else if(kind==='basicfloor'&&rand>.72&&area<=2048){
   cube(m,l+.13,.16,t+.21,.16,.010,.008,[.60,.63,.59]);
  }
 }
}
if(kind==='brickfloor'){
 // Interleaved rectangular bricks; mortar remains visible between courses.
 const mortar=[.34,.32,.29],brick=[[.57,.28,.23],[.64,.32,.25],[.53,.25,.21],[.68,.36,.28]];

 for(let row=0;row<4;row++)for(let k=-1;k<5;k++){
  const shift=row%2?.125:0,left=k*.25+shift+.012,right=(k+1)*.25+shift-.012;
  const l=Math.max(.009,left),r=Math.min(.991,right);
  if(r-l<.025)continue;
  const r0=row*.25+.012,r1=(row+1)*.25-.012;
  const shade=brick[(row*3+k+20)%brick.length].map(v=>Math.min(1,v*(.94+surfaceNoise(x*5+k,z*5+row)*.12)));
  quad(m,[x+l,.13,z+r0],[x+l,.13,z+r1],[x+r,.13,z+r1],[x+r,.13,z+r0],shade);
 }
}
if(kind==='woodfloor'||kind==='woodfloorLight'||kind==='woodfloorDark'){
 // Actual staggered planks with narrow dark seams and varied grain, not stripes.
 const plank=kind==='woodfloorLight'?[.70,.52,.32]:kind==='woodfloorDark'?[.30,.21,.14]:[.53,.37,.23];
 const seam=plank.map(v=>v*.52);

 for(let row=0;row<4;row++){
  const z0=z+.012+row*.245,z1=z+(row+1)*.245-.006;
  const cut=row%2?.59:.39;
  for(const [l,r] of [[.012,cut-.010],[cut+.010,.988]]){
   const v=surfaceNoise(x*7+row*2+l*10,z*3+row),tone=.88+v*.20;
   const color=plank.map(n=>Math.min(1,n*tone));
   quad(m,[x+l,.13,z0],[x+l,.13,z1],[x+r,.13,z1],[x+r,.13,z0],color);
   if(area<=2048){
    const grain=plank.map(n=>n*.80);
    const gZ=z0+.045+(v*.06);
    quad(m,[x+l+.05,.17,gZ],[x+l+.05,.17,gZ+.009],
      [x+r-.06,.17,gZ+.009],[x+r-.06,.17,gZ],grain);
   }
  }
 }
}
}

const SIGN_TYPES=['innSign','shopHerbSign','shopChestSign','shopBagSign','pineSuperLogo'];
const signTextures=new Map();
function makeSignArtwork(id){
 const c=document.createElement('canvas');c.width=id==='pineSuperLogo'?768:256;c.height=160;
 const a=c.getContext('2d');
 a.clearRect(0,0,256,160);
 a.textAlign='center';a.textBaseline='middle';
 if(id==='pineSuperLogo'){
  a.fillStyle='#1d503f';a.fillRect(0,0,768,160);
  a.fillStyle='#e8ce8e';a.beginPath();a.arc(84,80,55,0,Math.PI*2);a.fill();
  a.strokeStyle='#1a4e40';a.lineWidth=9;a.lineCap='round';
  a.beginPath();a.moveTo(84,122);a.lineTo(84,46);a.stroke();
  for(let i=0;i<3;i++){const y=50+i*22;a.beginPath();a.moveTo(84,y+21);a.lineTo(61,y-1);a.moveTo(84,y+21);a.lineTo(108,y-1);a.stroke()}
  a.textAlign='left';a.font='900 88px system-ui,sans-serif';a.fillStyle='#fff6d9';a.fillText('PINE MART',157,87);
  a.font='bold 24px system-ui,sans-serif';a.fillStyle='#d9e0be';a.fillText('SUPERMARKET',169,137);
 }else if(id==='innSign'){
  // Real 2D text drawn once by Canvas2D; no triangulated/voxel letters.
  a.font='900 93px Georgia, serif';a.lineJoin='round';a.lineWidth=5;
  a.strokeStyle='#402515';a.strokeText('INN',128,78);
  a.fillStyle='#ffe7a0';a.fillText('INN',128,78);
 }else if(id==='shopHerbSign'){
  a.strokeStyle='#b8e5a0';a.lineWidth=9;a.lineCap='round';
  a.beginPath();a.moveTo(127,140);a.quadraticCurveTo(134,78,125,19);a.stroke();
  a.fillStyle='#72c965';
  for(const [xx,yy,rx,ry,angle] of [[99,42,30,14,-.6],[156,55,31,15,.6],[99,84,35,16,-.5],[157,99,31,14,.5]]){
   a.save();a.translate(xx,yy);a.rotate(angle);a.beginPath();a.ellipse(0,0,rx,ry,0,0,Math.PI*2);a.fill();a.restore();
  }
 }else if(id==='shopChestSign'){
  a.fillStyle='#d9a94e';a.fillRect(45,62,166,71);
  a.fillStyle='#eac774';a.beginPath();a.moveTo(45,62);a.lineTo(65,33);a.lineTo(190,33);a.lineTo(211,62);a.closePath();a.fill();
  a.strokeStyle='#4c2916';a.lineWidth=8;a.strokeRect(46,63,164,70);
  a.beginPath();a.moveTo(47,63);a.lineTo(211,63);a.stroke();
  a.fillStyle='#75421f';a.fillRect(115,65,26,36);a.fillStyle='#ffe8a2';a.fillRect(122,75,12,16);
  for(const xx of [65,190]){a.fillStyle='#82501f';a.fillRect(xx-5,69,10,58)}
 }else{
  a.fillStyle='#e1bb7d';a.beginPath();
  a.moveTo(108,29);a.quadraticCurveTo(127,49,147,29);
  a.lineTo(161,45);a.quadraticCurveTo(220,130,169,138);
  a.quadraticCurveTo(128,150,87,138);a.quadraticCurveTo(37,130,94,45);
  a.closePath();a.fill();
  a.strokeStyle='#654026';a.lineWidth=8;a.stroke();
  a.strokeStyle='#fce8b7';a.lineWidth=8;a.beginPath();a.moveTo(109,35);a.quadraticCurveTo(128,49,145,35);a.stroke();
  a.fillStyle='#9b6a3c';a.fillRect(107,52,43,7);
 }
 return c;
}
function initSignTextures(){
 for(const id of SIGN_TYPES){
  const tex=gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D,tex);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,makeSignArtwork(id));
  signTextures.set(id,tex);
 }
 gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
}
function buildSignOverlay(){
 const groups=new Map(SIGN_TYPES.map(id=>[id,[]]));
 for(const o of world){
  if((hideUpper&&o.y>level)||!groups.has(o.type))continue;
  const data=groups.get(o.type),x=o.x+.5,z=o.z+.5,y=o.y*1.4+terrainY(o.x,o.z);
  for(const side of (o.type==='pineSuperLogo'?[1]:[-1,1])){
   const zz=side*.075;
   // Two-sided, readable from either face. Rotate quad around its board center.
   const corners=o.type==='pineSuperLogo'?[[-3.54,1.42,.583],[3.54,1.42,.583],[3.54,2.15,.583],[-3.54,2.15,.583]]:[[-.087,1.205,zz],[.453,1.205,zz],[.453,1.585,zz],[-.087,1.585,zz]];
   const vs=corners.map(([xx,yy,zz])=>{const [dx,dz]=rot2(xx,zz,o.rot||0);return[x+dx,y+yy,z+dz]});
   const uv=side>0?[[0,0],[1,0],[1,1],[0,1]]:[[1,0],[0,0],[0,1],[1,1]];
   for(const i of [0,1,2,0,2,3])data.push(...vs[i],...uv[i]);
  }
 }
 const out=[];
 for(const [id,data] of groups){
  if(!data.length)continue;
  const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);
  out.push({id,buf,count:data.length/5});
 }
 return out;
}
const signVert='attribute vec3 aPos;attribute vec2 aUV;uniform mat4 uMVP;varying vec2 vUV;void main(){gl_Position=uMVP*vec4(aPos,1.0);vUV=aUV;}';
const signFrag='precision mediump float;varying vec2 vUV;uniform sampler2D uTexture;void main(){vec4 c=texture2D(uTexture,vUV);if(c.a<0.12)discard;gl_FragColor=c;}';
let signProgram=null,signLoc=null,signOverlays=[];
function initSignProgram(){
 signProgram=gl.createProgram();
 gl.attachShader(signProgram,sh(gl.VERTEX_SHADER,signVert));
 gl.attachShader(signProgram,sh(gl.FRAGMENT_SHADER,signFrag));
 gl.linkProgram(signProgram);
 if(!gl.getProgramParameter(signProgram,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(signProgram));
 signLoc={p:gl.getAttribLocation(signProgram,'aPos'),uv:gl.getAttribLocation(signProgram,'aUV'),mvp:gl.getUniformLocation(signProgram,'uMVP'),tex:gl.getUniformLocation(signProgram,'uTexture')};
 initSignTextures();
}
function drawSignOverlays(vp){
 if(!signProgram||!signOverlays.length)return;
 gl.useProgram(signProgram);
 gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
 gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(-1,-1);
 gl.depthMask(false);gl.activeTexture(gl.TEXTURE0);gl.uniform1i(signLoc.tex,0);gl.uniformMatrix4fv(signLoc.mvp,false,vp);
 for(const o of signOverlays){
  gl.bindTexture(gl.TEXTURE_2D,signTextures.get(o.id));
  gl.bindBuffer(gl.ARRAY_BUFFER,o.buf);
  gl.enableVertexAttribArray(signLoc.p);gl.vertexAttribPointer(signLoc.p,3,gl.FLOAT,false,20,0);
  gl.enableVertexAttribArray(signLoc.uv);gl.vertexAttribPointer(signLoc.uv,2,gl.FLOAT,false,20,12);
  gl.drawArrays(gl.TRIANGLES,0,o.count);
 }
 gl.disableVertexAttribArray(signLoc.uv);gl.depthMask(true);gl.disable(gl.BLEND);gl.disable(gl.POLYGON_OFFSET_FILL);
 gl.useProgram(program);
}



// Residential roofing is generated per connected group, NOT per single roof tile.
// A complete rectangle has one ridge and continuous eaves. Odd footprints
// (especially cross gables) are partitioned into rectangular roof wings.
const RESIDENTIAL_ROOFS=new Set(['roofSteep','roofHip','roofCross','roofDormer','roofLean','roofThatchThick']);
function residentialRoofComponents(roofTiles){
 const look=new Map(roofTiles.map(o=>[o.x+','+o.z+','+o.y,o]));
 const seen=new Set(),groups=[];
 for(const o of roofTiles){
  const first=o.x+','+o.z+','+o.y;
  if(seen.has(first))continue;
  const q=[o],cells=[];seen.add(first);
  while(q.length){
   const a=q.pop();cells.push(a);
   for(const [dx,dz] of [[-1,0],[1,0],[0,-1],[0,1]]){
    const key=(a.x+dx)+','+(a.z+dz)+','+a.y,n=look.get(key);
    if(!n||seen.has(key)||n.type!==o.type||n.rot!==o.rot||terrainLevel(n.x,n.z)!==terrainLevel(o.x,o.z))continue;
    seen.add(key);q.push(n);
   }
  }
  groups.push(cells);
 }
 return groups;
}
function roofRectangles(cells){
 // Greedily assemble complete rows into maximal rectangles. This correctly
 // handles L-shaped houses without filling their open courtyard.
 const all=new Set(cells.map(p=>p.x+','+p.z)),rects=[];
 while(all.size){
  const coords=[...all].map(v=>v.split(',').map(Number)).sort((a,b)=>a[1]-b[1]||a[0]-b[0]);
  const [x,z]=coords[0];let width=1;
  while(all.has((x+width)+','+z))width++;
  let depth=1;
  while(true){
   let filled=true;
   for(let dx=0;dx<width;dx++)if(!all.has((x+dx)+','+(z+depth)))filled=false;
   if(!filled)break;depth++;
  }
  for(let dz=0;dz<depth;dz++)for(let dx=0;dx<width;dx++)all.delete((x+dx)+','+(z+dz));
  rects.push({x,z,w:width,d:depth});
 }
 return rects;
}
function residentialRoofGeometry(m,cells,allRoofLookup){
 if(!cells.length)return;
 const o=cells[0],id=o.type,r=o.rot||0;
 const base=o.y*1.4+.04+terrainY(o.x,o.z);
 const palette={
  roofSteep:[[.55,.29,.22],[.35,.20,.17]],
  roofHip:[[.57,.35,.27],[.34,.23,.20]],
  roofCross:[[.50,.29,.24],[.31,.20,.19]],
  roofDormer:[[.63,.35,.28],[.37,.23,.19]],
  roofLean:[[.48,.35,.25],[.30,.24,.20]],
  roofThatchThick:[[.67,.55,.32],[.44,.37,.21]]
 };
 const [c,trim]=palette[id],soft=c.map(v=>v*.91);
 const beam=(p,q,w,color)=>naturalBranch(m,p[0],p[1],p[2],q[0],q[1],q[2],w,w,color);
 const roofPart=(rect)=>{
  let {x,z,w,d}=rect;
  // On a fully shared townhouse boundary, withdraw the eaves to the party wall.
  // This prevents neighboring differently colored roofs from overlapping.
  const touches=(edge)=>{
   if(!allRoofLookup)return false;
   const coords=[];
   if(edge===0||edge===1)for(let dz=0;dz<d;dz++)coords.push([edge===0?x-1:x+w,z+dz]);
   else for(let dx=0;dx<w;dx++)coords.push([x+dx,edge===2?z-1:z+d]);
   return coords.every(([xx,zz])=>{
    const p=allRoofLookup.get(xx+','+zz+','+o.y);
    return p&&p.type!==o.type&&terrainLevel(xx,zz)===terrainLevel(o.x,o.z);
   });
  };
  const x0=x-(touches(0)?0:.13),x1=x+w+(touches(1)?0:.13),
        z0=z-(touches(2)?0:.13),z1=z+d+(touches(3)?0:.13);
  const midx=(x0+x1)/2,midz=(z0+z1)/2,wide=(r%2)===1;
  const half=wide?(z1-z0)/2:(x1-x0)/2;
  const peak=id==='roofLean'?.68:id==='roofThatchThick'?Math.min(1.5,.50+half*.24):Math.min(1.80,.57+half*.30);
  const p=(px,py,pz)=>[px,base+py,pz];
  if(id==='roofHip'){
   // Four sloping sides and a ridge along the longer axis.
   const ridgeOffset=Math.min((x1-x0),(z1-z0))*.28;
   if(x1-x0>=z1-z0){
    const a=p(x0+ridgeOffset,peak,midz),b=p(x1-ridgeOffset,peak,midz);
    quad(m,p(x0,0,z0),p(x1,0,z0),b,a,c);
    quad(m,a,b,p(x1,0,z1),p(x0,0,z1),soft);
    tri(m,p(x0,0,z0),a,p(x0,0,z1),c.map(v=>v*.94));
    tri(m,p(x1,0,z0),p(x1,0,z1),b,soft);
    beam(a,b,.056,trim);
   }else{
    const a=p(midx,peak,z0+ridgeOffset),b=p(midx,peak,z1-ridgeOffset);
    quad(m,p(x0,0,z0),a,b,p(x0,0,z1),c);
    quad(m,a,p(x1,0,z0),p(x1,0,z1),b,soft);
    tri(m,p(x0,0,z0),p(x1,0,z0),a,c);
    tri(m,p(x0,0,z1),b,p(x1,0,z1),soft);
    beam(a,b,.056,trim);
   }
  }else if(id==='roofLean'){
   const a=p(x0,.10,z0),b=p(x0,.10,z1),cc=p(x1,peak,z0),d1=p(x1,peak,z1);
   quad(m,a,b,d1,cc,c);
   beam(a,b,.045,trim);beam(cc,d1,.05,trim);
   quad(m,p(x0,0,z0),p(x1,0,z0),cc,a,trim);
   quad(m,p(x1,0,z1),p(x0,0,z1),b,d1,trim);
  }else{
   // Residential gable. A single continuous ridge replaces repeated
   // per-tile peaks and prevents a warehouse's sawtooth roof appearance.
   if(wide){
    const a=p(x0,0,z0),b=p(x1,0,z0),cc=p(midx,peak,z0);
    const d1=p(x0,0,z1),e=p(x1,0,z1),f=p(midx,peak,z1);
    quad(m,a,d1,f,cc,c);quad(m,cc,f,e,b,soft);
    tri(m,a,cc,b,trim);tri(m,d1,e,f,trim);
    beam(cc,f,.055,trim);
   }else{
    const a=p(x0,0,z0),b=p(x0,0,z1),cc=p(midx,peak,z0),d1=p(midx,peak,z1),e=p(x1,0,z0),f=p(x1,0,z1);
    quad(m,a,b,d1,cc,c);quad(m,cc,d1,f,e,soft);
    tri(m,a,cc,e,trim);tri(m,b,f,d1,trim);
    beam(cc,d1,.055,trim);
   }
  }
  // Continuous thin overhanging fascia. No per-cell crossbars.
  for(const [a,b] of [
   [p(x0,.015,z0),p(x1,.015,z0)],[p(x0,.015,z1),p(x1,.015,z1)],
   [p(x0,.015,z0),p(x0,.015,z1)],[p(x1,.015,z0),p(x1,.015,z1)]])beam(a,b,.033,trim);
  if(id==='roofThatchThick'){
   const thickness=.14;
   for(const px of [x0+.06,x1-.06])
    beam(p(px,-thickness,z0),p(px,-thickness,z1),.08,trim);
  }
  if(id==='roofDormer'&&w>=3&&d>=3){
   // Dormer projects from a roof slope with a real little pitched roof.
   const sx=wide?x0+.24*w:midx-half*.47;
   const zz=wide?midz-half*.47:z0+.38*d;
   const cx=Math.min(x1-.48,Math.max(x0+.48,sx));
   const cz=Math.min(z1-.48,Math.max(z0+.48,zz));
   const anchor=p(cx,peak*.49,cz),wall=[.81,.76,.65],pane=[.33,.53,.62];
   cube(m,anchor[0],anchor[1],anchor[2],.43,.40,.38,wall);
   cube(m,anchor[0],anchor[1]+.09,anchor[2]-.20,.26,.22,.035,pane);
   const top=p(cx,peak*.49+.67,cz);
   const la=p(cx-.30,peak*.49+.37,cz-.26),ra=p(cx+.30,peak*.49+.37,cz-.26);
   const lb=p(cx-.30,peak*.49+.37,cz+.25),rb=p(cx+.30,peak*.49+.37,cz+.25);
   quad(m,la,lb,top,p(cx,peak*.49+.67,cz-.26),c);
   quad(m,p(cx,peak*.49+.67,cz-.26),top,rb,ra,soft);
  }

  // Layered projecting eaves: exposed soffit and a thin contrasting fascia.
  const eave=.10;
  for(const [ax,az,bx,bz] of [[x0,z0,x1,z0],[x1,z0,x1,z1],[x1,z1,x0,z1],[x0,z1,x0,z0]]){
   const dx=bx-ax,dz=bz-az,len=Math.hypot(dx,dz);
   const cx=(ax+bx)/2,cz=(az+bz)/2;
   cube(m,cx,base-.105,cz,Math.abs(dx)>.01?len:.115,.085,Math.abs(dz)>.01?len:.115,trim);
   cube(m,cx,base-.018,cz,Math.abs(dx)>.01?len:.07,.025,Math.abs(dz)>.01?len:.07,c);
  }
  // Tile/shingle texture follows the roof slope without splitting the silhouette.
  // Small batches of thin ribs are capped to avoid excessive mobile geometry.
  if(id!=='roofLean'&&id!=='roofHip'){
   const count=Math.min(10,Math.max(2,Math.floor((wide?d:w)*1.6)));
   for(let k=1;k<count;k++){
    const t=k/count, sideX=wide?(x0+(x1-x0)*t):undefined;
    if(wide){
     const h=peak*t,zz0=z0+.06,zz1=z1-.06;
     // Crossing the ridge in narrow strips would look like a warehouse;
     // short color-accented slats stay on one slope.
     const col=k%2?trim:c.map(v=>v*.78);
     if(k<count/2)beam(p(sideX,h,zz0),p(sideX,h,zz1),.012,col);
    }else{
     const xx=x0+(midx-x0)*t,yy=peak*t,col=k%2?trim:c.map(v=>v*.78);
     beam(p(xx,yy+.006,z0+.09),p(xx,yy+.006,z1-.09),.010,col);
     beam(p(x1-(xx-x0),yy+.006,z0+.09),p(x1-(xx-x0),yy+.006,z1-.09),.010,col);
    }
   }
  }
  if(id==='roofHip'){
   for(let k=1;k<5;k++){
    const zz=z0+(z1-z0)*k/5;
    beam(p(x0+.12,.06,zz),p(x0+.48,peak*.65,zz),.010,trim);
    beam(p(x1-.12,.06,zz),p(x1-.48,peak*.65,zz),.010,trim);
   }
  }

  // Chimney as an integrated house silhouette detail.
  if(id==='roofSteep'&&w>=4&&d>=3){
   const cx=x0+.75,cz=z0+.9,yy=peak*.57;
   cube(m,cx,base+yy,cz,.31,.53,.32,[.49,.45,.40]);
   cube(m,cx,base+yy+.49,cz,.39,.09,.39,trim);
  }
 };
 for(const rect of roofRectangles(cells))roofPart(rect);
}

const AUTO_ROOFS=new Set(['roofTile','roofThatch','roofPlank']);
function roofFamily(id){
 if(/^roofTile(?:Ridge|End)?$/.test(id))return 'roofTile';
 if(/^roofThatch(?:Ridge|End)?$/.test(id))return 'roofThatch';
 if(/^roofPlank(?:Ridge|End)?$/.test(id))return 'roofPlank';
 return null;
}
// Roof joins are calculated from the current map, not stored in saved tiles.
/*__PINE_SHARED_ROOF_GEOMETRY__*//*__PINE_SHARED_WALL_FACADE__*//*__PINE_SHARED_BRIDGE_TYPES__*/function bridgeSpanElevation(o,lookup){
 const r=bridgeDirection(o.rot),dx=r%2?1:0,dz=r%2?0:1;
 // Find the approach bank along the bridge axis (not the sides).
 let h=terrainLevel(o.x,o.z);
 for(const sign of [-1,1])for(let n=1;n<=8;n++){
  const x=o.x+sign*dx*n,z=o.z+sign*dz*n;
  if(x<0||z<0||x>=MAP_W||z>=MAP_H)break;
  if(lookup.has(x+','+z))continue;
  h=Math.max(h,terrainLevel(x,z));break;
 }
 return h*TERRAIN_STEP;
}

function pineSuperVehicleType(t){return /^pineSuperCar(?:Mini|Van|SUV|Pickup)?$/.test(t)}
function pineSupermarketGeometry(m,o){
 const x=o.x+.5,z=o.z+.5,y=o.y*1.4+terrainY(o.x,o.z);
 const B=(dx,dy,dz,w,h,d,c)=>cube(m,x+dx,y+dy,z+dz,w,h,d,c);
 
  if(o.type.startsWith('pineSuper')){
   const ivory=[.84,.85,.81],glass=[.41,.63,.67],steel=[.32,.40,.42],
         pale=[.84,.86,.82],metal=[.55,.59,.59],wooden=[.47,.37,.28],dark=[.20,.25,.27];
   if(o.type==='pineSuperCorner'){
    B(0,0,0,.99,1.39,.99,ivory);
    for(const side of [-.34,.34])B(side,0,.43,.14,1.39,.14,[.38,.51,.45]);
    B(0,1.31,.42,.99,.11,.14,[.29,.47,.39]);
   }else if(o.type==='pineSuperProduceSlope'){
    B(0,.02,0,.85,.49,.80,wooden);
    for(let i=0;i<3;i++)B(0,.43+i*.10,-.24+i*.22,.83,.055,.21,[.37,.55,.38]);
    for(const xx of [-.40,.40])B(xx,.32,0,.04,.32,.78,steel);
   }else if(o.type==='pineSuperFreshCase'){
    B(0,.08,0,.95,.64,.77,pale);
    B(0,.67,.16,.94,.22,.52,glass);
    B(0,.86,-.20,.95,.08,.36,steel);
    B(0,.32,.42,.90,.11,.05,[.31,.50,.47]);
   }else if(o.type==='pineSuperShelfEnd'){
    B(0,.07,0,.89,.88,.47,steel);
    for(const h of [.26,.55,.91])B(0,h,.04,.86,.06,.45,wooden);
   }else if(o.type==='pineSuperPacking'){
    B(0,.73,0,.90,.08,.70,[.67,.66,.58]);
    for(const xx of [-.36,.36])B(xx,.08,0,.07,.65,.50,steel);
   }else if(o.type==='pineSuperRegisterGate'){
    B(-.34,.04,0,.10,.93,.10,steel);B(.34,.04,0,.10,.93,.10,steel);
    B(0,.92,0,.77,.10,.09,[.38,.54,.46]);
   }else if(o.type==='pineSuperWall'||o.type==='pineSuperAccent'){
    const c=o.type==='pineSuperAccent'?[.25,.46,.37]:[.82,.82,.75];
    B(0,0,0,1,1.39,1,c);
    B(0,1.31,.42,.99,.12,.13,[.34,.51,.42]);
   }else if(o.type==='pineSuperRoof'){
    // Single watertight roof slab: avoids coplanar top surfaces / z-fighting.
    B(0,-.015,0,.998,.155,.998,[.43,.46,.47]);
   }else if(o.type==='pineSuperLogo'){
    B(0,1.42,.52,7.4,.82,.10,[.17,.37,.30]);
    B(0,1.38,.581,7.30,.055,.025,[.83,.70,.41]);
   }else if(pineSuperVehicleType(o.type)){
    // All vehicle variants share the same base mesh and materials, avoiding duplicate renderers.
    const cm=mesh(),C=(dx,dy,dz,w,h,d,c)=>cube(cm,dx,dy,dz,w,h,d,c);
    const mini=o.type==='pineSuperCarMini',van=o.type==='pineSuperCarVan',
      suv=o.type==='pineSuperCarSUV',pickup=o.type==='pineSuperCarPickup';
    const hatch=mini||van||((o.x*7+o.z*11)&1)===0,aged=(o.x+o.z)%3===0;
    const paint=aged?[.41,.48,.46]:[.55,.36,.27],shadow=[.26,.28,.28],
      tyre=[.13,.14,.15],rim=[.44,.45,.42],window=[.19,.29,.31],
      bumper=[.32,.35,.34],light=[.78,.75,.62],red=[.57,.22,.18];
    C(0,.24,0,1.78,.44,2.76,paint); // steel body and low wheel arch
    C(0,.20,0,1.79,.22,2.62,shadow);
    C(0,.43,-.02,1.69,.31,2.47,paint);
    const back=hatch?-.92:-.72;
    C(0,.70,(back+.46)/2,1.49,.16,1.20,paint);
    // Raked windshield and rear glass (angled strips rather than square cab).
    const glassQuad=(zNear,zFar,bottom,top)=>{
      quad(cm,[-.68,bottom,zNear],[.68,bottom,zNear],[.60,top,zFar],[-.60,top,zFar],window);
    };
    glassQuad(.53,.29,.66,1.04);
    glassQuad(back-.12,back+.18,.65,1.03);
    C(0,1.01,(back+.30)/2,1.22,.095,hatch?1.09:.84,paint);
    for(const side of [-1,1]){
      // Side door windows, pillar separation and mirrors.
      C(side*.746,.80,-.14,.027,.31,.85,window);
      C(side*.78,.68,.59,.14,.09,.14,bumper);
      C(side*.71,.50,.15,.045,.015,.66,[.70,.63,.48]);
      for(const zWheel of [-.90,.90]){
        C(side*.83,.06,zWheel,.24,.37,.48,tyre);
        C(side*.96,.11,zWheel,.045,.17,.24,rim);
      }
      C(side*.65,.47,1.36,.30,.115,.056,light);
      C(side*.65,.43,-1.36,.30,.12,.056,red);
    }
    C(0,.38,1.40,1.61,.14,.12,bumper);
    C(0,.36,-1.40,1.61,.14,.12,bumper);
    C(0,.44,1.46,.43,.105,.015,[.63,.65,.61]); // license plate
    if(aged){
      C(-.35,.47,.98,.31,.009,.17,[.47,.28,.20]);
      C(.45,.43,-.93,.24,.009,.15,[.35,.28,.23]);
    }
    if(van){
      C(0,.58,-.28,1.60,.57,1.83,paint);
      C(0,1.13,-.30,1.58,.12,1.82,paint);
      for(const side of [-1,1])C(side*.81,.83,-.28,.025,.37,1.50,window);
    }else if(pickup){
      C(0,.51,-.86,1.56,.13,1.16,shadow);
      for(const side of [-1,1])C(side*.79,.48,-.86,.10,.24,1.15,paint);
      C(0,.51,-1.39,1.60,.26,.10,paint);
    }else if(suv){
      C(0,1.10,-.18,1.33,.12,1.15,paint);
      for(const side of [-1,1])C(side*.59,1.22,-.20,.055,.07,1.13,shadow);
    }
    const scaleX=mini?.82:van?1.0:1,scaleZ=mini?.84:van?1.05:pickup?1.05:1,scaleY=mini?.91:van?1.07:suv?1.12:1;
    const r=((o.rot||0)%4+4)%4;
    for(let i=0;i<cm.p.length;i+=3){
      const [dx,dz]=rot2(cm.p[i]*scaleX,cm.p[i+2]*scaleZ,r);
      const [nx,nz]=rot2(cm.n[i],cm.n[i+2],r);
      m.p.push(x+dx,y+cm.p[i+1]*scaleY,z+dz);
      m.n.push(nx,cm.n[i+1],nz);
      m.c.push(cm.c[i],cm.c[i+1],cm.c[i+2]);
    }
   }else if(o.type==='pineSuperGlass'||o.type==='pineSuperDoor'){
    B(0,.04,0,.97,.12,.92,ivory);
    for(const xx of [-.45,.45])B(xx,.14,0,.07,1.28,.08,steel);
    B(0,1.38,0,.97,.12,.09,steel);
    if(o.type==='pineSuperGlass'){
     // Stationary storefront glazing: no handles or moving leaf.
     B(0,.75,0,.83,1.13,.06,glass);
     B(0,.76,.04,.83,.034,.03,steel);
     B(0,.74,.04,.025,1.1,.018,pale);
    }else{
     // Only the center tile is walkable; teal canopy marks the sole public entrance.
     B(0,1.44,.07,1.78,.18,.42,[.22,.43,.37]);
     for(const xx of [-.22,.22])B(xx,.74,0,.40,1.12,.06,glass);
     for(const xx of [-.035,.035])B(xx,.77,.05,.022,.30,.02,metal);
    }
   }else if(o.type==='pineSuperShutter'){
    B(0,.65,0,.96,1.28,.12,metal);
    for(let i=0;i<9;i++)B(0,.13+i*.145,.076,.96,.025,.035,steel);
    B(0,1.39,0,.98,.15,.20,dark);
   }else if(['pineSuperShelf','pineSuperShelfEmpty','pineSuperShelfSparse','pineSuperShelfStocked'].includes(o.type)){
    const bare=o.type==='pineSuperShelfEmpty',sparse=o.type==='pineSuperShelfSparse',
      stocked=o.type==='pineSuperShelfStocked',hash=(o.x*37+o.z*91+o.y*13)>>>0;
    for(const h of [.19,.53,.87])B(0,h,0,.79,.065,.91,metal);
    for(const xx of [-.37,.37])B(xx,.04,0,.055,1.08,.91,steel);
    B(0,1.12,0,.81,.045,.94,wooden);
    // Cosmetic shelf contents only: no inventory items or interactions yet.
    const items=bare?0:sparse?2:stocked?9:o.type==='pineSuperShelf'?4:0;
    const colors=[[.69,.51,.32],[.44,.56,.37],[.71,.70,.55],[.52,.48,.66],[.68,.36,.30]];
    for(let i=0;i<items;i++){
      const h=[.255,.592,.925][i%3];
      const side=Math.floor(i/3)%3;
      const xx=[-.24,0,.24][side],zz=((hash+i*17)%3-1)*.21;
      const c=colors[(hash+i*7)%colors.length];
      B(xx,h,zz,.17,.12+(i%3)*.014,.13,c);
      if(i%2===0)B(xx,h+.095,zz,.17,.016,.13,[.73,.71,.62]);
    }
   }else if(o.type==='pineSuperCooler'){
    B(0,.04,0,.87,.81,.79,pale);
    B(0,.61,.36,.80,.28,.035,glass);
    B(0,.89,0,.91,.09,.81,steel);
   }else if(o.type==='pineSuperFreezer'){
    B(0,.05,0,.87,.61,.86,pale);
    B(0,.70,0,.84,.055,.82,glass);
    B(0,.74,0,.085,.025,.82,steel);
   }else if(o.type==='pineSuperCheckout'){
    B(0,.09,0,.91,.65,.53,steel);B(0,.76,0,.96,.065,.59,metal);
    B(-.30,.86,.05,.21,.17,.18,dark);B(.29,.84,-.13,.17,.13,.17,wooden);
   }else if(o.type==='pineSuperProduce'){
    B(0,.03,0,.81,.48,.78,wooden);
    B(0,.54,0,.87,.07,.84,steel);
   }else if(o.type==='pineSuperCart'){
    B(0,.40,0,.67,.29,.58,metal);B(0,.61,-.32,.72,.045,.07,steel);
    for(const xx of [-.27,.27])for(const zz of [-.22,.22])B(xx,.05,zz,.11,.12,.11,dark);
   }else if(o.type==='pineSuperStripe'){
    B(.43,.028,0,.075,.015,.99,[.86,.86,.80]);
   }else if(o.type==='pineSuperBayEnd'){
    B(0,.029,.43,.98,.015,.075,[.86,.86,.80]);
   }else if(o.type==='pineSuperCurb'){
    B(0,.035,0,.98,.17,.30,[.69,.69,.64]);
   }else if(o.type==='pineSuperSign'){
    B(0,1.55,0,.96,.48,.12,[.31,.51,.39]);
    for(const h of [1.50,1.66])B(0,h,.065,.72,.055,.02,pale);
   }else if(o.type==='pineSuperAC'){
    B(0,.08,0,.84,.60,.79,metal);
    for(let i=-2;i<=2;i++)B(i*.14,.39,.40,.05,.43,.02,dark);
   }else if(o.type==='pineSuperBollard'){
    for(const xx of [-.29,.29])B(xx,.03,0,.13,.39,.13,[.72,.65,.34]);
   }else if(o.type==='pineSuperRack'){
    for(const xx of [-.38,.38])for(const zz of [-.36,.36])B(xx,.05,zz,.06,1.24,.06,steel);
    for(const h of [.15,.58,1.11])B(0,h,0,.83,.06,.81,metal);
   }
   return;
  }

}

/*__PINE_SHARED_HARBOR_GEOMETRY__*/
/*__PINE_SHARED_LANDING_CRAFT_GEOMETRY__*/
function bridgeConnectedGeometry(m,o,lookup){
 const r=bridgeDirection(o.rot),wood=o.type.startsWith('bridgeWood'),end=o.type.endsWith('End');
 const axis=r%2===0,side=axis?[[1,0],[-1,0]]:[[0,1],[0,-1]];
 const along=axis?[[0,1],[0,-1]]:[[1,0],[-1,0]];
 const lookupAt=(dx,dz)=>lookup.get((o.x+dx)+','+(o.z+dz));
 const rail=side.map(([dx,dz])=>!bridgeAligned(o,lookupAt(dx,dz)));
 const first=!bridgeAligned(o,lookupAt(...along[0])),last=!bridgeAligned(o,lookupAt(...along[1]));
 // Position the top of the bridge deck just above the approach path.
 // The bridge has its own planks; never co-planar with underlying road tiles.
 const x=o.x+.5,z=o.z+.5,y=o.y*1.4+bridgeSpanElevation(o,lookup)-.30;
 const t=mesh(),B=(a,b,c,w,h,d,col)=>cube(t,a,b,c,w,h,d,col);
 const timber=[.51,.34,.21],highlight=[.66,.47,.29],dark=[.32,.24,.18],
 stone=[.60,.60,.57],cap=[.73,.72,.67];
 if(wood){
  B(0,.12,0,.985,.235,.985,dark);
  // Recessed plank seams avoid overlapping deck polygons at shared boundaries.
  for(let i=0;i<5;i++){const zz=-.40+i*.20;B(0,.27,zz,.972,.095,.183,i%2?timber:highlight);}
 }else{
  B(0,.08,0,.99,.29,.99,stone);
  B(0,.35,0,1,.10,1,cap);
  for(let i=0;i<4;i++){const zz=-.37+i*.25;B(0,.442,zz,.94,.016,.02,dark);}
 }
 const postColor=wood?timber:stone,topColor=wood?highlight:cap;
 for(let i=0;i<2;i++)if(rail[i]){
  const sx=i===0?.44:-.44;
  for(const zz of [-.40,.40])B(sx,.39,zz,.105,.54,.105,postColor);
  B(sx,.88,0,.10,.12,.99,topColor);
  if(!wood)B(sx,.40,0,.13,.42,.98,stone);
 }
 // Ends preserve walking access: no railing across the road.
 if(end){
  if(first)B(0,.26,-.47,.98,.07,.08,topColor);
  if(last)B(0,.26,.47,.98,.07,.08,topColor);
 }
 for(let i=0;i<t.p.length;i+=3){
  const [xx,zz]=rot2(t.p[i],t.p[i+2],r);
  const [nx,nz]=rot2(t.n[i],t.n[i+2],r);
  m.p.push(x+xx,y+t.p[i+1],z+zz);
  m.n.push(nx,t.n[i+1],nz);m.c.push(...t.c.slice(i,i+3));
 }
}

/*__PINE_SHARED_FENCE_GEOMETRY__*/