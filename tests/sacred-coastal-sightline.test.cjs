const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{test}=require('node:test');
const h=fs.readFileSync(process.env.WORLD_HTML||'world-editor.html','utf8');
const a=h.indexOf('function facilityVisibleRoofs()'),b=h.indexOf('function facilityCollectEntranceGuides',a);
const t={depth:1,entrance:{x:24,z:128},interior:{exitZ:142},enclosure:new Set(['24,131','24,157']),ring:{x:24,z:158,radius:18}};
const site={id:'base',buildings:[{id:'davidTemple',permanentRoof:true},{id:'normal'}],davidTemple:t};
function ctx(){
 const c=vm.createContext({Math,facilitySite:site,facilityRoofMeshes:[{count:10},{count:5}],poiWalkViewX:54,poiWalkViewZ:119,poiWalkLevel:0,poiWalkActive:true,cameraTopDown:false,pineAIActive:false,facilityHiddenRoof:()=>null});
 const i=h.indexOf('// BEGIN SACRED TEMPLE SIGHTLINE'),j=h.indexOf('// END SACRED TEMPLE SIGHTLINE',i);
 vm.runInContext((i<0?'':h.slice(i,j))+h.slice(h.indexOf('function poiDavidTempleEnclosedAt('),h.indexOf('function poiDavidTempleTunnelAt('))+h.slice(a,b),c);
 return c;
}
const expectRoofs=(c,expected)=>assert.deepEqual(Array.from(c.facilityVisibleRoofs()),expected);
test('actual facility roof gate does not reveal the dome from the coastal forest but preserves early nearby reveal and top plan',()=>{
 const c=ctx();
 expectRoofs(c,[1]);
 c.poiWalkViewX=84;c.poiWalkViewZ=116;expectRoofs(c,[1]);
 c.cameraTopDown=true;expectRoofs(c,[0,1]);c.cameraTopDown=false;
 c.poiWalkViewX=24;c.poiWalkViewZ=125;expectRoofs(c,[0,1]);
 c.poiWalkViewZ=157;expectRoofs(c,[0,1]);
 c.poiWalkViewX=47;expectRoofs(c,[1]);
});
test('real scene submit excludes only tagged architecture; partial and indexed rendering do not leak the draw uniform',()=>{
 const c=ctx(),out=[];
 const i=h.indexOf('function poiVisibleMeshRanges('),j=h.indexOf('function poiDrawWalkAvatar(',i);
 let fade=0;
 const gl={ARRAY_BUFFER:1,ELEMENT_ARRAY_BUFFER:2,TRIANGLES:3,UNSIGNED_INT:4,bindBuffer(){},
  enableVertexAttribArray(){},vertexAttribPointer(){},uniformMatrix4fv(){},uniform4f(){},
  uniform1f(key,v){assert.equal(key,'fade');fade=v;},drawArrays(_,start,count){out.push([start,count,fade]);},
  drawElements(_,count,t,off){out.push([off/4,count,fade]);}};
 Object.assign(c,{loc:{sacredTempleHide:'fade'},gl,poiOcclusionFrame:{},draw:m=>out.push([0,m.count,fade])});
 vm.runInContext(h.slice(i,j),c);
 const m={count:20,sacredParts:[[5,14]]};
 c.poiDrawSceneOcclusion(m,[]);assert.deepEqual(out,[[0,5,0],[14,6,0]]);
 out.length=0;c.poiWalkViewX=24;c.poiWalkViewZ=119;
 c.poiDrawSceneOcclusion({...m,hiddenSpans:[[3,4]],indices:{}},[]);
 assert.equal(out.length,3);assert.deepEqual(out[0],[0,4,0]);assert.deepEqual(out[2],[13,6,0]);
 assert.equal(out[1][0],4);assert.equal(out[1][1],9);assert(out[1][2]>.1&&out[1][2]<.95);
 assert.equal(fade,0);
 out.length=0;c.poiWalkViewZ=125;c.poiDrawSceneOcclusion(m,[]);assert.deepEqual(out,[[0,20,0]]);
});
