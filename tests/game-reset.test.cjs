const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const h=fs.readFileSync(process.env.HTML||path.join(__dirname,'..','world-editor.html'),'utf8');
const kit='world-workshop-hotbar-v1',clock='world-workshop-town-clock-v1',resume='world-workshop-resume-v1',backup='world-workshop-game-reset-backup-v1';
const base=JSON.stringify({version:1,route:'facility',id:'base',play:true,position:{x:81,z:32,y:0,facing:1}});
function fixture(memory={ [kit]:'inventory towerFind claims', [clock]:'lived time', [resume]:base, editor:'keep', audio:'keep', adventure:'keep'}){
 const map=new Map(Object.entries(memory)),ops=[];let fail=()=>false;
 const edit=(op,k,v)=>{ops.push([op,k,v]);if(fail(op,k,v))throw Error('disk');if(op==='set')map.set(k,v);else map.delete(k)};
 const storage={getItem:key=>map.get(key)??null,setItem:(k,v)=>edit('set',k,v),removeItem:k=>edit('remove',k)};
 const m=h.match(/\/\/ BEGIN GAME WORLD RESET\n([\s\S]*?)\/\/ END GAME WORLD RESET/);assert.ok(m,'reset and verified backup transaction are present');
 const c=vm.createContext({POI_HOTBAR_KEY:kit,POI_TOWN_CLOCK_KEY:clock,WORKSHOP_RESUME_KEY:resume,localStorage:storage,
  workshopResumeDecode:raw=>JSON.parse(raw||'null')});
 vm.runInContext(m[1],c);return {c,map,ops,storage,fail:f=>fail=f};
}
test('game reset checkpoints exact raw bytes before touching only the active game keys',()=>{
 const f=fixture();assert.equal(f.c.poiGameResetStorage(f.storage).ok,true);
 assert.deepEqual(f.ops.slice(0,5).map(([op,k])=>[op,k]),[['set','world-workshop-game-reset-first-backup-v1'],['set',backup],['remove',kit],['remove',clock],['remove',resume]]);
 assert.equal(f.map.get('editor'),'keep');assert.equal(f.map.get('audio'),'keep');assert.equal(f.map.get('adventure'),'keep');
 const b=JSON.parse(f.map.get(backup));assert.equal(b.phase,'complete');assert.equal(b.before[kit],'inventory towerFind claims');
 assert.equal(b.before[clock],'lived time');assert.equal(b.before[resume],base);
});
test('failed archive prevents deletion; partial failures and interrupted reset restore original bytes',()=>{
 const f=fixture();f.fail((op,k)=>op==='set'&&k===backup);
 assert.equal(f.c.poiGameResetStorage(f.storage).ok,false);assert.equal(f.ops.some(op=>op[0]==='remove'),false);
 f.fail((op,k)=>op==='remove'&&k===clock);
 assert.equal(f.c.poiGameResetStorage(f.storage).ok,false);assert.equal(f.map.get(kit),'inventory towerFind claims');
 assert.equal(f.map.get(clock),'lived time');assert.equal(f.map.get(resume),base);
 f.fail(()=>false);const crashed={phase:'prepared',version:1,before:{[kit]:'inventory', [clock]:'clock', [resume]:base}};
 const g=fixture({[backup]:JSON.stringify(crashed),[clock]:'clock',editor:'keep'});
 assert.equal(g.c.poiGameResetRecover(g.storage),true);assert.equal(g.map.get(kit),'inventory');assert.equal(g.map.get(resume),base);
});
test('resume belonging to a different route and corrupted untrusted backups are never overwritten',()=>{
 const other=JSON.stringify({version:1,route:'facility',id:'guildsaved'});
 const f=fixture({[kit]:'kit',[clock]:'time',[resume]:other});
 assert.equal(f.c.poiGameResetStorage(f.storage).ok,true);assert.equal(f.map.get(resume),other);
 const g=fixture({[backup]:'forged',editor:'keep',[kit]:'kit'});
 assert.equal(g.c.poiGameResetStorage(g.storage).ok,false);assert.equal(g.ops.length,0);
});
test('only a walking base routes to a clean same-path URL and the departed page cannot save over the reset',()=>{
 const f=fixture(),urls=[];
 Object.assign(f.c,{facilitySite:{id:'guildsaved'},poiWalkActive:true,pineAIActive:false,URL,
  location:{href:'https://example.com/world-editor.html?resume=1&test=1#old',replace:u=>urls.push(u)},
  workshopResumeLeaving:false,facilityLeaving:false});
 assert.equal(f.c.poiGameReset().reason,'unavailable');assert.equal(f.ops.length,0);
 f.c.facilitySite.id='base';assert.equal(f.c.poiGameReset().ok,true);
 assert.deepEqual(urls,['https://example.com/world-editor.html?facility=base&facility-play=1&reset-camera=1&test=1']);
 assert.equal(f.c.workshopResumeLeaving,true);assert.equal(f.c.facilityLeaving,true);
 for(const fn of ['poiHotbarSave','poiTownClockSave','workshopResumeWrite']){
  const i=h.indexOf('function '+fn+'(');
  assert.match(h.slice(i,i+300),/poiGameResetDeparture/);
 }
});
test('the reset control opens a scoped confirmation, with cancel focused instead of the destructive action',()=>{
 assert.match(h,/<dialog id="poiResetGameDialog"[^>]*aria-describedby="poiResetGameDescription"/);
 assert.match(h,/<button type="button" id="poiResetGameCancel" autofocus>キャンセル/);
 assert.match(h,/<button type="button" id="poiResetGameConfirm">初期化する/);
 assert.match(h,/if\(facilitySite\?\.id==='base'&&poiWalkActive\)\{poiGameResetOpen\(\);return\}/);
 assert.match(h,/if\(!poiGameResetDialogOpen\(\)\|\|confirm\.disabled\)return;/);
});
test('the first verified backup survives repeated resets and unavailable archive prevents mutation',()=>{
 const first='world-workshop-game-reset-first-backup-v1',f=fixture();
 assert.equal(f.c.poiGameResetStorage(f.storage).ok,true);
 const original=f.map.get(first);assert.equal(JSON.parse(original).before[kit],'inventory towerFind claims');
 f.map.set(kit,'new test items');f.map.set(clock,'new test time');
 assert.equal(f.c.poiGameResetStorage(f.storage).ok,true);
 assert.equal(f.map.get(first),original);assert.equal(JSON.parse(f.map.get(backup)).before[kit],'new test items');
 const g=fixture();g.fail((op,k)=>op==='set'&&k===first);
 assert.equal(g.c.poiGameResetStorage(g.storage).ok,false);assert.equal(g.ops.some(([op])=>op==='remove'),false);
});
