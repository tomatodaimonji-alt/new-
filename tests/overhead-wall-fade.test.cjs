const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(process.env.HTML||path.join(__dirname,'..','world-editor.html'),'utf8');
function fixture(){
 const c=vm.createContext({poiWalkActive:true,poiThirdPerson:false,cameraTopDown:false,pineAIActive:false,
  poiWalkViewX:108,poiWalkViewZ:58,poiWalkLevel:0,yaw:0,poiCreekPlayerHeight:()=>0,POI_OCCLUSION_OPACITY:.16});
 const m=html.match(/\/\/ BEGIN ANGLED WALL OCCLUSION\n([\s\S]*?)\/\/ END ANGLED WALL OCCLUSION/);
 assert.ok(m,'angled profile present');vm.runInContext(m[1],c);
 const row=(owner,side,x,z,y,start=0)=>({owner,side,x,z,y,type:'stonewall',min:[x,y*1.4,z+.45],max:[x+1,y*1.4+1.4,z+.6],start,end:start+3});
 const front=[row('tower','south',107,59,0,0),row('tower','south',108,59,0,3),row('tower','south',109,59,0,6),row('tower','south',108,59,1,9)];
 c.sceneMesh={wallFade:[...front,row('tower','north',108,57,0,12),row('other','south',110,59,0,15),row('tower','south',111,59,0,18)]};
 return {c,run:()=>vm.runInContext('poiAngledWallOcclusion({elev:.86},0)',c),front};
}
test('connected foreground run only, spanning floor stack, excludes rear, detached and separate owner',()=>{
 const f=fixture(),mask=f.run();assert.equal(mask.active,true);
 assert.equal(mask.kind,'overhead-wall');assert.equal(mask.wall.owner,'tower');
 assert.deepEqual(Array.from(mask.wall.cells,o=>o.x),[107,108,109,108]);
});
test('no cut in editor, third person, true top, or after clearing',()=>{
 const f=fixture();
 for(const [key,setting] of [['poiWalkActive',false],['poiThirdPerson',true],['cameraTopDown',true],['pineAIActive',true]]){
  const old=f.c[key];f.c[key]=setting;assert.equal(f.run().active,false);f.c[key]=old;
 }
 f.c.poiWalkViewX=105;assert.equal(f.run().active,false);
});
test('north-facing and diagonal rays select only the forward facade',()=>{
 const {c,run}=fixture();c.yaw=Math.PI-.16;
 const north=c.sceneMesh.wallFade[4];
 north.min[2]=57.88;north.max[2]=58.12;
 const mask=run();assert.equal(mask.wall.side,'north');assert.deepEqual(Array.from(mask.wall.cells,w=>w.z),[57]);
 c.poiWalkViewZ=56;assert.equal(run().active,false);
});
test('draw ranges reuse one scene buffer and the fade flag cannot leak into normal or roof draws',()=>{
 const js=html.slice(html.indexOf('function poiDrawSceneOcclusion'),html.indexOf('function poiAvatarOcclusion'));
 const calls=[];
 const c={poiOcclusionFrame:{kind:'overhead-wall',spans:[[6,12],[18,21]]},loc:{},draw:()=>calls.push('normal'),
  gl:{bindBuffer:()=>calls.push('bind'),enableVertexAttribArray(){},vertexAttribPointer(){},uniformMatrix4fv(){},
   uniform4f:(_loc,_x,_y,_z,w)=>calls.push(w),drawArrays:(_mode,first,count)=>calls.push([first,count])}};
 vm.createContext(c);vm.runInContext(js,c);c.poiDrawSceneOcclusion({buf:{},count:24},[]);
 assert.deepEqual(calls,['bind',[0,6],-1,[6,6],0,[12,6],-1,[18,3],0,[21,3]]);
});
