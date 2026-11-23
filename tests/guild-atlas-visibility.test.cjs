const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function pick(l,r){const i=h.indexOf(l),j=h.indexOf(r,i+1);assert(i>=0&&j>i,l);return h.slice(i,j)}
const getSite=vm.runInNewContext(pick('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+';buildFacilitySite');
const site={...getSite('base'),id:'base'};
function fixture(x,z,y,{active=true,facility=site}={}){
 const c=vm.createContext({facilitySite:facility,poiWalkX:x,poiWalkZ:z,poiWalkLevel:y,poiWalkActive:active,
  level:y,world:facility?.map.world||site.map.world,hideUpper:false,
  rot2:(x,z)=>[x,z],terrainY:()=>0,facilityVisibilityOwner:()=>null,facilityIsRoofPiece:()=>false,
  facilityStairOpenings:new Set(),gl:{createBuffer:()=>({}),bindBuffer(){},bufferData(){}}});
 vm.runInContext(pick('function guildBounds(','function ')+
  pick('function pineGuildAtlasLayout(','\nfunction ')+
  pick('function poiDungeonPointIn(','// Keep the B1')+
  pick('function facilityViewLevel(){','\nfunction ')+
  pick('function facilityObjectVisible(','function poiChestInvalidateModel(')+
  pick('const SIGN_TYPES=','\n')+'\n'+pick('function buildSignOverlay(){','const signVert=')+
  ';this.signIds=Array.from(buildSignOverlay(),o=>o.id);',c);
 return c.signIds;
}
test('only visible guild wall gets the world atlas texture; every unrelated B1 realm filters out above-ground atlas',()=>{
 for(const [x,z] of [[64,24],[116,61],[100,90],[77,79],[26,35]]){
  assert.ok(!fixture(x,z,-1).includes('pineGuildWorldMap'),'atlas leaked into B1 '+[x,z]);
 }
 assert.ok(fixture(56,40,0).includes('pineGuildWorldMap'),'guild retains atlas during above-ground play');
 assert.ok(fixture(56,40,0,{active:false}).includes('pineGuildWorldMap'),'guild retains atlas in editor');
 assert.ok(!fixture(64,24,-1,{active:false}).includes('pineGuildWorldMap'),'basement editor must not draw atlas of invisible upper floor');
});
