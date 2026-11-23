const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const s=fs.readFileSync(require('node:path').join(__dirname,'../world-editor.html'),'utf8');
const slice=(start,end)=>s.slice(s.indexOf(start),s.indexOf(end,s.indexOf(start)));
const context=vm.createContext({MAX_MAP:128,MAX_LEVEL:9,POI_INVENTORY_LIMIT:3,poiInventoryStack:()=>3,poiInventorySanitizeCell:d=>d.type!=='invalid'?d:null,poiHotbarWeaponForType:type=>type==='sword',poiRepeatableMonsterWeapon:()=>false,facilitySite:null,facilityEditView:null,poiWalkActive:false,pineGameActive:false,workshopResumeReady:true,workshopResumeLeaving:false,workshopResumeRaw:'',workshopResumeView:()=>null,localStorage:{setItem(){}},WORKSHOP_RESUME_KEY:'resume'});
vm.runInContext(slice('function poiInventoryReadDrops','function poiInventoryAllowed')+slice('function workshopResumeDecode','function workshopResumePermitted')+slice('function workshopResumeWrite','function workshopResumeStart')+slice('function workshopResumeTownPosition','function workshopResumeRestore(s)'),context);
const run=code=>JSON.parse(JSON.stringify(vm.runInContext(code,context)));
test('unchanged saved current marker at 96 rows and 128 rows supports added editor baselines',()=>{
 for(const height of [96,128]){
  const record=run(`facilitySite={id:'base',townOffset:22,map:{width:128,height:${height}}}; workshopResumeWrite(null,true); workshopResumeDecode(workshopResumeRaw)`);
  assert.equal(record.townLayout,5);
  assert.equal(record.townMapHeight,height);
 }
 assert.equal(run(`workshopResumeDecode(JSON.stringify({version:1,route:'facility',id:'base',townLayout:5,townMapHeight:Infinity})).townMapHeight||null`),null);
 assert.equal(run(`workshopResumeDecode(JSON.stringify({version:1,route:'facility',id:'inn',townLayout:5,townMapHeight:128})).townMapHeight||null`),null);
});
test('historical positions shift exactly once; only map-relative editor view compensates height',()=>{
 assert.deepEqual(run(`workshopResumeTownPosition({townLayout:4,position:{x:30,z:34,y:0,facing:2}},22)`),{x:40,z:44,y:0,facing:2});
 assert.deepEqual(run(`workshopResumeTownPosition({townLayout:5,position:{x:40,z:127,y:0,facing:2}},22)`),{x:40,z:127,y:0,facing:2});
 for(const [saved,now,panZ] of [[{},96,3],[{},128,-13],[{townMapHeight:128},128,3],[{townMapHeight:128},96,19]]){
  const record={townLayout:5,...saved};
  assert.deepEqual(run(`workshopResumeTownView(${JSON.stringify(record)},{panX:7,panZ:3},128,${now},22)`),{panX:7,panZ});
 }
 assert.deepEqual(run(`workshopResumeTownView({townLayout:4},{panX:7,panZ:3},128,128,22)`),{panX:7,panZ:-17});
});
test('ordinary drop saves support future south rows while retaining bounds, counts, dedupe, caps',()=>{
 const read=rows=>run(`poiInventoryReadDrops(${JSON.stringify(rows)})`);
 const cell=(z,over={})=>({x:7,z,y:0,type:'herb',...over});
 assert.deepEqual(read([cell(96,{count:8}),cell(96),cell(127)]),[cell(96,{count:3}),cell(127)]);
 assert.deepEqual(read([cell(128),cell(0,{x:128}),cell(0,{y:10})]),[]);
 assert.deepEqual(read([cell(127,{type:'sword'}),cell(126,{type:'sword'}),cell(44,{type:'invalid'}),cell(45)]),[cell(127,{type:'sword'})]);
 assert.match(s.slice(s.indexOf('function poiInventoryDraw')),/d\.y!==poiWalkLevel\|\|!validPos\(d\.x,d\.z\)/);
});
