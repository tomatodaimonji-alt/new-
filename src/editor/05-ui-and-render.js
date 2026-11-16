function render(){requestAnimationFrame(render);const p=parameters();if(dirty){if(sceneMesh)gl.deleteBuffer(sceneMesh.buf);for(const o of signOverlays)gl.deleteBuffer(o.buf);sceneMesh=makeScene();signOverlays=signProgram?buildSignOverlay():[];dirty=false}if(cursorDirty){if(cursorMesh)gl.deleteBuffer(cursorMesh.buf);cursorMesh=makeCursor();cursorDirty=false}gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);draw(sceneMesh,p.vp);drawSignOverlays(p.vp);draw(cursorMesh,p.vp)}
function saveLocal(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(data()))}catch(e){}}
function data(){return{format:'forest-world-v1',version:1,size:MAP_W,width:MAP_W,height:MAP_H,terrainHeights:[...terrainHeights.entries()].map(([key,h])=>{const [x,z]=key.split(',').map(Number);return{x,z,h}}),world:world.map(o=>({...o})),models:models.map(m=>({id:m.id,name:m.name,parts:m.parts.map(p=>({...p}))})),prefabs:prefabs.map(p=>({id:p.id,name:p.name,w:p.w,h:p.h,tiles:p.tiles.map(t=>({...t}))}))}}
function snapshot(){undoStack.push(JSON.stringify(data()));if(undoStack.length>45)undoStack.shift();redoStack.length=0}
function commit(){worldMaxLevel=world.reduce((top,o)=>Math.max(top,o.y),0);dirty=true;saveLocal();updateStats()}
function restore(json){loadData(JSON.parse(json));commit()}
function isFloor(t){return ROAD_IDS.has(t)||['grass','grassTuft','grassFlowers','grassPebbles','grassPatch','grassWeeds','grassTrampled','grassMeadow','grassWild','grassForest','grassDry','earth','moss','water','river','lake','sea','stone','woodfloor','woodfloorLight','woodfloorDark','brickfloor','basicfloor','plasterfloor','mossfloor','ironfloor'].includes(t)}
function changeCell(x,z){
 if(!validPos(x,z))return;
 if(['terrainUp','terrainDown','terrainFlat'].includes(mode)){
  const h=terrainLevel(x,z),next=mode==='terrainUp'?Math.min(TERRAIN_MAX,h+1):mode==='terrainDown'?Math.max(0,h-1):0;
  if(next===h)return;snapshot();if(next)terrainHeights.set(terrainKey(x,z),next);else terrainHeights.delete(terrainKey(x,z));
  commit();cursorDirty=true;updateStats();return;
 }
 const layer=o=>o.x===x&&o.z===z&&o.y===level;
 if(mode==='move')return;
 if(mode==='rotate'){
  const target=world.findIndex(o=>layer(o)&&!isFloor(o.type));
  if(target<0){toast('回転するブロックをタップしてください');return}
  snapshot();world[target].rot=(world[target].rot+1)%4;rotation=world[target].rot;
  commit();toast('ブロックを '+(rotation*90)+'° に回転');
  return;
 }
 const index=world.findIndex(o=>layer(o)&&(mode==='erase'?!isFloor(o.type):mode==='pick'?!isFloor(o.type):isFloor(o.type)===isFloor(selected)));
 const floorIndex=world.findIndex(o=>layer(o)&&isFloor(o.type));
 if(mode==='erase'){const target=index>=0?index:floorIndex;if(target>=0){snapshot();world.splice(target,1);commit()}return}
 if(mode==='pick'){const target=index>=0?index:floorIndex;if(target>=0){selected=world[target].type;rotation=world[target].rot||0;mode='place';if(ROAD_IDS.has(selected)){roadMode=selected.endsWith('Full')?'full':'auto';renderRoadList()}updateSelected();toast('部材を取得した')}return}
 if(!byId(selected))return;
 if(prefabs.some(p=>p.id===selected)){stampPrefab(x,z);dragPainting=false;return}
 if(index>=0&&world[index].type===selected&&world[index].rot===rotation)return;
 snapshot();if(index>=0)world.splice(index,1);world.push({x,z,y:level,type:selected,rot:rotation});commit();
}
function stampPrefab(x,z){const f=prefabs.find(p=>p.id===selected);if(!f)return;const r=((rotation%4)+4)%4;
const placements=f.tiles.map(t=>{const pair=r===0?[t.x,t.z]:r===1?[f.h-1-t.z,t.x]:r===2?[f.w-1-t.x,f.h-1-t.z]:[t.z,f.w-1-t.x];return{x:x+pair[0],z:z+pair[1],y:level+t.y,type:t.type,rot:(t.rot+r)%4}});
if(placements.some(p=>!validPos(p.x,p.z)||p.y>MAX_LEVEL)){toast('この場所には設計図を置けません');return}
snapshot();for(const p of placements){const ix=world.findIndex(o=>o.x===p.x&&o.z===p.z&&o.y===p.y&&isFloor(o.type)===isFloor(p.type));if(ix>=0)world.splice(ix,1);world.push(p)}commit();toast('「'+f.name+'」を配置した')}
function savePrefab(){const x1=numeric('rangeX1'),z1=numeric('rangeZ1'),x2=numeric('rangeX2'),z2=numeric('rangeZ2');if(![x1,z1,x2,z2].every(Number.isInteger)||!validPos(x1,z1)||!validPos(x2,z2)||x1>x2||z1>z2){toast('範囲の座標を確認してね');return}
const tiles=world.filter(o=>o.x>=x1&&o.x<=x2&&o.z>=z1&&o.z<=z2).map(o=>({x:o.x-x1,z:o.z-z1,y:o.y,type:o.type,rot:o.rot}));if(!tiles.length){toast('指定範囲に建材がないよ');return}
const f={id:'prefab-'+Date.now().toString(36),name:$('prefabName').value.trim()||'自作の家',w:x2-x1+1,h:z2-z1+1,tiles};snapshot();prefabs.push(f);commit();refreshPalette();selected=f.id;mode='place';updateSelected();toast('建物をテンプレート登録した')}
function updateStats(){$('terrainHeightLabel').textContent=hover&&validPos(hover.x,hover.z)?terrainLevel(hover.x,hover.z):'-';$('gridLabel').textContent=MAP_W+'×'+MAP_H;$('countLabel').textContent=world.length;$('selectedLabel').textContent=byId(selected)?.name||'未選択';$('rotationLabel').textContent=rotation*90+'°';$('cursorStatus').textContent=hover?'マス: '+(hover.x+1)+', '+(hover.z+1)+' · '+({place:'配置',erase:'消去',pick:'取得',rotate:'回転',move:'視点移動',terrainUp:'地面を上げる',terrainDown:'地面を下げる',terrainFlat:'平坦化'}[mode]||'配置'):'マスを選んで配置';}
function updateSelected(){for(const [id,active] of [['quickPlace',mode==='place'],['quickErase',mode==='erase'],['quickRotate',mode==='rotate'],['quickMove',mode==='move']]){$(id).classList.toggle('active',active)}for(const b of document.querySelectorAll('[data-brush]'))b.classList.toggle('selected',mode==='place'&&(b.dataset.brush===selected||(b.dataset.brush==='wall'&&isWallId(selected))));for(const b of document.querySelectorAll('[data-mode]'))b.classList.toggle('selected',b.dataset.mode===mode);updateStats()}
let wallExpanded=false,openedWallGroup=null,constructionExtrasExpanded=false,naturalExpanded=false;
function mkButton(id,el){const btn=document.createElement('button');btn.className='item';btn.dataset.brush=id;const icon=createBlockIcon(id);const name=document.createElement('span');name.textContent=el.name+(id==='wall'?(wallExpanded?'　⌃':'　⌄'):'');btn.append(icon,name);btn.addEventListener('click',()=>{if(id==='wall'){openWallSelector();return}selected=id;mode='place';updateSelected();$('palette').classList.remove('mobileOpen')});return btn}
const WALL_CHOICES=[
 ['wall','基本素材','標準的な明るい石の建材'],['stonewall','石積み','重厚な石造り'],['woodwall','木材','縦板と補強材'],
 ['brickwall','レンガ','赤いレンガ積み'],['plasterwall','漆喰','白壁と木枠'],['mosswall','苔むした石','古びた石と苔'],['ironwall','鉄板','金属パネルと鋲']
];
function drawWallThumbnail(cv,id){
 const g=cv.getContext('2d');if(!g)return;
 const w=cv.width,h=cv.height;g.fillStyle='#263c32';g.fillRect(0,0,w,h);
 const m=mesh();if(isFloor(id))addFloorTile(m,-.5,-.5,id,256,ROAD_IDS.has(id)&&!id.endsWith('Full')?5:0);else if(id==='pineLandingCraft')pineLandingCraftGeometry(m,0,0);else if(id.startsWith('pineHarbor'))pineHarborGeometry(m,{x:0,z:0,y:0,type:id,rot:0});else deco(m,id,0,0,0,rotation);
 const faces=[];
 const project=(x,y,z)=>[w/2+(x-z)*w*.30,(isFloor(id)?h*.51:h*.83)+(x+z)*h*.16-y*h*.38];
 for(let i=0;i<m.p.length;i+=9){
  const p1=project(m.p[i],m.p[i+1],m.p[i+2]),p2=project(m.p[i+3],m.p[i+4],m.p[i+5]),p3=project(m.p[i+6],m.p[i+7],m.p[i+8]);
  const xx=(m.p[i]+m.p[i+3]+m.p[i+6])/3,yy=(m.p[i+1]+m.p[i+4]+m.p[i+7])/3,zz=(m.p[i+2]+m.p[i+5]+m.p[i+8])/3;
  const shade=.60+.40*Math.max(0,(m.n[i]*-.4+m.n[i+1]+m.n[i+2]*.35)/Math.hypot(.4,1,.35));
  const color=m.c.slice(i,i+3).map(v=>Math.round(255*Math.min(1,v*shade)));
  faces.push({p:[p1,p2,p3],depth:xx+zz-yy*.1,color:'rgb('+color.join(',')+')'});
 }
 faces.sort((a,b)=>a.depth-b.depth);
 for(const f of faces){g.beginPath();g.moveTo(...f.p[0]);g.lineTo(...f.p[1]);g.lineTo(...f.p[2]);g.closePath();g.fillStyle=f.color;g.fill()}
 if(SIGN_TYPES.includes(id)){const art=makeSignArtwork(id);g.drawImage(art,w*.35,h*.23,w*.41,h*.31)}
}

const NATURAL_FLOORS=[
 {id:'grass',name:'草原'}, {id:'grassMeadow',name:'明るい草地'}, {id:'grassWild',name:'野草地'}, {id:'grassForest',name:'森の下草'}, {id:'grassDry',name:'乾いた草地'}, {id:'earth',name:'土'}, {id:'moss',name:'苔と石'},
 {id:'water',name:'水'}, {id:'river',name:'川'}, {id:'lake',name:'湖'}, {id:'sea',name:'海'}
];
const MATERIAL_FLOORS={
 wall:['basicfloor'],
 stonewall:['stone'],
 woodwall:['woodfloor','woodfloorLight','woodfloorDark'],
 brickwall:['brickfloor'],
 plasterwall:['plasterfloor'],
 mosswall:['mossfloor'],
 ironwall:['ironfloor']
};
let floorExpanded=false,openedFloorGroup=null,objectExpanded=false,openedFixtureGroup=null;
const CATEGORY_PREVIEW={
 '地面':'grass','素材':'brickwall','壁':'brickwall','自然':'grass','オブジェクト':'treeRound',
 '建具・その他':'pillar','窓':'windowWood','扉':'doorWood','店カウンター':'counterWood'
};
function createBlockIcon(id){
 const cv=document.createElement('canvas');
 cv.className='blockIcon';cv.width=112;cv.height=96;
 const prefab=prefabs.find(p=>p.id===id);
 const representative=prefab?(prefab.tiles.find(t=>!isFloor(t.type))||prefab.tiles[0])?.type:id;
 drawWallThumbnail(cv,isFloor(representative)||byId(representative)?representative:(CATEGORY_PREVIEW[id]||'wall'));
 return cv;
}
function expandableRow(label,icon,open,action,previewId){

 const btn=document.createElement('button');btn.className='item categoryRow';
 btn.setAttribute('aria-expanded',String(open));
 const sym=createBlockIcon(previewId||CATEGORY_PREVIEW[label]||'wall');
 const txt=document.createElement('span');txt.textContent=label;
 const arrow=document.createElement('span');arrow.className='categoryArrow';arrow.textContent=open?'⌃':'⌄';
 btn.append(sym,txt,arrow);btn.addEventListener('click',action);return btn;
}
function createFloorThumb(id){
 const cv=document.createElement('canvas');cv.width=112;cv.height=74;
 drawWallThumbnail(cv,id);return cv;
}
function selectableTile(id,name,description,thumbnail){
 const btn=document.createElement('button');btn.className='wallOption'+(selected===id&&mode==='place'?' active':'');
 const info=document.createElement('div'),strong=document.createElement('strong'),small=document.createElement('small');
 strong.textContent=name;small.textContent=description;
 info.append(strong,small);btn.append(thumbnail,info);
 btn.addEventListener('click',()=>{selected=id;mode='place';updateSelected();refreshPalette();toast(name+'を選択しました')});
 return btn;
}
function openWallSelector(){
 wallExpanded=!wallExpanded;
 renderWallCategories();
}
function renderWallCategories(){
 const root=$('buildList');root.replaceChildren();
 root.appendChild(expandableRow('素材','▦',wallExpanded,openWallSelector));
 if(!wallExpanded)return;
 const groups=document.createElement('div');groups.className='nestedChoices';
 // Natural ground and constructed material families live in one library.
 groups.appendChild(expandableRow('自然','🌱',naturalExpanded,()=>{
  naturalExpanded=!naturalExpanded;renderWallCategories();
 },'grass'));
 if(naturalExpanded){
  const naturalList=document.createElement('div');naturalList.className='nestedChoices floorTileChoices';
  for(const item of NATURAL_FLOORS){
   const cv=createFloorThumb(item.id);
   naturalList.appendChild(selectableTile(item.id,item.name,'自然の地面タイル',cv));
  }
  groups.appendChild(naturalList);
 }
 for(const [id,name,description] of WALL_CHOICES){
  const open=openedWallGroup===id;
  groups.appendChild(expandableRow(name,catalog.get(id)?.icon||'🧱',open,()=>{
   openedWallGroup=open?null:id;renderWallCategories();
  },id));
  if(open){
   const list=document.createElement('div');list.className='nestedChoices floorTileChoices';
   for(const [part,label,detail] of [
    ...MATERIAL_FLOORS[id].map(floorId=>[floorId,catalog.get(floorId).name,'1マスの床タイル']),
    [id+'Plain','装飾なしの壁','室内用・模様のない平滑な壁'],
    [id,'片面装飾の壁','外側の1面に模様'],
    [id+'corner','角の壁','隣接する2面に装飾'],
    [id+'Double','両面装飾の壁','向かい合う2面に装飾'],
    [id+'All','全面装飾の壁','4側面すべてに装飾'],
    [id+'Window','窓','素材に合わせた枠・両面ガラス'],
    [id+'Door','扉','素材に合わせた扉と枠'],
    [id+'Counter','店カウンター','素材に合わせた正面装飾と天板']
   ]){
    const cv=document.createElement('canvas');cv.width=200;cv.height=152;
    list.appendChild(selectableTile(part,label+'（'+name+'）',detail+' / '+description,cv));
    drawWallThumbnail(cv,part);
   }
   groups.appendChild(list);
  }
 }
 // Specialty variants remain valid for saved projects, but the main
 // catalogue is organized by matching wall material rather than duplicate groups.
 const legacyFixtures=new Set(['window','door','shopCounter','windowWood','windowStone','windowBrick','doorWood','doorIron','doorStone','counterWood','counterStone','counterLuxury']);
 const extras=palette.filter(p=>p.cat==='build'&&p.id!=='wall'&&!legacyFixtures.has(p.id));
 groups.appendChild(expandableRow('建具・その他','🚪',constructionExtrasExpanded,()=>{
  constructionExtrasExpanded=!constructionExtrasExpanded;renderWallCategories();
 }));
 if(constructionExtrasExpanded){
  const otherList=document.createElement('div');otherList.className='nestedChoices floorTileChoices';
  for(const p of extras){
   const cv=document.createElement('canvas');cv.width=200;cv.height=152;
   otherList.appendChild(selectableTile(p.id,p.name,'建築用ブロック',cv));
   drawWallThumbnail(cv,p.id);
  }
  groups.appendChild(otherList);
 }
 root.appendChild(groups);
}

const OBJECT_GROUPS=[
 {id:'nature',label:'自然',icon:'treeRound',subgroups:[
  {id:'trees',label:'樹木',icon:'treeOak',items:['treeRound','treeBranch','treePine','treeBirch','treeOak','treeMaple','treeCherry','treeWillow','treeCedar','treeBamboo','treeAutumn','treeDead','treeStump']},
  {id:'shrubs',label:'低木・草花',icon:'bushFlower',items:['bush','bushFlower','bushFern']},
  {id:'rocks',label:'岩石',icon:'rockGranite',items:['rock','rockGranite','rockSandstone','rockBasalt','rockMossy','rockCluster','rockCliff','watersideRock']},
  {id:'wild',label:'倒木・草花・菌類',icon:'giantMushroom',items:['fallenLog','exposedRoots','mushroomPatch','giantMushroom','vineWall','flowerField','tallGrass']}
 ]},
 {id:'terrainParts',label:'斜面・崖・橋',icon:'slopeGrass',subgroups:[
  {id:'elevationStairs',label:'段差の階段',icon:'terrainStairs',items:['terrainStairs']},
  {id:'ramps',label:'斜面・段差',icon:'slopeGrass',items:['slopeGrass','slopeStone','terrainStep']},
  {id:'cliffs',label:'崖',icon:'cliffEdge',items:['cliffEdge','cliffFace']},
  {id:'streams',label:'小川・岸・浅瀬',icon:'streamBank',items:['streamBank','streamBend','streamShallow','streamFord']},
  {id:'bridges',label:'木橋・石橋',icon:'bridgeWood',items:['bridgeWood','bridgeWoodEnd','bridgeStone','bridgeStoneEnd']}
 ]},
 {id:'pineHarbor',label:'PINE・港湾と船着場',icon:'pineHarborPier',subgroups:[
  {id:'harborDecks',label:'桟橋・岸壁',icon:'pineHarborQuay',items:['pineHarborPier','pineHarborQuay']},
  {id:'harborFittings',label:'係留・荷役・照明',icon:'pineHarborBollard',items:['pineHarborBollard','pineHarborFender','pineHarborLamp','pineHarborPallet','pineHarborSign']}
 ]},
 {id:'multistory',label:'多階建て・塔',icon:'towerSpire',subgroups:[
  {id:'stairs',label:'階段',icon:'stairStraight',items:['stairStraight','stairSwitchback','stairSpiral']},
  {id:'tower',label:'塔の建材',icon:'towerWall',items:['towerWall','towerWindow','towerBattlement','towerSpire','towerPillar']}
 ]},
 {id:'fences',label:'柵・門・柱・梁',icon:'fenceWood',subgroups:[
  {id:'fenceWoodSet',label:'木柵',icon:'fenceWood',items:['fenceWood','fenceWoodCorner','fenceWoodEnd','fenceWoodGate']},
  {id:'fenceStoneSet',label:'石柵',icon:'fenceStone',items:['fenceStone','fenceStoneCorner','fenceStoneEnd','fenceStoneGate']},
  {id:'fenceIronSet',label:'鉄柵',icon:'fenceIron',items:['fenceIron','fenceIronCorner','fenceIronEnd','fenceIronGate']},
  {id:'woodFrameSet',label:'柱・梁・斜材',icon:'frameWoodPost',items:['frameWoodPost','frameWoodBeam','frameWoodBrace']}
 ]},
 {id:'villageLife',label:'村の屋外設備',icon:'wellStone',subgroups:[
  {id:'wells',label:'井戸',icon:'wellStone',items:['wellStone','wellWood']},
  {id:'marketStalls',label:'露店・屋台',icon:'marketStallCloth',items:['marketStallCloth','marketStallWood']},
  {id:'handcarts',label:'荷車',icon:'handcartEmpty',items:['handcartEmpty','handcartLoaded']}
 ]},
 {id:'oldTown',label:'旧市街・連棟住宅',icon:'oldTownCreamWindow',subgroups:[
  {id:'facades',label:'彩色外壁・窓・玄関',icon:'oldTownOchreWindow',items:['oldTownCreamWall','oldTownCreamWindow','oldTownCreamDoor','oldTownOchreWall','oldTownOchreWindow','oldTownOchreDoor','oldTownRoseWall','oldTownRoseWindow','oldTownRoseDoor','oldTownMintWall','oldTownMintWindow','oldTownMintDoor','oldTownBlueWall','oldTownBlueWindow','oldTownBlueDoor','oldTownSandWall','oldTownSandWindow','oldTownSandDoor']},
  {id:'landmarks',label:'街の塔',icon:'oldTownTower',items:['oldTownCreamShop','oldTownOchreShop','oldTownRoseShop','oldTownMintShop','oldTownBlueShop','oldTownSandShop','oldTownTower','oldTownQuay','oldTownShop','oldTownSign','oldTownAwning','oldTownFlowerBox','oldTownShutters','oldTownStreetLamp']}
 ]},
 {id:'roofs',label:'家屋・屋根',icon:'roofTile',subgroups:[
  {id:'roofMaterial',label:'屋根3素材・自動接続',icon:'roofTile',items:['roofTile','roofThatch','roofPlank']},
  {id:'roofResidential',label:'住宅向け・屋根6形状',icon:'roofSteep',items:['roofSteep','roofHip','roofCross','roofDormer','roofLean','roofThatchThick']},
  {id:'roofPieces',label:'屋根の棟・端・角',icon:'roofTileRidge',items:['roofTileRidge','roofThatchRidge','roofPlankRidge','roofTileEnd','roofThatchEnd','roofPlankEnd','roofCorner']},
  {id:'architecture',label:'外装・建具',icon:'chimney',items:['chimney','archStone','timberWall','balcony','roofRuin']}
 ]},
 {id:'furniture',label:'家具・室内',icon:'bed',subgroups:[
  {id:'roundTables',label:'丸テーブル',icon:'roundTableWood',items:['roundTableWood','roundTableStone','roundTableSet']},
  {id:'tableware',label:'食器',icon:'plateCeramic',items:['plateWood','plateCeramic','bowlClay','cupWood','mugCeramic','jugClay']},
  {id:'tabletopSmall',label:'食べ物・小物',icon:'basketProduce',items:['basketProduce','breadBoard','smallFlowerVase']},
  {id:'furnishing',label:'家具',icon:'bed',items:['table','bed','bedLuxury','chairWood','chairClassic','stoolRound','benchWood','bookshelf','wardrobe']},
  {id:'lightheat',label:'照明・暖房',icon:'fireplace',items:['fireplace','lantern','candleStand']},
  {id:'goods',label:'生活・商店',icon:'barrel',items:['barrel','crate','sack','displayShelf']}
 ]},
 {id:'ruinBuilding',label:'破損した建材',icon:'ruinWallJagged',subgroups:[
  {id:'ruinWalls',label:'崩れた壁',icon:'ruinWallLow',items:['ruinWallLow','ruinWallJagged']},
  {id:'ruinRoofs',label:'破損した屋根',icon:'ruinRoofHole',items:['ruinRoofHole','ruinRoofCollapse']},
  {id:'ruinPosts',label:'折れた柱',icon:'ruinWoodPost',items:['ruinWoodPost','ruinStonePost']},
  {id:'ruinFloors',label:'破損した床',icon:'ruinFloorCrack',items:['ruinFloorCrack','ruinFloorHole']},
  {id:'ruinDoors',label:'壊れた扉',icon:'ruinDoorHanging',items:['ruinDoorHanging','ruinDoorBroken']},
  {id:'ruinWindows',label:'壊れた窓',icon:'ruinWindowEmpty',items:['ruinWindowEmpty','ruinWindowShattered']}
 ]},
 {id:'ruins',label:'廃墟・ダンジョン',icon:'ancientAltar',items:['brokenPillar','crackedWall','ironGate','gravestone','sarcophagus','stairDown','ancientAltar','rubble']},
 {id:'kitchens',label:'キッチン',icon:'kitchenStove',items:['kitchenStove','kitchenCounter','kitchenSink']},
 {id:'bathrooms',label:'風呂',icon:'bathWood',items:['bathWood','bathStone','bathLuxury']},
 {id:'storage',label:'収納・設備',icon:'rewardChest',items:['chest','rewardChest']},
 {id:'decorations',label:'看板・装飾',icon:'innSign',items:['innSign','shopHerbSign','shopChestSign','shopBagSign']}
];
let openedObjectGroup=null,openedNatureSubgroup=null;
function appendObjectItems(parent,ids){
 const list=document.createElement('div');list.className='nestedChoices floorTileChoices';
 for(const id of ids){
  const p=catalog.get(id);if(!p)continue;
  const cv=document.createElement('canvas');cv.width=200;cv.height=152;
  list.appendChild(selectableTile(id,p.name,'3Dモデル・90°回転対応',cv));
  drawWallThumbnail(cv,id);
 }
 parent.appendChild(list);
}
function renderObjectList(){
 const root=$('decorList');root.replaceChildren();
 root.appendChild(expandableRow('オブジェクト','◈',objectExpanded,()=>{objectExpanded=!objectExpanded;renderObjectList()}));
 if(!objectExpanded)return;
 const groups=document.createElement('div');groups.className='nestedChoices';
 for(const group of OBJECT_GROUPS){
  const expanded=openedObjectGroup===group.id;
  groups.appendChild(expandableRow(group.label,'',expanded,()=>{
   openedObjectGroup=expanded?null:group.id;renderObjectList();
  },group.icon));
  if(!expanded)continue;
  if(group.subgroups){
   const nest=document.createElement('div');nest.className='nestedChoices';
   for(const sub of group.subgroups){
    const isOpen=openedNatureSubgroup===sub.id;
    nest.appendChild(expandableRow(sub.label,'',isOpen,()=>{
     openedNatureSubgroup=isOpen?null:sub.id;renderObjectList();
    },sub.icon));
    if(isOpen)appendObjectItems(nest,sub.items);
   }
   groups.appendChild(nest);
  }else appendObjectItems(groups,group.items);
 }
 root.appendChild(groups);
}
let characterExpanded=false,openedCharacterGroup=null;
const CHARACTER_GROUPS=[
 {id:'humans',label:'人間',icon:'humanVillager',items:['humanBare','humanVillager','humanMerchant','humanKnight']},
 {id:'monsters',label:'モンスター',icon:'monsterDragon',items:['monsterSlime','monsterGoblin','monsterSkeleton','monsterDragon']}
];
function renderCharacterList(){
 const root=$('characterList');root.replaceChildren();
 root.appendChild(expandableRow('キャラクターブロック','',characterExpanded,()=>{
  characterExpanded=!characterExpanded;renderCharacterList();
 },'humanVillager'));
 if(!characterExpanded)return;
 const groups=document.createElement('div');groups.className='nestedChoices';
 for(const group of CHARACTER_GROUPS){
  const open=openedCharacterGroup===group.id;
  groups.appendChild(expandableRow(group.label,'',open,()=>{
   openedCharacterGroup=open?null:group.id;renderCharacterList();
  },group.icon));
  if(open)appendObjectItems(groups,group.items);
 }
 root.appendChild(groups);
}

let equipmentExpanded=false;
const EQUIPMENT_IDS=['equipStick','equipClub','equipWoodSword','equipStoneSword','equipIronSword'];
function renderEquipmentList(){
 const root=$('equipmentList');root.replaceChildren();
 root.appendChild(expandableRow('武器','',equipmentExpanded,()=>{
  equipmentExpanded=!equipmentExpanded;renderEquipmentList();
 },'equipIronSword'));
 if(equipmentExpanded)appendObjectItems(root,EQUIPMENT_IDS);
}

let roadExpanded=false,roadOpenGroup=null,roadMode='auto';
const ROAD_GROUPS=[
 ['自然の道',["roadDirt","roadGravel","roadMoss","roadMud"]],
 ['人工の道',["roadCobble","roadCutStone","roadBrick","roadPlank"]],
 ['廃墟・特殊な道',["roadBroken","roadAncient","roadBasalt","roadRoyal"]]
];
function renderRoadList(){
 const root=$('roadList');root.replaceChildren();
 root.appendChild(expandableRow('道タイル・自動接続／1マス全面','',roadExpanded,()=>{roadExpanded=!roadExpanded;renderRoadList()},'roadCobble'));
 if(!roadExpanded)return;
 const toggle=document.createElement('div');toggle.className='row';toggle.style.gap='8px';
 for(const [value,label] of [['auto','自動接続'],['full','1マス全面']]){
  const btn=document.createElement('button');btn.type='button';btn.textContent=label;
  btn.style.flex='1';btn.className=roadMode===value?'selected':'';
  btn.setAttribute('aria-pressed',String(roadMode===value));
  btn.addEventListener('click',()=>{roadMode=value;
   if(ROAD_IDS.has(selected)){selected=baseRoad(selected)+(value==='full'?'Full':'');mode='place'}
   renderRoadList();updateSelected();
  });toggle.appendChild(btn);
 }
 root.appendChild(toggle);
 const nest=document.createElement('div');nest.className='nestedChoices';
 ROAD_GROUPS.forEach(([label,ids],index)=>{
  const open=roadOpenGroup===index;
  nest.appendChild(expandableRow(label,'',open,()=>{roadOpenGroup=open?null:index;renderRoadList()},ids[0]));
  if(open){
   const list=document.createElement('div');list.className='nestedChoices floorTileChoices';
   ids.forEach(base=>{
    const id=base+(roadMode==='full'?'Full':'');
    list.appendChild(selectableTile(id,catalog.get(base).name,
      roadMode==='full'?'独立した1マス全面舗装':'同素材の道と自動接続・外縁を描画',
      createFloorThumb(id)));
   });nest.appendChild(list);
  }
 });
 root.appendChild(nest);
}
function refreshPalette(){
 renderRoadList();
 renderEquipmentList();
 renderCharacterList();
 renderWallCategories();
 renderObjectList();
 $('customList').replaceChildren(...models.map(m=>mkButton(m.id,{name:m.name,icon:'◈'})));
 $('prefabList').replaceChildren(...prefabs.map(p=>mkButton(p.id,{name:p.name,icon:'⌂'})));
 updateSelected();
}
function numeric(id,fallback=0){const v=Number($(id).value);return Number.isFinite(v)?v:fallback}

let selectedPart=-1,previewYaw=Math.PI/4,previewZoom=1.25,previewPointer=null;
const previewCanvas=$('preview'),pgl=previewCanvas.getContext('webgl',{antialias:true,alpha:false,powerPreference:'low-power'});
let previewProgram=null,previewLoc=null;
if(pgl){try{
const vertex=pgl.createShader(pgl.VERTEX_SHADER);pgl.shaderSource(vertex,VERT);pgl.compileShader(vertex);
const fragment=pgl.createShader(pgl.FRAGMENT_SHADER);pgl.shaderSource(fragment,FRAG);pgl.compileShader(fragment);
previewProgram=pgl.createProgram();pgl.attachShader(previewProgram,vertex);pgl.attachShader(previewProgram,fragment);pgl.linkProgram(previewProgram);
if(!pgl.getProgramParameter(previewProgram,pgl.LINK_STATUS))throw Error('WebGL link error');
previewLoc={p:pgl.getAttribLocation(previewProgram,'aPos'),n:pgl.getAttribLocation(previewProgram,'aNorm'),c:pgl.getAttribLocation(previewProgram,'aCol'),mvp:pgl.getUniformLocation(previewProgram,'uMVP')};pgl.enable(pgl.DEPTH_TEST);
}catch(e){previewProgram=null}}
function previewProject(x,y,z){
const sw=previewCanvas.width,sh=previewCanvas.height,scale=2.5/previewZoom;
const eye=[Math.sin(previewYaw)*7,5.6,Math.cos(previewYaw)*7];
const vp=mult(ortho(-scale*sw/sh,scale*sw/sh,-scale,scale,.1,80),look(eye,[0,.45,0]));
const v=[x,y,z,1],clip=[0,0,0,0];for(let row=0;row<4;row++)for(let k=0;k<4;k++)clip[row]+=vp[k*4+row]*v[k];
return [sw*(clip[0]/clip[3]+1)/2,sh*(1-clip[1]/clip[3])/2];
}
function updateParts(){
const el=$('parts');el.textContent='';
for(let i=0;i<modelParts.length;i++){const p=modelParts[i],r=document.createElement('div');r.className='partRow';if(i===selectedPart)r.style.outline='2px solid #e2c38f';
const txt=document.createElement('span');txt.textContent=(i+1)+'. '+p.w.toFixed(2)+'×'+p.h.toFixed(2)+'×'+p.d.toFixed(2)+' '+p.color;
const select=document.createElement('button');select.textContent=i===selectedPart?'選択中':'選択';select.addEventListener('click',()=>selectPart(i));
r.append(txt,select);el.appendChild(r)}
drawPreview();
}
function selectPart(i){selectedPart=i;if(i>=0&&modelParts[i]){
const p=modelParts[i];for(const [id,k] of [['partX','x'],['partY','y'],['partZ','z'],['partW','w'],['partH','h'],['partD','d']])$(id).value=String(p[k]);$('partColor').value=p.color}updateParts()}
function drawPreview(){
if(!previewProgram){const g=previewCanvas.getContext('2d');if(g){g.fillStyle='#182d27';g.fillRect(0,0,previewCanvas.width,previewCanvas.height);g.fillStyle='#eee';g.fillText('WebGLが使用できません',15,30)}return}
const w=Math.max(1,Math.round(previewCanvas.clientWidth*Math.min(devicePixelRatio||1,1.5))),h=Math.max(1,Math.round(previewCanvas.clientHeight*Math.min(devicePixelRatio||1,1.5)));
if(previewCanvas.width!==w||previewCanvas.height!==h){previewCanvas.width=w;previewCanvas.height=h}
pgl.viewport(0,0,w,h);pgl.clearColor(.085,.16,.13,1);pgl.clear(pgl.COLOR_BUFFER_BIT|pgl.DEPTH_BUFFER_BIT);
const m=mesh();const gridCol=[.27,.43,.34];for(let i=-4;i<=4;i++){cube(m,i*.5,-.028,0, .012,.015,4.1,gridCol);cube(m,0,-.028,i*.5,4.1,.015,.012,gridCol)}
for(let i=0;i<modelParts.length;i++){const part=modelParts[i];cube(m,part.x,part.y,part.z,part.w,part.h,part.d,hexRGB(part.color));
if(i===selectedPart){const x=part.x,y=part.y,z=part.z,w=part.w+.045,d=part.d+.045,H=part.h+.045,c=[1,.74,.23],t=.025;
for(const yy of [y,y+H]){cube(m,x,yy,z-d/2,w,t,t,c);cube(m,x,yy,z+d/2,w,t,t,c);cube(m,x-w/2,yy,z,t,t,d,c);cube(m,x+w/2,yy,z,t,t,d,c)}
for(const xx of [x-w/2,x+w/2])for(const zz of [z-d/2,z+d/2])cube(m,xx,y,zz,t,H,t,c)}
}
const angle=previewYaw,eye=[Math.sin(angle)*7,5.6,Math.cos(angle)*7],lookAt=[0,.45,0],scale=2.5/previewZoom,aspect=w/h;
const vp=mult(ortho(-scale*aspect,scale*aspect,-scale,scale,.1,80),look(eye,lookAt));
const buffer=pgl.createBuffer(),count=m.p.length/3,array=new Float32Array(count*9);
for(let i=0;i<count;i++){for(let j=0;j<3;j++){array[i*9+j]=m.p[i*3+j];array[i*9+j+3]=m.n[i*3+j];array[i*9+j+6]=m.c[i*3+j]}}
pgl.bindBuffer(pgl.ARRAY_BUFFER,buffer);pgl.bufferData(pgl.ARRAY_BUFFER,array,pgl.STREAM_DRAW);pgl.useProgram(previewProgram);
for(const [a,offset] of [[previewLoc.p,0],[previewLoc.n,12],[previewLoc.c,24]]){pgl.enableVertexAttribArray(a);pgl.vertexAttribPointer(a,3,pgl.FLOAT,false,36,offset)}
pgl.uniformMatrix4fv(previewLoc.mvp,false,vp);pgl.drawArrays(pgl.TRIANGLES,0,count);pgl.deleteBuffer(buffer);
}
function selectedEdit(fn){if(selectedPart<0||!modelParts[selectedPart]){toast('まず3Dパーツを選択してね');return}fn(modelParts[selectedPart]);selectPart(selectedPart)}
$('updatePart').addEventListener('click',()=>selectedEdit(p=>{const q={x:numeric('partX'),y:numeric('partY'),z:numeric('partZ'),w:numeric('partW'),h:numeric('partH'),d:numeric('partD'),color:$('partColor').value};if(!validModel({id:'custom-edit',name:'編集',parts:[q]})){toast('数値が範囲外です');return}Object.assign(p,q)}));
$('duplicatePart').addEventListener('click',()=>{if(selectedPart<0||modelParts.length>=100)return toast('パーツを選択してください');const p={...modelParts[selectedPart],x:modelParts[selectedPart].x+.2,z:modelParts[selectedPart].z+.2};modelParts.push(p);selectPart(modelParts.length-1)});
$('deletePart').addEventListener('click',()=>{if(selectedPart<0)return;modelParts.splice(selectedPart,1);selectPart(Math.min(selectedPart,modelParts.length-1))});
$('moveUp').addEventListener('click',()=>selectedEdit(p=>p.y=Math.min(8,Math.round((p.y+.1)*100)/100)));
$('moveDown').addEventListener('click',()=>selectedEdit(p=>p.y=Math.max(-8,Math.round((p.y-.1)*100)/100)));
$('growPart').addEventListener('click',()=>selectedEdit(p=>{for(const k of ['w','h','d'])p[k]=Math.min(8,Math.round((p[k]+.1)*100)/100)}));
$('shrinkPart').addEventListener('click',()=>selectedEdit(p=>{for(const k of ['w','h','d'])p[k]=Math.max(.05,Math.round((p[k]-.1)*100)/100)}));
$('orbitLeft').addEventListener('click',()=>{previewYaw-=Math.PI/8;drawPreview()});
$('orbitRight').addEventListener('click',()=>{previewYaw+=Math.PI/8;drawPreview()});
$('modelZoomIn').addEventListener('click',()=>{previewZoom=Math.min(3,previewZoom*1.2);drawPreview()});
$('modelZoomOut').addEventListener('click',()=>{previewZoom=Math.max(.5,previewZoom/1.2);drawPreview()});
const modelTouches=new Map();let modelLastMid=null;
previewCanvas.addEventListener('pointerdown',e=>{previewCanvas.setPointerCapture(e.pointerId);modelTouches.set(e.pointerId,{x:e.clientX,y:e.clientY});if(modelTouches.size!==1){previewPointer=null;return}
const box=previewCanvas.getBoundingClientRect(),px=(e.clientX-box.left)/box.width*previewCanvas.width,py=(e.clientY-box.top)/box.height*previewCanvas.height;
let best=-1,dist=70;for(let i=0;i<modelParts.length;i++){const part=modelParts[i],p=previewProject(part.x,part.y+part.h/2,part.z);const d=Math.hypot((px-p[0])/previewCanvas.width*box.width,(py-p[1])/previewCanvas.height*box.height);if(d<dist){best=i;dist=d}}
if(best>=0)selectPart(best);previewPointer={id:e.pointerId,x:e.clientX,y:e.clientY};});
previewCanvas.addEventListener('pointermove',e=>{if(!modelTouches.has(e.pointerId))return;modelTouches.set(e.pointerId,{x:e.clientX,y:e.clientY});
if(modelTouches.size>=2){const pts=[...modelTouches.values()],mid=(pts[0].x+pts[1].x)/2;if(modelLastMid!==null)previewYaw+=(mid-modelLastMid)*.01;modelLastMid=mid;drawPreview();return}
modelLastMid=null;if(!previewPointer||previewPointer.id!==e.pointerId||selectedPart<0)return;
const dx=e.clientX-previewPointer.x,dy=e.clientY-previewPointer.y;previewPointer.x=e.clientX;previewPointer.y=e.clientY;
const p=modelParts[selectedPart],speed=5/(Math.max(1,previewCanvas.clientHeight)*previewZoom);
const u=dx*speed,v=dy*speed;
p.x=Math.max(-8,Math.min(8,p.x+u*Math.cos(previewYaw)+v*Math.sin(previewYaw)));
p.z=Math.max(-8,Math.min(8,p.z-u*Math.sin(previewYaw)+v*Math.cos(previewYaw)));
updateParts();
});
for(const name of ['pointerup','pointercancel','lostpointercapture'])previewCanvas.addEventListener(name,e=>{modelTouches.delete(e.pointerId);if(previewPointer?.id===e.pointerId)previewPointer=null;if(modelTouches.size<2)modelLastMid=null});
function validModel(m){if(!m||typeof m.id!=='string'||!/^custom-[a-z0-9-]{1,32}$/.test(m.id)||typeof m.name!=='string'||m.name.length>40||!Array.isArray(m.parts)||m.parts.length>100)return false;return m.parts.every(p=>['x','y','z','w','h','d'].every(k=>Number.isFinite(p[k])&&Math.abs(p[k])<=8)&&p.w>=.04&&p.h>=.04&&p.d>=.04&&safeColor(p.color))}
