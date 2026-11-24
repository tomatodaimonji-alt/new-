from pathlib import Path
import sys
src,dst=map(Path,sys.argv[1:])
s=src.read_text()
def replace(a,b):
 global s
 if s.count(a)!=1: raise ValueError((s.count(a),a[:145]))
 s=s.replace(a,b,1)
replace('function poiDrawOrvasPlayerBeam(now,vp){','''function poiOrvasPortableBeamVisual(a,sockets){
 const m=mesh(),pass=poiAimWall({y:a.level});
 for(let i=0;i<2;i++){
  const r=a.rays[i],p=sockets[i];
  const end=r.visualEnd??Math.min(a.centerEnd??Infinity,r.visualLimit??r.end);
  if(!p||end<=.015)continue;
  // Preserve the committed impact; only reconnect the rendered filament
  // to its moving socket. A newly intervening solid can shorten it.
  const x=p[0]-.5,z=p[2]-.5,dx=r.x+a.d.x*end-x,dz=r.z+a.d.z*end-z;
  const length=Math.hypot(dx,dz);
  if(length<=.015)continue;
  const d={x:dx/length,z:dz/length},dy=((r.visualHeight??r.h)-p[1])/length;
  let clear=poiAimWallLimit({x,z,y:a.level},d,length,pass);
  if(typeof poiOrvasWallContact==='function'){
   const face=poiOrvasWallContact(x,p[1],z,d,clear,dy);
   if(face&&face.at<=clear)clear=Math.max(0,face.at-.008);
  }
  if(clear>.015)poiOrvasDualTube(m,p[0],p[2],d,0,clear,p[1],p[1]+dy*clear,0,false,false,true);
 }
 return m;
}
function poiDrawOrvasPlayerBeam(now,vp){''')
i=s.index(' if(!poiOrvasBeamGpu){',s.index('function poiDrawOrvasPlayerBeam('))
j=s.index(' const alpha=poiOrvasBeamAlpha(age);',i)
s=s[:i]+''' const sockets=poiWalkMesh?.orvasEyeSockets;
 if(!sockets)return;
 if(!a.visibleSockets||sockets.some((p,i)=>p.some((v,k)=>v!==a.visibleSockets[i][k]))){
  const m=poiOrvasPortableBeamVisual(a,sockets);
  a.visibleSockets=sockets;
  if(m.p.length)poiOrvasBeamGpu=upload(m,poiOrvasBeamGpu?.buf??null,gl.DYNAMIC_DRAW);
  else if(poiOrvasBeamGpu)poiOrvasBeamGpu.count=0;
 }
 if(!poiOrvasBeamGpu?.count)return;
'''+s[j:]
replace('''   const head=mesh();poiOrvasHeadGeometry(head,...poiOrvasTrophyBase([gx,gy,gz]),pose?.orvasHeadArt);
   poiOrvasAppendRigid(m,head,rotate,x,y,z);return m;''','''   const head=mesh(),base=poiOrvasTrophyBase([gx,gy,gz]),art=pose?.orvasHeadArt;
   poiOrvasHeadGeometry(head,...base,art);
   // The diamond-shaped red lens protrudes slightly from the socket.
   // Place the emitter just on that surface, in the exact same transform.
   m.orvasEyeSockets=POI_ORVAS_EYES.map(e=>{
    const p=poiDavidHeadPoint([e[0],e[1]+POI_ORVAS_HEAD_BASE,e[2]+.013],art);
    const [u,v]=rotate(base[0]+p[0],base[2]+p[2]);
    return [x+u,y+base[1]+p[1]-POI_ORVAS_HEAD_BASE,z+v];
   });
   poiOrvasAppendRigid(m,head,rotate,x,y,z);return m;''')
i=s.index('function poiWalkAvatar(');j=s.index('const POI_MONSTER_BREAK_MS=',i)
a=s[i:j]
assert a.count('upload(poiBuildPlayerMesh(')==4
a=a.replace(' if(aim){',' const put=m=>{const g=upload(m);g.orvasEyeSockets=m.orvasEyeSockets;return g};\n if(aim){',1)
a=a.replace('upload(poiBuildPlayerMesh(','put(poiBuildPlayerMesh(')
s=s[:i]+a+s[j:]
replace("  if(typeof poiDrawOrvasPlayerBeam==='function')poiDrawOrvasPlayerBeam(now,p.vp);\n",'')
replace('if(!poiPlayerDeath||poiPlayerDeath.relocated)poiDrawWalkAvatar(p.vp,now);','''if(!poiPlayerDeath||poiPlayerDeath.relocated)poiDrawWalkAvatar(p.vp,now);
  if(typeof poiDrawOrvasPlayerBeam==='function')poiDrawOrvasPlayerBeam(now,p.vp);''')
dst.write_text(s)
