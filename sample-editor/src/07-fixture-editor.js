// v25: fixture orientation controls. Edits only local yaw, never global scene geometry.
const orientFixtures=scene.objects.filter(o=>o.poiId==='convenience-study'&&
 ['food-daily-shelf','drink-shelf','magazine-shelf','fridge','hot-case'].includes(o.type));
let fixtureEditMode=false,fixtureEditIndex=0;
const fixtureRows=document.getElementById('fixtureControls');
const buildingRows=document.querySelectorAll('.buildingControls');
const fixtureInfo=document.getElementById('fixtureInfo');
const fixtureModeToggle=document.getElementById('fixtureModeToggle');
function selectedFixture(){return orientFixtures[fixtureEditIndex]}
function refreshFixtureEditor(){
 const o=selectedFixture();
 fixtureInfo.textContent=(fixtureEditIndex+1)+' / '+orientFixtures.length+
  ' '+o.id+'  向き:'+(((Math.round((o.yaw||0)/(Math.PI/2))%4)+4)%4*90)+'°';
}
function setFixtureEditMode(enabled){
 fixtureEditMode=enabled;
 for(const row of buildingRows)row.hidden=enabled;
 fixtureRows.hidden=!enabled;
 fixtureModeToggle.textContent=enabled?'建物編集に戻る':'什器の向きを編集';
 if(enabled)refreshFixtureEditor();else refreshEditor();
 editNotice.textContent=enabled?'什器を選び、左右90°ずつ回転できます':'建物を選択';
}
function fixtureWorldBounds(o,yaw){
 const c=Math.abs(Math.cos(yaw)),s=Math.abs(Math.sin(yaw));
 return {w:o.width*c+o.depth*s,d:o.width*s+o.depth*c};
}
function rotateFixture(delta){
 const o=selectedFixture();
 const newYaw=(((Math.round((o.yaw||0)/(Math.PI/2))+delta)%4)+4)%4*Math.PI/2;
 const bounds=fixtureWorldBounds(o,newYaw),padding=.23;
 const halfStore=convenience.width/2,front=convenience.z-convenience.depth/2,back=convenience.z+convenience.depth/2;
 if(Math.abs(o.x)+bounds.w/2+padding>halfStore||o.z-bounds.d/2-padding<front||
    o.z+bounds.d/2+padding>back){
  editNotice.textContent='壁・入口に近すぎるため回転できません';return;
 }
 const overlaps=scene.objects.some(other=>{
  if(other===o||other.poiId!=='convenience-study'||
     ['register','floor-mat'].includes(other.type))return false;
  const otherBounds=fixtureWorldBounds(other,other.yaw||0);
  return Math.abs(o.x-other.x)<(bounds.w+otherBounds.w)/2+.10&&
   Math.abs(o.z-other.z)<(bounds.d+otherBounds.d)/2+.10;
 });
 if(overlaps){editNotice.textContent='他の設備と重なるため回転できません';return}
 // Avoid placing a fixture over the player or NPC positions.
 const changed={...o,yaw:newYaw};
 if(fixtureAtPoint(changed,player.x,player.z,.25)||
    npcs.some(n=>fixtureAtPoint(changed,n.x,n.z,.24))){
  editNotice.textContent='人物と重なるため回転できません';return;
 }
 o.yaw=newYaw;rebuildStoreFixture(o);
 editNotice.textContent=saveFixtureAngles()?'向きを保存しました':'向きの保存に失敗';
 refreshFixtureEditor();
}
fixtureModeToggle.addEventListener('click',()=>setFixtureEditMode(!fixtureEditMode));
fixtureRows.addEventListener('click',e=>{
 const b=e.target.closest('button[data-fixture]');
 if(!b)return;
 const action=b.dataset.fixture;
 if(action==='prev'||action==='next'){
  fixtureEditIndex=(fixtureEditIndex+(action==='prev'?-1:1)+orientFixtures.length)%orientFixtures.length;
  editNotice.textContent='什器を選択しました';refreshFixtureEditor();
 }else if(action==='left'||action==='right')rotateFixture(action==='left'?-1:1);
});
refreshFixtureEditor();
