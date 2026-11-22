const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function span(a,b){const i=h.indexOf(a),j=h.indexOf(b,i+1);assert(i>=0&&j>i,a);return h.slice(i,j)}
test('surface play reuses one static grade batch, but changed cross-storey lamp inputs and the cellar never reuse it',()=>{
 const disposed=[],vbo={buf:'ground'},ctx=vm.createContext({gl:{deleteBuffer:b=>disposed.push(b)},
  facilitySite:{id:'base'},poiWalkActive:true,facilityViewLevel:()=>0});
 vm.runInContext(span('// BEGIN FACILITY SHARED GRADE','// END FACILITY SHARED GRADE'),ctx);
 const lamps=[{x:2,z:2,y:0,type:'lantern'},{x:3,z:3,y:2,rot:0,type:'lantern'}],wall={x:4,z:4,y:1,type:'poiWallSconce'};
 const key=ctx.facilityGradeKey(lamps);
 assert.notEqual(key,null);
 assert.equal(ctx.facilityGradeKey([...lamps,wall]),key,'sconces affect only their own floor');
 assert.notEqual(ctx.facilityGradeKey([lamps[0]]),key,'ordinary upper lamp affects ground exactly as before');
 ctx.facilityGradeRemember(key,vbo);
 assert.equal(ctx.facilityGradeGet(key),vbo);
 assert.equal(ctx.facilityGradeGet(ctx.facilityGradeKey([lamps[0]])),null);
 ctx.facilityViewLevel=()=>-1;
 assert.equal(ctx.facilityGradeKey(lamps),null,'no surface terrain is attached underground');
 ctx.facilityViewLevel=()=>0;ctx.poiWalkActive=false;
 assert.equal(ctx.facilityGradeKey(lamps),null,'editor gets its old geometry path');
 ctx.facilityGradeInvalidate();assert.equal(ctx.facilityGradeGet(key),null);assert.deepEqual(disposed,['ground']);
});
test('shared grade is drawn before the cutaway object ranges and invalidated on edits and exiting Play',()=>{
 assert.match(h,/draw\(sceneMesh\?\.ground,p\.vp\);poiDrawSceneOcclusion\(sceneMesh,p\.vp\)/);
 assert.match(h,/function facilityInvalidateScenes\(\)\{[^}]*facilityGradeInvalidate\(/);
 assert.match(h,/function commit\(\)\{[^\n]*facilityInvalidateScenes\(\)/);
 assert.match(h,/function facilitySetPlay\(active\)\{[\s\S]*?poiWalkSet\(false\);\s*facilityInvalidateScenes\(\)/);
});
test('Guild 1F/2F/3F share one buffer but expose their own exact visible floor and generated trim records',()=>{
 const shared={buf:'scene',count:150,storeyFade:[
  {owner:'townGuild',y:1,start:10,end:30},{owner:'townGuild',y:2,start:40,end:50},{owner:'lodging',y:1,start:60,end:70}],
 wallFade:[{owner:'townGuild',y:2},{owner:'lodging',y:1}],
 facilitySharedParts:[{owner:0,floor:2,start:70,end:80},{owner:0,floor:Infinity,start:80,end:90}]};
 let builds=0;
 const c=vm.createContext({facilitySite:{id:'base',buildings:[{id:'townGuild'},{id:'lodging'}]},hideUpper:false,
  poiWalkLevel:0,facilitySurface:null,facilitySurfaceEdited:false,facilityBuildFullSurface:false,world:[],
  poiAngledRangeMerge:r=>r.sort((a,b)=>a[0]-b[0]),makeScene:()=>{builds++;return shared}});
 vm.runInContext(span('// BEGIN FACILITY SHARED SURFACE','// END FACILITY SHARED SURFACE'),c);
 assert.equal(c.facilitySharedSurfaceAllowed(0),true);
 const seen=[];
 for(const y of [0,1,2,1,0]){
  c.poiWalkLevel=y;const mesh=c.facilitySurfaceView(0);
  assert.equal(mesh.buf,'scene');assert(mesh.storeyFade.every(r=>r.owner!=='townGuild'||r.y<=y));
  assert(mesh.wallFade.every(r=>r.owner!=='townGuild'||r.y<=y));assert(mesh.storeyFade.some(r=>r.owner==='lodging'));
  seen.push(Array.from(mesh.hiddenSpans,r=>Array.from(r)));
 }
 assert.equal(builds,1);
 assert.deepEqual(seen,[[[10,30],[40,50],[70,80],[80,90]],[[40,50],[70,80],[80,90]],[[80,90]],[[40,50],[70,80],[80,90]],[[10,30],[40,50],[70,80],[80,90]]]);
 assert.equal(c.facilitySharedSurfaceAllowed(1),false,'neighboring inn light uses exact bake fallback');
 c.poiWalkLevel=-1;assert.equal(c.facilitySharedSurfaceAllowed(0),false);
 c.poiWalkLevel=0;c.facilitySurfaceEdited=true;assert.equal(c.facilitySharedSurfaceAllowed(0),false);
 c.facilitySurfaceEdited=false;c.facilitySurface=null;c.world=[{y:2,type:'lantern'}];
 assert.equal(c.facilitySharedSurfaceAllowed(0),false,'cross-floor lights fall back');
});
test('hidden triangles are skipped in both opaque and dither spans, without modifying visible triangle order',()=>{
 const c=vm.createContext({});
 vm.runInContext(span('function poiVisibleMeshRanges(','function poiDrawSceneOcclusion('),c);
 assert.deepEqual(Array.from(c.poiVisibleMeshRanges(0,100,[[0,10],[25,50],[99,120]]),r=>Array.from(r)),[[10,25],[50,99]]);
 assert.deepEqual(Array.from(c.poiVisibleMeshRanges(50,60,[[0,10],[55,59],[99,120]]),r=>Array.from(r)),[[50,55],[59,60]]);
 assert.deepEqual(Array.from(c.poiVisibleMeshRanges(20,25,[[0,30]])),[]);
});
test('invalidating three shared views deletes each real VBO exactly once and detaches the active references',()=>{
 const seen=[],g={buf:'grade'},outside={buf:'town',ground:g},inside={buf:'town',ground:g};
 const c=vm.createContext({facilityGradeInvalidate:()=>seen.push('grade'),facilityWatchtowerCameraWalls:{},facilityEntranceGuides:{},
  facilityScenes:new Map([['out',{mesh:outside,signs:[{buf:'outSigns'}]}],['in',{mesh:inside,signs:[{buf:'inSigns'}]}]]),sceneMesh:inside,
  signOverlays:[{buf:'inSigns'}],facilitySurface:outside,facilityRoofMeshes:[{buf:'roof'}],gl:{deleteBuffer:b=>seen.push(b)}});
 vm.runInContext(span('function facilityInvalidateScenes(','function facilityUpdateCellarOption('),c);
 c.facilityInvalidateScenes();c.facilityInvalidateScenes();
 assert.deepEqual(seen,['grade','town','outSigns','inSigns','roof','grade']);
 assert.equal(c.facilitySurface,null);assert.equal(c.sceneMesh,null);assert.equal(c.signOverlays.length,0);
 assert.equal(c.facilityScenes.size,0);
});
test('the sparse middle-floor view uses one capped compact index buffer only on a supported WebGL context',()=>{
 const uploaded=[],ctx=vm.createContext({
  facilitySurfaceUintIndices:undefined,
  gl:{getExtension:name=>name==='OES_element_index_uint'?{}:null,createBuffer:()=>7,
   ELEMENT_ARRAY_BUFFER:34963,STATIC_DRAW:35044,bindBuffer:(...args)=>uploaded.push(args),
   bufferData:(target,indices,usage)=>uploaded.push([target,Array.from(indices),usage])}
 });
 vm.runInContext(span('function poiVisibleMeshRanges(','function poiDrawSceneOcclusion(')+
  span('function facilitySurfaceIndexBuffer(','function facilitySurfaceView('),ctx);
 const hidden=[[1,4],[8,10]];
 assert.equal(ctx.facilitySurfaceIndexBuffer(12,hidden),7);
 assert.deepEqual(uploaded,[[34963,7],[34963,[0,4,5,6,7,10,11],35044]]);
 assert.equal(ctx.poiVisibleVertexOffset(4,hidden),1);
 assert.equal(ctx.poiVisibleVertexOffset(9,hidden),5);
 assert.equal(ctx.facilitySurfaceIndexBuffer(2_000_000,[]),null,'6 MB limit is checked before allocation');
 ctx.facilitySurfaceUintIndices=undefined;ctx.gl.getExtension=()=>null;
 assert.equal(ctx.facilitySurfaceIndexBuffer(12,hidden),null);
 assert.equal(uploaded.length,2);
});
