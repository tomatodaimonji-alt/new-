const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm'),{test}=require('node:test');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const slice=(a,b)=>{const i=h.indexOf(a),j=h.indexOf(b,i+a.length);assert(i>=0&&j>i,a);return h.slice(i,j)};
function make(vars={}){
 const style=new Map(),attrs=new Set(),el={style:{setProperty:(k,v)=>style.set(k,v)},toggleAttribute:(n,v)=>v?attrs.add(n):attrs.delete(n)};
 const c=vm.createContext({...{
  $:()=>el, facilitySite:{id:'base'}, poiWalkActive:true, poiThirdPerson:true, poiWalkLevel:0, pineAIActive:false,
  poiWalkViewX:64,poiWalkViewZ:42,poiCameraYaw:0,poiCameraPitch:-.16,poiCameraDistance:5.5,
  cameraTopDown:false, poiWalkIndoor:()=>false, poiCreekPlayerHeight:()=>0, facilitySharedWallCameraEye:(_t,e)=>e,
  facilityWatchtowerCloseFov:()=>1.2, validPos:()=>true, terrainY:()=>0,
  performance:{now:()=>0}, layout:()=>({aspect:2}), zoom:1, MAP_W:128, MAP_H:128, panX:0,panZ:0,
  worldMaxLevel:3,TERRAIN_MAX:5,TERRAIN_STEP:.35,terrainHeights:new Map(), hideUpper:false,level:0,yaw:0,
  poiTownClockGameMs:720*500, POI_TOWN_MINUTE_MS:500, MAX_LEVEL:5, MAX_MAP:128,
  mult:(_a,b)=>b, ortho:()=>[], look:(eye,target)=>({eye,target}),perspective:()=>[]
 },...vars});
 vm.runInContext(slice('// BEGIN OUTDOOR SKY','// END OUTDOOR SKY')+slice(h.includes('// BEGIN SACRED THRESHOLD PORTRAIT')?'// BEGIN SACRED THRESHOLD PORTRAIT':'function parameters(){','function cursorAt(')+
 slice('function workshopResumeDecode(','function workshopResume')+'\n;this.camera=()=>parameters();',c);
 return {c,style,attrs};
}
test('normal orbit and overhead unchanged; outdoor elevated aim reveals a sky gradient and the far orbit cannot bury the lens',()=>{
 const {c,style,attrs}=make();
 const normal=make({poiCameraPitch:.35}).c.camera();
 assert(normal.skyHorizon>15&&normal.skyHorizon<22);
 assert(Math.abs(normal.vp.eye[1]-(1.1+5.5*Math.sin(.35)))<1e-9);
 assert.equal(c.poiOrbitPitchClamp(-2),-.16);
 const looked=c.camera();assert(looked.vp.eye[1]<looked.vp.target[1]);
 assert(looked.skyHorizon>50&&looked.skyHorizon<70);
 c.poiSkyBackdrop(looked);assert(attrs.has('data-poi-sky'));
 assert.match(style.get('--poi-sky-top'),/^rgb\(/);
 const day=style.get('--poi-sky-top');c.poiTownClockGameMs=120*500;c.poiSkyBackdrop(looked);assert.notEqual(style.get('--poi-sky-top'),day);
 c.poiCameraDistance=15;assert(c.camera().vp.eye[1]>=.22-1e-8);
 c.cameraTopDown=true;c.poiThirdPerson=false;c.poiSkyBackdrop(c.camera());assert(!attrs.has('data-poi-sky'));
 const cliff=make({terrainY:()=>1.2}).c.camera();assert(cliff.vp.eye[1]>=1.42-1e-8);
});
test('negative sky pitch survives saves, remains gated indoors and underground, and wall correction preserves the real camera restriction',()=>{
 const {c}=make();
 const saved=()=>c.workshopResumeDecode(JSON.stringify({version:1,route:'facility',id:'base',play:true,
  view:{yaw:0,zoom:1,panX:0,panZ:0,level:0,orbitYaw:0,orbitPitch:-.16,orbitDistance:5.5,third:true}}));
 assert.equal(saved().view.orbitPitch,-.16);
 assert.equal(make({poiWalkIndoor:()=>true}).c.poiOrbitPitchClamp(-1),.12);
 const underground=make({poiWalkLevel:-1,poiDungeonPointIn:()=>false}).c;
 assert.equal(underground.poiOrbitPitchClamp(-1),.12);assert.equal(underground.camera().skyHorizon,undefined);
 const clipped=make({facilitySharedWallCameraEye:(_t,e)=>[e[0],e[1],e[2]+1]}).c;
 const clear=c.camera(),corrected=clipped.camera();
 assert.equal(corrected.vp.eye[2],clear.vp.eye[2]+1,'real collision-adjusted eye is still used');
 assert.equal(corrected.vp.eye[1],clear.vp.eye[1]);
 assert(Number.isFinite(corrected.skyHorizon),'surface wall correction no longer force-flashes the editor color');
 const {eye,target}=corrected.vp;
 const horizon=50-50*(eye[1]-target[1])/Math.hypot(eye[0]-target[0],eye[2]-target[2])/Math.tan(.6);
 assert(Math.abs(corrected.skyHorizon-horizon)<1e-9,'sky uses corrected angle and original clipped lens');
 assert(h.includes('poiOrbitPitchClamp(poiCameraPitch+(now.y-multiGesture.y)*.004)'));
 assert(h.includes('poiOrbitPitchClamp(poiCameraPitch+(e.clientY-t.lastY)*.006)'));
});
test('fixed-time sky uses opaque fixed-world colors at straight, upward, and deep downward angles',()=>{
 const {c,attrs,style}=make({poiTownClockGameMs:90*500,poiCameraDistance:5.5});
 const steps=[];
 for(const p of [.12,-.16,.14,.15,.35,.75]){
  c.poiCameraPitch=p;
  const packet=c.camera();c.poiSkyBackdrop(packet);
  assert(attrs.has('data-poi-sky'));assert.equal(packet.skyOpacity,undefined);
  const actual=Math.atan2(packet.vp.eye[1]-packet.vp.target[1],Math.hypot(packet.vp.eye[0]-packet.vp.target[0],packet.vp.eye[2]-packet.vp.target[2]));
  for(const [name,angle] of [['horizon',0],['mid-y',Math.PI/12],['top-y',Math.PI/6]]){
   const stop=parseFloat(style.get('--poi-sky-'+name));
   const expected=50-50*Math.tan(Math.min(Math.PI/3,actual+angle))/Math.tan(Math.PI/6);
   assert(Math.abs(stop-expected)<=.25+1e-10,name+' at pitch '+p+': '+stop+' expected '+expected);
  }
  steps.push(['top','mid','edge','base'].map(s=>style.get('--poi-sky-'+s)));
 }
 for(const set of steps)assert.deepEqual(set,steps[0]);
 for(const color of steps[0])assert.match(color,/^rgb\(\d+ \d+ \d+\)$/,'night should not blend into a teal default');
 assert.notEqual(steps[0][0],steps[0][2]);assert.notEqual(steps[0][2],steps[0][3]);
 assert(parseFloat(style.get('--poi-sky-horizon'))<-19,'ordinary sky gradient completely off screen in deep down view');
 assert.doesNotMatch(slice('#viewWrap[data-poi-sky]{','/* Play-only overlays'),/transparent|#709187/);
 c.poiTownClockGameMs=720*500;c.poiSkyBackdrop(c.camera());assert.notEqual(style.get('--poi-sky-top'),steps[0][0]);
});
