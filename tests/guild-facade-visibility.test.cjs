const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const i=h.indexOf('function pineGuildRenewalCutOwner()'),j=h.indexOf('function facilityRenderScene()',i);
assert(i>=0&&j>i);
function setup(id){
 const x={facilitySite:{id,buildings:id==='base'?[{id:'townGuild'},{id:'lodging'}]:[{}]},poiWalkActive:true,
  poiWalkLevel:0,level:0,AUTO_ROOFS:new Set(),RESIDENTIAL_ROOFS:new Set(),inside:null,
  facilityFloorMasks:[{footprint:new Set(['14,20']),floors:new Map([[0,0],[1,1],[2,2]])},
   {footprint:new Set(['40,20']),floors:new Map([[0,0],[1,1]])}],
  facilityHiddenRoof(){return x.inside},facilityFloorOwner(a,b){return a===14?0:1},
  facilityUsesGuildRendering:()=>id==='guildsaved'||id==='guildrenewal'};
 vm.createContext(x);vm.runInContext(h.slice(i,j),x);
 return x;
}
test('guild facade remains outside and in editor, hides only for its own interiors including top floor',()=>{
 const facade={x:14,z:20,y:0,type:'guildFacadeSign'},foreign={...facade,x:40};
 for(const id of ['base','guildsaved','guildrenewal']){
  const x=setup(id);
  assert(x.facilityObjectVisible(facade),id+' outside');
  x.inside=0;
  for(const floor of [0,1,2]){
   x.poiWalkLevel=floor;
   assert.equal(x.facilityVisibilityOwner(),0,id+' indoor cache does not share outside');
   assert.equal(x.facilityObjectVisible(facade),false,id+' inside '+floor);
   assert(x.facilityObjectVisible(foreign),id+' other building sign remains visible');
   assert(x.facilityObjectVisible({...facade,type:'guildWallQuestBoard'}));
  }
  x.poiWalkActive=false;assert(x.facilityObjectVisible(facade),id+' editor');
 }
 const x=setup('base');x.inside=1;
 assert(x.facilityObjectVisible(facade),'another facility interior');
});
test('solid board and sign texture share the same active facility visibility rule',()=>{
 const sign=h.slice(h.indexOf('function buildSignOverlay()'),h.indexOf('const signVert='));
 const scene=h.slice(h.indexOf('function makeScene()'),h.indexOf('const {blockers:pineShadows'));
 assert.match(sign,/facilitySite&&!facilityObjectVisible\(o\)/);
 assert.match(scene,/facilitySite&&!facilityObjectVisible\(o,cut\)/);
});
