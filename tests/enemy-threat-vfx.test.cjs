const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function extract(a,b){
 const start=html.indexOf(a),end=html.indexOf(b,start+1);
 assert(start>=0&&end>start,a);return html.slice(start,end);
}
test('a normal gameplay render with a pending threat submits the scene and monster, but no warning tile geometry',()=>{
 const calls=[];
 const s=vm.createContext({
  window:{pineStartup:{failed:false,loading:false}},performance:{now:()=>350},poiScreenNoteFrozen:()=>false,
  poiWalkActive:true,pineGameActive:false,pineAIActive:false,document:{hidden:false},poiWalkX:5,poiWalkZ:5,poiWalkLevel:0,facilitySite:{id:'base'},facilityRoofMeshes:[1],level:0,hideUpper:false,
  facilityRenderScene:()=>({mesh:{ground:'ground'},signs:[]}),sceneMesh:null,dirty:false,cursorDirty:false,
  parameters:()=>({vp:[]}),poiTownSceneLight:()=>[1,1,1],gl:{uniform3f(){},clear(){}},loc:{},poiPlayerDeath:null,
  signOverlays:[],poiEnemyThreatTiles:()=>[{x:5,z:5,y:0,start:100,hit:620}],
  poiDrawEnemyThreatTiles:()=>calls.push('target-tile overlay'),
  draw:what=>calls.push(what),poiMonsterRender:()=>calls.push('monster'),
 });
 for(const name of ['requestAnimationFrame','poiTownClockFrame','poiWalkFrame','poiMessageUpdate','poiOcclusionBegin',
  'poiDrawSceneOcclusion','facilityDrawRoofs','poiDrawGameRoofs','poiOcclusionEnd','poiDrawEditorGhostRoof',
  'drawSignOverlays','pineDrawEditCursor','poiEconomyDraw','poiInventoryDraw','poiDrawWalkAvatar','poiPlayerWeaponDraw',
  'poiRenderEnemyHealth','poiRenderDamageLabels','poiMineUnlockDraw','poiTownDialogueDraw','pineDrawChecks',
  'facilityDrawEntranceGuides','poiScreenNoteCaptureFrame'])s[name]=()=>{};
 vm.runInContext(extract('function poiDungeonPointIn(','function poiOtherworldIn(')+
  extract('// BEGIN NORTH AXE FOOTPRINT','// END NORTH AXE FOOTPRINT')+
  extract('function render(){','let savedMapRestoreFailed=')+'\nrender();',s);
 assert.deepEqual(calls,['ground','monster']);
 assert.doesNotMatch(html,/function poiEnemyThreatDrawAt\(|const POI_ENEMY_THREAT_TINT=/);
});
test('telemetry keeps the committed target through windup; the tell lives on the monster and ends on impact',()=>{
 const obj={type:'monsterSkeleton',y:0},state={x:4,z:5,hp:45,nextAttack:0},hits=[];
 const s=vm.createContext({poiWalkActive:true,poiWalkLevel:0,poiWalkX:5,poiWalkZ:5,pineAIActive:false,
  facilitySite:{id:'base'},poiMonsterStates:new Map([[obj,state]]),poiPlayerDying:()=>false,poiAudioAllowed:()=>true,
  poiMonsterMeshDirty:false,poiMobHitPlayer:(_o,t)=>{hits.push(t);return false}});
 vm.runInContext(extract('// BEGIN SLIME ATTACK','// END SLIME ATTACK'),s);
 assert(s.poiEnemyBeginPlayer(obj,state,100));
 const read=now=>Array.from(s.poiEnemyThreatTiles(now),t=>[t.x,t.z,t.y,t.start,t.hit,t.type]);
 const target=[[5,5,0,100,620,'monsterSkeleton']];
 assert.deepEqual(read(100),target);
 const draw=s.poiEnemyVisualAttack(obj.type,state,330),release=s.poiEnemyVisualAttack(obj.type,state,618);
 assert.equal(draw.phase,'windup');assert(draw.tell>.55);
 assert.equal(release.phase,'release');assert(release.tell<draw.tell);
 s.poiWalkX=4;s.poiWalkZ=6; // normal sidestep does not retarget
 assert.deepEqual(read(619),target);assert.deepEqual(hits,[]);
 s.poiEnemyResolvePlayer(620);
 assert.deepEqual(read(620),[]);assert.deepEqual(hits,[]);
 const impact=s.poiEnemyVisualAttack(obj.type,state,620);
 assert.equal(impact.phase,'impact');assert((impact.tell||0)<draw.tell);
 const model=extract('function poiMonsterRender(now','// BEGIN PLAYER DEFEAT');
 assert.match(model,/attack\?\.tell/);assert.match(model,/part\.c\[i\].*\+tell/);
});
