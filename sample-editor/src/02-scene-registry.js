// v14 scene registry: one POI owns independently addressable building and prop instances.
// Values here are an authored starting layout, not surveyed real-world dimensions.
const SCENE_STORAGE_KEY='sample-editor-scene-v1';
const scene={
 schema:1,
 pois:[{id:'yanaka-ginza-study',name:'谷中銀座・再現研究区画',bounds:{minX:-19,maxX:19,minZ:-66,maxZ:66},source:'photo-inspired estimates',buildingIds:[],objectIds:[]}],
 buildings:[],
 objects:[],
 selectedBuildingId:null
};
function defaultShop(side,k){
 return {
  id:'yanaka-'+(side===-1?'west':'east')+'-'+String(k+1).padStart(2,'0'),
  poiId:'yanaka-ginza-study',type:'shop',side,k,
  x:side*(8.65+seeded(k*17,side)*.52),
  z:-51+k*7.25+(seeded(k,side)*.55-.275),
  width:6.75+seeded(k,side*9)*.35,
  depth:5.2+seeded(k*8,side)*1.3,
  height:4.8+Math.floor(seeded(k*5,side)*3)*2.65,
  material:'painted-plaster',source:'photo-inspired estimates'
 };
}
for(const side of [-1,1])for(let k=0;k<15;k++)scene.buildings.push(defaultShop(side,k));
for(let k=0;k<8;k++)for(const side of [-1,1]){
 scene.objects.push({id:'pole-'+side+'-'+k,poiId:'yanaka-ginza-study',type:'utility-pole',
  x:side*5.95,z:-48+k*14.2,height:7.1,source:'photo-inspired estimates'});
}
// v20 convenience-store study at the end of the commercial street.
// Coordinates are a designed prototype, not measurements of a named real shop.
const convenience={id:'mini-market-01',poiId:'convenience-study',
 type:'convenience',x:0,z:79.5,width:17.6,depth:20,height:4.35,
 entrance:{x:0,z:69.5,opening:3.5},
 source:'Japanese convenience-store layout reference; approximate proportions'};
scene.pois.push({id:'convenience-study',name:'小型コンビニ・研究店舗',
 bounds:{minX:-10,maxX:10,minZ:68,maxZ:91},
 source:'layout study, estimated',buildingIds:[convenience.id],objectIds:[]});
scene.buildings.push(convenience);
const fixtures=[
 ['counter-left','checkout',-5.6,72.35,2.6,1.1,1.05],
 ['counter-machine','register',-5.6,72.35,.48,.40,.33],
 ['shelf-a','aisle-shelf',-3.15,77.2,1.16,3.55,1.57],
 ['shelf-b','aisle-shelf',3.15,77.2,1.16,3.55,1.57],
 ['shelf-c','aisle-shelf',-3.15,83.1,1.16,3.55,1.57],
 ['shelf-d','aisle-shelf',3.15,83.1,1.16,3.55,1.57],
 ['back-fridge-a','fridge',-5.45,88.05,2.8,.8,2.50],
 ['back-fridge-b','fridge',-2.55,88.05,2.8,.8,2.50],
 ['back-fridge-c','fridge',.35,88.05,2.8,.8,2.50],
 ['back-fridge-d','fridge',3.25,88.05,2.8,.8,2.50],
 ['back-fridge-e','fridge',6.15,88.05,2.8,.8,2.50],
 ['side-rack-a','side-rack',7.5,75.6,.66,3.4,1.95],
 ['side-rack-b','side-rack',7.5,82.1,.66,3.4,1.95],
 ['hot-case','hot-case',-6.15,76.1,1.08,.85,1.15],
 ['entry-mat','floor-mat',0,71.2,2.9,1.65,.018]
];
for(const [id,type,x,z,width,depth,height] of fixtures){
 scene.objects.push({id:'mini-market-'+id,poiId:'convenience-study',
  type,x,z,width,depth,height,
  source:'reference-inspired, approximate'});
 scene.pois[1].objectIds.push('mini-market-'+id);
}
scene.pois[0].buildingIds=scene.buildings.filter(b=>b.type==='shop').map(b=>b.id);
scene.pois[0].objectIds=scene.objects.filter(o=>o.poiId==='yanaka-ginza-study').map(o=>o.id);
function restoreSceneEdits(){
 try{
  const saved=JSON.parse(localStorage.getItem(SCENE_STORAGE_KEY)||'null');
  if(!saved||saved.schema!==1||!Array.isArray(saved.buildings))return;
  for(const entry of saved.buildings){
   const b=scene.buildings.find(item=>item.id===entry.id);
   if(!b)continue;
   for(const field of ['x','z','width','depth','height']){
    const value=entry[field];
    if(Number.isFinite(value)&&Math.abs(value)<200&&
       (field==='x'||field==='z'||(field==='height'?value>=3:value>=3)))
      b[field]=value;
   }
  }
 }catch(err){console.warn('Scene edits unavailable',err)}
}
function saveSceneEdits(){
 try{
  localStorage.setItem(SCENE_STORAGE_KEY,JSON.stringify({
   schema:scene.schema,
   buildings:scene.buildings.map(b=>({id:b.id,x:b.x,z:b.z,width:b.width,depth:b.depth,height:b.height}))
  }));
  return true;
 }catch(err){console.warn('Saving scene failed',err);return false;}
}
restoreSceneEdits();
