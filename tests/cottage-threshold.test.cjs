const assert=require('node:assert/strict'),{test}=require('node:test'),fs=require('node:fs'),vm=require('node:vm');
const s=fs.readFileSync(process.argv[2]??'world-editor.html','utf8');
const cut=(a,b)=>{const x=s.indexOf(a),y=s.indexOf(b,x+1);return x>=0&&y>x?s.slice(x,y):''};
function run(code){
 const b={id:'cottage',entrance:{x:14,z:20},turn:0, floorFootprints:{0:[1]},x1:10,x2:16,z1:14,z2:20};
 const site={id:'base',buildings:[b,{id:'rowhouse'}]};
 const c=vm.createContext({site,b,rot2:()=>[0,1],facilityFloorOwner:(x,z)=>z<20&&x>=10&&x<=16?0:null,
  poiWalkActive:true,poiThirdPerson:true,cameraTopDown:false,pineAIActive:false,facilitySurfaceEdited:false});
 const stock=cut('function poiLowRoomCameraArea(','function poiLowRoomIndexedWalls(');
 const trial=cut('// BEGIN COTTAGE THRESHOLD','// END COTTAGE THRESHOLD');
 vm.runInContext("const POI_LOW_ROOM_IDS=new Set(['cottage']);"+stock+trial,c);
 return JSON.parse(vm.runInContext('JSON.stringify('+code+')',c));
}
const view="(x,z)=>typeof poiCottageMix==='function'?poiCottageMix(site,x,z,0)?.mix??0:poiLowRoomCameraArea(site,x,z,0)?1:0";
test('partial camera blend on true threshold, smooth each direction without switching on a cell boundary',()=>{
 const a=run(`[20.8,20.55,20.25,20,19.75,19.5,19.25,19.05].map(z=>(${view})(14,z))`);
 assert(a[0]===0&&a[3]>.1&&a[3]<.65&&a.at(-1)>.97,JSON.stringify(a));
 assert(a.slice(1).every((n,i)=>n>=a[i]&&n-a[i]<.32),JSON.stringify(a));
});
test('side of house and unrelated mode stay unaffected',()=>{
 const a=run(`[ (${view})(15.2,20.3), (${view})(14,21), (cameraTopDown=true,(${view})(14,20)) ]`);
 assert.deepEqual(a,[0,0,0]);
});

test('close roof and only the eye-facing boundary walls to almost zero, leaving opposite and partitions intact',()=>{
 const q=run('[poiCottageOpacity(0),poiCottageOpacity(1),poiCottageFrontCell(b,14,20,0,1),poiCottageFrontCell(b,14,14,0,1),poiCottageFrontCell(b,13,17,0,1),poiCottageFrontCell(b,10,18,-1,0)]');
 assert.equal(q[0],1);assert(q[1]<.04);assert.deepEqual(q.slice(2),[true,false,false,true]);
});
