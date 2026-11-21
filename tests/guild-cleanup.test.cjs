const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const html=readFileSync(process.env.HTML||'world-editor.html','utf8');
const ACTIVE='world-workshop-pois-v1', BACKUP='world-workshop-guild-duplicates-v105';
const CANON='poi-adventurers-guild-v102';
const GUILD='冒険者ギルド';
function rec(id,name=GUILD,x=1){
 return {id,name,map:{format:'forest-world-v1',version:1,width:30,height:30,
  world:[{x,z:x,y:0,type:'stonewall',rot:0}],models:[],prefabs:[]}};
}
function bootstrap(input,options={}){
 const mem=new Map();
 if(input!==null)mem.set(ACTIVE,input);
 if(options.archive!==undefined)mem.set(BACKUP,options.archive);
 const writes=[];
 const localStorage={
  getItem:k=>mem.get(k)??null,
  setItem(k,v){
   writes.push(k);
   if(options.failKey===k)throw Error('quota');
   mem.set(k,options.corruptKey===k?'corrupt write':v);
  }
 };
 const warnings=[];
 const ctx=vm.createContext({localStorage,console:{warn:(...a)=>warnings.push(a)},toast:()=>{}});
 const begin=html.indexOf("const PINE_CUSTOM_POI_KEY=");
 const end=html.indexOf('function pineInstallOnlyGuildPOI(){',begin);
 assert(begin>=0&&end>begin);
 const region=html.slice(begin,end);
 const validationStart=html.indexOf('function validModel(');
 const validationEnd=html.indexOf('function loadData(',validationStart);
 const sharedValidation=html.slice(validationStart,validationEnd);
 const api=vm.runInContext(`
 const MIN_MAP=12,MAX_MAP=128,MAX_LEVEL=9,TERRAIN_MAX=8;
 const palette=[{id:'stonewall'}],PINE_CHECK_COLORS=['#f5cb54'];
 const safeColor=()=>true;
 `+sharedValidation+region+`
  customPOIs=pineReadSavedPOIs();
  ({repair:()=>pineRepairDuplicateGuildPOIs(), records:()=>JSON.stringify(customPOIs),
  writable:()=>pinePOIStorageWritable, reload:()=>{customPOIs=pineReadSavedPOIs()}})
 `,ctx);
 return {api,mem,writes,warnings};
}
test('latest canonical wins and every original removed record survives separately from active maps',()=>{
 const primary=rec('poi-guild-primary-v87','ギルド',1);
 const misc=rec('poi-other-aaa','宿舎',2);
 const older=rec('poi-wanted-dup',GUILD,3);
 const stale=rec(CANON,GUILD,4);
 const canonical=rec(CANON,GUILD,5);
 const input=JSON.stringify([primary,older,misc,stale,canonical]);
 const {api,mem,writes}=bootstrap(input);
 assert.equal(api.repair(),true);
 assert.deepEqual(JSON.parse(api.records()),[primary,misc,canonical]);
 assert.deepEqual(JSON.parse(mem.get(BACKUP)),{version:1,records:[older,stale]});
 assert.deepEqual(writes,[BACKUP,ACTIVE]);
 api.reload();
 assert.equal(api.repair(),false);
 assert.deepEqual(writes,[BACKUP,ACTIVE]);
});
test('without canonical ID, retains last exact Adventurers Guild name',()=>{
 const last=rec('poi-manual-last',GUILD,11), primary=rec('poi-guild-but-not',GUILD+' ',12);
 const {api,mem}=bootstrap(JSON.stringify([rec('poi-first-ever'),primary,last]));
 assert.equal(api.repair(),true);
 assert.deepEqual(JSON.parse(mem.get(ACTIVE)),[primary,last]);
 assert.match(html,/p\.id===PINE_ADVENTURERS_GUILD_ID\|\|p\.name===PINE_ADVENTURERS_GUILD_NAME/);
});
test('archive quota, invalid archive, and unverified writes never alter active bytes',()=>{
 const input=JSON.stringify([rec('poi-older-copy'),rec(CANON)],null,2);
 for(const options of [{failKey:BACKUP},{archive:'invalid'},{corruptKey:BACKUP}]){
  const {api,mem,writes}=bootstrap(input,options);
  assert.equal(api.repair(),true);
  assert.equal(mem.get(ACTIVE),input);
  assert(!writes.includes(ACTIVE));
 }
});
test('archive may remain after save failure and replay does not create extra backups',()=>{
 const removed=rec('poi-older-copy'),canonical=rec(CANON);
 const input=JSON.stringify([removed,removed,canonical],null,2);
 const first=bootstrap(input,{failKey:ACTIVE});
 assert.equal(first.api.repair(),true);
 assert.equal(first.mem.get(ACTIVE),input);
 const backup=first.mem.get(BACKUP);
 assert.deepEqual(JSON.parse(backup).records,[removed,removed]);
 const second=bootstrap(input,{archive:backup});
 assert.equal(second.api.repair(),true);
 assert.deepEqual(second.writes,[ACTIVE]);
 assert.equal(second.mem.get(BACKUP),backup);
});
test('a malformed primary is never rewritten by cleanup and disables all legacy writes',()=>{
 for(const input of ['', 'no json', '{"not":"list"}', JSON.stringify([rec('poi-saved-valid'),null,rec(CANON)])]){
  const {api,mem,writes}=bootstrap(input);
  assert.equal(api.repair(),false);
  assert.equal(api.writable(),false);
  assert.equal(mem.get(ACTIVE),input);
  assert.deepEqual(writes,[]);
 }
 assert.match(html,/function pineStorePOIs\(entries\)\{\s*if\((?:facilitySite\|\|)?!pinePOIStorageWritable\)return false;/);
});

test('non-importable target maps are never removed or substituted',()=>{
 const malformed=[
  m=>delete m.models,
  m=>{m.models=[{id:'invalid',parts:[]}]},
  m=>{m.width=1},
  m=>{m.world[0].x=30},
  m=>{m.world[0].type='unknown-in-current-catalog'},
  m=>{m.world[0].rot=4},
  m=>{m.prefabs=[{id:'bad'}]},
  m=>{m.terrainHeights=[{x:0,z:0,h:-1}]},
  m=>{m.checks=[{x:0,y:0,z:0,color:'#abc'}]}
 ];
 for(const bad of malformed){
  for(const badIsCanonical of [false,true]){
   const older=rec('poi-older-save'),canonical=rec(CANON);
   bad((badIsCanonical?canonical:older).map);
   const input=JSON.stringify([older,canonical],null,2);
   const {api,mem,writes}=bootstrap(input);
   assert.equal(api.repair(),true);
   assert.equal(api.writable(),false);
   assert.equal(mem.get(ACTIVE),input);
   assert.deepEqual(writes,[]);
  }
 }
});
test('a different name pointing to the chosen ID makes the cleanup ambiguous',()=>{
 const input=JSON.stringify([rec(CANON,'ギルド'),rec('poi-older-save'),rec(CANON)],null,2);
 const {api,mem,writes}=bootstrap(input);
 assert.equal(api.repair(),true);
 assert.equal(api.writable(),false);
 assert.equal(mem.get(ACTIVE),input);
 assert.deepEqual(writes,[]);
});
