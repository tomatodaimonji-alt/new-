// v14 scene editor: inspect and edit one building instance at a time.
// The rest of the town and object catalog remain untouched.
const editToggle=document.getElementById('editToggle');
const editPanel=document.getElementById('editPanel');
const editInfo=document.getElementById('editInfo');
const editNotice=document.getElementById('editNotice');
let editorOpen=false,selectedIndex=0;
const editableShops=scene.buildings.filter(b=>b.type==='shop');
function selectedShop(){return editableShops[selectedIndex]}
function refreshEditor(){
 const b=selectedShop();
 scene.selectedBuildingId=b.id;
 editInfo.textContent=(selectedIndex+1)+' / '+editableShops.length+'  '+b.id+
  '  X:'+b.x.toFixed(1)+'  Z:'+b.z.toFixed(1)+'  H:'+b.height.toFixed(1);
}
function editShop(action){
 const b=selectedShop();
 if(action==='prev'||action==='next'){
  selectedIndex=(selectedIndex+(action==='prev'?-1:1)+editableShops.length)%editableShops.length;
  editNotice.textContent='建物を選択';
  refreshEditor();return;
 }
 if(action==='reset'){
  const reset=defaultShop(b.side,b.k);
  for(const name of ['x','z','height','width','depth'])b[name]=reset[name];
 }else{
  const commands={xMinus:['x',-.5],xPlus:['x',.5],zMinus:['z',-.5],
   zPlus:['z',.5],hMinus:['height',-.5],hPlus:['height',.5]};
  const operation=commands[action];if(!operation)return;
  const [key,delta]=operation;
  const next=+(b[key]+delta).toFixed(2);
  if(key==='height'&&next<3){editNotice.textContent='高さの下限';return}
  if(key==='x'&&Math.abs(next)<5.4+b.depth*.5){editNotice.textContent='歩行者通路のため移動不可';return}
  const area=scene.pois[0].bounds;
  if((key==='x'&&(next<area.minX||next>area.maxX))||
     (key==='z'&&(next<area.minZ||next>area.maxZ))){
   editNotice.textContent='区画の外には移動できません';return;
  }
  // Do not overlap other building footprints when moving a shop.
  const candidate={...b,[key]:next};
  if(editableShops.some(other=>other!==b&&
   Math.abs(other.x-candidate.x)<(other.depth+candidate.depth)*.5+.10&&
   Math.abs(other.z-candidate.z)<(other.width+candidate.width)*.5+.10)){
   editNotice.textContent='他の建物と重なります';return;
  }
  b[key]=next;
 }
 renderStreetShop(b);
 editNotice.textContent=saveSceneEdits()?'端末に保存しました':'保存できませんでした';
 refreshEditor();
}
editToggle.addEventListener('click',()=>{
 editorOpen=!editorOpen;
 editPanel.hidden=!editorOpen;
 editToggle.textContent=editorOpen?'閉じる':'編集';
 if(editorOpen){resetStick();refreshEditor()}
});
editPanel.addEventListener('click',e=>{
 const button=e.target.closest('button[data-edit]');
 if(button)editShop(button.dataset.edit);
});
refreshEditor();
