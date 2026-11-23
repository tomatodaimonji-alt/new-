const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function cut(x,y){const a=h.indexOf(x),b=h.indexOf(y,a+x.length);assert(a>=0&&b>a,x);return h.slice(a,b)}
function start(mode,{saved=null,canGo=true,play=true,site='base'}={}){
 const params=new URLSearchParams('facility='+site+'&facility-play=1'+(mode?'&reset-camera=1':''));
 const events=[],c={poiWalkActive:false,poiThirdPerson:false,cameraTopDown:false,facilitySite:{id:site},facilityParams:params,
  URL,WORKSHOP_RESUME_KEY:'resume',localStorage:{getItem:()=>JSON.stringify(saved??{route:'facility',id:'base',play:true})},workshopResumeDecode:JSON.parse,facilityPlayOnOpen:(p,id)=>p.get('facility')===id,location:{href:'https://game.test/?'+params},history:{state:null,replaceState(_s,_empty,href){events.push(new URL(href))}},
  facilitySetPlay(){if(canGo)c.poiWalkActive=true},workshopResumeRestore(s){events.push('restore');c.poiWalkActive=!!s?.play;c.poiThirdPerson=!!s?.view?.third},
  poiSyncCameraModeUI(){events.push('camera UI')},poiWalkCamera(){},workshopResumeWrite(){events.push('save camera')}};
 vm.createContext(c);vm.runInContext(cut('function facilityOpenPlayFromEntry(','function facilityBoot('),c);
 c.facilityOpenPlayFromEntry(saved,play);if(play)c.facilityFinishResetCameraEntry();
 return {c,events};
}
test('only a fresh explicit base reset starts in third person and consumes the URL after saving',()=>{
 const run=start(true);
 assert.equal(run.c.poiWalkActive,true);assert.equal(run.c.poiThirdPerson,true);assert.equal(run.c.cameraTopDown,false);
 assert.deepEqual(run.events.slice(0,1),['camera UI']);
 assert.equal(run.events[1].searchParams.get('resume'),'1');
 assert(!run.events[1].searchParams.has('facility')&&!run.events[1].searchParams.has('reset-camera')&&!run.events[1].searchParams.has('facility-play'));
 assert.match(h,/workshopResumeStart\(\);\s*facilityFinishResetCameraEntry\(\);/);
 assert.equal(start(false).c.poiThirdPerson,false);
 assert.equal(start(true,{site:'artisan'}).c.poiThirdPerson,false);
 assert.equal(start(true,{canGo:false}).events.length,0);
});
test('a retained reset URL never overwrites a new saved preference when a WebView cannot update history',()=>{
 const saved={route:'facility',id:'base',play:true,view:{third:false}};
 const run=start(true,{saved});
 assert.equal(run.c.poiThirdPerson,false);assert.equal(run.events[0],'restore');
 assert.equal(start(false,{saved:{...saved,view:{third:true}},play:false}).c.poiThirdPerson,true);
 assert.match(cut('function poiGameReset(){','function poiGameResetDialogOpen('),/searchParams\.set\('reset-camera','1'\)/);
});
