const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const id='poi-adventurers-guild-v102',title='冒険者ギルド';
const key='world-workshop-pois-v1',archive='world-workshop-guild-duplicates-v105',old='pine-adventurers-guild-poi-before-v102',save='forest-world-editor-v1';
const map=n=>({format:'forest-world-v1',version:1,width:30,height:30,models:[],prefabs:[],checks:[],world:[{x:n,z:3,y:0,type:'woodfloor',rot:0}]});
const record=(n,other={})=>({id,name:title,map:map(n),...other});
function runtime(sources){
 const source=html.match(/function pineGuildOriginalRecord\([\s\S]*?(?=function pineGuildOriginalSite\()/)?.[0];assert(source,'guild original route missing');
 const writes=[];
 const api=vm.runInNewContext(source.replace(/function pineGuildCurrentMapMatches\([\s\S]*?(?=function pineGuildOriginalSource\()/,'')+';pineGuildOriginalSource',{
  localStorage:{getItem:k=>sources[k]??null,setItem:(...a)=>writes.push(a)},
  PINE_CUSTOM_POI_KEY:key,PINE_DUPLICATE_POI_BACKUP_KEY:archive,PINE_ADVENTURERS_GUILD_ID:id,PINE_ADVENTURERS_GUILD_NAME:title,SAVE_KEY:save,
  pineValidSavedPOI:p=>p&&/^poi-/.test(p.id)&&p.map?.format==='forest-world-v1',
  pineValidateWorldData:m=>{if(!m?.world?.length)throw Error('bad');return {newW:m.width,newH:m.height}},
  pineGuildCurrentMapMatches:m=>m.world[0].x===9,
  pineDecodeDuplicatePOIBackups:r=>JSON.parse(r)?.records??[]
 });
 return {source:api(),writes};
}
test('canonical saved wins unchanged and resolver writes no storage',()=>{
 const r=record(5),s=runtime({[key]:JSON.stringify([record(7,{id:'poi-older'}),r]),[old]:JSON.stringify(record(8))});
 assert.equal(s.source.kind,'saved');assert.equal(JSON.stringify(s.source.record),JSON.stringify(r));assert.deepEqual(s.writes,[]);
});
test('unique legacy name is live rather than manufactured as duplicate',()=>{
 const r=record(7,{id:'poi-older'});const s=runtime({[key]:JSON.stringify([r])});
 assert.equal(s.source.kind,'saved');assert.equal(s.source.record.id,r.id);assert.deepEqual(s.writes,[]);
});
test('use backup only if no valid live, reject distinct archive ambiguity, and identify current map separately',()=>{
 assert.equal(runtime({[key]:'[]',[old]:JSON.stringify(record(8))}).source.kind,'backup');
 assert.equal(runtime({[key]:JSON.stringify([record(1,{map:null})]),[old]:JSON.stringify(record(8))}).source.kind,'backup');
 assert.equal(runtime({[archive]:JSON.stringify({version:1,records:[record(1),record(2)]})}).source,null);
 assert.equal(runtime({[archive]:JSON.stringify({version:1,records:[record(1),record(1)]})}).source.kind,'backup');
 assert.equal(runtime({[save]:JSON.stringify(map(9))}).source.kind,'current');
 assert.equal(runtime({[save]:JSON.stringify(map(8))}).source,null);
});
test('gallery has the separate editor route and restoration is opt-in',()=>{
 assert.match(html,/data-guild-original|dataset\.guildOriginal/);
 assert.match(html,/guildOriginalRequested/);
 assert.match(html,/confirm\('保存された配置を「冒険者ギルド」としてPOI一覧に戻しますか？/);
 assert.match(html,/if\(facilitySite\?\.id==='guildsaved'\)return;/);
});
