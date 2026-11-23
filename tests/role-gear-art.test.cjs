const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const ids=['armorMerchantCoat','armorGuildUniform','armorCookApron','armorCookHat','equipFryingPan','equipLadle','equipBallpointPen'];
function fn(name,re){return h.match(re??new RegExp('^function '+name+'\\([\\s\\S]*?^}','m'))?.[0]||'';}
const source=fn('poiRoleItemGeometry')+'\n'+fn('poiLootContentIcon')+'\n'+fn('poiArmorContentIcon');
function build(id){
 const points=[],colors=[],cube=(_,x,y,z,w,t,d,c)=>{points.push([x-w/2,y,z-d/2],[x+w/2,y+t,z+d/2]);colors.push(c.toString())};
 const tri=(_,a,b,c,color)=>{points.push(a,b,c);colors.push(color.toString())},quad=(m,a,b,c,d,color)=>{tri(m,a,b,c,color);tri(m,a,c,d,color)};
 const context=vm.createContext({cube,tri,quad,id});
 return {ok:vm.runInContext(source+'\npoiRoleItemGeometry({},id,0,0,0)',context),points,colors};
}
test('each role object has a distinct small finite 3D mesh and authored deco routing',()=>{
 const signatures=new Set();
 for(const id of ids){
  const {ok,points,colors}=build(id);
  assert.equal(ok,true,id);assert(points.length>=12&&points.length<650,id);
  assert(points.flat().every(Number.isFinite));
  assert(new Set(colors).size>=3,id);
  signatures.add(JSON.stringify([points,colors]));
  assert(h.includes('case \''+id+'\':'),id+' render route');
 }
 assert.equal(signatures.size,ids.length);
 const range=(id,axis)=>{const p=build(id).points.map(v=>v[axis]);return Math.max(...p)-Math.min(...p)};
 assert(range('equipFryingPan',0)>.46);
 assert(range('equipLadle',0)>.23&&range('equipLadle',0)<range('equipFryingPan',0));
 assert(range('equipBallpointPen',0)<.15);
 assert(range('equipBallpointPen',1)>.48);
});
test('inventory uses the existing transparent fitted cached thumbnail from the same 3D authoring ID',()=>{
 const calls=[],c=vm.createContext({
  poiLootContentIcons:new Map(),poiArmorContentIcons:new Map(),POI_FIRE_WAND:'fireWand',
  poiHotbarWeaponForType:id=>id.startsWith('equip'),poiArmorCategory:id=>id.startsWith('armor'),
  document:{createElement:()=>({width:0,height:0,dataset:{}})},
  drawWallThumbnail:(cv,id,opts)=>{calls.push([id,opts]);return build(id).points.length>0}
 });
 vm.runInContext(source,c);
 for(const id of ids){
  const getter=id.startsWith('equip')?c.poiLootContentIcon:c.poiArmorContentIcon;
  const cv=getter(id);
  assert.equal(cv.dataset.itemModel,id);assert.equal(cv.width,96);assert.equal(cv.height,96);
  assert.equal(getter(id),cv,'repeat calls reuse one drawing');
 }
 assert.deepEqual(calls.map(([id,{transparent,fit}])=>[id,transparent,fit]),ids.map(id=>[id,true,id.startsWith('equip')?true:'architecture']));
});
