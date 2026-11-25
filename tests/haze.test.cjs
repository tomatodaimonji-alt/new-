const fs=require('node:fs'),vm=require('node:vm'),a=require('node:assert/strict'),{test}=require('node:test');
const out=fs.readFileSync(process.env.HAZE_TEST_INPUT??'world-editor.html','utf8'),{createHash}=require('node:crypto');
const cut=(s,i,j)=>{const x=s.indexOf(i),y=s.indexOf(j,x+i.length);a(x>=0&&y>x,i);return s.slice(x,y)};
function fixture(){
 const values=[],s=vm.createContext({gl:{uniform3f:(id,...v)=>values.push([id,...v])},loc:{fieldHaze:'haze',fieldHazeColor:'color'},
  poiWalkActive:true,cameraTopDown:false,pineAIActive:false,facilitySurfaceEdited:false,
  poiSacredFogOn:false,poiSacredEdgeOn:false,indoors:false,cut:false,inTemple:false,templeVisible:false,
  facilitySite:{id:'base'},poiOverlandSnow:{id:'snowpass'},poiSnowPassBase:{edited:false},
  poiTownClockGameMs:360000,POI_TOWN_MINUTE_MS:500,poiSacredEdgeHorizon:()=>[.74,.81,.82],
  foot:{x:71.125,z:149.625,y:0}});
 vm.runInContext(`
 const poiWalkIndoor=()=>indoors,facilityVisibilityOwner=()=>cut?{}:null,poiSquareFieldSite=s=>s.id==='base'&&!s.foreign;
 const poiDavidTempleEnclosedAt=()=>inTemple,poiSacredTempleViewAmount=()=>templeVisible?1:0,poiAimOrigin=()=>foot;
 `+cut(out,'const POI_OVERLAND_ORIGINS=','function poiOverlandQueue(')+cut(out,'let poiFieldHazeFrame=','function poiSacredFrontierFogRegion('),s);
 return {values,s,run:x=>vm.runInContext(x,s)};
}
const normalized=x=>JSON.parse(JSON.stringify(x));
test('exact shade is symmetric and monotone, same region-phase fractional real foot; restore scoped uniforms',()=>{
 const {values,run}=fixture();
 run("poiFieldHazePrepare(700);poiFieldHazeStart();poiFieldHazeRegion('snowpass');poiFieldHazeRegion('snowpass');poiFieldHazeRegion('milda');poiFieldHazeRegion('base');poiFieldHazeStop();poiFieldHazeStop()");
 a.deepEqual(values,[['color',.74,.81,.82],['haze',71.625,150.125,.38],['haze',23.625,11.125,.38],['haze',0,0,0],
  ['haze',71.625,150.125,.38],['haze',0,0,0]]);
 const fog=cut(out,' if(uFieldHaze.z>0.0){',' if(uSacredFog.z>0.0){');
 a.match(fog,/distanceToFoot=length\(vLootXZ-uFieldHaze.xy\)/);
 const [begin,end]=fog.match(/smoothstep\((\d+.\d+),(\d+.\d+),distanceToFoot\)/).slice(1).map(Number);
 const alpha=(dx,dz)=>{const x=Math.min(1,Math.max(0,(Math.hypot(dx,dz)-begin)/(end-begin)));return .38*x*x*(3-2*x);};
 a.deepEqual([begin,end],[18,32]);a.equal(alpha(18,0),0);a.equal(alpha(32,0),.38);a.equal(alpha(60,0),.38);a.equal(alpha(30,0),alpha(0,-30));a.equal(alpha(18,24),alpha(-24,18));
 a(alpha(20,0)<alpha(26,0)&&alpha(26,0)<alpha(30,0));
 a.equal(alpha(0,26),alpha(26,0));
 a(!/discard|gl_FragColor|vWorldHeight|uMVP/.test(fog),'RGB veil never drops geometry, changes alpha, or depends on camera pitch');
 // The curve is subpixel-continuous across a whole unit walk, even at its steepest.
 a(Math.abs(alpha(25.5,0)-alpha(24.5,0))<.041);

});
test('actual local guard keeps original sacred fog/edge, indoor/roof/editor/foreign/edited paths unmodified',()=>{
 const {run}=fixture(),eligible=()=>run('poiFieldHazeEligible(facilitySite,foot)');
 a(eligible());
 for(const code of ['indoors','cut','inTemple','templeVisible','poiSacredFogOn','poiSacredEdgeOn','facilitySurfaceEdited','cameraTopDown','pineAIActive']){
  run(code+'=true');a(!eligible(),code);run(code+'=false');a(eligible(),code);
 }
 run('foot.y=-1');a(!eligible());run("foot.y=0;facilitySite={id:'snowpass'}");a(!eligible());
 run('facilitySite=poiOverlandSnow');a(eligible());run('poiSnowPassBase.edited=true');a(!eligible());
 // Immutable exact v338 source windows: Sacred mist, guards, physical terrain and upload policy.
 for(const [i,j,expected] of [
 [
  "function poiSacredApplyFog(",
  "function ",
  "c498246dce0d4c92f45da2de7d19414401c17cc3e8f756cbe83eb7ead0fa5927"
 ],
 [
  " if(uSacredFog.z>0.0){",
  " gl_FragColor=vec4(color,1.0);",
  "bfea86ee6deb49c32e149014778a721fbd1072eae37444a5c8e8130443060f54"
 ],
 [
  "function poiOverlandUpload(",
  "function poiOverlandBakeFrame(",
  "d6207bb1198c7f70168228b1421752492e6c8742d9d2626adc4b420423bee0b4"
 ],
 [
  "function poiWalkIndoor(",
  "function ",
  "83dd790d9d0d34e800541bc9a40be21d5f535adca6905067a6bd705fa16b1bc5"
 ],
 [
  "function poiDavidTempleEnclosedAt(",
  "function ",
  "5a8d42fb2296e1df5561cb2d4ae40af5c06010ea90d7e66e1f1c544125bed027"
 ],
 [
  "function poiOutdoorGroundRuns(",
  "function ",
  "a86718e9b5718bc126f50d19f28123b220c41ec2c49bfd0674ee1f973bb2a2f9"
 ]
]){
  a.equal(createHash('sha256').update(cut(out,i,j)).digest('hex'),expected,i);
 }
});
test('all exterior callers have exact local authority and actor/effect draw outside scope',()=>{
 const begin=out.indexOf(' poiFieldHazeStart();'),end=out.indexOf(' poiDrawEditorGhostRoof(p.vp);',begin);
 const render=out.slice(begin,end),occ=render.indexOf('poiOcclusionEnd()');
 a.match(render,/try\{if\(stream\)\{[\s\S]*poiOverlandPresent[\s\S]*facilityDrawLocalScene[\s\S]*facilityDrawForestScene[\s\S]*finally\{poiFieldHazeStop\(\)\}/);
 a(render.indexOf('poiFieldHazeStop()')<render.indexOf('poiSacredInteriorDraw'));
 a(occ>=0&&render.lastIndexOf('poiFieldHazeStart()')>occ);
 a(render.endsWith('finally{poiFieldHazeStop()}\n'));
 a.match(cut(out,'function poiOverlandPresent(', 'function poiOverlandInspect('),/poiFieldHazeRegion\(o.id\)[\s\S]*poiFieldHazeRegion\(active\)/);
 a.match(cut(out,'function poiOutdoorLate(', '// END OUTDOOR GEOGRAPHY LOD'),/poiFieldHazeRegion\(q.a.id\)[\s\S]*poiFieldHazeRegion\(id\)[\s\S]*poiAddGroundFrame/);
 a.match(cut(out,'function poiSeamRoleRender(', 'function poiOutdoorDrop('),/poiFieldHazeRegion\(q.a.id\);\n   poiSeamCompactDraw/);
});
