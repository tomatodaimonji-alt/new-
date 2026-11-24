const {readFileSync}=require('node:fs');
const assert=require('node:assert/strict');
const test=require('node:test');
const html=readFileSync(process.env.HTML||'world-editor.html','utf8');
const near=(anchor,n=1300)=>{const i=html.indexOf(anchor); assert(i>=0,anchor);return html.slice(i,i+n)};
test('opens an editable facility with standard toolbar, without starting play',()=>{
 const boot=near('function facilityBoot(');
 assert(boot.includes('facilitySession'));
 assert(!boot.includes('gameWorldMode'));
 assert(!boot.includes('poiWalkSet(true)'));
 assert(html.includes('id="facilitySessionActions"'));
 assert(html.includes('id="facilityExit"'));
});
test('both play controls use temporary facility play, and preserve primary save guards',()=>{
 assert(near("$('enterGameWorld').addEventListener").includes('facilitySetPlay(true)'));
 assert(near("$('poiWalkToggle').addEventListener").includes('facilitySetPlay(!poiWalkActive)'));
 assert(near('function saveLocal(){',145).includes('if(facilitySite||'));
 assert(near('function pineStorePOIs(entries){',145).includes('if(facilitySite||'));
});
test('exports the current map, accepts checks/undo, and invalidates play meshes after edits',()=>{
 assert(near('function facilityDownload(){',540).includes('facilityExportMap(data())'));
 const start=html.indexOf('function commit(){'),end=html.indexOf('\nfunction ',start);
 assert(start>=0&&end>start&&html.slice(start,end).includes('facilityInvalidateScenes()'));
 assert(near('function restore(json){',290).includes('facilityLoadMap'));
 assert(!near('function changeCell(x,z){',130).includes('if(facilitySite||'));
});
test('facility sessions reject whole-map import and cap even in-play editing and prefab stamps',()=>{
 assert(near("$('importJson').addEventListener",660).includes("if(facilitySite){toast('JSONの読み込みは元の編集画面で"));
 assert(near("$('importJson').addEventListener",660).includes('loadData(o);undoStack.push(before)'));
 assert.equal(html.includes('function facilityLoadMap(map,fromExternal'),false);
 assert(near("$('level').addEventListener('change'",410).includes('if(facilitySite){facilitySetEditLevel'));
 assert(near('function stampPrefab(',670).includes('p.y>(facilitySite?facilityMaxEditLevel():MAX_LEVEL)'));
 assert(near('function facilitySetEditLevel(',300).includes('facilityMaxEditLevel()'));
 // Inspect the whole function rather than truncating the roof guard when
 // unrelated object-visibility routing is added ahead of it.
 const start=html.indexOf('function facilityObjectVisible('),end=html.indexOf('\n}',start);
 assert(start>=0&&end>start);
 assert.match(html.slice(start,end),/if\(floor>=0&&poiWalkActive&&facilityIsRoofPiece\(o\)&&facilityRoofOwner\(o\)!==null\)return false/);
});
