const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const h=fs.readFileSync(process.argv[2]||path.join(__dirname,'south-landing-candidate.html'),'utf8');
for(const script of h.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(script[1]);
const a=h.indexOf('function frontierSouthDrawCovered('),b=h.indexOf('function frontierSouthCoveredCamera(',a);
let y=0,drawn=[];
const c=vm.createContext({
 facilitySite:{id:'frontier'},poiWalkViewX:160,poiWalkViewZ:79,
 facilityViewLevel:()=>y,facilityScenes:new Map([['cellar:-1',{mesh:{id:'view'}}]]),
 mesh:()=>({}),upload:m=>m,stockAtlasUpload:m=>m,
 frontierSouthVestibuleArt:m=>m.id='floor',frontierSouthGateArt:m=>m.id='gate',
 frontierSouthStairArt:m=>m.id='stairs',frontierSouthDoorArt:m=>m.id='door',
 frontierSouthCeilingMesh:preview=>({id:preview?'preview':'cellar'}),
 frontierSouthLanternMounts:()=>[],stockAtlasOutside:()=>false,
 frontierSouthMouthView:(x,z)=>x>=156&&x<=165&&z>=75&&z<=82.25,
 frontierSouthRampHeight:(x,z)=>x>=159&&x<=163&&z>=76&&z<=81.02?-1:null,
 draw:m=>drawn.push(m.id),frontierStaticDraw:m=>drawn.push(m.id),
 frontierSouthDrawDoor:()=>drawn.push('door'),
 frontierSouthStairGpu:null,frontierSouthVestibuleGpu:null,frontierSouthPreviewGpu:null,
 frontierSouthInteriorGateGpu:null,frontierSouthDoorGpu:null,frontierSouthCeilingGpu:null
});
vm.runInContext(h.slice(a,b)+'\nglobalThis.drawCover=frontierSouthDrawCovered;',c);
const check=(floor,z,eye,expected)=>{
 y=floor;c.poiWalkViewZ=z;drawn=[];
 c.drawCover([],0,eye);assert.deepEqual(drawn,expected);
};
check(0,74,[160.5,2,69],['stairs','floor','gate','door']);
check(0,77,[160.5,2,74],['stairs','view','preview','floor','gate','door']);
check(-1,79,[160.5,1,76],['stairs','preview']);
check(-1,81,[160.5,.6,80.5],['stairs','cellar']);  // screenshot case: B1 landing, toward the dungeon
check(-1,81,[160.5,.6,82.5],['stairs','cellar','gate','door']);  // ascent: preserve the visible outer gate
check(-1,81,[165,.6,82.5],['stairs','cellar']); // side glance not through stair throat
check(-1,90,[160.5,.6,94],['cellar']); // deep B1 never reuses upper scene
assert.ok(h.includes('frontierSouthDrawCovered(p.vp,now,p.eye)'));
console.log('PASS surface floor stays visible upstairs without covering B1, first landing retains stairs/context and valid uphill glimpse');
