const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function span(a,b){const i=html.indexOf(a),j=html.indexOf(b,i+1);assert(i>=0&&j>i,'missing '+a);return html.slice(i,j)}
test('B1 mine stone walls join the real angled fade, limited to the ray-hit tiles',()=>{
 const scope=vm.createContext({facilitySite:{id:'base',buildings:[],mine:{bounds:{x1:112,x2:125,z1:50,z2:63,y:-1}}},
  isWallId:t=>t==='mosswall',poiWalkActive:true,poiThirdPerson:false,cameraTopDown:false,pineAIActive:false,
  poiWalkViewX:119,poiWalkViewZ:58,poiWalkLevel:-1,yaw:Math.PI,poiCreekPlayerHeight:()=>0,
  POI_OCCLUSION_OPACITY:.16});
 vm.runInContext(span('const POI_ANGLED_RUIN_WALLS=','function makeScene()')+
  span('// BEGIN ANGLED WALL OCCLUSION','// END ANGLED WALL OCCLUSION'),scope);
 function wall(x,z){
  const o={x,z,y:-1,type:'mosswall'},sides=scope.poiAngledWallSides(o);
  assert(sides.some(s=>s.owner==='abandoned-mine'));
  return sides.map(side=>({...side,...o,min:[x,-1.4,z],max:[x+1,0,z+1],start:x*10,end:x*10+8}));
 }
 assert.equal(scope.poiAngledWallSides({x:110,z:57,y:-1,type:'mosswall'}).length,0);
 assert.equal(scope.poiAngledWallSides({x:119,z:57,y:-1,type:'crate'}).length,0);
 scope.sceneMesh={wallFade:[...wall(119,57),...wall(118,57),...wall(117,57)]};
 const f=scope.poiAngledWallOcclusion({elev:.86},0);
 assert.equal(f.wall.owner,'abandoned-mine');
 assert.deepEqual(Array.from(f.wall.cells,c=>c.x),[119]);
 assert.equal(f.wall.cells[0].y,-1);
 scope.cameraTopDown=true;
 assert.equal(scope.poiAngledWallOcclusion({elev:.86},0).active,false);
});
test('depth-only fallback is drawn before the normal avatar and leaves depth writes enabled',()=>{
 const log=[],vp={},avatar={count:42},scope=vm.createContext({loc:{occlusionInfo:123},poiWalkMesh:avatar,pineAIActive:false,
  gl:{GREATER:'greater',LESS:'less',depthFunc:v=>log.push(['depth',v]),depthMask:v=>log.push(['writes',v]),
   uniform4f:(loc,...args)=>log.push(['mode',loc,args[3]])},draw:m=>log.push(['draw',m])});
 vm.runInContext(span('// BEGIN GAME DAMAGE FLASH','// END GAME DAMAGE FLASH')+
  span('function poiDrawWalkAvatar(','function poiAvatarOcclusion('),scope);
 scope.poiDrawWalkAvatar(vp,100);
 assert.deepEqual(log,[['writes',false],['depth','greater'],['mode',123,-2],['draw',avatar],
  ['mode',123,0],['depth','less'],['writes',true],['draw',avatar]]);
 log.length=0;scope.pineAIActive=true;scope.poiDrawWalkAvatar(vp,100);
 assert.deepEqual(log,[['draw',avatar]],'AI render gets no rescue silhouette');
 assert.match(html,/if\(uOcclusionInfo\.w< -1\.5\)[\s\S]*gl_FragColor=vec4\(vec3\(\.90,\.82,\.63\),1\.0\)/);
 assert.match(html,/if\(!poiPlayerDeath\|\|poiPlayerDeath\.relocated\)poiDrawWalkAvatar\(p\.vp,now\)/);
});
