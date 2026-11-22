const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(process.env.HTML||path.join(__dirname,'..','world-editor.html'),'utf8');
function fixture(){
 const fade={style:{},dataset:{},hidden:true},calls=[];
 const g={poiWalkActive:true,poiPlayerHP:0,poiWalkX:90,poiWalkZ:50,poiWalkViewX:90,poiWalkViewZ:50,poiWalkLevel:1,poiWalkFacing:0,level:1,
  poiSpawnX:40,poiSpawnZ:42,poiAttackReady:0,POI_PLAYER_MAX_HP:100,facilitySite:{id:'base'},poiCreekPlayerHeight:()=>0,
  poiWalkCanStep:()=>true,poiTownDialogueClose(){},poiShopClose(){},poiDamageLabels:[],poiCombatHud(){},poiMessagePush:(...v)=>{calls.push(['msg',...v]);return true},
  workshopResumeWrite:()=>calls.push(['resume']),poiMonsterBreak:(...v)=>calls.push(['burst',...v]),poiWalkReset:(...v)=>calls.push(['respawn',...v]),
  $:id=>id==='poiDeathFade'?fade:{},poiWalkAttackPosePending:true,poiWalkActionStarted:0,poiAudioAllowed:()=>true};
 const s=html.match(/\/\/ BEGIN PLAYER DEFEAT\n([\s\S]*?)\/\/ END PLAYER DEFEAT/);assert.ok(s,'defeat transition exists');
 const c=vm.createContext(g);vm.runInContext(s[1],c);return {c,calls,fade};
}
test('one knockout, exact notice, blackout before relocation and no saved item or map mutations',()=>{
 const {c,calls,fade}=fixture();
 assert.equal(c.poiPlayerDeathBegin(100),true);assert.equal(c.poiPlayerDeathBegin(105),false);
 assert.deepEqual(calls.map(a=>a[0]),['burst','msg']);assert.equal(calls[1][1],'死んでしまった。');
 assert.equal(c.poiPlayerDeathFrame(800),true);assert.equal(fade.style.opacity,'0');
 assert.equal(c.poiPlayerDeathFrame(1550),true);assert.ok(+fade.style.opacity>0);
 c.poiPlayerDeathFrame(1750);assert.equal(fade.style.opacity,'1');
 assert.equal(c.poiPlayerHP,100);assert.equal(c.level,0);
 assert.deepEqual(calls[2],['respawn',40,42]);assert.deepEqual(calls[3],['resume']);
 c.poiPlayerDeathFrame(2000);assert.equal(c.poiPlayerDeathSnapshot().phase,'in');
 assert.equal(c.poiPlayerDeathFrame(2320),false);assert.equal(fade.hidden,true);
 assert.equal(c.poiPlayerDeathSnapshot(),null);assert.equal(calls.filter(a=>a[0]==='respawn').length,1);
});
test('returning from background always blackens before recovering, even after a long delay',()=>{
 const {c,calls,fade}=fixture();let allowed=true;c.poiAudioAllowed=()=>allowed;
 c.poiPlayerDeathBegin(100);allowed=false;
 assert.equal(c.poiPlayerDeathFrame(5000),true);assert.equal(c.poiPlayerHP,0);
 allowed=true;c.poiPlayerDeathFrame(5001);
 assert.equal(fade.style.opacity,'1');assert.equal(fade.dataset.stage,'black');assert.equal(calls.filter(a=>a[0]==='respawn').length,1);
 c.poiPlayerDeathFrame(5050);assert.equal(fade.dataset.stage,'black');
 c.poiPlayerDeathFrame(5200);assert.equal(fade.dataset.stage,'in');
});
test('edited blocked spawn chooses the next valid protected city tile',()=>{
 const {c}=fixture();
 c.POI_SAFE_TOWN=[];c.poiWildZone=(_boxes,x,z)=>x===40&&z===52;
 c.poiWalkCanStep=(x,z)=>x===40&&(z===43||z===52);
 const p=c.poiPlayerDeathSpawn();
 assert.deepEqual([p.x,p.z],[40,52]);
 c.poiWalkCanStep=()=>false;c.poiWalkSpawnNearCenter=()=>({x:20,z:20});
 const backup=c.poiPlayerDeathSpawn();
 assert.deepEqual([backup.x,backup.z],[20,20]);
});
