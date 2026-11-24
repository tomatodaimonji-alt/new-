const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const block=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i+1);assert(i>=0&&j>i,'missing '+a);return html.slice(i,j)};
test('mask follows actual viewport and body position, strictly third-person Play only',()=>{
 const x={poiWalkActive:true,poiThirdPerson:true,cameraTopDown:false,pineAIActive:false,
  poiWalkViewX:0,poiWalkViewZ:0,poiWalkLevel:0,poiCameraYaw:0,poiCreekPlayerHeight:()=>0,
  canvas:{width:480,height:840}};
 const p={vp:[1,0,0,0, 0,1,0,0, 0,0,1,1, 0,0,0,5]};
 vm.createContext(x);vm.runInContext('const POI_OCCLUSION_OPACITY=.16;'+block('function poiAvatarOcclusion(','function poiOcclusionBegin('),x);
 const a=x.poiAvatarOcclusion(p,100);
 assert(a.active);assert.equal(a.opacity,.16);
 assert(a.head[1]>a.foot[1]+25);assert(a.radius>10&&a.radius<90);
 assert.equal(a.foot[0],a.head[0]);assert(a.depthGate>1/5.5);
 assert(a.ground>.15);
 x.poiWalkViewX=1;assert(x.poiAvatarOcclusion(p,100).foot[0]>a.foot[0]);
 x.poiWalkLevel=1;assert(Math.abs(x.poiAvatarOcclusion(p,100).ground-a.ground-1.4)<.0001);
 for(const k of ['poiWalkActive','poiThirdPerson','cameraTopDown','pineAIActive']){
  const keep=x[k];x[k]=!keep;assert.equal(x.poiAvatarOcclusion(p,100).active,false,k);x[k]=keep;
 }
 x.poiWalkViewZ=-10;assert.equal(x.poiAvatarOcclusion(p,100).active,false,'behind camera');
});
test('single world program dither is foreground/height gated and disabled before avatar and editor overlay',()=>{
 const vert=block('const VERT=','const FRAG='),frag=block('const FRAG=','function sh('),render=block('function render()','let savedMapRestoreFailed');
 assert.match(vert,/vWorldHeight=aPos\.y/);
 assert.match(frag,/gl_FragCoord\.w>uOcclusionInfo\.x/);
 assert.match(frag,/vWorldHeight>uOcclusionInfo\.y/);
 assert.match(frag,/smoothstep\([\s\S]*discard/);
 assert.match(render,/poiOcclusionBegin\(p,now\);[\s\S]*poiDrawSceneOcclusion\(sceneMesh,p\.vp\);\s*if\(typeof facilityDrawLocalScene==='function'\)facilityDrawLocalScene\(p\.vp\);\s*(?:if\(typeof facilityDrawForestScene==='function'\)facilityDrawForestScene\(p\.vp\);\s*)?facilityDrawRoofs\(p\.vp\);poiDrawGameRoofs\(p\.vp\);[\s\S]*poiOcclusionEnd\(\);[\s\S]*poiDrawEditorGhostRoof[\s\S]*poiDrawWalkAvatar\(p\.vp,now\)/);
 if(html.includes('function facilityDrawForestScene(')){
  assert.match(render,/poiOcclusionBegin\(p,now\);[\s\S]*facilityDrawForestScene\(p\.vp\);[\s\S]*poiOcclusionEnd\(\);/,
   'new forest local mesh must also be inside the established occlusion pass');
 }
 assert.doesNotMatch(block('function poiAvatarOcclusion(','// BEGIN NORTH AXE FOOTPRINT'),/makeScene\(|upload\(|readPixels\(/);
});

