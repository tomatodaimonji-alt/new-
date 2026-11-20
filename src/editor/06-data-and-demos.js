function loadData(o){if(!o||o.format!=='forest-world-v1'||o.version!==1||!Array.isArray(o.world)||!Array.isArray(o.models)||o.world.length>40000||o.models.length>80)throw Error('データ形式または件数が不正です');
const newW=o.width??o.size,newH=o.height??o.size;
if(!Number.isInteger(newW)||!Number.isInteger(newH)||newW<MIN_MAP||newW>MAX_MAP||newH<MIN_MAP||newH>MAX_MAP)throw Error('マップの広さが不正です');
const blocks=o.prefabs||[];if(!Array.isArray(blocks)||blocks.length>100)throw Error('設計図の数が多すぎます');
if(!o.models.every(validModel))throw Error('モデルの内容が不正です');
const heights=o.terrainHeights??[];
if(!Array.isArray(heights)||heights.length>MAX_MAP*MAX_MAP||!heights.every(p=>p&&Number.isInteger(p.x)&&Number.isInteger(p.z)&&p.x>=0&&p.z>=0&&p.x<newW&&p.z<newH&&Number.isInteger(p.h)&&p.h>=1&&p.h<=TERRAIN_MAX))throw Error('地形の高さデータが不正です');const names=new Set([...palette.map(p=>p.id),...o.models.map(m=>m.id)]);
if(!blocks.every(f=>f&&/^prefab-[a-z0-9-]{1,32}$/.test(f.id)&&typeof f.name==='string'&&f.name.length<41&&Number.isInteger(f.w)&&Number.isInteger(f.h)&&f.w>0&&f.h>0&&f.w<=MAX_MAP&&f.h<=MAX_MAP&&Array.isArray(f.tiles)&&f.tiles.length<=650&&f.tiles.every(t=>t&&Number.isInteger(t.x)&&t.x>=0&&t.x<f.w&&Number.isInteger(t.z)&&t.z>=0&&t.z<f.h&&Number.isInteger(t.y)&&t.y>=0&&t.y<=MAX_LEVEL&&names.has(t.type)&&Number.isInteger(t.rot)&&t.rot>=0&&t.rot<4)))throw Error('設計図の内容が不正です');if(!o.world.every(p=>p&&p.x>=0&&p.z>=0&&Number.isInteger(p.x)&&Number.isInteger(p.z)&&p.x<newW&&p.z<newH&&Number.isInteger(p.y)&&p.y>=0&&p.y<=MAX_LEVEL&&typeof p.type==='string'&&names.has(p.type)&&Number.isInteger(p.rot)&&p.rot>=0&&p.rot<=3))throw Error('配置の内容が不正です');const incomingChecks=o.checks??[];
if(!Array.isArray(incomingChecks)||incomingChecks.length>300||
 !incomingChecks.every(p=>p&&Number.isInteger(p.x)&&Number.isInteger(p.z)&&Number.isInteger(p.y)&&
 p.x>=0&&p.z>=0&&p.x<newW&&p.z<newH&&p.y>=0&&p.y<=MAX_LEVEL&&PINE_CHECK_COLORS.includes(p.color)))
 throw Error('チェックデータが不正です');
pineCheckMarks=incomingChecks.map(p=>({...p}));pineCheckNodes.clear();
$('pineCheckOverlay').replaceChildren();pineCheckRefresh();
MAP_W=newW;MAP_H=newH;terrainHeights=new Map(heights.map(p=>[terrainKey(p.x,p.z),p.h]));world=o.world.map(p=>({...p}));worldMaxLevel=world.reduce((top,p)=>Math.max(top,p.y),0);models=o.models.map(m=>({...m,parts:m.parts.map(p=>({...p}))}));prefabs=blocks.map(f=>({...f,tiles:f.tiles.map(t=>({...t}))}));selected='wall';rotation=0;mode='place';level=0;$('level').value='0';$('mapWidth').value=MAP_W;$('mapHeight').value=MAP_H;for(const id of ['rangeX1','rangeX2'])$(id).max=MAP_W-1;for(const id of ['rangeZ1','rangeZ2'])$(id).max=MAP_H-1;cursorDirty=true;refreshPalette();}
function displayJSON(){$('jsonText').value=JSON.stringify(data(),null,2)}











function auditWorld(){
 const problems=[],warnings=[],key=(x,z,y)=>x+','+z+','+y;
 const floors=new Map(),structures=new Map(),stairways=[],road=new Set();
 const isRoof=t=>RESIDENTIAL_ROOFS.has(t)||AUTO_ROOFS.has(t);
 const isWallPart=t=>/^(?:oldTown(?:Cream|Ochre|Rose|Mint|Blue|Sand)(?:Wall|Window|Door|Shop)|(?:plasterwall|woodwall|stonewall|brickwall)(?:Plain|Window|Door))$/.test(t);
 for(const p of world){
  if(!Number.isInteger(p.x)||!Number.isInteger(p.z)||!Number.isInteger(p.y)||
     p.x<0||p.z<0||p.x>=MAP_W||p.z>=MAP_H||p.y<0||p.y>MAX_LEVEL){
   problems.push('マップ外の配置 '+JSON.stringify([p.x,p.z,p.y]));continue;
  }
  const k=key(p.x,p.z,p.y);
  if(isFloor(p.type)){
   floors.set(k,p);
   if(p.y===0&&ROAD_IDS.has(p.type))road.add(p.x+','+p.z);
  }else{
   if(!structures.has(k))structures.set(k,[]);
   structures.get(k).push(p);
   if(p.type==='terrainStairs')stairways.push(p);
   if(p.y===0&&BRIDGE_IDS.has(p.type))road.add(p.x+','+p.z);
  }
 }
 const at=(x,z,y)=>structures.get(key(x,z,y))||[];
 const townFloor=p=>['woodfloor','woodfloorLight','woodfloorDark','plasterfloor','brickfloor'].includes(p?.type);
 let checkedWalls=0,checkedRoofs=0;
 const dirs=[[0,-1],[1,0],[0,1],[-1,0]];
 for(const p of floors.values()){
  if(!townFloor(p))continue;
  const layer=at(p.x,p.z,p.y);
  // Only test occupied building floors; the outer shell must be a wall
  // on each exposed face. Same-tile shop signs remain valid decoration.
  const external=dirs.some(([dx,dz])=>!townFloor(floors.get(key(p.x+dx,p.z+dz,p.y))));
  if(external){
   checkedWalls++;
   if(!layer.some(o=>isWallPart(o.type)))problems.push('外壁の欠け '+key(p.x,p.z,p.y));
  }
  if(!townFloor(floors.get(key(p.x,p.z,p.y+1)))){
   checkedRoofs++;
   if(!at(p.x,p.z,p.y+1).some(o=>isRoof(o.type)))
    problems.push('屋根の欠け '+key(p.x,p.z,p.y+1));
  }
 }
 const stairsOK=[];
 for(const o of stairways){
  const [dx,dz]=STAIR_DIRECTIONS[o.rot||0]||[0,-1];
  const target=terrainLevel(o.x+dx,o.z+dz),base=terrainLevel(o.x,o.z);
  const valid=target===base+1;
  stairsOK.push(valid);
  if(!valid)problems.push('段差に接続しない階段 '+key(o.x,o.z,o.y));
 }
 // Road network components: informational only, since isolated private lanes
 // can be intentional. Walkable lanes must connect along cardinal tile edges.
 let components=0;const unseen=new Set(road);
 while(unseen.size){
  components++;
  const first=unseen.values().next().value,queue=[first];
  unseen.delete(first);
  for(let n=0;n<queue.length;n++){
   const [x,z]=queue[n].split(',').map(Number);
   for(const [dx,dz] of dirs){const next=(x+dx)+','+(z+dz);
    if(unseen.delete(next))queue.push(next);
   }
  }
 }
 if(components>1)warnings.push('道路が'+components+'つの領域に分かれています（橋・私道は別扱い）');
 return {problems,warnings,checkedWalls,checkedRoofs,checkedStairs:stairsOK.length,
  objects:world.length,roadComponents:components};
}
function showWorldAudit(){
 const report=auditWorld(),num=report.problems.length;
 const lines=[
  '配置チェック結果',
  '外壁 '+report.checkedWalls+'面 / 屋根 '+report.checkedRoofs+'マス / 階段 '+report.checkedStairs+'か所を確認',
  num?'問題 '+num+'件':'重大な配置エラーは検出されませんでした',
  ...report.problems.slice(0,12),
  ...report.warnings
 ];
 if(num>12)lines.push('ほか '+(num-12)+'件');
 alert(lines.join('\n'));toast('配置チェック：'+num+'件の問題');
}


function makePineHarborDemo(){
 if(world.length&&!confirm('現在の配置を48×40のPINE上陸艇・軍港見本に置き換えますか？先にJSONを保存してください。'))return;
 snapshot();MAP_W=48;MAP_H=40;world=[];terrainHeights=new Map();
 const add=(x,z,type,y=0,rot=0)=>{
  if(x>=0&&z>=0&&x<48&&z<40)world.push({x,z,y,type,rot});
 };
 // 1m tiles: a paved operations apron, a concrete quay and deep-water berth.
 for(let z=0;z<40;z++)for(let x=0;x<48;x++){
  const water=z>=19,ground=z>=14?'roadCutStoneFull':
    x%7===0?'roadCobbleFull':'grassWild';
  add(x,z,water?'sea':ground);
  if(!water)terrainHeights.set(terrainKey(x,z),1);
 }
 for(let z=17;z<=23;z++)for(let x=10;x<=40;x++)add(x,z,'pineHarborQuay',1);
 // 20-person assembly zone: a 5x4 group stays on the land apron.
 for(let z=11;z<=14;z++)for(let x=12;x<=16;x++)
  add(x,z,'roadCutStoneFull');
 // Two independently enterable service buildings with the proper roof/walls.
 for(const [bx,bz,w,d] of [[30,6,8,7],[8,5,7,6]]){
  const door=bx+Math.floor(w/2),front=bz+d-1;
  for(let z=bz;z<=front;z++)for(let x=bx;x<bx+w;x++){
   add(x,z,'woodfloor');
   const edge=x===bx||x===bx+w-1||z===bz||z===front;
   if(edge)add(x,z,z===front&&x===door?'plasterwallDoor':
    (z===bz||z===front)&&x>bx&&x<bx+w-1?'plasterwallWindow':'plasterwall',
    0,z===front?0:z===bz?2:x===bx?3:1);
   add(x,z,'roofHip',1);
  }
 }
 // Standalone ship entity using the exact in-game shared mesh.
 add(25,28,'pineLandingCraft');
 // Crew slots: five ranks of four to validate the usable deck dimensions.
 for(let row=0;row<4;row++)for(let col=0;col<5;col++)
  add(22+Math.round(col*1.5),26+Math.round(row*1.3),'humanKnight');
 // Dockside gear at quay edge rather than in the center lane.
 for(const [x,z,type] of [
  [11,18,'pineHarborLamp'],[39,18,'pineHarborLamp'],
  [16,23,'pineHarborBollard'],[24,23,'pineHarborBollard'],
  [30,23,'pineHarborBollard'],[36,23,'pineHarborBollard'],
  [19,23,'pineHarborFender'],[28,23,'pineHarborFender'],
  [14,17,'pineHarborPallet'],[34,17,'pineHarborPallet'],
  [30,14,'pineHarborSign'],[39,17,'pineHarborPallet']
 ])add(x,z,type);
 $('mapWidth').value=48;$('mapHeight').value=40;
 for(const id of ['rangeX1','rangeX2'])$(id).max=47;
 for(const id of ['rangeZ1','rangeZ2'])$(id).max=39;
 $('rangeX2').value=47;$('rangeZ2').value=39;
 level=0;$('level').value='0';hideUpper=false;$('hideUpper').checked=false;
 mode='move';yaw=Math.PI/4;showEntireMap();refreshPalette();commit();cursorDirty=true;
 toast('48×40：18×8上陸艇・20人分の甲板・軍港の岸壁と施設を生成');
}
function makeCityNature64Demo(){
 if(world.length&&!confirm('現在の配置を64×64の「川と丘の旧市街」に置き換えますか？先にJSON保存してください。'))return;
 snapshot();MAP_W=64;MAP_H=64;world=[];terrainHeights=new Map();
 const base=new Map(),buildings=new Map(),props=[],occupied=new Set(),roads=new Set(),water=new Set(),stairs=[];
 const W=64,H=64,K=(x,z,y=0)=>x+','+z+','+y,P=(x,z)=>x+','+z,valid=(x,z)=>x>=0&&z>=0&&x<W&&z<H;
 const rnd=(x,z,seed=0)=>surfaceNoise(x*13+seed*23+7,z*17+seed*19+3);
 const floor=(x,z,t,y=0)=>{if(valid(x,z))base.set(K(x,z,y),{x,z,y,type:t,rot:0})};
 const part=(x,z,t,y=0,rot=0)=>{if(valid(x,z))buildings.set(K(x,z,y),{x,z,y,type:t,rot})};
 const prop=(x,z,t,y=0,rot=0)=>{if(valid(x,z)&&!occupied.has(P(x,z))&&!water.has(P(x,z)))props.push({x,z,y,type:t,rot})};
 const raised=(x,z,h)=>{if(h)terrainHeights.set(terrainKey(x,z),h);else terrainHeights.delete(terrainKey(x,z))};
 const stamp=(x0,z0,x1,z1,h)=>{for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++)raised(x,z,h)};
 const path=(points,t='roadDirtFull',width=1)=>{
  for(let i=0;i<points.length-1;i++){
   let [x,z]=points[i];const [tx,tz]=points[i+1];
   for(let k=0;k<128;k++){
    for(let side=0;side<width;side++){
     const xx=x+(x===tx?side:0),zz=z+(x===tx?0:side);
     if(valid(xx,zz)&&!occupied.has(P(xx,zz))&&!water.has(P(xx,zz))){
      floor(xx,zz,t);roads.add(P(xx,zz));
     }
    }
    if(x===tx&&z===tz)break;
    if(x!==tx)x+=Math.sign(tx-x);else z+=Math.sign(tz-z);
   }
  }
 };
 // The terrain is tile-aligned. Broad lowlands carry the old town; stepped
 // northeast plateaus are connected at explicitly marked staircase cells.
 for(let z=0;z<H;z++)for(let x=0;x<W;x++){
  const n=rnd(x,z),urban=x>=6&&x<=44&&z>=20&&z<=50;
  const grass=urban?(n<.25?'grassPatch':n<.43?'grassTuft':'grassWild'):
   n<.10?'grassPebbles':n<.27?'grassPatch':n<.47?'grassFlowers':
   n<.69?'grassTuft':n<.82?'grassForest':'grassWild';
  floor(x,z,grass);raised(x,z,1);
 }
 // Northeast terraced hills: one step between successive plateaus.
 stamp(49,5,63,19,2);
 stamp(55,2,63,11,3);
 // The southern river has a definite wet channel. West/east banks become
 // irregular, but the central bridge is always seven tiles long.
 for(let x=0;x<64;x++){
  const north=x>=19&&x<=27?51:51+(x>44?Math.floor(rnd(x,7)*3):x<6?1:0);
  const south=x>=19&&x<=27?57:57+(x>44?Math.floor(rnd(x,19)*3):x<6?1:0);
  for(let z=north;z<=south;z++){
   raised(x,z,0);floor(x,z,'river');water.add(P(x,z));
  }
 }
 // The paved embankment contrasts with the informal natural bank farther east.
 for(let x=5;x<=43;x++)for(let z=48;z<=50;z++)floor(x,z,'roadCutStoneFull');
 for(let x=5;x<=43;x++)for(let z=58;z<=59;z++)if(!water.has(P(x,z)))floor(x,z,'roadCutStoneFull');
 for(let x=6;x<=42;x++)floor(x,47,'roadCobbleFull');
 for(let x=6;x<=42;x++)floor(x,39,'roadCobbleFull');
 // Main roads; paths are cardinal and wide enough for one-tile movement.
 path([[23,18],[23,39],[23,50]],'roadCobbleFull',2);
 path([[5,32],[45,32]],'roadCobbleFull',2);
 path([[5,24],[43,24]],'roadDirtFull');
 path([[12,6],[12,24]],'roadDirtFull');
 path([[34,18],[34,32]],'roadDirtFull');
 path([[44,21],[44,32]],'roadGravelFull');
 path([[23,58],[23,62]],'roadCutStoneFull',2);
 // Hill path and deliberate 1-level connections.
 path([[44,24],[54,24],[54,20],[54,12],[58,12]],'roadDirtFull');
 for(const [x,z,rot] of [[54,20,0],[58,12,0]]){
  part(x,z,'terrainStairs',0,rot);stairs.push([x,z,rot]);
 }
 // Bridge deck floats above water; its floor UNDERLAY remains river only.
 for(let z=51;z<=57;z++)for(let x=22;x<=24;x++)
  props.push({x,z,y:0,type:z===51||z===57?'bridgeStoneEnd':'bridgeStone',rot:z===57?2:0});
 // Densely packed painted townhouses, but no houses on the main street.
 const townhomes=[
  [6,40,3,7,3,'Cream','roofSteep'],[9,40,3,7,4,'Ochre','roofDormer'],
  [12,40,4,7,3,'Rose','roofHip'],[16,40,4,7,5,'Mint','roofSteep'],
  [26,40,3,7,3,'Blue','roofDormer'],[29,40,3,7,4,'Sand','roofHip'],
  [32,40,4,7,5,'Cream','roofSteep'],[36,40,3,7,4,'Ochre','roofDormer'],
  [39,40,4,7,3,'Rose','roofHip'],
  [7,34,4,5,3,'Sand','roofHip'],[11,34,4,5,4,'Blue','roofSteep'],
  [15,34,5,5,3,'Cream','roofDormer'],[27,34,4,5,3,'Mint','roofHip'],
  [31,34,5,5,4,'Rose','roofSteep'],[36,34,5,5,3,'Ochre','roofDormer']
 ].map(([x,z,w,d,n,c,roof])=>({x,z,w,d,n,c,roof,oldTown:true}));
 // More spacious houses, with gaps between individual plots.
 const suburbs=[
  [7,26,5,5,2,'plasterwall','roofSteep'],[14,26,5,5,2,'woodwall','roofThatchThick'],
  [28,26,5,5,2,'woodwall','roofDormer'],[36,26,5,5,1,'stonewall','roofHip'],
  [7,18,5,5,2,'woodwall','roofSteep'],[16,18,5,5,1,'plasterwall','roofThatchThick'],
  [28,18,5,5,2,'plasterwall','roofCross'],[37,18,5,5,1,'woodwall','roofHip']
 ].map(([x,z,w,d,n,mat,roof])=>({x,z,w,d,n,mat,roof,oldTown:false}));
 // Agricultural holdings are spread out with room for crops and sheds.
 const farms=[
  [4,7,5,5,1,'woodwall','roofThatchThick'],[20,9,5,5,1,'plasterwall','roofThatchThick'],
  [20,2,5,5,1,'woodwall','roofPlank']
 ].map(([x,z,w,d,n,mat,roof])=>({x,z,w,d,n,mat,roof,oldTown:false}));
 const houses=[...townhomes,...suburbs,...farms];
 for(const h of houses){
  for(let z=h.z;z<h.z+h.d;z++)for(let x=h.x;x<h.x+h.w;x++){
   if(!valid(x,z)||occupied.has(P(x,z)))throw Error('家屋が重複 '+P(x,z));
   occupied.add(P(x,z));
  }
 }
 // Construct floorplates and wall shells. Different-height townhouses receive
 // their exposed upper-level party walls; lower stories share a closed core.
 for(const h of houses){
  const material=h.oldTown?'oldTown'+h.c:h.mat;
  const front=h.z+h.d-1,door=h.x+Math.floor(h.w/2);
  for(let z=h.z;z<h.z+h.d;z++)for(let x=h.x;x<h.x+h.w;x++){
   for(let y=0;y<h.n;y++){
    floor(x,z,'woodfloor',y);
    const boundaries=[[0,1,0],[1,0,1],[0,-1,2],[-1,0,3]];
    const outside=boundaries.filter(([dx,dz])=>{
     const xx=x+dx,zz=z+dz,neighbor=houses.find(b=>xx>=b.x&&xx<b.x+b.w&&zz>=b.z&&zz<b.z+b.d);
     return !neighbor||neighbor.n<=y;
    });
    if(outside.length){
     const facing=z===front&&outside.some(([dx,dz])=>dx===0&&dz===1);
     const side=facing?[0,1,0]:outside[0];
     const entry=y===0&&facing&&x===door;
     const window=!entry&&facing&&(y>0||(x+z)%2===0);
     const shop=y===0&&facing&&h.oldTown&&x===h.x;
     const id=h.oldTown?material+(entry?'Door':shop?'Shop':window?'Window':'Wall'):
      material+(entry?'Door':window?'Window':'Plain');
     part(x,z,id,y,side[2]);
    }
   }
   part(x,z,h.roof,h.n);
  }
  // A front walk links detached homes to streets, without overwriting houses.
  if(!h.oldTown){
   const px=door;
   const start=[px,front+1],queue=[start],seen=new Set([P(...start)]),prev=new Map();
   let found=null;
   for(let qi=0;qi<queue.length&&qi<700;qi++){
    const [x,z]=queue[qi],k=P(x,z);
    if(roads.has(k)){found=k;break;}
    for(const [dx,dz] of [[0,1],[1,0],[-1,0],[0,-1]]){
     const xx=x+dx,zz=z+dz,nk=P(xx,zz);
     if(!valid(xx,zz)||water.has(nk)||occupied.has(nk)||seen.has(nk))continue;
     if(Math.abs(xx-px)+Math.abs(zz-front)>18)continue;
     seen.add(nk);prev.set(nk,k);queue.push([xx,zz]);
    }
   }
   if(found){
    let k=found;
    while(prev.has(k)){
     k=prev.get(k);const [xx,zz]=k.split(',').map(Number);
     floor(xx,zz,'roadDirtFull');roads.add(k);
    }
   }
  }
  if(h.oldTown){
   for(const [x,y,type] of [[h.x,0,'oldTownAwning'],
    [h.x+h.w-1,0,'oldTownSign'],[h.x,1,'oldTownFlowerBox']]){
    props.push({x,z:front,y,type,rot:0});
   }
  }else{
   prop(h.x,front+1,'barrel');
   prop(h.x+h.w-1,front+1,h.n>1?'smallFlowerVase':'basketProduce');
  }
 }
 // Farms are tiled earth with a mix of vegetables and grain, not grass carpets.
 for(const [x0,z0,x1,z1] of [[2,2,10,5],[2,13,10,16],[12,3,18,10],[26,3,34,10]]){
  for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){
   if(occupied.has(P(x,z))||roads.has(P(x,z)))continue;
   floor(x,z,'earth');
   if((x+z)%2===0)prop(x,z,'cropWheat');
   else if((x+z)%3===0)prop(x,z,'cropVegetable');
  }
 }
 // Fields and animal enclosure form a lived-in outer edge.
 for(let x=12;x<=18;x++){prop(x,13,'fenceWood');prop(x,17,'fenceWood');}
 for(let z=14;z<=16;z++){prop(12,z,'fenceWood',0,1);prop(18,z,'fenceWood',0,1);}
 for(const [x,z] of [[14,14],[16,15],[15,16]])prop(x,z,'sheepWool');
 // The old-town plaza is a modest opening rather than a huge empty square.
 for(let z=32;z<=33;z++)for(let x=20;x<=26;x++)
  if(!occupied.has(P(x,z)))floor(x,z,'roadCobbleFull');
 // Tree density increases away from the city. Keep roads, buildings and bridges clear.
 let treeCount=0;
 for(let z=0;z<51;z++)for(let x=0;x<64;x++){
  if(occupied.has(P(x,z))||roads.has(P(x,z))||water.has(P(x,z)))continue;
  const forest=x>=46&&z<=31,edge=x>=41&&z<36,west=x<=5&&z<33;
  const density=forest?.23:edge?.092:west?.045:.008;
  const n=rnd(x,z,31);
  if(n<density&&((x*3+z)%4!==0)){
   const t=['treeOak','treePine','treeBirch','treeCedar','treeRound'][Math.floor(rnd(x,z,53)*5)];
   prop(x,z,t);treeCount++;
  }else if(n<density+.085&&forest){
   prop(x,z,rnd(x,z,19)<.5?'bushFern':'rockMossy');
  }
 }
 // Scenic lookout and ruin on the upper terrace.
 for(const [x,z,t] of [[58,6,'stonePillar'],[60,7,'rockMossy'],[57,8,'benchWood'],
 [54,21,'rockGranite'],[48,28,'bushFlower'],[51,25,'fallenLog'],
 [8,48,'benchWood'],[18,48,'handcartLoaded'],[31,49,'crate'],
 [40,48,'benchWood'],[25,37,'wellStone'],[20,34,'barrel'],
 [8,33,'basketProduce'],[30,30,'smallFlowerVase'],
 [11,12,'handcartEmpty'],[20,7,'basketProduce'],
 [23,49,'humanMerchant'],[28,48,'humanVillager'],
 [10,33,'humanVillager'],[36,33,'humanVillager'],
 [18,23,'humanVillager'],[6,11,'humanVillager']])prop(x,z,t);
 // Unified quay crest; ground cliff remains solid beneath the walkway.
 for(let x=5;x<=43;x++)prop(x,50,'oldTownQuay');
 // South landing provides a destination instead of a bridge to nowhere.
 for(const [x,z,t] of [[19,60,'treeBirch'],[31,61,'treeOak'],
 [27,59,'benchWood'],[15,61,'bushFlower']])prop(x,z,t);
 world=[...base.values(),...buildings.values(),...props];
 $('mapWidth').value=W;$('mapHeight').value=H;
 for(const id of ['rangeX1','rangeX2'])$(id).max=W-1;
 for(const id of ['rangeZ1','rangeZ2'])$(id).max=H-1;
 $('rangeX2').value=W-1;$('rangeZ2').value=H-1;
 level=0;$('level').value='0';hideUpper=false;$('hideUpper').checked=false;
 mode='move';selected='roadCobbleFull';rotation=0;yaw=Math.PI/4;
 showEntireMap();refreshPalette();commit();cursorDirty=true;
 toast('64×64：旧市街・住宅地・畑・川・森・丘を生成');
}

function makeOldTownV2Demo(){makeOldTownRiverDemo(true)}
function makeOldTownRiverDemo(upgraded=false){
 if(world.length&&!confirm('現在の配置を川沿い旧市街に置き換えますか？先にJSON保存してください。'))return;
 snapshot();MAP_W=24;MAP_H=24;world=[];terrainHeights=new Map();
 const ground=new Map(),structures=new Map(),items=[],occupied=new Set(),paths=new Set();
 const K=(x,z,y=0)=>x+','+z+','+y,P=(x,z)=>x+','+z;
 const valid=(x,z)=>x>=0&&z>=0&&x<24&&z<24;
 const floor=(x,z,t,y=0)=>{if(valid(x,z))ground.set(K(x,z,y),{x,z,y,type:t,rot:0})};
 const part=(x,z,t,y=0,rot=0)=>{if(valid(x,z))structures.set(K(x,z,y),{x,z,y,type:t,rot})};
 const item=(x,z,t,y=0,rot=0)=>{if(valid(x,z)&&!occupied.has(P(x,z)))items.push({x,z,y,type:t,rot})};
 // The southern waterside borders a continuous low stone embankment.
 // The topography is built at height 1 until the water's edge.
 for(let z=0;z<=18;z++)for(let x=0;x<24;x++)terrainHeights.set(terrainKey(x,z),1);
 for(let z=0;z<24;z++)for(let x=0;x<24;x++){
  const v=surfaceNoise(x*9+3,z*11+7);
  floor(x,z,z>=19?'river':v<.20?'grassPatch':v<.40?'grassFlowers':'grassWild');
 }
 for(let z=15;z<=18;z++)for(let x=0;x<24;x++){floor(x,z,'roadCutStoneFull');paths.add(P(x,z));}
 for(let z=7;z<=8;z++)for(let x=0;x<24;x++){floor(x,z,'roadCobbleFull');paths.add(P(x,z));}
 for(let z=1;z<=14;z++)for(const x of [6,18]){
  floor(x,z,'roadCobbleFull');paths.add(P(x,z));
 }
 // Old town block: six narrow townhouses share side boundaries.
 const townhomes=[
  {x:0,w:3,z:9,d:6,n:3,c:'Cream',roof:'roofSteep'},
  {x:3,w:3,z:9,d:6,n:4,c:'Ochre',roof:'roofDormer'},
  {x:7,w:3,z:9,d:6,n:3,c:'Rose',roof:'roofHip'},
  {x:10,w:3,z:9,d:6,n:5,c:'Mint',roof:'roofSteep'},
  {x:13,w:3,z:9,d:6,n:4,c:'Blue',roof:'roofDormer'},
  {x:16,w:2,z:9,d:6,n:3,c:'Sand',roof:'roofHip'}
 ];
 const backhomes=[
  {x:0,w:5,z:1,d:5,n:3,c:'Sand',roof:'roofHip'},
  {x:7,w:4,z:1,d:5,n:3,c:'Rose',roof:'roofSteep'},
  {x:11,w:4,z:1,d:5,n:4,c:'Cream',roof:'roofDormer'},
  {x:15,w:3,z:1,d:5,n:3,c:'Ochre',roof:'roofSteep'}
 ];
 const buildings=[...townhomes,...backhomes];
 for(const h of buildings)for(let z=h.z;z<h.z+h.d;z++)for(let x=h.x;x<h.x+h.w;x++){
  if(occupied.has(P(x,z)))throw Error('家屋重複 '+P(x,z));
  occupied.add(P(x,z));
 }
 for(const h of buildings){
  const frontZ=h.z+h.d-1,frontX=h.x+Math.floor(h.w/2);
  for(let z=h.z;z<h.z+h.d;z++)for(let x=h.x;x<h.x+h.w;x++){
   for(let y=0;y<h.n;y++){
    floor(x,z,'woodfloor',y);
    const edges=[[0,-1,2],[1,0,1],[0,1,0],[-1,0,3]].filter(([dx,dz])=>
     !occupied.has(P(x+dx,z+dz)) || (z===frontZ && dz===1));
    // Only true exterior walls; shared party walls remain solid.
    if(edges.length){
     const face=edges[0],isFront=z===frontZ&&face[1]===1;
     const isDoor=isFront&&y===0&&x===frontX;
     const hasWindow=isFront&&y>=1 || (isFront&&x!==frontX&&y===0);
     part(x,z,'oldTown'+h.c+(isDoor?'Door':hasWindow?'Window':'Wall'),y,face[2]);
    }else{
     // Interior walls exist within each townhouse at upper floors only when needed.
    }
   }
   part(x,z,h.roof,h.n,0);
  }
 }
 // A small municipal tower anchors the east corner without needing a huge cathedral.
 for(let z=9;z<=14;z++)for(let x=19;x<=22;x++){
  occupied.add(P(x,z));
  for(let y=0;y<3;y++){
   floor(x,z,'stone',y);
   const edge=x===19||x===22||z===9||z===14;
   if(edge)part(x,z,y===0&&z===14&&x===20?'oldTownCreamDoor':
     (x===19||x===22||z===14)?'oldTownCreamWindow':'oldTownCreamWall',y,z===14?0:2);
  }
  part(x,z,'roofHip',3,0);
 }
 // Place the tower on top of a clear central roof location.
 part(20,11,'oldTownTower',3,0);
 // Flat stone quays: the terrain's exposed side is the river wall,
 // with a slight repeating coping line along the waterfront.
 for(let x=0;x<24;x++){
  item(x,18,'oldTownQuay',0,0);
 }
 for(const [x,z,t] of [[1,16,'benchWood'],[4,17,'barrel'],[8,16,'handcartLoaded'],
 [12,17,'crate'],[15,16,'benchWood'],[21,16,'lantern'],
 [6,6,'smallFlowerVase'],[18,6,'displayShelf'],[7,8,'humanMerchant'],
 [18,8,'humanVillager'],[14,17,'humanVillager'],[3,17,'humanVillager']])item(x,z,t);
 // Wood pedestrian bridge continues an existing street across the channel.
 for(let z=19;z<24;z++)for(let x=6;x<=7;x++){
  // Keep real water below the raised deck. A second wooden road surface
  // used to be drawn below every bridge piece, causing brown squares and flicker.
  floor(x,z,'river');
  item(x,z,'bridgeWood',0,0);
 }

 // Fill exposed upper party walls where adjacent houses have fewer floors.
 // A shared wall is only omitted where BOTH adjacent rooms exist at this level.
 const inside=new Set([...ground.values()].filter(o=>o.y>0&&o.type==='woodfloor').map(o=>K(o.x,o.z,o.y)));
 const faceDirections=[[0,-1,2],[1,0,1],[0,1,0],[-1,0,3]];
 for(const h of buildings){
  for(let y=0;y<h.n;y++)for(let z=h.z;z<h.z+h.d;z++)for(let x=h.x;x<h.x+h.w;x++){
   const current=K(x,z,y);
   if(structures.has(current))continue;
   const edge=faceDirections.find(([dx,dz])=>!inside.has(K(x+dx,z+dz,y))&&
    (y>0||!occupied.has(P(x+dx,z+dz))));
   if(edge)part(x,z,'oldTown'+h.c+'Wall',y,edge[2]);
  }
 }
 if(upgraded){
  // Convert selected street-level fronts into shops; keep a real entrance per property.
  const upgradedShops=[
   [0,1,'Cream'],[3,3,'Ochre'],[7,7,'Rose'],[10,10,'Mint'],[13,13,'Blue'],[16,16,'Sand']
  ];
  for(const [left,shopX,color] of upgradedShops){
   const h=townhomes.find(b=>b.x===left);
   if(!h)continue;
   // Preserve one accessible doorway in the center of each townhouse.
   const entry=h.x+Math.floor(h.w/2);
   const x=shopX===entry?h.x:shopX;
   part(x,14,'oldTown'+color+'Shop',0,0);
   // Signboards and awnings inhabit a tile's existing facade without taking another tile.
   items.push({x,z:14,y:0,type:'oldTownAwning',rot:0});
   if(h.w>=3)items.push({x:h.x+h.w-1,z:14,y:0,type:'oldTownSign',rot:0});
   if(h.n>=3)items.push({x:h.x,z:14,y:1,type:'oldTownFlowerBox',rot:0});
   items.push({x:h.x+h.w-1,z:14,y:2,type:'oldTownShutters',rot:0});
  }
  // Upper-floor flower boxes face the water, while lanterns light the promenade.
  for(const [x,z,y,type] of [
   [1,14,2,'oldTownFlowerBox'],[4,14,2,'oldTownFlowerBox'],[8,14,1,'oldTownFlowerBox'],
   [11,14,2,'oldTownFlowerBox'],[14,14,2,'oldTownFlowerBox'],
   [3,14,1,'oldTownShutters'],[10,14,1,'oldTownShutters'],
   [2,14,0,'oldTownStreetLamp'],[9,14,0,'oldTownStreetLamp'],[16,14,0,'oldTownStreetLamp']
  ])items.push({x,z,y,type,rot:0});
  // A little lane-side trade and public life rather than scatter everywhere.
  for(const [x,z,t] of [[3,16,'basketProduce'],[6,16,'handcartEmpty'],
   [10,16,'barrel'],[14,16,'displayShelf'],[20,17,'benchWood'],
   [2,7,'smallFlowerVase'],[10,7,'bushFlower'],[20,7,'lantern'],
   [7,16,'humanMerchant'],[12,16,'humanVillager']])item(x,z,t);
  // Natural edge only toward the district's rear, never on the waterfront promenade.
  for(let x=0;x<24;x++)for(let z=0;z<=1;z++){
   if(occupied.has(P(x,z)))continue;
   const v=surfaceNoise(x*13,z*19);
   if(v<.17)floor(x,z,'grassTuft');
   else if(v<.28)floor(x,z,'grassFlowers');
  }
 }
 world=[...ground.values(),...structures.values(),...items];
 $('mapWidth').value=24;$('mapHeight').value=24;
 for(const id of ['rangeX1','rangeX2','rangeZ1','rangeZ2'])$(id).max=23;
 $('rangeX2').value=23;$('rangeZ2').value=23;
 level=0;$('level').value='0';hideUpper=false;$('hideUpper').checked=false;
 selected='oldTownCreamWindow';rotation=0;mode='move';yaw=Math.PI/4;
 showEntireMap();refreshPalette();commit();cursorDirty=true;
 toast(upgraded?'暮らす川沿い旧市街：商店・庇・花箱・看板を追加':'川沿い旧市街：連棟住宅10軒・石の護岸・水辺・小塔');
}

function makeLivedInTownDemo(){
 if(world.length&&!confirm('配置を「暮らしの住宅街」に置き換えますか？先にJSONで保存してください。'))return;
 snapshot();MAP_W=24;MAP_H=24;world=[];terrainHeights=new Map();
 const floors=new Map(),buildings=new Map(),objects=[],taken=new Set(),road=new Set();
 const K=(x,z,y=0)=>x+','+z+','+y,P=(x,z)=>x+','+z;
 const within=(x,z)=>x>=0&&z>=0&&x<24&&z<24;
 const put=(into,x,z,type,y=0,rot=0)=>{if(within(x,z))into.set(K(x,z,y),{x,z,y,type,rot})};
 const prop=(x,z,type,rot=0)=>{if(within(x,z)&&!taken.has(P(x,z)))objects.push({x,z,y:0,type,rot})};
 const pave=(x,z,type)=>{if(within(x,z)&&!taken.has(P(x,z))){put(floors,x,z,type);road.add(P(x,z))}};
 // Small asymmetric neighborhood with streets linked along tile edges.
 for(let z=0;z<24;z++)for(let x=0;x<24;x++){
  const noise=surfaceNoise(x*7+2,z*9+1);
  put(floors,x,z,noise<.19?'grassFlowers':noise<.41?'grassTuft':noise<.66?'grassPatch':'grassWild');
 }
 for(let x=0;x<24;x++)for(let z=11;z<=12;z++)pave(x,z,'roadCobbleFull');
 for(let z=1;z<=22;z++)for(const x of [8,15])pave(x,z,z<14?'roadDirtFull':'roadGravelFull');
 // Plot shapes include a cottage with side wing and a slightly taller merchant house.
 const homes=[
  {x:1,z:2,w:5,d:5,n:2,roof:'roofSteep',mat:'plasterwall'},
  {x:10,z:1,w:4,d:6,n:2,roof:'roofDormer',mat:'woodwall'},
  {x:18,z:2,w:5,d:5,n:1,roof:'roofHip',mat:'stonewall'},
  {x:2,z:15,w:5,d:5,n:2,roof:'roofCross',mat:'woodwall',wing:[[6,18],[7,18],[6,19],[7,19]]},
  {x:10,z:16,w:4,d:5,n:1,roof:'roofThatchThick',mat:'plasterwall'},
  {x:18,z:15,w:5,d:5,n:2,roof:'roofSteep',mat:'brickwall'}
 ];
 for(const h of homes){
  const cells=new Set();
  for(let dz=0;dz<h.d;dz++)for(let dx=0;dx<h.w;dx++)cells.add(P(h.x+dx,h.z+dz));
  for(const [x,z] of h.wing||[])cells.add(P(x,z));
  for(const p of cells){if(taken.has(p))throw Error('住宅の重複 '+p);taken.add(p)}
  // Every home has a front entrance directed toward the shared main street,
  // even if its plot is set back from the road by a small garden.
  const entry=[h.x+Math.floor(h.w/2),h.z<10?h.z+h.d-1:h.z];
  for(const p of cells){
   const [x,z]=p.split(',').map(Number);
   for(let y=0;y<h.n;y++){
    put(floors,x,z,y===0?'woodfloor':'woodfloorLight',y);
    const sides=[[0,-1,2],[1,0,1],[0,1,0],[-1,0,3]].filter(([dx,dz])=>!cells.has(P(x+dx,z+dz)));
    if(sides.length){
     const d=entry&&entry[0]===x&&entry[1]===z&&y===0;
     const win=!d&&((x*3+z*5+y*7)%4===0);
     put(buildings,x,z,d?h.mat+'Door':win?h.mat+'Window':h.mat+'Plain',y,sides[0][2]);
    }
   }
   put(buildings,x,z,h.roof,h.n);
  }
  const doorZ=h.z<10?h.z+h.d:h.z-1;
  const doorX=h.x+Math.floor(h.w/2);
  for(let z=Math.min(doorZ,h.z<10?11:12);z<=Math.max(doorZ,h.z<10?11:12);z++)pave(doorX,z,'roadDirtFull');
  // Working yards are distinct for each dwelling rather than repeated scatter.
  const byDoor=h.z<10?h.z+h.d+1:h.z-2;
  prop(h.x,byDoor,h.roof==='roofThatchThick'?'basketProduce':'barrel');
  prop(h.x+2,byDoor,'smallFlowerVase');
  if(h.n>1)objects.push({x:h.x+2,z:h.z+2,y:0,type:'roundTableWood',rot:0});
  if(h.n>1)objects.push({x:h.x+3,z:h.z+2,y:0,type:'stairSwitchback',rot:0});
 }
 // Street details follow actual use: carts by shops, planters by doors.
 for(const [x,z,t] of [[7,10,'handcartLoaded'],[9,10,'crate'],[16,10,'benchWood'],
 [7,13,'basketProduce'],[16,13,'barrel'],[1,10,'bushFlower'],
 [22,10,'treeBirch'],[23,22,'treeOak'],[1,22,'treePine'],
 [9,22,'flowerField'],[14,22,'rockMossy'],[7,21,'fenceWood'],
 [16,20,'sack'],[9,8,'humanVillager'],[16,15,'humanMerchant']])prop(x,z,t);
 world=[...floors.values(),...buildings.values(),...objects];
 $('mapWidth').value=24;$('mapHeight').value=24;
 for(const id of ['rangeX1','rangeX2','rangeZ1','rangeZ2'])$(id).max=23;
 $('rangeX2').value=23;$('rangeZ2').value=23;
 level=0;$('level').value='0';hideUpper=false;$('hideUpper').checked=false;
 selected='roofSteep';rotation=0;mode='move';yaw=Math.PI/4;
 showEntireMap();refreshPalette();commit();cursorDirty=true;
 toast('暮らしの住宅街：6軒・軒の厚み・窓枠・玄関・生活小物');
}

function makeResidentialRoofDemo(){
 if(world.length&&!confirm('現在の配置を住宅屋根の比較サンプルに置き換えますか？先にJSON保存してください。'))return;
 snapshot();MAP_W=24;MAP_H=24;world=[];terrainHeights=new Map();
 const ground=new Map(),wallMap=new Map(),furniture=[],used=new Set();
 const key=(x,z,y=0)=>x+','+z+','+y;
 const floor=(x,z,type,y=0)=>ground.set(key(x,z,y),{x,z,y,type,rot:0});
 const part=(x,z,type,y=0,rot=0)=>wallMap.set(key(x,z,y),{x,z,y,type,rot});
 const add=(x,z,type,rot=0)=>furniture.push({x,z,y:0,type,rot});
 const homes=[
  {x:2,z:2,w:4,d:4,n:2,mat:'plasterwall',roof:'roofSteep',rot:0},
  {x:10,z:2,w:4,d:4,n:1,mat:'stonewall',roof:'roofHip',rot:0},
  {x:17,z:2,w:4,d:4,n:2,mat:'woodwall',roof:'roofDormer',rot:1},
  {x:2,z:13,w:4,d:4,n:2,mat:'timberWall',roof:'roofCross',rot:1,annex:[[5,14],[5,15],[6,14],[6,15]]},
  {x:10,z:13,w:4,d:4,n:1,mat:'brickwall',roof:'roofLean',rot:0},
  {x:17,z:13,w:4,d:4,n:1,mat:'woodwall',roof:'roofThatchThick',rot:0}
 ];
 for(let z=0;z<24;z++)for(let x=0;x<24;x++){
  const t=surfaceNoise(x*3+2,z*5+1),type=t<.23?'grassFlowers':t<.52?'grassTuft':t<.70?'grassPatch':'grassWild';
  floor(x,z,type);
 }
 for(let z=9;z<=11;z++)for(let x=0;x<24;x++)floor(x,z,'roadCobbleFull');
 for(let x=7;x<=8;x++)for(let z=1;z<22;z++)floor(x,z,'roadDirtFull');
 for(let x=15;x<=16;x++)for(let z=1;z<22;z++)floor(x,z,'roadGravelFull');
 for(const h of homes){
  const cells=new Set();
  for(let dz=0;dz<h.d;dz++)for(let dx=0;dx<h.w;dx++)cells.add((h.x+dx)+','+(h.z+dz));
  for(const [x,z] of h.annex||[])cells.add(x+','+z);
  for(const cell of cells){
   if(used.has(cell))throw Error('建物重複 '+cell);
   used.add(cell);
  }
  const material=h.mat==='timberWall'?'woodwall':h.mat;
  for(const cell of cells){
   const [x,z]=cell.split(',').map(Number);
   for(let y=0;y<h.n;y++){
    floor(x,z,y===0?'woodfloor':'woodfloorLight',y);
    const edges=[[0,-1,2],[1,0,1],[0,1,0],[-1,0,3]].filter(([dx,dz])=>!cells.has((x+dx)+','+(z+dz)));
    if(edges.length){
     const face=edges[0],door=y===0&&z===h.z+h.d-1&&x===h.x+1;
     const window=!door&&(x*7+z*3+y*5)%5===0;
     part(x,z,door?material+'Door':window?material+'Window':material+'Plain',y,face[2]);
    }
   }
   part(x,z,h.roof,h.n,h.rot);
  }
  if(h.n>1)add(h.x+1,h.z+1,'stairSwitchback');
  add(h.x+2,h.z+2,'roundTableWood');
 }
 for(const [x,z,t] of [[1,7,'smallFlowerVase'],[4,7,'barrel'],[11,7,'benchWood'],
 [18,7,'handcartLoaded'],[21,7,'treeBirch'],[1,20,'treeOak'],
 [4,19,'basketProduce'],[12,19,'sack'],[19,19,'bushFlower'],
 [22,21,'treePine'],[11,22,'rockMossy'],[5,22,'flowerField']])add(x,z,t);
 world=[...ground.values(),...wallMap.values(),...furniture];
 $('mapWidth').value=24;$('mapHeight').value=24;
 for(const id of ['rangeX1','rangeX2','rangeZ1','rangeZ2'])$(id).max=23;
 $('rangeX2').value=23;$('rangeZ2').value=23;
 level=0;$('level').value='0';hideUpper=false;$('hideUpper').checked=false;
 selected='roofSteep';rotation=0;mode='move';yaw=Math.PI/4;
 showEntireMap();refreshPalette();commit();cursorDirty=true;
 toast('住宅屋根の比較：6種類・6棟を生成しました');
}

function makeCompactTerrainDemo(){
 if(world.length&&!confirm('現在の配置を24×24地形見本に置き換えますか？先にJSONで保存してください。'))return;
 snapshot();MAP_W=24;MAP_H=24;world=[];terrainHeights=new Map();
 const floors=new Map(),structures=new Map(),deco=[];
 const key=(x,z,y=0)=>x+','+z+','+y;
 const place=(m,x,z,type,y=0,rot=0)=>{if(x>=0&&z>=0&&x<24&&z<24)m.set(key(x,z,y),{x,z,y,type,rot})};
 const raised=(a,b,c,d,h)=>{
  for(let z=b;z<=d;z++)for(let x=a;x<=c;x++)terrainHeights.set(terrainKey(x,z),h);
 };
 // Two connected terraces: ground level 0, middle level 1, inner level 2.
 raised(3,3,20,14,1);
 raised(11,4,20,8,2);
 for(let z=0;z<24;z++)for(let x=0;x<24;x++){
  const n=surfaceNoise(x*5+4,z*7+2);
  const grass= n<.13?'grassPebbles':n<.29?'grassPatch':n<.45?'grassTuft':
   n<.60?'grassWild':n<.75?'grassFlowers':n<.88?'grassWeeds':'grassTrampled';
  place(floors,x,z,grass);
 }
 // One-tile-wide paths connect by cardinal edges, not diagonal corner touches.
 function path(points,type){
  for(let i=0;i<points.length-1;i++){
   let [x,z]=points[i], [tx,tz]=points[i+1];
   while(true){
    place(floors,x,z,type);
    if(x===tx&&z===tz)break;
    if(x!==tx)x+=Math.sign(tx-x);else z+=Math.sign(tz-z);
   }
  }
 }
 path([[1,17],[7,17],[7,14],[7,10],[7,6]],'roadDirtFull');
 path([[7,10],[12,10],[16,10],[16,9],[16,8],[16,6]],'roadGravelFull');
 path([[7,17],[18,17]],'roadDirtFull');
 // Up-direction conventions: north, east, south and west, all one level.
 // North-facing stair from level 0 to 1.
 place(structures,7,15,'terrainStairs',0,0);
 // North-facing stair from level 1 to 2.
 place(structures,16,9,'terrainStairs',0,0);
 // East-facing stair from level 0 to 1 on the western edge.
 place(structures,2,11,'terrainStairs',0,1);
 // South-facing stair from level 0 to 1 on the northern edge.
 place(structures,13,2,'terrainStairs',0,2);
 // West-facing stair from level 0 to 1 on the eastern edge.
 place(structures,21,12,'terrainStairs',0,3);
 for(const [x,z,t] of [[3,19,'treeBirch'],[20,19,'treePine'],[18,2,'treeOak'],
  [4,6,'bushFern'],[10,19,'flowerField'],[21,18,'rockMossy'],
  [18,11,'basketProduce'],[5,12,'barrel'],[15,18,'smallFlowerVase']])
  deco.push({x,z,y:0,type:t,rot:0});
 // Two modest homes demonstrate that structures sit flush with raised ground.
 function home(x,z,material,roof){
  for(let dz=0;dz<4;dz++)for(let dx=0;dx<5;dx++){
   const xx=x+dx,zz=z+dz,border=dx===0||dx===4||dz===0||dz===3;
   place(floors,xx,zz,'woodfloor');
   if(border){
    const rot=dz===0?2:dx===4?1:dx===0?3:0;
    const door=dx===2&&dz===3,window=(dx+dz)%4===0&&!door;
    place(structures,xx,zz,door?material+'Door':window?material+'Window':material+'Plain',0,rot);
   }
   place(structures,xx,zz,roof,1);
  }
 }
 home(4,4,'plasterwall','roofThatch');
 home(15,4,'woodwall','roofTile');
 world=[...floors.values(),...structures.values(),...deco];
 $('mapWidth').value=24;$('mapHeight').value=24;
 for(const id of ['rangeX1','rangeX2','rangeZ1','rangeZ2'])$(id).max=23;
 $('rangeX2').value=23;$('rangeZ2').value=23;
 level=0;$('level').value='0';hideUpper=false;$('hideUpper').checked=false;
 selected='terrainStairs';rotation=0;mode='move';yaw=Math.PI/4;
 showEntireMap();refreshPalette();commit();cursorDirty=true;
 toast('24×24：4方向の階段・2段の高台・草地装飾');
}

function makeTerraceFarmDemo(){
 if(world.length&&!confirm('現在の配置を段丘農村の完成見本に置き換えますか？先にJSON保存をおすすめします。'))return;
 snapshot();MAP_W=64;MAP_H=64;world=[];terrainHeights=new Map();
 const placed=new Map(),decor=[],footprints=new Set(),roadSet=new Set();
 const K=(x,z,y)=>x+','+z+','+y,P=(x,z)=>x+','+z;
 const within=(x,z)=>x>=0&&z>=0&&x<64&&z<64;
 const floor=(x,z,type,y=0)=>{if(within(x,z))placed.set('f:'+K(x,z,y),{x,z,y,type,rot:0})};
 const put=(x,z,type,y=0,rot=0)=>{
  if(within(x,z))placed.set('b:'+K(x,z,y),{x,z,y,type,rot});
 };
 const prop=(x,z,type,y=0,rot=0)=>{
  if(within(x,z)&&!footprints.has(P(x,z)))decor.push({x,z,y,type,rot});
 };
 const terrace=(x0,z0,x1,z1,h)=>{
  for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){
   if(within(x,z))terrainHeights.set(terrainKey(x,z),h);
  }
 };
 // High homes, middle farms, lower riverside. Broad uninterrupted terraces.
 terrace(4,4,51,18,2);
 terrace(4,19,51,38,1);
 terrace(41,4,51,18,2);
 // A third-level lookout, with the building entirely on one plateau.
 terrace(4,4,17,12,3);
 const dirs=[[0,-1,2],[1,0,1],[0,1,0],[-1,0,3]];
 const house=(x,z,w,d,floors,mat,roof)=>{
  for(let dz=0;dz<d;dz++)for(let dx=0;dx<w;dx++){
   const xx=x+dx,zz=z+dz;
   if(footprints.has(P(xx,zz)))throw Error('重複する住宅 '+xx+','+zz);
   footprints.add(P(xx,zz));
  }
  for(let y=0;y<floors;y++)for(let dz=0;dz<d;dz++)for(let dx=0;dx<w;dx++){
   const xx=x+dx,zz=z+dz,edge=dx===0||dx===w-1||dz===0||dz===d-1;
   floor(xx,zz,mat==='stonewall'?'stone':'woodfloor',y);
   if(edge){
    const r=dz===0?2:dx===w-1?1:dx===0?3:0;
    const door=y===0&&dz===d-1&&dx===Math.floor(w/2);
    const win=!door&&(dx+2*dz+y*3)%5===0;
    put(xx,zz,door?mat+'Door':win?mat+'Window':mat+'Plain',y,r);
   }
   if(y===floors-1)put(xx,zz,roof,floors);
  }
  decor.push({x:x+2,z:z+2,y:0,type:'roundTableWood',rot:0});
  if(floors>1)decor.push({x:x+3,z:z+2,y:0,type:'stairSwitchback',rot:0});
 };
 house(5,5,8,7,2,'stonewall','roofTile');
 house(23,7,8,7,2,'plasterwall','roofTile');
 house(34,8,8,7,1,'woodwall','roofThatch');
 house(7,23,8,7,1,'woodwall','roofThatch');
 house(23,25,8,7,2,'plasterwall','roofPlank');
 house(34,25,8,7,1,'stonewall','roofThatch');
 house(7,44,9,8,1,'woodwall','roofPlank');
 house(24,45,8,7,1,'plasterwall','roofThatch');
 // The creek stays on the eastern side of the village.
 // It steps down exactly at Z=19 and Z=39, with visible water drops.
 for(let z=3;z<62;z++)for(let x=45;x<=47;x++){
  if(z<19)terrainHeights.set(terrainKey(x,z),2);
  else if(z<39)terrainHeights.set(terrainKey(x,z),1);
  else terrainHeights.delete(terrainKey(x,z));
  floor(x,z,'river');
 }
 const path=(x0,z0,x1,z1,type)=>{
  let x=x0,z=z0;for(let steps=0;steps<140;steps++){
   if(!within(x,z))break;
   const id=P(x,z);
   if(!footprints.has(id)&&!(x>=45&&x<=47)){floor(x,z,type);roadSet.add(id);}
   if(x===x1&&z===z1)break;
   if(x!==x1)x+=Math.sign(x1-x);else z+=Math.sign(z1-z);
  }
 };
 // Roads make cardinal turns only; no diagonally touching squares.
 path(3,16,43,16,'roadDirtFull');
 path(5,35,43,35,'roadGravelFull');
 path(5,54,43,54,'roadDirtFull');
 for(const [x,z0,z1] of [[19,4,61],[32,15,54],[42,17,54]])path(x,z0,x,z1,'roadDirtFull');
 // 1-step transitions: facing north (rotation 0) climbs to the north.
 for(const [x,z] of [[11,13],[19,19],[32,19],[42,19],[19,39],[32,39],[42,39]]){
  floor(x,z,'roadCobbleFull');put(x,z,'terrainStairs',0,0);
 }
 // Crops and fenced farmyard, with worked soil and standing produce.
 for(const [x0,z0,x1,z1] of [[8,32,15,36],[24,33,30,37],[34,32,39,36],[8,55,16,59]]){
  for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){
   if(footprints.has(P(x,z)))continue;
   floor(x,z,'earth');
   if((x+z)%2===0)prop(x,z,'cropWheat');
   else if((x+2*z)%4===0)prop(x,z,'cropVegetable');
  }
 }
 for(let x=50;x<=60;x++){
  prop(x,42,'fenceWood');prop(x,56,'fenceWood');
 }
 for(let z=43;z<56;z++){
  prop(50,z,z===49?'fenceWoodGate':'fenceWood',0,1);prop(60,z,'fenceWood',0,1);
 }
 for(const [x,z] of [[53,46],[57,47],[55,52],[58,53]])prop(x,z,'sheepWool');
 // Bridges are level with the neighboring walkways on their own terrace.
 for(const z of [26,50])for(let x=44;x<=48;x++){
  floor(x,z,'roadPlankFull');
  if(x>=45&&x<=47)put(x,z,'bridgeWood',0,1);
 }
 for(const [x,z,t] of [[18,22,'wellStone'],[29,20,'handcartLoaded'],
  [17,44,'barrel'],[34,43,'crate'],[38,20,'marketStallCloth'],
  [4,35,'treeOak'],[4,58,'treePine'],[37,47,'treeBirch'],
  [54,14,'treeOak'],[55,24,'treePine'],[57,35,'treeCedar'],
  [55,59,'treePine'],[61,10,'treeBirch'],[59,4,'treeOak'],
  [22,42,'bushFlower'],[38,58,'rockMossy'],[18,57,'handcartEmpty'],
  [16,18,'rockGranite'],[54,33,'bushFern'],[36,17,'flowerField']])prop(x,z,t);
 for(const [x,z,t] of [[13,19,'humanVillager'],[22,21,'humanMerchant'],
  [33,39,'humanVillager'],[28,43,'humanVillager'],[55,44,'humanVillager']])prop(x,z,t);
 world=[...placed.values(),...decor];
 $('mapWidth').value=64;$('mapHeight').value=64;
 for(const id of ['rangeX1','rangeX2'])$(id).max=63;
 for(const id of ['rangeZ1','rangeZ2'])$(id).max=63;
 $('rangeX2').value=63;$('rangeZ2').value=63;
 level=0;$('level').value='0';hideUpper=false;$('hideUpper').checked=false;
 selected='wall';mode='move';rotation=0;yaw=Math.PI/4;
 showEntireMap();refreshPalette();commit();cursorDirty=true;
 toast('段丘農村：段差・滝・畑・牧場・住宅8棟を生成しました');
}

function makeElevationDemo(){
 if(world.length&&!confirm('現在の配置を高低差サンプルに置き換えますか？ 先にJSONで保存してください。'))return;
 snapshot();MAP_W=40;MAP_H=40;world=[];terrainHeights=new Map();
 const add=(x,z,type,y=0,rot=0)=>world.push({x,z,y,type,rot});
 const terrace=(x0,z0,x1,z1,h)=>{for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++)terrainHeights.set(terrainKey(x,z),h)};
 terrace(8,7,32,29,1);terrace(18,7,32,19,2);terrace(29,7,32,13,3);
 const pave=(x0,z0,x1,z1,t)=>{for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++)add(x,z,t)};
 pave(5,30,35,32,'roadCobbleFull');pave(10,18,16,18,'roadCobbleFull');
 pave(10,24,30,24,'roadCobbleFull');pave(20,15,30,15,'roadCobbleFull');
 for(const [x,z,rot] of [[12,30,0],[12,29,0],[20,20,0],[20,19,0],[30,14,0],[30,13,0]])add(x,z,'terrainStairs',0,rot);
 const house=(x,z,w,d,n,material,roof)=>{
  const mat=material==='timberWall'?'woodwall':material;
  for(let y=0;y<n;y++)for(let dz=0;dz<d;dz++)for(let dx=0;dx<w;dx++){
   const xx=x+dx,zz=z+dz,edge=dx===0||dz===0||dx===w-1||dz===d-1;
   add(xx,zz,y===0?'woodfloor':'woodfloorLight',y);
   if(edge){
    const rot=dz===0?2:dx===0?3:dx===w-1?1:0;
    const door=y===0&&dx===Math.floor(w/2)&&dz===d-1;
    const win=!door&&(dx+dz+y*3)%5===0;
    add(xx,zz,door?mat+'Door':win?mat+'Window':mat+'Plain',y,rot);
   }
   if(y===n-1)add(xx,zz,roof,n);
  }
  add(x+2,z+2,'roundTableSet');if(n>1)add(x+2,z+3,'stairSwitchback');
 };
 house(9,9,7,6,2,'plasterwall','roofTile');
 house(21,9,7,6,2,'stonewall','roofPlank');
 house(9,21,7,6,1,'woodwall','roofThatch');
 for(const [x,z,t] of [[6,6,'treeOak'],[35,10,'treePine'],[35,23,'treeBirch'],[6,25,'treeMaple'],
 [4,33,'bushFern'],[33,35,'treePine'],[18,33,'wellStone'],[17,27,'marketStallCloth'],
 [19,27,'handcartLoaded'],[29,25,'barrel'],[34,28,'rockGranite']])add(x,z,t);
 $('mapWidth').value=MAP_W;$('mapHeight').value=MAP_H;
 for(const id of ['rangeX1','rangeX2'])$(id).max=MAP_W-1;
 for(const id of ['rangeZ1','rangeZ2'])$(id).max=MAP_H-1;
 $('rangeX2').value=MAP_W-1;$('rangeZ2').value=MAP_H-1;
 level=0;$('level').value='0';hideUpper=false;$('hideUpper').checked=false;
 mode='move';selected='wall';yaw=Math.PI/4;showEntireMap();refreshPalette();commit();cursorDirty=true;
 toast('高低差サンプル：地面0〜3段の住宅街を生成');
}

function makeForestTransitionDemo(){
 if(world.length&&!confirm('現在の配置を「森に還る街」に置き換えますか？ 先にJSON保存をおすすめします。'))return;
 snapshot();MAP_W=96;MAP_H=96;world=[];terrainHeights=new Map();
 const W=MAP_W,H=MAP_H,base=new Map(),walls=new Map(),props=[],reserved=new Set(),roads=new Set(),wet=new Set(),used=new Set();
 const pos=(x,z)=>x+','+z,k=(x,z,y=0)=>x+','+z+','+y,ok=(x,z)=>x>=0&&z>=0&&x<W&&z<H;
 const rand=(x,z,n=0)=>{let a=Math.imul(x+101,73856093)^Math.imul(z+73,19349663)^Math.imul(n+19,83492791);a=Math.imul(a^(a>>>13),1274126177);return ((a^(a>>>16))>>>0)/4294967296};
 const tile=(x,z,t,y=0)=>{if(ok(x,z)&&y<=9)base.set(k(x,z,y),{x,z,y,type:t,rot:0})};
 const wall=(x,z,t,y=0,rot=0)=>{if(ok(x,z)&&y<=9)walls.set(k(x,z,y),{x,z,y,type:t,rot})};
 const obj=(x,z,t,y=0,rot=0,roadAllowed=false)=>{
  const p=pos(x,z);if(!ok(x,z)||reserved.has(p)||wet.has(p)||(!roadAllowed&&roads.has(p))||used.has(p))return false;
  props.push({x,z,y,type:t,rot});used.add(p);return true;
 };
 const buildingData=[
 [27,10,10,8,3,'timberWall','roofTile','inn'],
 [44,10,9,8,2,'plasterwall','roofTile','bakery'],
 [62,15,10,8,2,'stonewall','roofPlank','smith'],
 [25,28,10,9,2,'plasterwall','roofThatch','shop'],
 [61,34,10,9,3,'timberWall','roofTile','guild'],
 [26,51,11,8,2,'brickwall','roofPlank','workshop'],
 [59,51,11,8,2,'plasterwall','roofTile','tavern'],
 [43,57,9,7,2,'woodwall','roofThatch','home'],
 [8,17,9,8,1,'woodwall','roofThatch','farm'],
 [8,40,10,9,2,'timberWall','roofPlank','weaver'],
 [76,17,9,9,1,'plasterwall','roofThatch','farm'],
 [78,42,9,8,2,'stonewall','roofPlank','warehouse'],
 [9,61,10,8,1,'woodwall','roofThatch','herbalist'],
 [27,68,10,8,1,'plasterwall','roofPlank','abandoned'],
 [59,68,10,8,2,'brickwall','roofTile','abandoned'],
 [78,64,9,8,1,'woodwall','roofThatch','abandoned'],
 [8,80,9,8,1,'stonewall','roofPlank','ruin'],
 [39,84,9,7,1,'woodwall','roofThatch','ruin'],
 [74,83,10,8,1,'stonewall','roofTile','ruin']
 ];
 // Compact terraced homes create narrow residential lanes like an old hillside town.
 // Reserve the market center and preserve the older landmark houses.
 const planned=new Set();
 const footprintsOf=(b,i)=>{
  const [x,z,w,h]=b,set=new Set(),tw=Math.max(3,Math.floor(w*.55));
  for(let dz=0;dz<h;dz++)for(let dx=0;dx<w;dx++)set.add((x+dx)+','+(z+dz));
  if(i%3!==2)for(let dz=0;dz<3;dz++)for(let dx=0;dx<tw;dx++)set.add((x+dx)+','+(z+h+dz));
  if(i%4===1)for(let dz=0;dz<3;dz++)for(let dx=0;dx<3;dx++)set.delete((x+dx)+','+(z+dz));
  return set;
 };
 buildingData.forEach((b,i)=>{for(const p of footprintsOf(b,i))planned.add(p)});
 const candidates=[];
 for(let z=13;z<65;z+=8)for(let x=10+(z%3);x<83;x+=8){
  const d=Math.hypot((x-48)*.86,(z-43)*1.12);
  if(d<13||d>37)continue;
  candidates.push([x,z]);
 }
 let terraced=0;
 for(const [x,z] of candidates){
  if(terraced>=19)break;
  const i=buildingData.length,w=5+(terraced%3),h=5+(terraced%2);
  const b=[x,z,w,h,1+(terraced%3),'plasterwall','roofTile','home'];
  b[5]=['timberWall','plasterwall','woodwall','stonewall'][terraced%4];
  b[6]=['roofTile','roofThatch','roofPlank'][terraced%3];
  const cells=footprintsOf(b,i);
  if([...cells].some(k=>{const [xx,zz]=k.split(',').map(Number);
   if(xx<3||xx>=93||zz<3||zz>=75||planned.has(k))return true;
   // Keep a small gap to maintain a real alley between each pair of homes.
   return [[-1,0],[1,0],[0,-1],[0,1]].some(([dx,dz])=>planned.has((xx+dx)+','+(zz+dz)));
  }))continue;
  buildingData.push(b);for(const p of cells)planned.add(p);terraced++;
 }
 // Irregular footprints, built extensions, staggered roof heights.
 const houses=buildingData.map((b,i)=>{
  const [x,z,w,h,n,material,roof,kind]=b;
  const cells=new Set(),annex=new Set(),w1=Math.max(3,Math.floor(w*.55));
  for(let dz=0;dz<h;dz++)for(let dx=0;dx<w;dx++)cells.add(pos(x+dx,z+dz));
  if(i%3!==2)for(let dz=0;dz<3;dz++)for(let dx=0;dx<w1;dx++){
   const p=pos(x+dx,z+h+dz);cells.add(p);annex.add(p);
  }
  if(i%4===1)for(let dz=0;dz<3;dz++)for(let dx=0;dx<3;dx++)cells.delete(pos(x+dx,z+dz));
  for(const p of cells){if(reserved.has(p))throw Error('建築位置が重複 '+p);reserved.add(p)}
  return {x,z,w,h,n,material,roof,kind,cells,annex};
 });
 function road(x,z,type){const p=pos(x,z);if(ok(x,z)&&!reserved.has(p)&&!wet.has(p)){tile(x,z,type);roads.add(p)}}
 function curve(pts,width,type){
  for(let i=0;i+1<pts.length;i++){
   const [x1,z1]=pts[i],[x2,z2]=pts[i+1],steps=Math.max(Math.abs(x2-x1),Math.abs(z2-z1))*2;
   for(let t=0;t<=steps;t++){const x=Math.round(x1+(x2-x1)*t/steps),z=Math.round(z1+(z2-z1)*t/steps);
    for(let dx=-width;dx<=width;dx++)for(let dz=-width;dz<=width;dz++)if(Math.abs(dx)+Math.abs(dz)<=width+1){
      let material=type;
      if(width===0 && (type==='roadDirtFull'||type==='roadGravelFull') && x1!==x2&&z1!==z2){
       material=type==='roadDirtFull'?( (x2-x1)*(z2-z1)>0?'roadDirtDiagB':'roadDirtDiagA'):
         ((x2-x1)*(z2-z1)>0?'roadGravelDiagB':'roadGravelDiagA');
      }
      road(x+dx,z+dz,material);
     }
   }
  }
 }
 // Historic core: crooked lanes, loosely rounded market; exterior: winding dirt.
 curve([[45,0],[46,12],[49,29],[49,43],[47,54],[50,70],[47,95]],1,'roadCobbleFull');
 curve([[0,44],[16,40],[28,42],[41,44],[53,45],[72,43],[95,47]],1,'roadCobbleFull');
 curve([[12,10],[22,16],[32,22],[44,32],[50,36]],0,'roadGravelFull');
 curve([[73,13],[72,27],[66,33],[59,42]],0,'roadGravelFull');
 curve([[8,54],[19,57],[32,62],[47,70]],0,'roadDirtFull');
 curve([[56,59],[67,62],[77,64],[91,76]],0,'roadDirtFull');
 curve([[39,55],[31,66],[24,77],[10,94]],0,'roadDirtFull');
 curve([[56,69],[68,76],[82,89]],0,'roadDirtFull');
 curve([[18,24],[20,33],[18,48],[20,65]],0,'roadDirtFull');
 curve([[72,24],[72,35],[74,53],[73,70]],0,'roadGravelFull');
 for(let z=36;z<=52;z++)for(let x=37;x<=59;x++){
  const d=((x-48)/12)**2+((z-44)/9)**2;
  if(d<.96+rand(x,z,10)*.1)road(x,z,rand(x,z,11)<.15?'roadCobbleFull':'roadCutStoneFull');
 }
 // The watercourse is away from the core, with two practical crossings.
 const banks=[];
 for(let x=0;x<W;x++){
  const c=Math.round(79+2*Math.sin(x*.11)+1.5*Math.sin(x*.23));
  for(let dz=-1;dz<=1;dz++){const z=c+dz,p=pos(x,z);if(!reserved.has(p)){tile(x,z,'river');wet.add(p);roads.delete(p)}}
  banks.push([x,c-2,0],[x,c+2,2]);
 }
 // Flat banks are generated automatically by shoreline(); no raised bank blocks.
 for(const [x,z] of banks)if(x%17===0&&rand(x,z,7)<.35)obj(x,z,'watersideRock',0,0);
 for(const cx of [48,69]){
  const c=Math.round(79+2*Math.sin(cx*.11)+1.5*Math.sin(cx*.23));
  for(let z=c-2;z<=c+2;z++){
   wet.delete(pos(cx,z));tile(cx,z,'roadPlankFull');roads.add(pos(cx,z));
   obj(cx,z,cx===48?(Math.abs(z-c)===2?'bridgeStoneEnd':'bridgeStone'):
    (Math.abs(z-c)===2?'bridgeWoodEnd':'bridgeWood'),0,z>c?2:0,true);
  }
  curve([[cx,c-8],[cx,c-3]],0,'roadDirtFull');curve([[cx,c+3],[cx,95]],0,'roadDirtFull');
 }
 const dirs=[[0,-1,2],[1,0,1],[0,1,0],[-1,0,3]];
 // Doorways choose an outside face close to an existing street.
 const nearestRoad=(x,z)=>{
  let best=999;for(let dx=-10;dx<=10;dx++)for(let dz=-10;dz<=10;dz++){
   const a=Math.abs(dx)+Math.abs(dz);if(a<best&&roads.has(pos(x+dx,z+dz)))best=a;
  }return best;
 };
 const interiorProps={
  inn:['roundTableSet','chairClassic','bookshelf','lantern','bedLuxury'],
  bakery:['breadBoard','basketProduce','kitchenStove','roundTableSet'],
  smith:['fireplace','barrel','crate','counterStone'],
  shop:['displayShelf','sack','barrel','basketProduce'],
  guild:['roundTableStone','bookshelf','chairClassic','rewardChest'],
  workshop:['roundTableWood','barrel','sack','displayShelf'],
  tavern:['roundTableSet','stoolRound','barrel','fireplace'],
  home:['roundTableWood','chairWood','bed','wardrobe'],
  farm:['barrel','sack','basketProduce','bed'],
  weaver:['sack','crate','roundTableWood','displayShelf'],
  warehouse:['crate','barrel','sack','displayShelf'],
  herbalist:['smallFlowerVase','bookshelf','bowlClay','bed'],
  abandoned:['rubble','ruinFloorCrack','crate'],
  ruin:['rubble','ruinStonePost','brokenPillar']
 };
 const nav=(x,z)=>ok(x,z)&&!reserved.has(pos(x,z))&&!wet.has(pos(x,z));
 function joinRoad(sx,sz){
  if(!nav(sx,sz))return;
  const queue=[[sx,sz]],prev=new Map(),seen=new Set([pos(sx,sz)]);let finish=null;
  for(let i=0;i<queue.length&&i<3500;i++){
   const [x,z]=queue[i],p=pos(x,z);
   if(roads.has(p)){finish=p;break}
   for(const [dx,dz] of dirs){const nx=x+dx,nz=z+dz,np=pos(nx,nz);
    if(nav(nx,nz)&&!seen.has(np)){seen.add(np);prev.set(np,p);queue.push([nx,nz])}
   }
  }
  for(let i=0;finish&&i<70;i++){
   if(finish===pos(sx,sz))break;
   const [x,z]=finish.split(',').map(Number);
   if(!roads.has(finish))road(x,z,'roadDirtFull');
   finish=prev.get(finish);
  }
  // Walk forward along the recovered chain from the door.
  let next=pos(sx,sz);
  for(let i=0;i<70&&next;i++){
   const [x,z]=next.split(',').map(Number);
   if(roads.has(next))break;
   road(x,z,rand(x,z,19)<.23?'roadGravelFull':'roadDirtFull');
   next=prev.get(next);
  }
 }
 for(const h of houses){
  const boundary=[],inside=[];
  for(const p of h.cells){const [x,z]=p.split(',').map(Number),neighbors=dirs.filter(([dx,dz])=>h.cells.has(pos(x+dx,z+dz))).length;
   if(neighbors===4)inside.push([x,z]);
   for(const [dx,dz,rot] of dirs)if(!h.cells.has(pos(x+dx,z+dz)))boundary.push({x,z,dx,dz,rot,neighbors});
  }
  const candidates=boundary.filter(p=>nav(p.x+p.dx,p.z+p.dz));
  candidates.sort((a,b)=>(nearestRoad(a.x+a.dx,a.z+a.dz)+(a.neighbors<3?3:0))-(nearestRoad(b.x+b.dx,b.z+b.dz)+(b.neighbors<3?3:0)));
  const entrance=candidates[0]||boundary[0],damaged=h.kind==='abandoned'||h.kind==='ruin';
  const heightAt=(x,z)=>h.annex.has(pos(x,z))?Math.max(1,h.n-1):h.n;
  for(const p of h.cells){
   const [x,z]=p.split(',').map(Number),height=heightAt(x,z);
   for(let y=0;y<height;y++)tile(x,z,h.material==='brickwall'?'brickfloor':h.material==='stonewall'?'stone':'woodfloor',y);
   const ruined=damaged&&rand(x,z,31)<(h.kind==='ruin'?.48:.18);
   wall(x,z,ruined?(rand(x,z,32)<.5?'ruinRoofHole':'ruinRoofCollapse'):
    h.annex.has(p)?(h.roof==='roofTile'?'roofPlank':'roofThatch'):h.roof,height);
  }
  // Every perimeter tile gets a continuous full wall body. Material-matched
  // doors/windows replace the wall body, avoiding open gaps at corners.
  // Upper-storey boundaries are recalculated when annexes end below the main roof.
  for(const p of h.cells){
   const [wx,wz]=p.split(',').map(Number);
   for(let y=0;y<heightAt(wx,wz);y++){
    const outside=dirs.filter(([dx,dz])=>!h.cells.has(pos(wx+dx,wz+dz))||
      (h.cells.has(pos(wx+dx,wz+dz))&&heightAt(wx+dx,wz+dz)<=y));
    if(!outside.length)continue;
    const b=outside[0],isEntry=y===0&&wx===entrance.x&&wz===entrance.z;
    const n=rand(wx,wz,y+44),material=h.material==='timberWall'?'woodwall':h.material;
    const type=isEntry?(damaged?'ruinDoorHanging':material+'Door'):
     damaged&&n<(h.kind==='ruin'?.52:.23)?(n<.15?'ruinWallJagged':'ruinWallLow'):
     n<.17?(damaged?'ruinWindowShattered':material+'Window'):
     material+'Plain';
    wall(wx,wz,type,y,b[2]);
   }
  }
  const furn=interiorProps[h.kind];inside.slice(0,Math.min(6,inside.length)).forEach(([x,z],i)=>{
   if(i===2)return;props.push({x,z,y:0,type:furn[i%furn.length],rot:i%4});
  });
  if(h.n>1){const stairs=inside.find(([x,z])=>heightAt(x,z)===h.n);
   if(stairs)for(let y=0;y<h.n-1;y++)props.push({x:stairs[0],z:stairs[1],y,type:'stairSwitchback',rot:y%2?2:0});
  }
  joinRoad(entrance.x+entrance.dx,entrance.z+entrance.dz);
  // Nonidentical yards, cargo and small working corners.
  const goods=damaged?['rubble','fallenLog','ruinWoodPost','tallGrass']:
   h.kind==='farm'?['sack','basketProduce','barrel','handcartLoaded']:
   h.kind==='smith'?['barrel','crate','rockBasalt','handcartEmpty']:
   ['barrel','crate','basketProduce','smallFlowerVase'];
  for(const [j,dx,dz] of [[0,-2,2],[1,h.w+1,2],[2,2,-2],[3,3,h.h+2]])
   if(rand(h.x+dx,h.z+dz,29)>.18)obj(h.x+dx,h.z+dz,goods[j],0,j);
  if(['farm','weaver','herbalist','home'].includes(h.kind))
   for(let j=0;j<5;j++)obj(h.x-3,h.z+2+j,j===2?'fenceWoodGate':'fenceWood',0,1);
 }
 // Market is irregular but deliberately leaves the main passage open.
 for(const [x,z,t,rot] of [
  [48,45,'wellStone',0],[39,38,'marketStallCloth',1],[56,39,'marketStallWood',3],
  [40,51,'marketStallCloth',0],[55,50,'marketStallCloth',2],
  [36,46,'marketStallWood',1],[59,44,'marketStallCloth',3],
  [40,42,'displayShelf',0],[54,42,'basketProduce',0],[43,50,'roundTableSet',0],
  [52,38,'roundTableSet',0],[39,47,'handcartLoaded',0],[56,47,'handcartEmpty',0],
  [43,39,'benchWood',1],[52,51,'benchWood',3],
  [45,40,'barrel',0],[55,46,'sack',0],[42,47,'basketProduce',0],
  [37,38,'lantern',0],[57,37,'lantern',0],[37,52,'lantern',0],[57,53,'lantern',0]
 ])obj(x,z,t,0,rot,true);
 // Continuous ground cover with large-scale color patches instead of a single
 // neon-green default. Grass, dry soil and forest undergrowth grade by distance.
 for(let z=0;z<H;z++)for(let x=0;x<W;x++){
  const p=pos(x,z);if(reserved.has(p)||roads.has(p)||wet.has(p))continue;
  const d=Math.hypot((x-48)/1.12,(z-43)/1.05);
  const noise=smoothSurfaceNoise(x*.13+12,z*.13-3),patch=smoothSurfaceNoise(x*.29,z*.29+19);
  const type=d<22?(noise<.35?'grassDry':noise>.67?'grassMeadow':'grass'):
   d<33?(noise<.33?'earth':noise>.72?'grassMeadow':'grassWild'):
   d<43?(noise<.23?'earth':noise>.68?'grassForest':'grassWild'):
   (noise<.29?'moss':patch>.67?'grassDry':'grassForest');
  tile(x,z,type);
 }
 // Urban vegetation moves gradually through gardens and ruin-strewn fields to forest.
 for(let z=1;z<H-1;z+=2)for(let x=1;x<W-1;x+=2){
  const p=pos(x,z),d=Math.hypot((x-48)/1.12,(z-43)/1.05);
  if(reserved.has(p)||roads.has(p)||wet.has(p)||used.has(p))continue;
  const n=rand(x,z,101),density=d<19?.026:d<29?.12:d<37?.30:d<45?.58:.79;
  if(n>=density)continue;
  const q=rand(x,z,102);
  const t=d<29?(q<.20?'treeBirch':q<.46?'flowerField':q<.72?'bushFlower':'tallGrass'):
   d<41?(q<.29?'treeOak':q<.49?'treeBirch':q<.66?'bushFern':q<.79?'rockMossy':q<.89?'fallenLog':'treeMaple'):
   q<.28?'treePine':q<.48?'treeOak':q<.62?'treeCedar':q<.74?'treeBirch':q<.83?'treeDead':q<.92?'bushFern':'rockGranite';
  obj(x,z,t,0,(x+z)%4);
  
 }
 // Ruins and archaeology emerge as the houses thin out.
 for(const [x,z,t] of [[90,90,'ancientAltar'],[89,87,'brokenPillar'],
  [92,88,'ruinWallJagged'],[87,91,'rubble'],[86,87,'gravestone'],
  [22,88,'ancientAltar'],[20,86,'ruinWallLow'],[21,90,'fallenLog'],
  [6,69,'ruinStonePost'],[82,76,'ruinWallLow']]){used.delete(pos(x,z));obj(x,z,t,0,0,true);}
 for(const [x,z,t] of [[43,41,'humanMerchant'],[55,44,'humanMerchant'],
 [46,51,'humanVillager'],[36,43,'humanKnight'],[21,42,'humanVillager'],
 [66,45,'humanVillager'],[48,67,'humanKnight']])obj(x,z,t,0,0,true);
 world=[...base.values(),...walls.values(),...props];
 $('mapWidth').value=W;$('mapHeight').value=H;
 for(const id of ['rangeX1','rangeX2'])$(id).max=W-1;
 for(const id of ['rangeZ1','rangeZ2'])$(id).max=H-1;
 $('rangeX2').value=Math.min(W-1,Number($('rangeX2').value));
 $('rangeZ2').value=Math.min(H-1,Number($('rangeZ2').value));
 level=0;$('level').value='0';hideUpper=false;$('hideUpper').checked=false;
 selected='wall';rotation=0;mode='move';yaw=Math.PI/4;
 showEntireMap();refreshPalette();commit();cursorDirty=true;
 toast('森に還る街：住宅密集・連続した路地・自然な川岸へ改修');
}

function makeShowcaseTownDemo(){
 if(world.length&&!confirm('現在の配置を「完成見本の街」に置き換えますか？ 先にJSONで保存することをおすすめします。'))return;
 snapshot();
 MAP_W=80;MAP_H=80;world=[];terrainHeights=new Map();
 const ground=new Map(),built=new Map(),props=[],occupied=new Set(),roadCells=new Set();
 const inMap=(x,z)=>Number.isInteger(x)&&Number.isInteger(z)&&x>=0&&z>=0&&x<MAP_W&&z<MAP_H;
 const key=(x,z,y=0)=>x+','+z+','+y;
 const posKey=(x,z)=>x+','+z;
 const floor=(x,z,type,y=0)=>{if(inMap(x,z)&&y>=0&&y<=MAX_LEVEL)ground.set(key(x,z,y),{x,z,y,type,rot:0});};
 const part=(x,z,type,y=0,rot=0)=>{if(inMap(x,z)&&y>=0&&y<=MAX_LEVEL)built.set(key(x,z,y),{x,z,y,type,rot})};
 const prop=(x,z,type,y=0,rot=0)=>{
  if(inMap(x,z)&&y>=0&&y<=MAX_LEVEL)props.push({x,z,y,type,rot});
 };
 const paving=(x0,z0,x1,z1,type)=>{for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){
  if(!inMap(x,z))continue;
  floor(x,z,type);roadCells.add(posKey(x,z));
 }};
 // Winding roads and compact neighborhoods: two arc-shaped streets plus
 // a broad east-west market avenue, not a rigid checkerboard.
 paving(37,4,41,75,'roadCobbleFull');
 paving(6,36,74,39,'roadCobbleFull');
 paving(29,29,49,49,'roadCutStoneFull');
 paving(33,33,45,45,'roadRoyalFull');
 paving(35,35,43,43,'roadCutStoneFull');
 paving(4,14,34,16,'roadDirtFull');
 paving(43,15,74,17,'roadGravelFull');
 paving(8,64,35,66,'roadDirtFull');
 paving(44,66,73,68,'roadCobbleFull');
 paving(16,17,18,34,'roadGravelFull');
 paving(61,18,63,34,'roadCobbleFull');
 paving(15,42,17,62,'roadDirtFull');
 paving(64,42,66,63,'roadGravelFull');
 paving(20,22,36,23,'roadDirtFull');
 paving(44,25,59,26,'roadCobbleFull');
 paving(21,52,35,53,'roadGravelFull');
 paving(43,52,59,53,'roadCobbleFull');
 // A channel runs through the southern quarter. Banks, shallow edges,
 // and two stone/wood crossing points give the waterway a visible purpose.
 for(let x=5;x<=74;x++)for(let z=57;z<=59;z++){
  floor(x,z,'river');roadCells.delete(posKey(x,z));
 }
 for(let x=5;x<=74;x++){
  if(x>36&&x<43||x>62&&x<67)continue;
  prop(x,56,x%9===0?'streamBend':'streamBank',0,0);
  prop(x,60,'streamBank',0,2);
 }
 for(let z=57;z<=59;z++){
  for(let x=37;x<=41;x++){prop(x,z,'bridgeStone',0,0);roadCells.add(posKey(x,z));}
  for(let x=63;x<=66;x++){prop(x,z,'bridgeWood',0,0);roadCells.add(posKey(x,z));}
 }
 for(const [x,z,t] of [[39,56,'bridgeStoneEnd'],[39,60,'bridgeStoneEnd'],
  [64,56,'bridgeWoodEnd'],[64,60,'bridgeWoodEnd']])prop(x,z,t,0,z===60?2:0);
 // Plot-based houses: irregular footprints, mixed heights and roof materials.
 // Door targets face the primary approach, and a path connects each entrance.
 const houses=[
  {name:'西門近くの農家',x:5,z:5,areas:[[0,0,8,7],[1,6,5,3]],n:1,wall:'woodwall',roof:'roofThatch',fl:'woodfloor',target:[17,15],kind:'farm'},
  {name:'石造りのパン屋',x:21,z:6,areas:[[0,0,8,7],[3,6,5,3]],n:2,wall:'brickwall',roof:'roofTile',fl:'brickfloor',target:[28,15],kind:'bakery'},
  {name:'北の宿屋',x:45,z:5,areas:[[0,0,11,8],[0,7,6,4]],n:3,wall:'plasterwall',roof:'roofTile',fl:'woodfloor',target:[49,16],kind:'inn'},
  {name:'鍛冶屋',x:65,z:6,areas:[[0,0,9,8],[0,7,5,3]],n:1,wall:'stonewall',roof:'roofPlank',fl:'stone',target:[63,16],kind:'smith'},
  {name:'西の染物工房',x:5,z:22,areas:[[0,0,10,8],[4,7,5,4]],n:2,wall:'timberWall',roof:'roofPlank',fl:'woodfloorDark',target:[17,28],kind:'craft'},
  {name:'緑屋根の商家',x:23,z:25,areas:[[0,0,8,6],[2,5,5,5]],n:2,wall:'plasterwall',roof:'roofThatch',fl:'woodfloor',target:[29,37],kind:'shop'},
  {name:'水路沿いの食堂',x:49,z:28,areas:[[0,0,10,7],[0,6,5,5]],n:2,wall:'timberWall',roof:'roofTile',fl:'woodfloor',target:[43,38],kind:'tavern'},
  {name:'東の雑貨商',x:67,z:22,areas:[[0,0,8,9],[0,6,5,5]],n:1,wall:'woodwall',roof:'roofThatch',fl:'woodfloor',target:[65,38],kind:'shop'},
  {name:'西南の小屋',x:5,z:44,areas:[[0,0,9,7]],n:1,wall:'woodwall',roof:'roofThatch',fl:'woodfloor',target:[16,51],kind:'farm'},
  {name:'薬草師の家',x:22,z:43,areas:[[0,0,9,8],[2,7,6,3]],n:2,wall:'plasterwall',roof:'roofTile',fl:'woodfloorLight',target:[36,47],kind:'healer'},
  {name:'運河沿いの倉庫',x:49,z:43,areas:[[0,0,10,9],[4,8,5,3]],n:1,wall:'stonewall',roof:'roofPlank',fl:'woodfloorDark',target:[45,52],kind:'warehouse'},
  {name:'南東の大邸宅',x:67,z:43,areas:[[0,0,9,10],[1,9,5,4]],n:3,wall:'timberWall',roof:'roofTile',fl:'woodfloor',target:[65,51],kind:'manor'},
  {name:'川南の木造民家',x:5,z:68,areas:[[0,0,10,8]],n:1,wall:'woodwall',roof:'roofThatch',fl:'woodfloor',target:[15,65],kind:'home'},
  {name:'廃屋・元薬局',x:21,z:69,areas:[[0,0,10,8],[3,6,5,3]],n:2,wall:'stonewall',roof:'roofPlank',fl:'stone',target:[35,67],kind:'ruin'},
  {name:'南門前の住宅',x:47,z:69,areas:[[0,0,9,8]],n:2,wall:'plasterwall',roof:'roofThatch',fl:'woodfloor',target:[45,67],kind:'home'},
  {name:'旧倉庫の廃墟',x:65,z:69,areas:[[0,0,10,8]],n:1,wall:'brickwall',roof:'roofTile',fl:'brickfloor',target:[63,67],kind:'ruin'}
 ];
 const dirs=[{dx:0,dz:-1,r:2},{dx:1,dz:0,r:1},{dx:0,dz:1,r:0},{dx:-1,dz:0,r:3}];
 function pathToRoad(sx,sz,tx,tz){
  let x=sx,z=sz;
  for(let t=0;t<20&&inMap(x,z)&&!occupied.has(posKey(x,z));t++){
   const k=posKey(x,z);
   if(roadCells.has(k))break;
   floor(x,z,t%4===0?'roadGravelFull':'roadDirtFull');
   roadCells.add(k);
   const options=dirs.map(d=>({x:x+d.dx,z:z+d.dz,score:Math.abs(x+d.dx-tx)+Math.abs(z+d.dz-tz)}))
    .filter(p=>inMap(p.x,p.z)&&!occupied.has(posKey(p.x,p.z)));
   options.sort((a,b)=>a.score-b.score);
   if(!options.length)break;
   x=options[0].x;z=options[0].z;
  }
 }
 for(const h of houses){
  const cells=new Set();
  for(const [ax,az,w,d] of h.areas)for(let dz=0;dz<d;dz++)for(let dx=0;dx<w;dx++)cells.add(posKey(h.x+ax+dx,h.z+az+dz));
  for(const k of cells){
   if(occupied.has(k))throw Error('建物が重なっています: '+h.name+' '+k);
   occupied.add(k);
  }
  const boundary=[];
  for(const k of cells){const [x,z]=k.split(',').map(Number);
   for(const d of dirs)if(!cells.has(posKey(x+d.dx,z+d.dz)))boundary.push({x,z,...d});
  }
  boundary.sort((a,b)=>Math.abs(a.x+a.dx-h.target[0])+Math.abs(a.z+a.dz-h.target[1])-
   Math.abs(b.x+b.dx-h.target[0])-Math.abs(b.z+b.dz-h.target[1]));
  // Prefer openings away from the corner so they read as proper doorways.
  const entry=boundary.find(b=>dirs.filter(d=>cells.has(posKey(b.x+d.dx,b.z+d.dz))).length>=3)||boundary[0];
  const inside=[...cells].map(k=>k.split(',').map(Number)).filter(([x,z])=>dirs.every(d=>cells.has(posKey(x+d.dx,z+d.dz))));
  for(let y=0;y<h.n;y++){
   for(const k of cells){
    const [x,z]=k.split(',').map(Number);
    floor(x,z,h.fl,y);
    if(y===h.n-1)part(x,z,h.roof,y+1);
   }
   for(const b of boundary){
    const loc=key(b.x,b.z,y);
    if(built.has(loc)&&!(y===0&&b.x===entry.x&&b.z===entry.z))continue;
    const door=y===0&&b.x===entry.x&&b.z===entry.z;
    const ruined=h.kind==='ruin',decay=(b.x*13+b.z*7+y*5)%9;
    const type=door?(ruined?'ruinDoorHanging':'doorWood'):
      ruined&&decay<3?(decay===0?'ruinWallJagged':'ruinWallLow'):
      (b.x*5+b.z*11+y*13)%6===0?(ruined?'ruinWindowShattered':'windowWood'):
      h.wall==='timberWall'?'timberWall':h.wall+'Plain';
    part(b.x,b.z,type,y,b.r);
   }
   if(y<h.n-1&&inside.length){
    const [sx,sz]=inside[Math.min(3,inside.length-1)];
    prop(sx,sz,'stairSwitchback',y);
   }
  }
  if(h.kind==='ruin'){
   let i=0;
   for(const k of cells){
    if(i++%7!==0)continue;
    const [x,z]=k.split(',').map(Number);
    part(x,z,(i%2)?'ruinRoofCollapse':'ruinRoofHole',h.n);
   }
  }
  const furniture={
   farm:['barrel','sack','basketProduce','crate'],
   bakery:['breadBoard','roundTableSet','kitchenStove','basketProduce'],
   inn:['roundTableSet','roundTableWood','chairClassic','lantern','bedLuxury'],
   smith:['fireplace','barrel','crate','counterStone','ironGate'],
   craft:['displayShelf','barrel','sack','roundTableWood'],
   shop:['displayShelf','basketProduce','jugClay','roundTableSet'],
   tavern:['roundTableSet','roundTableWood','stoolRound','barrel','fireplace'],
   healer:['bookshelf','smallFlowerVase','bowlClay','bed'],
   warehouse:['barrel','crate','sack','handcartLoaded'],
   manor:['roundTableStone','chairClassic','bedLuxury','wardrobe'],
   home:['roundTableWood','chairWood','cupWood','bed'],
   ruin:['rubble','crate','ruinStonePost','ruinFloorCrack']
  };
  const chosen=furniture[h.kind]||furniture.home;
  inside.slice(0,Math.min(8,inside.length)).forEach(([x,z],i)=>{
   if((x===entry.x&&z===entry.z)||i===3) return;
   const item=chosen[i%chosen.length];
   prop(x,z,item,(item==='bedLuxury'&&h.n>1)?1:0,(i*3)%4);
  });
  if(h.kind==='inn'||h.kind==='manor')prop(h.x+3,h.z+3,'bedLuxury',h.n-1);
  if(h.kind==='smith'){prop(h.x+2,h.z+2,'chimney');prop(h.x+7,h.z+5,'rockBasalt');}
  if(h.kind==='ruin')for(const [dx,dz] of [[-1,2],[2,-1],[6,-1]])prop(h.x+dx,h.z+dz,'rubble');
  pathToRoad(entry.x+entry.dx,entry.z+entry.dz,h.target[0],h.target[1]);
 }
 // The town square is a dense hub, with walkable approaches from each side.
 // Display stalls around the edge rather than obstructing the central cross.
 for(const [x,z,rot] of [[32,33,0],[46,33,0],[32,46,2],[46,46,2],
  [29,39,1],[49,39,3]])prop(x,z,(x+z)%3===0?'marketStallWood':'marketStallCloth',0,rot);
 for(const [x,z] of [[35,32],[43,32],[35,46],[43,46],[30,35],[48,35]]){
  prop(x,z,'displayShelf');prop(x+1,z,'basketProduce');
 }
 prop(39,39,'wellStone');
 for(const [x,z] of [[37,36],[41,36],[37,43],[41,43]])prop(x,z,'lantern');
 for(const [x,z,rot] of [[34,40,1],[44,40,3],[36,45,0],[42,45,0]])prop(x,z,'benchWood',0,rot);
 for(const [x,z] of [[36,34],[42,34],[35,44],[43,44]])prop(x,z,'smallFlowerVase');
 for(const [x,z] of [[27,38],[52,37],[33,51],[46,51]])prop(x,z,'handcartLoaded');
 // An old watchtower and remnants of the former town defenses.
 function watchTower(cx,cz,levels){
  const ring=[[0,-2],[1,-2],[2,-1],[2,0],[2,1],[1,2],[0,2],[-1,2],[-2,1],[-2,0],[-2,-1],[-1,-2]];
  for(let y=0;y<levels;y++){
   for(const [dx,dz] of ring)part(cx+dx,cz+dz,y===levels-1?'towerBattlement':'towerWall',y);
   for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)floor(cx+dx,cz+dz,'stone',y);
   if(y<levels-1)prop(cx,cz,'stairSpiral',y);
  }
  prop(cx,cz,'towerSpire',levels);
 }
 watchTower(76,37,5);
 for(let z=30;z<=46;z++){
  if(z===38||z===39||z===40)continue;
  part(78,z,z%5===0?'ruinWallJagged':'stonewallPlain');
 }
 for(const [x,z,t] of [[75,33,'fenceIronGate'],[75,43,'fenceIronGate'],[78,39,'ironGate'],
  [72,40,'gravestone'],[73,42,'brokenPillar']])prop(x,z,t);
 for(let x=0;x<80;x++)if(x%2===0){
  if(x>=35&&x<=43)continue;
  prop(x,2,'fenceStone',0,0);
  if(x%12===0)prop(x,3,'fenceStoneCorner');
 }
 for(const [x,z] of [[36,2],[42,2],[36,76],[42,76]])prop(x,z,'towerPillar');
 // Streetlights, public seating, shrubs, scattered cargo and traces of life.
 for(const [x,z] of [[17,16],[22,23],[62,17],[17,35],[62,36],[16,53],[65,53],
  [18,66],[59,67],[39,51],[39,63],[45,23],[37,23]])prop(x,z,'lantern');
 for(const [x,z,t] of [[12,18,'treeOak'],[31,7,'treeBirch'],[58,11,'treeMaple'],
  [4,38,'treePine'],[76,13,'treeCedar'],[3,57,'treeWillow'],[75,61,'treeWillow'],
  [13,72,'treeAutumn'],[57,75,'treeOak'],[72,76,'treeDead'],[20,40,'treeOak'],
  [61,46,'treeCherry'],[20,56,'bushFlower'],[55,60,'bushFern'],
  [17,73,'flowerField'],[59,73,'mushroomPatch'],[8,61,'rockMossy'],
  [71,62,'rockGranite'],[23,64,'flowerField'],[54,21,'bushFlower'],
  [5,18,'tallGrass'],[74,48,'bushFern'],[17,6,'treeOak']]){
  if(!occupied.has(posKey(x,z)))prop(x,z,t);
 }
 for(const [x,z,type] of [[31,36,'humanMerchant'],[47,38,'humanMerchant'],
  [39,34,'humanVillager'],[41,44,'humanKnight'],[17,23,'humanVillager'],
  [60,31,'humanVillager'],[62,52,'humanMerchant'],[39,70,'humanKnight'],
  [15,60,'humanVillager'],[67,17,'humanKnight']])if(!occupied.has(posKey(x,z)))prop(x,z,type);
 // Keep roof heights and samples fully within the existing world format.
 world=[...ground.values(),...built.values(),...props];
 $('mapWidth').value=MAP_W;$('mapHeight').value=MAP_H;
 for(const id of ['rangeX1','rangeX2'])$(id).max=MAP_W-1;
 for(const id of ['rangeZ1','rangeZ2'])$(id).max=MAP_H-1;
 $('rangeX2').value=Math.min(MAP_W-1,Number($('rangeX2').value));
 $('rangeZ2').value=Math.min(MAP_H-1,Number($('rangeZ2').value));
 level=0;$('level').value='0';hideUpper=false;$('hideUpper').checked=false;
 selected='wall';rotation=0;mode='move';yaw=Math.PI/4;
 showEntireMap();refreshPalette();commit();cursorDirty=true;
 toast('完成見本の街：16棟・中央市場・運河・橋・塔・廃墟を生成しました');
}

function makeOrganicTownDemo(){
 if(world.length&&!confirm('現在の配置を自然な町サンプルに置き換えますか？ 事前にJSON保存をおすすめします。'))return;
 snapshot();
 MAP_W=64;MAP_H=64;world=[];terrainHeights=new Map();
 const ground=new Map(),structure=new Map(),items=[];
 const within=(x,z)=>Number.isInteger(x)&&Number.isInteger(z)&&x>=0&&z>=0&&x<MAP_W&&z<MAP_H;
 const floor=(x,z,type,y=0)=>{
  if(within(x,z))ground.set(x+','+z+','+y,{x,z,y,type,rot:0});
 };
 const part=(x,z,type,y=0,rot=0)=>{
  if(!within(x,z)||y<0||y>MAX_LEVEL)return;
  structure.set(x+','+z+','+y,{x,z,y,type,rot});
 };
 const prop=(x,z,type,y=0,rot=0)=>{if(within(x,z)&&y<=MAX_LEVEL)items.push({x,z,y,type,rot})};
 const paving=(x0,z0,x1,z1,type)=>{
  for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++)floor(x,z,type);
 };
 // Town paths vary in width and surface; main square uses independent paving.
 paving(29,4,31,59,'roadCobbleFull');
 paving(5,29,58,31,'roadCobbleFull');
 paving(26,26,35,35,'roadCutStoneFull');
 paving(28,28,33,33,'roadCobbleFull');
 paving(29,0,31,3,'roadDirtFull');
 paving(29,60,31,63,'roadDirtFull');
 paving(0,29,4,31,'roadDirtFull');
 paving(59,29,63,31,'roadDirtFull');
 const houses=[
  {name:'農家',x:7,z:9,areas:[[0,0,7,7]],n:1,wall:'plasterwall',roof:'roofThatch',fl:'woodfloor',entrance:'south'},
  {name:'宿屋',x:17,z:8,areas:[[0,0,9,8]],n:2,wall:'timberWall',roof:'roofTile',fl:'woodfloor',entrance:'south'},
  {name:'石造りの家',x:38,z:8,areas:[[0,0,7,10]],n:2,wall:'stonewall',roof:'roofPlank',fl:'stone',entrance:'south'},
  {name:'倉庫',x:48,z:11,areas:[[0,0,9,6]],n:1,wall:'woodwall',roof:'roofPlank',fl:'woodfloorDark',entrance:'south'},
  {name:'L字工房',x:8,z:20,areas:[[0,0,9,5],[0,4,5,8]],n:1,wall:'brickwall',roof:'roofTile',fl:'brickfloor',entrance:'east'},
  {name:'不規則な商家',x:43,z:20,areas:[[0,0,10,5],[2,4,8,8],[0,5,4,4]],remove:[[0,0],[9,0],[9,1]],n:2,wall:'plasterwall',roof:'roofThatch',fl:'woodfloor',entrance:'west'},
  {name:'木造民家',x:6,z:39,areas:[[0,0,8,8]],n:1,wall:'woodwall',roof:'roofThatch',fl:'woodfloor',entrance:'north'},
  {name:'小さな屋敷',x:18,z:40,areas:[[0,0,9,8],[2,7,5,4]],n:3,wall:'timberWall',roof:'roofTile',fl:'woodfloorLight',entrance:'east'},
  {name:'L字住宅',x:37,z:39,areas:[[0,0,9,5],[4,4,6,8]],n:2,wall:'stonewall',roof:'roofTile',fl:'stone',entrance:'west'},
  {name:'段違いの家',x:49,z:41,areas:[[1,0,7,6],[0,2,9,5],[2,6,5,3]],remove:[[1,0],[8,2]],n:1,wall:'plasterwall',roof:'roofPlank',fl:'woodfloor',entrance:'north'},
  {name:'小さな物置',x:8,z:52,areas:[[0,0,6,6]],n:1,wall:'woodwall',roof:'roofPlank',fl:'woodfloor',entrance:'east'},
  {name:'庭付きの家',x:42,z:52,areas:[[0,0,7,6]],n:2,wall:'plasterwall',roof:'roofThatch',fl:'woodfloor',entrance:'west'}
 ];
 const occupied=new Set();
 const footprints=[];
 const directions=[{dx:0,dz:-1,side:'north',r:2},{dx:1,dz:0,side:'east',r:1},{dx:0,dz:1,side:'south',r:0},{dx:-1,dz:0,side:'west',r:3}];
 for(const h of houses){
  const cells=new Set();
  for(const [ax,az,w,d] of h.areas)for(let dz=az;dz<az+d;dz++)for(let dx=ax;dx<ax+w;dx++)cells.add((h.x+dx)+','+(h.z+dz));
  for(const [dx,dz] of h.remove||[])cells.delete((h.x+dx)+','+(h.z+dz));
  for(const key of cells)if(occupied.has(key))throw Error('町の建物が重なっています: '+key);else occupied.add(key);
  const border=[];
  for(const key of cells){
   const [x,z]=key.split(',').map(Number);
   for(const dir of directions)if(!cells.has((x+dir.dx)+','+(z+dir.dz)))border.push({x,z,...dir});
  }
  // A door is chosen on a genuine perimeter edge facing the nearest approach road.
  const choices=border.filter(b=>b.side===h.entrance);
  choices.sort((a,b)=>{
   const approach=k=>h.entrance==='north'||h.entrance==='south'?Math.abs(k.x-30):Math.abs(k.z-30);
   return approach(a)-approach(b);
  });
  const door=choices[0]||border[0];
  for(let y=0;y<h.n;y++){
   for(const key of cells){
    const [x,z]=key.split(',').map(Number);
    floor(x,z,h.fl,y);
    if(y===h.n-1)part(x,z,h.roof,y+1);
   }
   for(const b of border){
    const isDoor=y===0&&b.x===door.x&&b.z===door.z&&b.side===door.side;
    // Avoid redundant wall placements at a perimeter corner by picking one face.
    const loc=b.x+','+b.z+','+y;
    if(structure.has(loc)&&!isDoor)continue;
    if(isDoor){part(b.x,b.z,'doorWood',y,b.r);continue}
    const window=((b.x*7+b.z*3+y*11)%5===0);
    const type=window?'windowWood':h.wall==='timberWall'?'timberWall':h.wall+'Plain';
    part(b.x,b.z,type,y,b.r);
   }
   const stairX=Math.round(h.x+2),stairZ=Math.round(h.z+2);
   if(y<h.n-1&&cells.has(stairX+','+stairZ))prop(stairX,stairZ,'stairSwitchback',y);
  }
  const interior=[...cells].map(k=>k.split(',').map(Number)).filter(([x,z])=>
   directions.every(d=>cells.has((x+d.dx)+','+(z+d.dz))));
  if(interior.length){
   const [tx,tz]=interior[Math.floor(interior.length/2)];
   prop(tx,tz,h.n===1?'table':'bookshelf');
  }
  if(h.name==='宿屋'){prop(h.x+3,h.z+3,'bedLuxury',1);prop(h.x+6,h.z+3,'wardrobe',1);}
  if(h.name==='L字工房'){prop(h.x+2,h.z+2,'fireplace');prop(h.x+3,h.z+5,'barrel');}
  if(h.name==='不規則な商家'){prop(h.x+3,h.z+2,'displayShelf');prop(h.x+4,h.z+2,'sack');}
  if(h.name==='小さな屋敷')prop(h.x+4,h.z+4,'bedLuxury',2);
  // Connect each front door via a modest footpath; terminate before any building.
  let px=door.x+door.dx,pz=door.z+door.dz;
  for(let step=0;step<8&&within(px,pz)&&!occupied.has(px+','+pz);step++){
   floor(px,pz,step===0?'roadGravelFull':'roadDirtFull');
   if((px>=29&&px<=31)||(pz>=29&&pz<=31))break;
   if(h.entrance==='north'||h.entrance==='south'){
    const bias=px<30?1:-1;
    if(step>=2&&Math.abs(px-30)>1)px+=bias;else pz+=door.dz;
   }else{
    const bias=pz<30?1:-1;
    if(step>=2&&Math.abs(pz-30)>1)pz+=bias;else px+=door.dx;
   }
  }
  footprints.push({name:h.name,cells:cells.size,floors:h.n});
 }
 // Restore uninterrupted roads and the town centre over incidental paths.
 paving(29,4,31,59,'roadCobbleFull');
 paving(5,29,58,31,'roadCobbleFull');
 paving(26,26,35,35,'roadCutStoneFull');
 paving(28,28,33,33,'roadCobbleFull');
 prop(30,30,'ancientAltar');
 for(const [x,z] of [[27,27],[34,27],[27,34],[34,34]])prop(x,z,'lantern');
 for(const [x,z] of [[27,36],[34,36],[36,27]])prop(x,z,'benchWood');
 // Deterministic street furniture, gardens, small yards and wooded outskirts.
 for(const [x,z,type] of [
  [4,4,'treePine'],[14,5,'treeOak'],[33,5,'treeBirch'],[60,9,'treePine'],
  [5,17,'treeBirch'],[35,15,'rockGranite'],[58,19,'treeAutumn'],
  [3,40,'treeOak'],[15,38,'flowerField'],[31,40,'treeBirch'],[59,37,'treeWillow'],
  [5,54,'fallenLog'],[15,58,'mushroomPatch'],[34,57,'rockMossy'],
  [56,56,'treeOak'],[59,52,'bushFern'],[21,58,'treeStump'],
  [10,18,'barrel'],[13,18,'crate'],[23,18,'flowerField'],
  [46,19,'sack'],[53,19,'crate'],[12,38,'flowerField'],
  [17,50,'lantern'],[38,51,'barrel'],[55,50,'displayShelf'],
  [24,54,'tallGrass'],[33,23,'flowerField'],[22,36,'bushFlower']
 ])if(!occupied.has(x+','+z))prop(x,z,type);
 for(const [x,z,type] of [
  [30,32,'humanMerchant'],[28,34,'humanVillager'],[36,29,'humanKnight'],
  [19,19,'humanMerchant'],[43,37,'humanVillager'],[31,48,'humanVillager']
 ])if(!occupied.has(x+','+z))prop(x,z,type);
 world=[...ground.values(),...structure.values(),...items];
 $('mapWidth').value=MAP_W;$('mapHeight').value=MAP_H;
 for(const id of ['rangeX1','rangeX2'])$(id).max=MAP_W-1;
 for(const id of ['rangeZ1','rangeZ2'])$(id).max=MAP_H-1;
 $('rangeX2').value=Math.min(MAP_W-1,Number($('rangeX2').value));
 $('rangeZ2').value=Math.min(MAP_H-1,Number($('rangeZ2').value));
 level=0;$('level').value='0';hideUpper=false;$('hideUpper').checked=false;
 selected='wall';rotation=0;mode='move';
 showEntireMap();refreshPalette();commit();cursorDirty=true;
 toast('自然な町を生成しました：形も階数も異なる12棟');
}

function makeVillageDemo(){
 if(world.length&&!confirm('現在のマップを試作村に置き換えますか？ 先にJSONで保存することをおすすめします。'))return;
 snapshot();
 MAP_W=52;MAP_H=52;world=[];terrainHeights=new Map();models=[];prefabs=[];
 const floors=new Map(),objects=[];
 const f=(x,z,type)=>{if(x>=0&&x<MAP_W&&z>=0&&z<MAP_H)floors.set(x+','+z,{x,z,y:0,type,rot:0})};
 const p=(x,z,type,y=0,rot=0)=>{if(x>=0&&x<MAP_W&&z>=0&&z<MAP_H)objects.push({x,z,y,type,rot})};
 const rect=(x0,z0,x1,z1,type)=>{for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++)f(x,z,type)};
 // Perimeter: a fortified but inhabited forest village with one clear south gate.
 for(let x=10;x<=41;x++){
  p(x,10,x===10||x===41?'stonewallcorner':'stonewallPlain');
  if(x<24||x>26)p(x,41,x===10||x===41?'stonewallcorner':'stonewallPlain');
 }
 for(let z=11;z<41;z++){
  p(10,z,'stonewallPlain');p(41,z,'stonewallPlain');
 }
 for(const x of [23,27])p(x,41,'stonewallAll');
 for(let x=24;x<=26;x++)f(x,41,'roadCobble');
 for(let z=42;z<=51;z++)for(let x=24;x<=26;x++)f(x,z,'roadDirt');
 p(24,42,'humanKnight',0,0);p(27,42,'humanKnight',0,0);
 // Cardinal main street, central plaza and short entrances to four buildings.
 for(let z=20;z<=41;z++)for(let x=24;x<=26;x++)f(x,z,'roadCobble');
 for(let x=19;x<=32;x++)for(let z=24;z<=26;z++)f(x,z,'roadCobble');
 rect(22,22,28,28,'roadCutStone');
 rect(23,23,27,27,'roadCobble');
 p(25,25,'ancientAltar');
 for(const [x,z] of [[22,23],[28,23],[22,27],[28,27]])p(x,z,'lantern');
 // Buildings use the existing modular 3D walls and connected roof tiles.
 const building=(x0,z0,wall,roof,floorType,doorSide)=>{
  const x1=x0+7,z1=z0+7,doorX=x0+3,doorZ=doorSide==='south'?z1:z0;
  rect(x0,z0,x1,z1,floorType);
  for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){
   const border=x===x0||x===x1||z===z0||z===z1;
   if(border){
    const corner=(x===x0||x===x1)&&(z===z0||z===z1);
    let t=corner?wall+'All':wall+'Plain';
    if(wall==='wall')t=corner?'wallAll':'wallPlain';
    if(x===doorX&&z===doorZ)t='doorWood';
    else if((z===z0||z===z1)&&(x===x0+1||x===x1-1))t='windowWood';
    p(x,z,t);
   }
   p(x,z,roof,1,0);
  }
  return {x0,z0,x1,z1};
 };
 // Adventurers guild: bookcases, tables, quests and a chest.
 building(14,13,'stonewall','roofTile','woodfloor','south');
 p(16,15,'bookshelf');p(19,15,'bookshelf');p(17,17,'table');p(20,17,'chairWood');
 p(15,19,'rewardChest');p(19,19,'humanMerchant');
 p(17,21,'innSign');p(18,22,'flowerField');
 // Blacksmith: masonry, forge, counter, materials.
 building(29,13,'brickwall','roofPlank','stone','south');
 p(31,15,'fireplace');p(34,15,'barrel');p(31,18,'counterStone');
 p(34,18,'chest');p(32,20,'humanVillager');
 p(32,22,'rockCluster');p(35,22,'crate');
 // House: personal storage and comfortable living.
 building(14,30,'plasterwall','roofThatch','woodfloor','north');
 p(16,32,'bed');p(20,32,'wardrobe');p(17,35,'table');
 p(20,35,'chairWood');p(15,35,'lantern');p(19,34,'humanVillager');
 p(14,29,'flowerField');p(20,29,'bushFlower');
 // Market: merchandise, shelving and wandering merchant.
 building(29,30,'woodwall','roofPlank','woodfloor','north');
 p(30,33,'displayShelf');p(35,33,'displayShelf');p(32,35,'counterWood');
 p(34,35,'barrel');p(31,35,'sack');p(33,34,'humanMerchant');
 p(30,29,'crate');p(34,29,'shopHerbSign');
 // Plaza and village life.
 p(23,29,'benchWood');p(27,29,'benchWood');
 p(25,30,'treeOak');p(25,20,'treeBirch');
 p(23,32,'humanBare');
 // Natural outskirts with reproducible layout (no random seeds required).
 const trees=[[5,5,'treePine'],[7,14,'treeOak'],[5,25,'treeBirch'],[7,37,'treePine'],
 [4,47,'treeCedar'],[15,5,'treeOak'],[27,5,'treePine'],[39,6,'treeAutumn'],
 [47,13,'treeOak'],[46,29,'treeWillow'],[47,43,'treePine'],[15,46,'treeBirch'],
 [36,47,'treeOak'],[3,33,'treePine'],[34,3,'treeCedar'],[49,5,'treePine']];
 for(const [x,z,type] of trees)p(x,z,type);
 rect(44,17,49,24,'lake');
 for(const [x,z,t] of [[43,18,'watersideRock'],[44,25,'rockMossy'],[49,25,'bushFern'],
 [6,19,'fallenLog'],[3,27,'giantMushroom'],[7,45,'mushroomPatch'],[38,46,'rockGranite'],
 [45,34,'flowerField'],[13,46,'tallGrass'],[48,35,'rockCluster']])p(x,z,t);
 // Keep one ground tile per coordinate and non-ground on independent layers.
 world=[...floors.values(),...objects];
 $('mapWidth').value=MAP_W;$('mapHeight').value=MAP_H;
 for(const id of ['rangeX1','rangeX2'])$(id).max=MAP_W-1;
 for(const id of ['rangeZ1','rangeZ2'])$(id).max=MAP_H-1;
 $('rangeX2').value=Math.min(MAP_W-1,Number($('rangeX2').value));
 $('rangeZ2').value=Math.min(MAP_H-1,Number($('rangeZ2').value));
 selected='wall';rotation=0;level=0;mode='move';
 $('level').value='0';
 showEntireMap();refreshPalette();updateSelected();commit();
 toast('試作村を生成しました：52×52、建物4棟、南門・広場・村人');
}


function makeHighBuilding(kind){
 if(world.length&&!confirm('現在のマップを建築サンプルに置き換えますか？ 先にJSON保存をおすすめします。'))return;
 snapshot();world=[];models=[];prefabs=[];terrainHeights=new Map();
 MAP_W=Math.max(MAP_W,24);MAP_H=Math.max(MAP_H,24);
 const tower=kind==='tower',size=tower?7:9,cx=Math.floor(MAP_W/2),cz=Math.floor(MAP_H/2);
 const x0=cx-Math.floor(size/2),z0=cz-Math.floor(size/2);
 const floors=tower?7:3,roofLevel=floors;
 const add=(x,z,y,type,rot=0)=>world.push({x,z,y,type,rot});
 for(let floor=0;floor<floors;floor++){
  for(let z=0;z<size;z++)for(let x=0;x<size;x++){
   const wx=x0+x,wz=z0+z,edge=x===0||z===0||x===size-1||z===size-1;
   if(floor>0)add(wx,wz,floor,tower?'stone':'woodfloor');
   else add(wx,wz,0,tower?'stone':'woodfloor');
   if(edge){
    let wall=tower?'towerWall':'timberWall',rot=0;
    if(z===0)rot=2;else if(x===0)rot=3;else if(x===size-1)rot=1;
    if((floor===0&&x===Math.floor(size/2)&&z===size-1)){
     wall='doorWood';rot=0;
    }else if((x===Math.floor(size/2)&&z===0&&floor%2===1)||
            (z===Math.floor(size/2)&&x===0&&floor%2===0)){
     wall=tower?'towerWindow':'windowWood';
    }
    add(wx,wz,floor,wall,rot);
   }
  }
  add(x0+1,z0+1,floor,tower?'stairSpiral':'stairSwitchback',0);
  if(tower){
   add(cx,cz,floor,floor===floors-1?'ancientAltar':'lantern');
  }else{
   add(cx,cz,floor,'table');
   add(x0+size-2,z0+size-2,floor,floor===2?'bedLuxury':'bookshelf');
  }
 }
 if(tower){
  for(let z=0;z<size;z++)for(let x=0;x<size;x++)if(x===0||z===0||x===size-1||z===size-1){
   add(x0+x,z0+z,roofLevel,'towerBattlement');
  }
  add(cx,cz,roofLevel,'towerSpire');
 }else{
  for(let z=0;z<size;z++)for(let x=0;x<size;x++)add(x0+x,z0+z,roofLevel,'roofTile');
 }
 for(const [dx,dz,t] of [[-6,-5,'treePine'],[6,4,'treeOak'],[-6,4,'rockCluster'],[5,-5,'flowerField']]){
  const x=cx+dx,z=cz+dz;
  if(validPos(x,z))add(x,z,0,t);
 }
 $('mapWidth').value=MAP_W;$('mapHeight').value=MAP_H;
 for(const id of ['rangeX1','rangeX2'])$(id).max=MAP_W-1;
 for(const id of ['rangeZ1','rangeZ2'])$(id).max=MAP_H-1;
 $('rangeX2').value=Math.min(Number($('rangeX2').value),MAP_W-1);
 $('rangeZ2').value=Math.min(Number($('rangeZ2').value),MAP_H-1);
 level=0;$('level').value='0';hideUpper=false;$('hideUpper').checked=false;
 selected='wall';mode='move';rotation=0;
 worldMaxLevel=world.reduce((top,o)=>Math.max(top,o.y),0);showEntireMap();refreshPalette();commit();cursorDirty=true;
 toast(tower?'7階建ての塔を試作しました':'3階建ての家を試作しました');
}

// POI sample catalog: six building typologies, three architectural states.
const PINE_SUPER_VARIANTS=[['wholesale','スーパー',36,24,1,'倉庫型スーパーの通常の廃墟']];
const PINE_SUPER_STATES=[['normal','通常の廃墟','構造を維持した店舗']];
// Apply marked corrections only to the starter-guild layout in existing local saves.
function pineApplyGuildMarkedEdits(){
 const has=(x,z,type)=>world.some(p=>p.x===x&&p.z===z&&p.y===0&&p.type===type);
 const isGuild=MAP_W===30&&MAP_H===30&&
  has(7,6,'stonewall')&&has(22,6,'stonewall')&&
  has(14,20,'stonewallDoor')&&
  has(12,10,'counterWood')&&has(16,10,'counterWood')&&
  (has(11,8,'woodwall')||has(11,8,'woodwallDoor'));
 if(!isGuild)return false;
 let changed=false;
 const remove=(x,z,types)=>{const before=world.length;
  world=world.filter(p=>!(p.x===x&&p.z===z&&p.y===0&&types.includes(p.type)));
  if(world.length!==before)changed=true;
 };
 if(has(11,8,'woodwall')&&!has(11,8,'woodwallDoor')){
  remove(11,8,['woodwall']);
  world.push({x:11,z:8,y:0,type:'woodwallDoor',rot:0});changed=true;
 }
 remove(13,9,['counterWood']);
 for(const z of [8,9,10])remove(17,z,['counterWood']);
 remove(18,10,['counterWood']);
 for(const z of [7,8,9,10])remove(19,z,['woodwall']);
 return changed;
}

// Visual review checks: separate from the terrain, editable independently, saved in map JSON.
let pineCheckMarks=[],pineCheckMode=false,pineCheckColor='#f5cb54';
const PINE_CHECK_COLORS=['#f5cb54','#f06262','#43c579','#429ff0','#ffffff','#bd80ed'];
const pineCheckNodes=new Map();
function pineCheckRefresh(){
 const bar=$('pineCheckToolbar');if(bar)bar.hidden=!pineCheckMode;
 const button=$('pineCheckMode');
 if(button){button.classList.toggle('selected',pineCheckMode);button.setAttribute('aria-pressed',String(pineCheckMode))}
 const count=$('pineCheckCount');if(count)count.textContent=pineCheckMarks.length+'件';
 document.querySelectorAll('[data-check-color]').forEach(button=>{
  const active=button.dataset.checkColor===pineCheckColor;
  button.classList.toggle('selected',active);button.setAttribute('aria-pressed',String(active));
 });
}
function pineSetCheckMode(active){
 pineCheckMode=!!active&&!pineGameActive;
  if(pineCheckMode){$('palette').classList.remove('mobileOpen');$('inspector').classList.remove('mobileOpen')}
 pineCheckRefresh();
}
function pineToggleCheck(x,z){
 if(!validPos(x,z)||pineGameActive)return;
 const index=pineCheckMarks.findIndex(p=>p.x===x&&p.z===z&&p.y===level);
 if(index<0&&pineCheckMarks.length>=300){toast('チェック上限は300件です');return}
 snapshot();
 if(index>=0)pineCheckMarks.splice(index,1);
 else pineCheckMarks.push({x,z,y:level,color:pineCheckColor});
 pineCheckNodes.clear();$('pineCheckOverlay').replaceChildren();
 commit();pineCheckRefresh();
}
function pineDrawChecks(vp){
 const layer=$('pineCheckOverlay');if(!layer)return;
 if(pineGameActive){layer.hidden=true;return}
 layer.hidden=false;
 const present=new Set();
 for(const p of pineCheckMarks){
  if(p.y!==level||p.x>=MAP_W||p.z>=MAP_H)continue;
  const key=p.x+','+p.z+','+p.y;present.add(key);
  let node=pineCheckNodes.get(key);
  if(!node){node=document.createElement('span');node.className='pineMapCheck';
   node.textContent='✓';layer.append(node);pineCheckNodes.set(key,node)}
  node.style.color=p.color;
  const pt=poiWorldToScreen(vp,p.x+.5,terrainY(p.x,p.z)+p.y*1.4+.7,p.z+.5);
  const visible=pt&&pt.x>=-24&&pt.y>=-24&&pt.x<=canvas.clientWidth+24&&pt.y<=canvas.clientHeight+24;
  node.style.display=visible?'grid':'none';
  if(visible){node.style.left=pt.x+'px';node.style.top=pt.y+'px'}
 }
 for(const [key,node] of pineCheckNodes)if(!present.has(key)){node.remove();pineCheckNodes.delete(key)}
}
// v86: Safe, opt-in reconstruction of the user's v84 guild screenshots.
// Only the 30x30 guild GROUND-FLOOR solid objects are replaced. Floors, all
// upstairs objects, terrain and every position outside the guild are preserved.
// Original full map is separately backed up before any change.
function pineApplyScreenshotGuildLayout(){
 if(MAP_W!==30||MAP_H!==30||!guildBounds()){
  toast('30×30の冒険者ギルドを開いてから実行してください');return;
 }
 const west=7,east=22,north=6,south=20;
 const inside=o=>o.y===0&&o.x>=west&&o.x<=east&&o.z>=north&&o.z<=south;
 const existing=world.filter(o=>inside(o)&&!isFloor(o.type));
 if(!confirm('v84の写真に合わせてギルド1階の壁・家具を再配置します。\n対象 '+existing.length+'件を置き換えます。上階・床・屋外は残します。\n現在の全マップを別途バックアップして続けますか？'))return;
 try{
  // Do not overwrite the previous backup if the action is accidentally repeated.
  const key='pine-guild-screenshot-before-v86';
  if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(data()));
 }catch(e){
  alert('安全なバックアップを保存できなかったため、配置は変更していません。');return;
 }
 snapshot();
 world=world.filter(o=>!inside(o)||isFloor(o.type));
 const add=(x,z,type,rot=0)=>world.push({x,z,y:0,type,rot});
 // The outer shell and six ground-floor windows match the photograph.
 for(let z=north;z<=south;z++)for(let x=west;x<=east;x++){
  if(x!==west&&x!==east&&z!==north&&z!==south)continue;
  const doorway=z===south&&x===14;
  const window=(z===south&&(x===10||x===19))||
   (z===north&&(x===10||x===19))||
   ((x===west||x===east)&&(z===10||z===16));
  add(x,z,doorway?'stonewallDoor':window?'stonewallWindow':'stonewall',z===north?2:x===west?3:x===east?1:0);
 }
 // Left staff wing, bath, stair passage and north-right sanitary cubicle.
 for(let z=7;z<=17;z++)add(11,z,z===8?'woodwallDoor':'woodwall',z===8?1:0);
 for(let x=8;x<=10;x++)add(x,13,x===9?'woodwallDoor':'woodwall');
 for(let x=8;x<=10;x++)add(x,17,'woodwall');
 for(let z=7;z<=11;z++)add(18,z,'woodwall');
 for(let x=19;x<=21;x++)add(x,11,x===20?'woodwallDoor':'woodwall');
 // Photo-reference furniture coordinates, including all reception sections.
 const pieces=[
  [9,8,'bed'],[10,8,'bookshelf'],[21,12,'bookshelf',3],
  [12,10,'counterWood'],[13,10,'counterWood'],[14,10,'counterWood'],
  [15,10,'counterWood'],[16,10,'counterWood'],
  [16,8,'counterWood',1],[16,9,'counterWood',1],
  [9,10,'table'],[10,10,'chairWood',2],[10,12,'wardrobe'],
  [9,15,'bathWood'],[20,13,'roundTableWood'],[20,14,'chairWood',2],
  [19,13,'chairWood',3],[20,16,'benchWood',2],[19,16,'roundTableWood'],
  [11,12,'guildWallQuestBoard',3],[20,8,'guildLatrine'],[21,9,'crate'],
  [10,16,'crate'],[20,18,'barrel'],[10,14,'guildLatrine'],
  [20,13,'lantern'],[8,18,'guildStairUp'],
  [14,20,'guildFacadeSign']
 ];
 for(const [x,z,type,rot=0] of pieces)add(x,z,type,rot);
 // Ledger, pen cup and charter are rendered from the counter layout:
 // never save them as duplicates in world[].
 commit();refreshPalette();updateSelected();
 toast('ギルド1階を写真の配置へ調整。元データはバックアップ済み（元に戻すことも可能）');
}

function pineRestoreScreenshotGuildBackup(){
 const key='pine-guild-screenshot-before-v86';
 let backup;
 try{backup=localStorage.getItem(key)}catch(e){}
 if(!backup){toast('復元用バックアップがありません');return}
 if(!confirm('写真配置を適用する直前のマップ全体を復元します。\n現在の未保存変更は上書きされます。よろしいですか？'))return;
 try{
  const parsed=JSON.parse(backup);
  if(!parsed||!Array.isArray(parsed.world)||!Number.isFinite(parsed.width))throw Error('backup invalid');
  snapshot();loadData(parsed);commit();refreshPalette();updateSelected();showEntireMap();
  toast('写真配置の適用前のマップを復元しました');
 }catch(e){alert('バックアップの復元に失敗しました。現在の配置は維持されています。')}
}
function pineStarterGuildPOI(){
 if(world.length&&!confirm('現在の編集マップを冒険者ギルドのサンプルで置き換えますか？ 先にJSON保存をおすすめします。'))return;
 snapshot();world=[];models=[];prefabs=[];terrainHeights=new Map();
 const w=30,h=30;MAP_W=w;MAP_H=h;
 const add=(x,z,type,y=0,rot=0)=>{if(x>=0&&x<w&&z>=0&&z<h)world.push({x,z,y,type,rot})};
 const west=7,east=22,north=6,south=20,doorX=14;
 // Courtyard / three-tile approach, without unrelated obstacles on the threshold.
 for(let z=2;z<h-2;z++)for(let x=2;x<w-2;x++)
  add(x,z,(z>south&&Math.abs(x-doorX)<=2)?'grassTrampled':((x>=west-2&&x<=east+2&&z>=north-2&&z<=south+3&&(x+z)%11===0)?'grassPebbles':'grassMeadow'));
 for(let z=south+1;z<h-2;z++)for(let x=doorX-1;x<=doorX+1;x++)add(x,z,'stone');
 // Ground floor: clear central aisle, symmetric windows, timber-lined entry hall.
 for(let z=north;z<=south;z++)for(let x=west;x<=east;x++){
  add(x,z,'woodfloor');
  if(x===west||x===east||z===north||z===south){
   const entrance=z===south&&x===doorX;
   const window=(z===south&&(x===10||x===19))||
     (z===north&&(x===10||x===19))||
     ((x===west||x===east)&&(z===10||z===16));
   add(x,z,entrance?'stonewallDoor':window?'stonewallWindow':'stonewall',0,z===north?2:x===west?3:x===east?1:0);
  }
 }
 // Upper storey is a separate editable layer, with windows and its own floor.
 for(let z=north;z<=south;z++)for(let x=west;x<=east;x++){
  // Keep a large central gallery opening to make the ground-floor atrium legible.
  const gallery=x>=12&&x<=17&&z>=11&&z<=16;
  if(!gallery&&!(x===8&&z===18))add(x,z,'woodfloor',1);
  if(x===west||x===east||z===north||z===south){
   const window=(z===south&&(x===10||x===14||x===19))||
    (z===north&&(x===10||x===19))||
    ((x===west||x===east)&&(z===10||z===16));
   add(x,z,window?'stonewallWindow':'stonewall',1,z===north?2:x===west?3:x===east?1:0);
  }
  // Roof joins automatically create a pitched ridge instead of a flat warehouse lid.
 }
 // Third floor: guild archive and meeting gallery.
 for(let z=north;z<=south;z++)for(let x=west;x<=east;x++){
  const opening=x>=13&&x<=16&&z>=12&&z<=15;
  if(!opening&&!(x===19&&z===17))add(x,z,'woodfloor',2);
  if(x===west||x===east||z===north||z===south){
   const window=(z===south&&(x===10||x===14||x===19))||(z===north&&(x===10||x===19))||((x===west||x===east)&&(z===10||z===16));
   add(x,z,window?'stonewallWindow':'stonewall',2,z===north?2:x===west?3:x===east?1:0);
  }
  add(x,z,'roofHip',3);
 }
 // Reference floor plan: rear-left living room, compact middle-left bath
 // (3x3 cells), left-front stair landing, north-east private toilet.
 // Blue mark: move staff entrance to (11,8), near the back of the left wing.
 // Red mark: remove the doorway entirely at (11,18), leaving an open stair path.
 for(let z=7;z<=18;z++){
  if(z===18)continue;
  add(11,z,z===8?'woodwallDoor':'woodwall');
 }
 for(let x=8;x<=10;x++)add(x,13,x===9?'woodwallDoor':'woodwall');
 for(let x=8;x<=10;x++)add(x,17,'woodwall');
 // Remove the freestanding strip at the front of the staff stair landing.
 // Shift the private-toilet side partition one tile inward only where
 // the counter meets it, keeping the toilet screened by an actual wall.
 for(let z=7;z<=9;z++)add(18,z,'woodwall');
 // Remove the four white-marked right partition pieces (x19,z7-10).
 for(let x=19;x<=21;x++)add(x,11,x===20?'woodwallDoor':'woodwall');
 // Ground-floor reception sits ahead of the door, with accessible side aisles.
 for(const [x,z,t,r,y] of [
  // Keep the notice-board sightlines open; storage belongs along side bays.
  [8,9,'bookshelf',1,0],[9,8,'bed',0,0],
  [21,12,'bookshelf',3,0],
  // Keep the unmarked front counter at x12 through x16.
  // Keep the existing rear-facing side wings and a staff-only route behind them.
  [12,10,'counterWood',0,0],[13,10,'counterWood',0,0],
  [14,10,'counterWood',0,0],[15,10,'counterWood',0,0],
  [16,10,'counterWood',0,0],
  [9,10,'table',0,0],[10,10,'chairWood',2,0],
  [10,12,'wardrobe',0,0],[9,15,'bathWood',0,0],
  [20,13,'roundTableWood',0,0],[20,14,'chairWood',2,0],[19,13,'chairWood',3,0],
  [20,16,'benchWood',2,0],
  [19,16,'roundTableWood',0,0],
  // Wide two-cell noticeboard faces the public area, on the marked upper wall.
  [11,12,'guildWallQuestBoard',3,0],
  [20,8,'guildLatrine',0,0],[21,9,'crate',0,0],
  [10,16,'crate',0,0],[20,18,'barrel',0,0],
  [10,14,'lantern',0,0],[20,13,'lantern',0,0],
  [8,18,'guildStairUp',0,0],[8,18,'guildStairDown',0,1],
  [9,8,'bookshelf',0,1],[20,8,'bookshelf',0,1],
  [10,18,'roundTableWood',0,1],[11,18,'chairWood',2,1],
  [19,17,'guildStairUp',0,1],[19,17,'guildStairDown',0,2],
  [9,8,'bookshelf',0,2],[10,8,'bookshelf',0,2],[20,8,'bookshelf',0,2],
  [10,18,'roundTableStone',0,2],[11,18,'chairWood',2,2],
  [18,10,'guildQuestBoard',0,2],[19,13,'table',0,2],
  [9,22,'benchWood',0,0],[20,22,'benchWood',0,0],
  [8,24,'bushFlower',0,0],[21,25,'bushFlower',0,0],
  [4,9,'treeOak',0,0],[26,10,'treeBirch',0,0],
  [4,21,'bushFlower',0,0],[26,22,'bushFlower',0,0],
  [14,20,'guildFacadeSign',0,0]
 ])add(x,z,t,y,r);
 // A single facade-mounted guild nameplate replaces the old freestanding crest.
 add(11,south+1,'lantern');add(18,south+1,'lantern');
 for(const [id,val] of [['mapWidth',w],['mapHeight',h],['rangeX1',west],['rangeX2',east],['rangeZ1',north],['rangeZ2',south]]){
  const el=$(id);if(el)el.value=val;
 }
 for(const id of ['rangeX1','rangeX2'])$(id).max=w-1;
 for(const id of ['rangeZ1','rangeZ2'])$(id).max=h-1;
 level=0;$('level').value='0';hideUpper=false;$('hideUpper').checked=false;
 $('poiRoofToggle').textContent='屋根を隠す';
 poiWalkReset(doorX,south+3);
 selected='stonewall';mode='move';rotation=0;
 commit();refreshPalette();updateSelected();showEntireMap();
 $('palette').classList.remove('mobileOpen');
 toast('冒険者ギルドを配置しました（受付・職員室・トイレ・談話スペース）。編集後にPOIとして登録できます');
}
function pineSupermarketPOI(style='wholesale',condition='normal',force=false){
 style='wholesale';condition='normal';
 const spec=PINE_SUPER_VARIANTS[0];
 if(!force&&world.length&&!confirm('現在のエディター配置をスーパーのPOIサンプルで置き換えますか？ JSON保存をおすすめします。'))return;
 const [,label,w,d,levels]=spec;
 snapshot();world=[];models=[];prefabs=[];terrainHeights=new Map();
 const siteW=Math.max(48,w+24),siteH=Math.max(46,d+30);
 MAP_W=siteW;MAP_H=siteH;
 const put=(x,z,type,y=0,rot=0)=>{if(x>=0&&z>=0&&x<siteW&&z<siteH)world.push({x,z,y,type,rot})};
 const west=Math.floor((siteW-w)/2),north=8,south=north+d-1,cx=west+Math.floor(w/2);
 const t=(x,z)=>((x*17+z*29+w*13+d*7)%23+23)%23;
 // Full site baseline, pavement, service ramp and parking aisle.
 for(let z=2;z<siteH-2;z++)for(let x=2;x<siteW-2;x++)
  put(x,z,x>=west-5&&x<=west+w+5?'stone':'grass');
 for(let z=2;z<north;z++)for(let x=west+Math.floor(w*.45);x<Math.min(siteW-2,west+w+8);x++)put(x,z,'ironfloor');
 for(let z=south+3;z<siteH-3;z++)for(let x=west-3;x<west+w+3;x++)put(x,z,'roadBasaltFull');
 for(let x=west;x<west+w;x++){put(x,south+1,'plasterfloor');if(x%2===0)put(x,south+2,'pineSuperCurb')}
 // Two rows of parked-car bays: continuous long white side lines and closing end lines.
 // Keep a separate unobstructed pedestrian strip aligned with the single main door.
 for(const startZ of [south+5,south+13]){
  if(startZ+4>=siteH-3)continue;
  for(let x=west-2;x<=west+w+1;x+=3){
   if(Math.abs(x-cx)<=3)continue;
   for(let z=startZ;z<=startZ+4;z++)put(x,z,'pineSuperStripe');
   if(x+2<siteW-2)put(x+1,startZ+4,'pineSuperBayEnd');
  }
 }
 for(let z=south+3;z<siteH-3;z++)for(const x of [cx-1,cx,cx+1])put(x,z,'plasterfloor');
 // Floorplates including second-story urban storage.
 for(let y=0;y<levels;y++)for(let z=north;z<=south;z++)for(let x=west;x<west+w;x++){
  const back=z<north+Math.max(3,Math.floor(d*.27));
  put(x,z,y>0?'woodfloorLight':back?'ironfloor':z>=south-3?'plasterfloor':'basicfloor',y);
 }
 const backZ=north+Math.max(3,Math.floor(d*.27));
 // Perimeter with selective glazing and a 2/3-tile automated glass entrance.
 for(let y=0;y<levels;y++)for(let z=north;z<=south;z++)for(let x=west;x<west+w;x++){
  const side=x===west||x===west+w-1,isBack=z===north,isFront=z===south;
  if(!side&&!isBack&&!isFront)continue;
  const entry=y===0&&isFront&&x===cx;
  const shutter=y===0&&isBack&&x===west+w-5;
  const staff=y===0&&isBack&&x===west+2;
  const glazing=isFront&&x>west+2&&x<west+w-3&&y===0;
  let type=entry?'pineSuperDoor':shutter?'pineSuperShutter':staff?'plasterwallDoor':glazing?'pineSuperGlass':'pineSuperWall';
  if(y===0&&isFront&&!entry&&!glazing&&x>west+2&&x<west+w-3)type='pineSuperAccent';
  if((x===west||x===west+w-1)&&(z===north||z===south))type='pineSuperCorner';
  if(condition==='converted'&&isFront&&x===cx+1)type='ironwall';
  if(condition==='damaged'&&y===0&&!entry&&!staff&&!shutter&&!(side&&isBack)&&!(side&&isFront)&&t(x,z)<3)continue;
  put(x,z,type,y);
 }
 // Back-of-house partitions, access points and storage racks.
 for(let x=west+1;x<west+w-1;x++)
  put(x,backZ,x===west+w-5?'plasterwallDoor':'plasterwall');
 for(let x=west+Math.floor(w*.34);x<west+w-1;x+=Math.max(4,Math.floor(w*.21)))
  for(let z=north+1;z<backZ;z++)put(x,z,z===backZ-1?'plasterwallDoor':'plasterwall');
 for(let x=west+2;x<west+w-2;x+=Math.max(3,Math.floor(w*.22)))put(x,north+2,'pineSuperRack');
 // Staff kitchenette/office side, clear route to loading bay.
 if(w>=18)put(west+2,north+2,'table');
 // Main accessible aisle, shelf rows, perimeter chillers.
 const aisleStart=backZ+2,aisleEnd=south-5;
 const shelfStep=style==='wholesale'?4:3;
 for(let x=west+3;x<west+w-3;x+=shelfStep){
  if(Math.abs(x-cx)<=2)continue;
  for(let z=aisleStart;z<=aisleEnd;z++){
   const retained=x===west+3&&z===aisleStart;
   const keptEmpty=x===west+3&&z===aisleEnd;
   const keptSparse=w<=18&&x>cx&&z===aisleStart;
   if(condition==='damaged'&&!retained&&!keptEmpty&&!keptSparse&&t(x,z)<=2)continue;
   const k=t(x,z);
   const shelf=retained?'pineSuperShelfStocked':keptEmpty?'pineSuperShelfEmpty':keptSparse?'pineSuperShelfSparse':k<7?'pineSuperShelfEmpty':k<14?'pineSuperShelfSparse':k<20?'pineSuperShelf':'pineSuperShelfStocked';
   put(x,z,shelf);
  }
  if(aisleStart<=aisleEnd)put(x,aisleEnd+1,'pineSuperShelfEnd');
 }
 for(let z=aisleStart;z<=aisleEnd;z++)for(const x of [west+1,west+w-2])put(x,z,'pineSuperCooler');
 if(w>=20)for(const x of [cx-3,cx+3])for(let z=aisleStart;z<=Math.min(aisleEnd,aisleStart+2);z++)put(x,z,'pineSuperFreezer');
 // Dedicated produce and deli/butcher sections are grouped rather than scattered.
 for(let x=west+2;x<=west+Math.min(w-3,8);x+=2){
  if(x!==cx&&aisleStart+1<=aisleEnd)put(x,aisleStart+1,'pineSuperProduceSlope');
 }
 if(aisleEnd>=aisleStart+3)for(let x=west+w-7;x<west+w-2;x+=2)
  if(x!==cx&&x>west+1)put(x,aisleEnd-1,'pineSuperFreshCase');
 for(let x=west+2;x<=west+4;x+=2)if(x<west+w-2)put(x,aisleStart,'pineSuperProduce');
 const registers=Math.max(1,Math.min(6,Math.round(w/7)));
 for(let i=0;i<registers;i++){
  const x=west+3+Math.floor(i*(w-7)/Math.max(1,registers-1));
  if(Math.abs(x-cx)>1){
   put(x,south-2,'pineSuperCheckout');
   if(south-3>aisleEnd+1)put(x,south-3,'pineSuperPacking');
   if(x+1<west+w-1)put(x+1,south-2,'pineSuperRegisterGate');
  }
 }
 // A fictional, locally rendered brand sign spans the shopfront.
 put(cx,south,'pineSuperLogo');
 // Park in the marked bays, with different silhouettes, orientations and abandoned states.
 const cars=style==='compact'?2:style==='hyper'||style==='wholesale'?6:4;
 const carTypes=['pineSuperCar','pineSuperCarMini','pineSuperCarVan','pineSuperCarSUV','pineSuperCarPickup'];
 for(let i=0;i<cars;i++){
  const side=i%2===0?-1:1,slot=Math.floor(i/2),x=side<0?west+3+(slot%2)*3:west+w-4-(slot%2)*3;
  const z=south+(slot>=2?15:7);
  if(x>2&&x<siteW-3&&z<siteH-3&&Math.abs(x-cx)>2)
    put(x,z,carTypes[(i+Math.floor(w/8))%carTypes.length],0,(i%3===0?1:i%4===0?3:0));
 }
 put(west+1,south+1,'pineSuperCart');put(west+2,south+1,'pineSuperCart');
 put(west+Math.floor(w*.25),south+1,'pineSuperSign');
 put(west+Math.floor(w*.72),south+1,'pineSuperSign');
 for(const z of [north+1,north+4])put(Math.min(siteW-3,west+w+4),z,'pineSuperBollard');
 // Preserve one customer entrance while ensuring every accessible interior tile connects.
 // 0-1 BFS chooses the fewest wall/fixture edits; no unbounded brute-force room drilling.
 const accessClear=new Set(['pineSuperDoor','plasterwallDoor','woodwallDoor','brickwallDoor','pineSuperLogo','pineSuperStripe','pineSuperCurb','pineSuperSign']);
 const inside=(x,z)=>x>west&&x<west+w-1&&z>north&&z<south;
 const kOf=(x,z)=>x+','+z,blockers=new Map();
 for(const o of world)if(o.y===0&&inside(o.x,o.z)&&!isFloor(o.type)&&!accessClear.has(o.type))blockers.set(kOf(o.x,o.z),o);
 const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
 const flood=()=>{
  const seen=new Set(),queue=[[cx,south-1]];seen.add(kOf(cx,south-1));
  for(let j=0;j<queue.length;j++)for(const [dx,dz] of dirs){
   const nx=queue[j][0]+dx,nz=queue[j][1]+dz,k=kOf(nx,nz);
   if(!inside(nx,nz)||seen.has(k)||blockers.has(k))continue;
   seen.add(k);queue.push([nx,nz]);
  }
  return seen;
 };
 let accessRepairs=0;
 for(let check=0;check<w*d;check++){
  const reached=flood(),remaining=[];
  for(let z=north+1;z<south;z++)for(let x=west+1;x<west+w-1;x++){
   const k=kOf(x,z);if(!blockers.has(k)&&!reached.has(k))remaining.push(k);
  }
  if(!remaining.length)break;
  const dist=new Map(),prev=new Map(),queue=[...reached],remainingSet=new Set(remaining);
  for(const k of reached)dist.set(k,0);
  let goal=null;
  for(let qi=0;qi<queue.length;qi++){
   const k=queue[qi],here=dist.get(k),[x,z]=k.split(',').map(Number);
   if(remainingSet.has(k)){goal=k;break}
   for(const [dx,dz] of dirs){
    const nx=x+dx,nz=z+dz,nk=kOf(nx,nz);if(!inside(nx,nz))continue;
    const cost=blockers.has(nk)?1:0,next=here+cost;
    if(next>=(dist.get(nk)??Infinity))continue;
    dist.set(nk,next);prev.set(nk,k);
    if(cost)queue.push(nk);else queue.splice(qi+1,0,nk);
   }
  }
  if(!goal)break;
  let removed=0;
  for(let k=goal;prev.has(k);k=prev.get(k)){
   const wall=blockers.get(k);if(!wall)continue;
   // Turn one partition wall into a door; do not alter outer walls or user assets.
   if(/wall/i.test(wall.type)||wall.type==='ironwall')wall.type='plasterwallDoor';
   else world.splice(world.indexOf(wall),1);
   blockers.delete(k);removed++;
  }
  if(!removed)break;
  accessRepairs+=removed;
 }
 // Internal repairs never affect the perimeter or main facade.
 // Roof is an independent hideable story, not a collision-bearing floor.
 for(let z=north;z<=south;z++)for(let x=west;x<west+w;x++){
  if(condition==='damaged'&&t(x,z)<4)continue;
  put(x,z,'pineSuperRoof',levels);
 }
 for(const x of [west+4,west+w-5])put(x,north+3,'pineSuperAC',levels);
 if(levels===2)put(west+2,north+2,'stairSwitchback',0);
 if(condition==='converted'){
  for(let x=west+3;x<west+w-3;x+=2)if(Math.abs(x-cx)>2)put(x,south+2,'pineSuperBollard');
 }
 for(const [id,v] of [['mapWidth',siteW],['mapHeight',siteH],['rangeX1',west],['rangeZ1',north],['rangeX2',west+w-1],['rangeZ2',south]]){
  const el=$(id);if(el)el.value=v;
 }
 for(const id of ['rangeX1','rangeX2'])$(id).max=siteW-1;
 for(const id of ['rangeZ1','rangeZ2'])$(id).max=siteH-1;
 level=0;$('level').value='0';hideUpper=false;$('hideUpper').checked=false;
 $('poiRoofToggle').textContent='屋根を隠す';
 poiWalkReset(cx,south+3);
 selected='pineSuperShelf';mode='move';rotation=0;
 commit();refreshPalette();updateSelected();showEntireMap();
 toast(label+'・'+PINE_SUPER_STATES.find(v=>v[0]===condition)?.[1]+' を配置した');
}
function pineSwitchEditor(open){
 const url=new URL(location.href);
 if(open)url.searchParams.set('editor','1');
 else url.searchParams.delete('editor');
 location.href=url.toString();
}

const PINE_CUSTOM_POI_KEY='world-workshop-pois-v1';
let customPOIs=[];
function pineReadSavedPOIs(){
 try{
  const saved=localStorage.getItem(PINE_CUSTOM_POI_KEY);
  if(!saved)return [];
  const list=JSON.parse(saved);
  if(!Array.isArray(list)||list.length>20)return [];
  return list.filter(p=>p&&typeof p.id==='string'&&/^poi-[a-z0-9-]{3,40}$/.test(p.id)&&
   typeof p.name==='string'&&p.name.length>0&&p.name.length<=40&&p.map&&
   p.map.format==='forest-world-v1'&&p.map.version===1&&Array.isArray(p.map.world));
 }catch(e){return []}
}
let poiExpanded=false;
function pineBuildPOICategories(){
 const host=$('poiSampleCategories');if(!host)return;
 host.replaceChildren();
 const heading=expandableRow('POI','',poiExpanded,()=>{
  poiExpanded=!poiExpanded;pineBuildPOICategories();
 },'pineSuperShelfStocked');
 host.append(heading);
 if(!poiExpanded)return;
 const inner=document.createElement('div');inner.className='nestedChoices poiInner';
 const button=document.createElement('button');
 button.type='button';button.className='poiSampleEntry item';
 const glyph=document.createElement('span');glyph.className='poiEntryGlyph';glyph.textContent='▦';
 const info=document.createElement('span');info.textContent='スーパー';
 const detail=document.createElement('small');detail.textContent='倉庫型・通常の廃墟';
 info.append(detail);button.append(glyph,info);
 button.addEventListener('click',()=>{pineSupermarketPOI('wholesale','normal');$('palette').classList.remove('mobileOpen')});
 inner.append(button);
 for(const record of customPOIs){
  const row=document.createElement('div');row.className='poiCustomEntry';
  const choice=document.createElement('button');choice.type='button';choice.className='poiSampleEntry item';
  const symbol=document.createElement('span');symbol.className='poiEntryGlyph';symbol.textContent='▦';
  const label=document.createElement('span');label.textContent=record.name;
  const desc=document.createElement('small');desc.textContent=record.map.width+'×'+record.map.height+' マス · 登録済み';
  label.append(desc);choice.append(symbol,label);
  choice.addEventListener('click',()=>pineLoadCustomPOI(record.id));
  const remove=document.createElement('button');remove.type='button';remove.className='poiDelete';remove.textContent='×';remove.setAttribute('aria-label',record.name+' を削除');
  remove.addEventListener('click',()=>{
   if(!confirm('登録済みPOI「'+record.name+'」を削除しますか？'))return;
   const ix=customPOIs.findIndex(p=>p.id===record.id);if(ix<0)return;
   const next=customPOIs.filter(p=>p.id!==record.id);
   if(!pineStorePOIs(next))return;
   customPOIs=next;pineBuildPOICategories();toast('登録POIを削除しました');
  });
  row.append(choice,remove);inner.append(row);
 }
 host.append(inner);
}
function pineStorePOIs(entries){
 try{
  const content=JSON.stringify(entries);
  if(content.length>4*1024*1024){toast('POI保存容量の上限です。不要なPOIを削除してください');return false}
  localStorage.setItem(PINE_CUSTOM_POI_KEY,content);return true;
 }catch(e){toast('POIを保存できません。端末の空き容量を確認してください');return false}
}
function pineRegisterCurrentPOI(){
 if(!world.length){toast('建材がないマップは登録できません');return}
 if(customPOIs.length>=20){toast('POIは20件まで。不要なPOIを削除してください');return}
 $('poiNameInput').value='マイPOI '+(customPOIs.length+1);
 $('poiNameError').textContent='';
 $('poiNameModal').classList.add('open');
 requestAnimationFrame(()=>$('poiNameInput').focus());
}
function pineClosePOINameModal(){
 $('poiNameModal').classList.remove('open');
 $('poiNameError').textContent='';
}
function pineConfirmPOIName(){
 const label=$('poiNameInput').value.trim();
 if(!label||label.length>40){$('poiNameError').textContent='POI名を1〜40文字で入力してください';$('poiNameInput').focus();return}
 if(customPOIs.length>=20){$('poiNameError').textContent='POIは20件まで登録できます';return}
 const record={id:'poi-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),name:label,map:data()};
 const next=[...customPOIs,record];
 if(!pineStorePOIs(next)){$('poiNameError').textContent='保存できません。端末の空き容量を確認してください';return}
 customPOIs=next;pineBuildPOICategories();pineClosePOINameModal();toast('「'+label+'」をPOIに登録しました');
}
function pineLoadCustomPOI(id){
 const record=customPOIs.find(p=>p.id===id);if(!record)return;
 if(!confirm('現在の編集マップを「'+record.name+'」で置き換えますか？ 未保存の変更はJSONで保存してください。'))return;
 try{
  const before=JSON.stringify(data());
  loadData(record.map);
  undoStack.push(before);if(undoStack.length>45)undoStack.shift();redoStack.length=0;
  commit();showEntireMap();$('palette').classList.remove('mobileOpen');
  toast('「'+record.name+'」を読み込みました');
 }catch(e){toast('POIの読み込みに失敗: '+e.message)}
}

/* v39 - independent, autosaved adventure world */
const PINE_GAME_SAVE_KEY='world-workshop-adventure-v1';
let pineGameActive=false,pineEditorBackup=null,pineGameLastSave=0;
const PINE_GAME_SPAWN={x:24,z:24};
function pineGameGenerate(){
 const worldItems=[],add=(x,z,type,y=0,rot=0)=>{if(x>=0&&z>=0&&x<48&&z<48)worldItems.push({x,z,y,type,rot})};
 for(let t=0;t<48;t++)for(let q=23;q<=25;q++){add(q,t,t<13||t>35?'earth':'stone');add(t,q,t<13||t>35?'earth':'stone')}
 for(let x=20;x<=28;x++)for(let z=20;z<=28;z++)add(x,z,'stone');
 for(const [bx,bz,wall,roof] of [[14,14,'plasterwall','roofThatch'],[29,14,'woodwall','roofPlank'],[14,29,'brickwall','roofTile'],[29,29,'stonewall','roofThatch']]){
  for(let dx=0;dx<5;dx++)for(let dz=0;dz<5;dz++){
   const x=bx+dx,z=bz+dz;
   if(dx===0||dx===4||dz===0||dz===4){
    const entrance=dx===2&&dz===(bz<24?4:0),window=!entrance&&(dx===2||dz===2);
    add(x,z,entrance?wall+'Door':window?wall+'Window':wall);
   }else add(x,z,'woodfloor');
   add(x,z,roof,1);
  }
 }
 for(const [x,z,type] of [[21,21,'wellStone'],[27,21,'marketStallCloth'],[21,27,'benchWood'],[27,27,'marketStallWood'],[22,22,'humanVillager'],[26,22,'humanVillager'],[22,26,'humanVillager'],[26,26,'humanVillager']])add(x,z,type);
 for(let x=3;x<45;x+=4)for(let z=3;z<45;z+=4){
  if(Math.abs(x-24)<12&&Math.abs(z-24)<12)continue;
  if(x>=22&&x<=26||z>=22&&z<=26)continue;
  const hash=(x*37+z*71)%11;
  add(x,z,hash%3===0?'treeOak':hash%3===1?'treeBirch':'treePine');
  if(hash%2===0)add(Math.min(x+1,46),z,'bush');
 }
 for(const [x,z] of [[10,10],[10,19],[11,32],[9,40],[17,7],[29,8],[38,12],[42,20],[39,32],[32,41],[20,40],[7,28],[35,6],[6,35],[41,42],[15,41]])add(x,z,'monsterSlime');
 return {format:'forest-world-v1',version:1,size:48,width:48,height:48,terrainHeights:[],world:worldItems,models:[],prefabs:[]};
}
function pineGameRead(){
 try{const v=JSON.parse(localStorage.getItem(PINE_GAME_SAVE_KEY)||'null');
  return v&&v.version===1&&Number.isInteger(v.x)&&Number.isInteger(v.z)&&v.x>=0&&v.x<48&&v.z>=0&&v.z<48&&Array.isArray(v.monsters)?v:null;
 }catch(e){return null}
}
function pineGameSave(force=false){
 if(!pineGameActive)return;
 const now=performance.now();if(!force&&now-pineGameLastSave<1800)return;
 pineGameLastSave=now;
 try{localStorage.setItem(PINE_GAME_SAVE_KEY,JSON.stringify({
  version:1,x:poiWalkX,z:poiWalkZ,hp:poiPlayerHP,
  monsters:[...poiMonsterStates.values()].map(s=>({x:s.x,z:s.z,hp:s.hp}))
 }))}catch(e){if(force)toast('ゲームの自動保存に失敗しました')}
}
function pineGameEnter(){
 if(pineGameActive)return;
 if(poiWalkActive)poiWalkSet(false);
 saveLocal();pineEditorBackup=JSON.stringify(data());
 try{
  const saved=pineGameRead();
  loadData(pineGameGenerate());
  pineGameActive=true;
  $('app').classList.add('gameWorldMode');
  $('palette').classList.remove('mobileOpen');$('inspector').classList.remove('mobileOpen');
  poiWalkSet(true);
  poiBuildGameRoofs();
  poiSpawnX=PINE_GAME_SPAWN.x;poiSpawnZ=PINE_GAME_SPAWN.z;
  const pos=saved&&poiWalkCanStep(saved.x,saved.z)?saved:PINE_GAME_SPAWN;
  poiWalkReset(pos.x,pos.z);
  if(saved){
   poiPlayerHP=Number.isFinite(saved.hp)?Math.max(1,Math.min(POI_PLAYER_MAX_HP,saved.hp)):POI_PLAYER_MAX_HP;
   [...poiMonsterStates.values()].forEach((state,i)=>{
    const m=saved.monsters[i];
    if(m&&Number.isInteger(m.x)&&Number.isInteger(m.z)&&Number.isFinite(m.hp)&&validPos(m.x,m.z)){
     state.x=m.x;state.z=m.z;state.fromX=m.x;state.fromZ=m.z;state.moveStarted=-10000;state.facing=0;state.hp=Math.max(0,Math.min(POI_MONSTER_STATS.monsterSlime.hp,m.hp));
    }
   });
  }
  poiThirdPerson=false;$('poiThirdView').textContent='三人称視点';$('poiThirdView').setAttribute('aria-pressed','false');
  poiCombatHud();dirty=true;cursorDirty=true;pineGameSave(true);
  toast(saved?'冒険を再開しました':'村に到着しました。草原でスライムと戦えます');
 }catch(e){
  console.error('Could not enter game',e);
  pineGameActive=false;$('app').classList.remove('gameWorldMode');
  if(poiWalkActive)poiWalkSet(false);
  if(pineEditorBackup){try{loadData(JSON.parse(pineEditorBackup))}catch(_e){}}
  pineEditorBackup=null;showEntireMap();toast('ゲーム世界を開けませんでした');
 }
}
function pineGameExit(){
 if(!pineGameActive)return;
 pineGameSave(true);poiDestroyGameRoofs();poiWalkSet(false);
 pineGameActive=false;$('app').classList.remove('gameWorldMode');
 if(pineEditorBackup)loadData(JSON.parse(pineEditorBackup));
 pineEditorBackup=null;showEntireMap();updateSelected();dirty=true;cursorDirty=true;
 toast('エディターに戻りました');
}

function makeDemo(){pineSupermarketPOI('wholesale','normal',false)}
function setMapSize(skipRemovalConfirm=false){
 const width=Number($('mapWidth').value),height=Number($('mapHeight').value);
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<MIN_MAP||height<MIN_MAP||width>MAX_MAP||height>MAX_MAP){toast('縦横は12〜128の整数で指定してください');return}
 if(width===MAP_W&&height===MAP_H){showEntireMap();toast('マップ全体を表示しました');return}
 const removed=world.filter(p=>p.x>=width||p.z>=height);
 if(removed.length&&!skipRemovalConfirm&&!confirm('範囲外の建材 '+removed.length+' 個が消えます。縮小しますか？'))return;
 snapshot();world=world.filter(p=>p.x<width&&p.z<height);terrainHeights=new Map([...terrainHeights].filter(([key])=>{const [x,z]=key.split(',').map(Number);return x<width&&z<height}));MAP_W=width;MAP_H=height;
 $('rangeX1').max=$('rangeX2').max=width-1;$('rangeZ1').max=$('rangeZ2').max=height-1;
 $('rangeX2').value=Math.min(width-1,Number($('rangeX2').value));$('rangeZ2').value=Math.min(height-1,Number($('rangeZ2').value));
 showEntireMap();commit();toast(width+'×'+height+' マスの地面を表示しました');
}
function closeClearMapModal(){
 $('clearMapModal').classList.remove('open');
 $('clearEntireMap').focus();
}
$('clearEntireMap').addEventListener('click',()=>{
 if(!world.length&&!terrainHeights.size){toast('消去するものがありません');return}
 $('clearMapModal').classList.add('open');
 $('cancelClearMap').focus();
});
$('cancelClearMap').addEventListener('click',closeClearMapModal);
$('clearMapModal').addEventListener('click',e=>{if(e.target===$('clearMapModal'))closeClearMapModal()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('clearMapModal').classList.contains('open')){e.preventDefault();closeClearMapModal()}});
$('confirmClearMap').addEventListener('click',()=>{
 if(!world.length&&!terrainHeights.size){closeClearMapModal();return}
 snapshot();world.length=0;terrainHeights.clear();worldMaxLevel=0;cursorDirty=true;
 commit();closeClearMapModal();toast('マップを全消去しました（元に戻すで復元できます）');
});
let mapSizeRemovalApproved=false;
function closeMapSizeModal(){
 $('mapSizeModal').classList.remove('open');
 $('openMapSize').focus();
}
$('openMapSize').addEventListener('click',()=>{
 $('mapSizeWidth').value=MAP_W;$('mapSizeHeight').value=MAP_H;
 $('mapSizeWarning').textContent='';mapSizeRemovalApproved=false;
 $('confirmMapSize').textContent='変更する';
 $('mapSizeModal').classList.add('open');
 $('mapSizeWidth').focus();
});
for(const id of ['mapSizeWidth','mapSizeHeight'])$(id).addEventListener('input',()=>{
 mapSizeRemovalApproved=false;$('mapSizeWarning').textContent='';$('confirmMapSize').textContent='変更する';
});
$('cancelMapSize').addEventListener('click',closeMapSizeModal);
$('mapSizeModal').addEventListener('click',e=>{if(e.target===$('mapSizeModal'))closeMapSizeModal()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('mapSizeModal').classList.contains('open')){e.preventDefault();closeMapSizeModal()}});
$('confirmMapSize').addEventListener('click',()=>{
 const width=Number($('mapSizeWidth').value),height=Number($('mapSizeHeight').value);
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<MIN_MAP||width>MAX_MAP||height<MIN_MAP||height>MAX_MAP){
  $('mapSizeWarning').textContent='縦横は12〜128の整数で指定してください';return;
 }
 const removed=world.filter(p=>p.x>=width||p.z>=height).length;
 if(removed&&!mapSizeRemovalApproved){
  mapSizeRemovalApproved=true;
  $('mapSizeWarning').textContent='範囲外の建材 '+removed+' 個が消去されます。続行する場合はもう一度押してください。';
  $('confirmMapSize').textContent='縮小を確定';return;
 }
 $('mapWidth').value=width;$('mapHeight').value=height;
 setMapSize(true);closeMapSizeModal();
});
$('applyMapSize').addEventListener('click',()=>setMapSize());
$('quickPlace').addEventListener('click',()=>{mode='place';updateSelected()});
$('quickErase').addEventListener('click',()=>{mode='erase';updateSelected()});
$('quickRotate').addEventListener('click',()=>{mode='rotate';updateSelected()});
// Touch gestures: place/erase/pick only on a completed, stationary single-finger tap.
// Any dragging, multitouch, cancellation, or long press suppresses block changes.
const touchPositions=new Map();
let tapCandidate=null,multiGesture=null;
const TAP_SLOP=9,MAX_TAP_MS=600;
function updateHover(e){
 const next=cursorAt(e.clientX,e.clientY);
 if(!hover||next.x!==hover.x||next.z!==hover.z){hover=next;cursorDirty=true;updateStats()}
}
function panGesture(dx,dy){
 const scale=9/zoom/Math.max(1,canvas.clientHeight)*2;
 const a=dx*scale,c=-dy*scale/Math.sin(.86);
 // Screen-space drag: subtract the screen-right and screen-down ground vectors
 // from the camera center, for ALL rotation angles. dx/dy never change meaning.
 panX-=a*Math.cos(yaw)-c*Math.sin(yaw);
 panZ+=a*Math.sin(yaw)+c*Math.cos(yaw);
 cursorDirty=true;
}
function gestureSnapshot(){
 if(touchPositions.size<2)return null;
 const points=[...touchPositions.values()].slice(0,2);
 const a=points[0],b=points[1];
 return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,dist:Math.hypot(b.x-a.x,b.y-a.y),angle:Math.atan2(b.y-a.y,b.x-a.x)};
}
function angleDifference(now,before){
 return Math.atan2(Math.sin(now-before),Math.cos(now-before));
}
canvas.addEventListener('pointerdown',e=>{
 e.preventDefault();
 canvas.setPointerCapture(e.pointerId);
 touchPositions.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(touchPositions.size===1){
  tapCandidate={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,start:performance.now(),moved:false,cancelled:false};
  multiGesture=null;
  updateHover(e);
 }else{
  // If another finger joins, never allow the original tap to place anything.
  if(tapCandidate)tapCandidate.cancelled=true;
  multiGesture=gestureSnapshot();
 }
});
canvas.addEventListener('pointermove',e=>{
 if(!touchPositions.has(e.pointerId))return;
 e.preventDefault();
 touchPositions.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(touchPositions.size>=2){
  if(tapCandidate)tapCandidate.cancelled=true;
  const now=gestureSnapshot();
  if(now&&multiGesture){
   if(poiWalkActive&&poiThirdPerson){
    if(multiGesture.dist>1)poiCameraDistance=Math.max(2.5,Math.min(15,poiCameraDistance*multiGesture.dist/Math.max(1,now.dist)));
    poiCameraYaw-=angleDifference(now.angle,multiGesture.angle);
    poiCameraPitch=Math.max(.12,Math.min(1.15,poiCameraPitch+(now.y-multiGesture.y)*.004));
    cursorDirty=true;
   }else{
    if(multiGesture.dist>1)zoom=Math.max(.025,Math.min(4,zoom*now.dist/multiGesture.dist));
    yaw+=angleDifference(now.angle,multiGesture.angle);
    panGesture(now.x-multiGesture.x,now.y-multiGesture.y);
    cursorDirty=true;
   }
  }
  multiGesture=now;
  return;
 }
 const t=tapCandidate;
 if(!t||t.id!==e.pointerId)return;
 if(Math.hypot(e.clientX-t.x,e.clientY-t.y)>TAP_SLOP)t.moved=true;
 if(t.moved){
  if(poiWalkActive&&poiThirdPerson){
   poiCameraYaw-=(e.clientX-t.lastX)*.008;
   poiCameraPitch=Math.max(.12,Math.min(1.15,poiCameraPitch+(e.clientY-t.lastY)*.006));
   cursorDirty=true;
  }else panGesture(e.clientX-t.lastX,e.clientY-t.lastY);
 }else if(!(poiWalkActive&&poiThirdPerson)){
  updateHover(e);
 }
 t.lastX=e.clientX;t.lastY=e.clientY;
});
canvas.addEventListener('pointerup',e=>{
 const t=tapCandidate;
 const isSingle=touchPositions.size===1&&touchPositions.has(e.pointerId);
 touchPositions.delete(e.pointerId);
 if(isSingle&&t&&t.id===e.pointerId&&!t.cancelled&&!t.moved&&
    Math.hypot(e.clientX-t.x,e.clientY-t.y)<=TAP_SLOP&&
    performance.now()-t.start<=MAX_TAP_MS&&(pineCheckMode||mode!=='move')&&!(poiWalkActive&&poiThirdPerson)){
  const pos=cursorAt(e.clientX,e.clientY);
  if(validPos(pos.x,pos.z)){if(pineCheckMode)pineToggleCheck(pos.x,pos.z);else changeCell(pos.x,pos.z)}
 }
 if(t?.id===e.pointerId)tapCandidate=null;
 if(touchPositions.size<2)multiGesture=null;
});
for(const ev of ['pointercancel','lostpointercapture'])canvas.addEventListener(ev,e=>{
 touchPositions.delete(e.pointerId);
 if(tapCandidate)tapCandidate.cancelled=true;
 if(tapCandidate?.id===e.pointerId)tapCandidate=null;
 multiGesture=touchPositions.size>=2?gestureSnapshot():null;
});
canvas.addEventListener('wheel',e=>{e.preventDefault();if(poiWalkActive&&poiThirdPerson){poiCameraDistance=Math.max(2.5,Math.min(15,poiCameraDistance*(e.deltaY>0?1.12:.89)));cursorDirty=true}else zoom=Math.max(.025,Math.min(4,zoom*(e.deltaY>0?.92:1.08)))},{passive:false});
$('rotatePlacement').addEventListener('click',()=>{rotation=(rotation+1)%4;updateStats();toast('次に置く部材の向き：'+rotation*90+'°')});
$('fitMap').addEventListener('click',showEntireMap);$('turn').addEventListener('click',()=>{yaw+=Math.PI/2;cursorDirty=true});$('zoomIn').addEventListener('click',()=>zoom=Math.min(4,zoom*1.2));$('zoomOut').addEventListener('click',()=>zoom=Math.max(.025,zoom/1.2));$('resetCamera').addEventListener('click',()=>{yaw=Math.PI/4;showEntireMap()});$('rotatePart').addEventListener('click',()=>{rotation=(rotation+1)%4;updateStats()});$('level').addEventListener('change',e=>{level=Math.max(0,Math.min(MAX_LEVEL,Number(e.target.value)||0));dirty=true;cursorDirty=true;updateStats()});
$('hideUpper').addEventListener('change',e=>{hideUpper=e.target.checked;dirty=true;cursorDirty=true;$('poiRoofToggle').textContent=hideUpper?'屋根を表示':'屋根を隠す';toast(hideUpper?'上階を隠して編集中':'全階層を表示中')});
$('eyedrop').addEventListener('click',()=>{mode='pick';updateSelected();toast('配置済み部材をタップすると選べます')});for(const b of document.querySelectorAll('[data-mode]'))b.addEventListener('click',()=>{mode=b.dataset.mode;updateSelected()});
$('undo').addEventListener('click',()=>{if(!undoStack.length)return;redoStack.push(JSON.stringify(data()));restore(undoStack.pop())});$('redo').addEventListener('click',()=>{if(!redoStack.length)return;undoStack.push(JSON.stringify(data()));restore(redoStack.pop())});
$('villageDemo').addEventListener('click',makeVillageDemo);
$('organicTownDemo').addEventListener('click',makeOrganicTownDemo);
$('showcaseTownDemo').addEventListener('click',makeShowcaseTownDemo);
for(const action of ['terrainUp','terrainDown','terrainFlat'])$(action).addEventListener('click',()=>{mode=action;updateSelected();toast('地形編集：マスをタップ')});
$('forestTransitionDemo').addEventListener('click',makeForestTransitionDemo);
$('elevationDemo').addEventListener('click',makeElevationDemo);
$('terraceFarmDemo').addEventListener('click',makeTerraceFarmDemo);
$('compactTerrainDemo').addEventListener('click',makeCompactTerrainDemo);
$('residentialRoofDemo').addEventListener('click',makeResidentialRoofDemo);
$('livedInTownDemo').addEventListener('click',makeLivedInTownDemo);
$('oldTownRiverDemo').addEventListener('click',()=>makeOldTownRiverDemo(false));
$('oldTownV2Demo').addEventListener('click',makeOldTownV2Demo);
$('cityNature64Demo').addEventListener('click',makeCityNature64Demo);
$('pineHarborDemo').addEventListener('click',makePineHarborDemo);
$('worldAudit').addEventListener('click',showWorldAudit);
$('house3Demo').addEventListener('click',()=>makeHighBuilding('house'));
$('tower7Demo').addEventListener('click',()=>makeHighBuilding('tower'));
$('clear').addEventListener('click',()=>{if(!confirm('配置したすべての部材を消去しますか？'))return;snapshot();world=[];commit();toast('マップを空にしました')});$('demo').addEventListener('click',makeDemo);

$('pineCheckMode').addEventListener('click',()=>pineSetCheckMode(!pineCheckMode));
document.querySelectorAll('[data-check-color]').forEach(button=>button.addEventListener('click',()=>{
 pineCheckColor=button.dataset.checkColor;pineCheckRefresh();
}));
$('pineCheckClear').addEventListener('click',()=>{
 if(!pineCheckMarks.length||!confirm('チェックをすべて消去しますか？'))return;
 snapshot();pineCheckMarks=[];pineCheckNodes.clear();$('pineCheckOverlay').replaceChildren();
 commit();pineCheckRefresh();
});
pineCheckRefresh();
$('topDownView').addEventListener('click',toggleTopDown);
$('registerPOI').addEventListener('click',pineRegisterCurrentPOI);
$('poiWalkToggle').addEventListener('click',()=>poiWalkSet(!poiWalkActive));
$('enterGameWorld').addEventListener('click',()=>{pineSetCheckMode(false);pineGameEnter()});
$('returnEditorWorld').addEventListener('click',pineGameExit);
window.addEventListener('pagehide',()=>pineGameSave(true));
document.addEventListener('visibilitychange',()=>{if(document.hidden)pineGameSave(true)});
$('poiThirdView').addEventListener('click',togglePoiThirdPerson);
$('poiAudioToggle').addEventListener('click',poiToggleAudio);
$('poiSoundSettingsToggle').addEventListener('click',()=>{
 const panel=$('poiSoundPanel');panel.hidden=!panel.hidden;
 $('poiSoundSettingsToggle').setAttribute('aria-expanded',String(!panel.hidden));
});
for(const [kind,id] of [['master','poiVolumeMaster'],['bgm','poiVolumeBgm'],['se','poiVolumeSe']]){
 $(id).addEventListener('input',e=>poiAudioSetVolume(kind,e.target.value));
}
poiAudioSyncUI();

$('poiWalkAction').addEventListener('click',poiWalkAction);
// Prevent long-press selection/copy menus while interacting with game controls.
// Keep editor inputs and text fields selectable.
for(const eventName of ['contextmenu','selectstart','dragstart']){
 document.addEventListener(eventName,e=>{
  const target=e.target;
  if(!(target instanceof Element))return;
  const gameControl=target.closest('#poiWalkPad,#poiGameTools,#returnEditorWorld,#poiCombatHud');
  if(pineGameActive||gameControl)e.preventDefault();
 },{capture:true});
}

$('poiRoofToggle').addEventListener('click',()=>{
 if(poiWalkActive){toast('歩行中の屋根は入退店に応じて自動切替します');return}
 hideUpper=!hideUpper;$('hideUpper').checked=hideUpper;dirty=true;cursorDirty=true;
 $('poiRoofToggle').textContent=hideUpper?'屋根を表示':'屋根を隠す';
});
let poiWalkRepeat=null;
function poiStopRepeat(){if(poiWalkRepeat!==null){clearInterval(poiWalkRepeat);poiWalkRepeat=null}}
for(const button of document.querySelectorAll('[data-poi-dir]')){
 const dirs={n:[0,-1],s:[0,1],w:[-1,0],e:[1,0]};
 const step=()=>poiWalkStep(...(poiWalkActive&&poiThirdPerson?poiCameraRelativeStep(button.dataset.poiDir):dirs[button.dataset.poiDir]));
 button.addEventListener('pointerdown',e=>{e.preventDefault();poiStopRepeat();step();poiWalkRepeat=setInterval(step,35);button.setPointerCapture(e.pointerId)});
 for(const name of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(name,poiStopRepeat);
}
document.addEventListener('keydown',e=>{
 if(!poiWalkActive||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
 const k=e.key.toLowerCase();
 if(k===' '||k==='enter'){e.preventDefault();poiWalkAction();return}
 const d={arrowup:[0,-1],w:[0,-1],arrowdown:[0,1],s:[0,1],arrowleft:[-1,0],a:[-1,0],arrowright:[1,0],d:[1,0]}[k];
 if(d){e.preventDefault();const cameraKey={arrowup:'n',w:'n',arrowdown:'s',s:'s',arrowleft:'w',a:'w',arrowright:'e',d:'e'}[k];poiWalkStep(...(poiThirdPerson?poiCameraRelativeStep(cameraKey):d))}
});
$('poiNameCancel').addEventListener('click',pineClosePOINameModal);
$('poiNameForm').addEventListener('submit',e=>{e.preventDefault();pineConfirmPOIName()});
$('poiNameModal').addEventListener('click',e=>{if(e.target===$('poiNameModal'))pineClosePOINameModal()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('poiNameModal').classList.contains('open')){e.preventDefault();pineClosePOINameModal()}});
$('openJson').addEventListener('click',()=>{$('jsonModal').classList.add('open');displayJSON()});$('closeJson').addEventListener('click',()=>$('jsonModal').classList.remove('open'));
$('exportJson').addEventListener('click',displayJSON);$('copyJson').addEventListener('click',async()=>{const str=$('jsonText').value;try{await navigator.clipboard.writeText(str);toast('JSONをコピーした')}catch(e){$('jsonText').select();document.execCommand('copy');toast('JSONをコピーしました')}});
$('downloadJson').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(data(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='my-forest-world.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)});
$('pickJsonFile').addEventListener('click',()=>$('jsonFile').click());
$('jsonFile').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>6*1024*1024)throw Error('ファイルが大きすぎます（上限6MB）');const contents=await file.text();JSON.parse(contents);$('jsonText').value=contents;toast('JSONファイルを読み込みました。「JSONを読み込む」で配置に反映します')}catch(err){toast('ファイルの読み込み失敗: '+err.message)}finally{e.target.value=''}});
$('importJson').addEventListener('click',()=>{try{const o=JSON.parse($('jsonText').value);const before=JSON.stringify(data());loadData(o);undoStack.push(before);if(undoStack.length>45)undoStack.shift();redoStack.length=0;commit();$('jsonModal').classList.remove('open');toast('ワールドを読み込んだ')}catch(e){toast('読み込み失敗：'+e.message)}});
$('showPalette').addEventListener('click',()=>{pineSetCheckMode(false);$('palette').classList.toggle('mobileOpen');$('inspector').classList.remove('mobileOpen')});
try{const saved=localStorage.getItem(SAVE_KEY);if(saved){loadData(JSON.parse(saved));if(pineApplyGuildMarkedEdits())commit()}else makeDemo()}catch(e){MAP_W=16;MAP_H=16;world=[];models=[];prefabs=[];makeDemo()}
customPOIs=pineReadSavedPOIs();
pineBuildPOICategories();
const poiEntrance=world.find(o=>o.type==='pineSuperDoor');
if(poiEntrance)poiWalkReset(poiEntrance.x,Math.min(MAP_H-2,poiEntrance.z+2));
$('poiRoofToggle').textContent=hideUpper?'屋根を表示':'屋根を隠す';
refreshPalette();updateStats();updateSelected();showEntireMap();render();
if(location.search.includes('test=1'))window.__editorTest={state:()=>({world:world.map(p=>({...p})),models:models.map(m=>({...m})),prefabs:prefabs.map(p=>({...p})),selected,mode,rotation,level,glLink:gl.getProgramParameter(program,gl.LINK_STATUS)}),place:(x,z)=>changeCell(x,z),data};
})();
