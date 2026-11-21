const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function cut(a,b){const i=h.indexOf(a),j=h.indexOf(b,i+1);assert(i>=0&&j>i,a);return h.slice(i,j)}
test('an after-hours cold launch uses the traveler’s intact assigned room, not a closed desk',()=>{
 const bed={id:'inn-west',residentId:'guest',stand:{x:29,z:16,y:1,facing:0}};
 const c={poiTownNpcActors:[],poiTownNpcVersion:0,POI_TOWN_CLOSE:1080,POI_TOWN_WAKE:360,
  POI_TOWN_RESIDENT_ROLES:[{id:'guest',role:'adventurer',home:{x:29,z:16,y:1},public:{x:31,z:22,y:0}}],
  POI_TOWN_INN_BEDS:[bed],poiTownNpcExistsBed:()=>true,poiTownNpcStance:()=>true};
 vm.createContext(c);vm.runInContext(cut('function poiTownNpcInit(','function poiTownNpcBedOwner('),c);
 c.poiTownNpcInit({minute:1290,absoluteMinute:1290});
 assert.equal(c.poiTownNpcActors[0].bedId,'inn-west');
 assert.equal(c.poiTownNpcActors[0].y,1);
 assert.equal(c.poiTownNpcActors[0].bedUntil,1800);
 c.poiTownNpcActors=[];
 c.poiTownNpcInit({minute:60,absoluteMinute:1500});
 assert.equal(c.poiTownNpcActors[0].bedUntil,1800,'before sunrise stay expires this morning');
 c.poiTownNpcActors=[];c.poiTownNpcExistsBed=()=>false;
 c.poiTownNpcInit({minute:1290,absoluteMinute:1290});
 assert.equal(c.poiTownNpcActors[0].bedId,null,'removed bed stays unavailable');
});
test('v143→v144 preserves player position and the older static editor view center',()=>{
 const p=vm.runInNewContext(cut('function workshopResumeTownPosition(','function workshopResumeRestore(')+';({view:workshopResumeTownView,position:workshopResumeTownPosition})');
 const old={panX:3,panZ:-2};
 assert.deepEqual({...p.view({townLayout:4},old,128,96,22)},{panX:3,panZ:-6});
 assert.equal(p.view({townLayout:5},old,128,96,22),old);
 const pos={x:40,z:50,y:0,facing:1};
 assert.deepEqual({...p.position({townLayout:4,position:pos},22)},{x:50,z:60,y:0,facing:1});
 assert.equal(p.position({townLayout:5,position:pos},22),pos);
 assert.deepEqual({...p.position({townLayout:3,position:{x:19,z:21,y:0,facing:2}},22)},{x:41,z:43,y:0,facing:2});
});
