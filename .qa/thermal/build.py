from pathlib import Path
import sys
d=Path(__file__).parent;s,o=map(Path,sys.argv[1:]);h=s.read_text()
def rep(a,b):
 global h
 if h.count(a)!=1: raise ValueError((h.count(a),a[:150]))
 h=h.replace(a,b)
def section(a,b,s):
 global h
 i=h.index(a);j=h.index(b,i+1)
 h=h[:i]+s+h[j:]
section('function poiPlayerFireGeometry(', 'function poiAppendWeaponProjectile(', (d/'fire-wand.js').read_text())
rep('function poiPlayerWeaponDraw(now,vp){','let poiWeaponFireBodyGpu=null;\nfunction poiPlayerWeaponDraw(now,vp){')
rep(' const data=upload(m);try{draw(data,vp)}finally{gl.deleteBuffer(data.buf)}\n if(m.fireGlow)poiDrawPlayerFireGlow(m.fireGlow,vp);',
''' if(m.fireGlow){
  poiWeaponFireBodyGpu=upload(m,poiWeaponFireBodyGpu?.buf??null,gl.DYNAMIC_DRAW);
  draw(poiWeaponFireBodyGpu,vp);poiDrawPlayerFireGlow(m.fireGlow,vp);
 }else{const data=upload(m);try{draw(data,vp)}finally{gl.deleteBuffer(data.buf)}}''')
i=h.index('function poiDavidCueGeometry(')
j=h.index(" if(q.kind==='beam'){",i)
k=h.index('// BEGIN DAVID STOMP IMPACT',j)
h=h[:j]+' return {lane,beam};\n}\n'+(d/'david-beam.js').read_text()+'\n'+h[k:]
rep('  const {lane,beam}=poiDavidCueGeometry(q,b);\n  poiDavidCue={q,door:poiWalkDoorOpen,map:world,lane:lane.p.length?upload(lane):null,beam:beam.p.length?upload(beam):null};',
'''  const {lane}=poiDavidCueGeometry(q,b);
  poiDavidCue={q,door:poiWalkDoorOpen,map:world,lane:lane.p.length?upload(lane):null,beam:null,beamAt:-Infinity};''')
rep('''   const m=poiDavidSweepBeamMesh(q,b);
   if(m.p.length){poiDavidCue.live=upload(m,poiDavidCue.live?.buf??null,gl.DYNAMIC_DRAW);gl.blendColor(0,0,0,reduced?.66:.84);draw(poiDavidCue.live,vp)}''',
'''   const m=poiDavidSweepBeamMesh(q,b,now);
   if(m.p.length){poiDavidCue.live=poiDavidBeamUpload(m,poiDavidCue.live);poiDavidDrawThermalBeam(poiDavidCue.live,vp,reduced?.70:.90)}''')
rep("  if(!tell&&!live&&age<180&&poiDavidCue.beam){gl.blendColor(0,0,0,reduced?.64:.92-.45*age/180);draw(poiDavidCue.beam,vp)}",
'''  if(!tell&&!live&&age<180&&q.kind==='beam'){
   if(now-poiDavidCue.beamAt>=32){
    const ray={x:q.dx,z:q.dz};
    const limit=poiDavidCue.beamReach??(poiDavidCue.beamReach=poiDavidBeamReach(q,b,ray));
    const m=poiDavidThermalBeam(q,ray,limit,now,reduced);
    // Keep the allocated buffer so door states cannot cause churn mid-beam.
    if(m.p.length)poiDavidCue.beam=poiDavidBeamUpload(m,poiDavidCue.beam);
    poiDavidCue.beamVisible=!!m.p.length;poiDavidCue.beamAt=now;
   }
   if(poiDavidCue.beamVisible)poiDavidDrawThermalBeam(poiDavidCue.beam,vp,reduced?.66:.94-.43*age/180);
  }''')
o.write_text(h)
