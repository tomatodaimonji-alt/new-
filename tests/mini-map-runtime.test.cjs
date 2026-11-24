const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const snippet=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i+1);assert(i>=0&&j>i,'missing '+a);return html.slice(i,j)};
const run=(scope={})=>{
 Object.assign(scope,{btoa,atob,poiWalkDoorOpen:null,poiWalkIndoor:()=>false,setTimeout:()=>1,clearTimeout:()=>{}});
 vm.createContext(scope);
 vm.runInContext(snippet('const POI_SAFE_TOWN=','function poiWalkStatus('),scope);
 return scope;
};
test('explicit town coverage does not grant zero-risk rating to the similarly named outside routes',()=>{
 const {poiRegionAt:region}=run(),base={id:'base',name:'ゲーム世界'};
 for(const [x,z] of [[19,21],[19,46],[60,45],[47,15],[10,41],[37,41],[27,16]])
  assert.deepEqual({...region(base,x,z)},{name:'拠点',difficulty:0,stars:'☆☆☆☆☆☆☆☆☆☆'});
 for(const [x,z] of [[63,45],[19,47],[67,38],[0,0],[86,39]])
  assert.deepEqual({...region(base,x,z)},{name:'外',difficulty:1,stars:'★☆☆☆☆☆☆☆☆☆'});
 assert.deepEqual({...region({id:'stable',name:'厩舎'},15,35)},{name:'厩舎',difficulty:0,stars:'☆☆☆☆☆☆☆☆☆☆'});
 assert.equal(region({id:'future',name:'未踏の地',difficulty:8},1,1).stars,'★★★★★☆☆☆☆☆');
 assert.equal(region({id:'future',name:'未踏の地',difficulty:-2},1,1).stars,'☆☆☆☆☆☆☆☆☆☆');
 assert.equal(region(null,20,20,true).name,'旧・冒険マップ');
});
test('mini map follows the active floor and hides for editor/AI while reusing static map on movement/turns',()=>{
 const labels=[];
 const mkCtx=()=>({fillRect(){},strokeRect(){},beginPath(){},arc(){},fill(){},stroke(){},fillText(s){labels.push(s)},clearRect(){},drawImage(){}});
 const mkCanvas=()=>({width:144,height:144,getContext:()=>mkCtx()});
 const els={poiMiniHud:{hidden:true},poiMiniMap:mkCanvas(),poiLocationName:{textContent:''},
  poiLocationStars:{textContent:'',setAttribute(){}}};
 const scope=run({$:id=>els[id],document:{createElement:mkCanvas},facilitySite:{id:'base',name:'ゲーム世界'},
  poiWalkActive:false,pineAIActive:false,pineGameActive:false,poiWalkLevel:0,poiWalkFacing:0,poiWalkX:19,poiWalkZ:46,
  MAP_W:96,MAP_H:56,world:[{x:19,z:46,type:'stone',y:0},{x:19,z:46,type:'stone',y:1}],
  isFloor:t=>t==='stone',isWallId:()=>false,poiWalkPassableDoor:()=>false,BRIDGE_IDS:new Set(),ROAD_IDS:new Set()});
 assert.equal(scope.poiMiniUpdate(),undefined);assert(els.poiMiniHud.hidden);
 scope.poiWalkActive=true;scope.poiMiniUpdate();
 const builds=scope.poiMiniSnapshot().topologyBuilds;assert.equal(builds,1);assert(!els.poiMiniHud.hidden);
 assert.equal(els.poiLocationName.textContent,'拠点');
 scope.poiWalkZ=47;scope.poiMiniUpdate();assert.equal(els.poiLocationName.textContent,'外');
 scope.poiWalkFacing=2;scope.poiMiniUpdate();assert.equal(scope.poiMiniSnapshot().topologyBuilds,builds);
 scope.pineAIActive=true;scope.poiMiniUpdate();assert(els.poiMiniHud.hidden);
 scope.pineAIActive=false;scope.poiWalkLevel=1;scope.poiMiniUpdate();
 assert(!els.poiMiniHud.hidden);assert.equal(scope.poiMiniSnapshot().topologyBuilds,builds);
 assert(labels.includes('2F'),'keep upper-floor information visible after replacing the old status');
 scope.poiWalkLevel=0;scope.poiMiniUpdate();assert.equal(scope.poiMiniSnapshot().topologyBuilds,builds);
 scope.poiMiniInvalidate();scope.poiMiniUpdate();assert.equal(scope.poiMiniSnapshot().topologyBuilds,builds+1);
 scope.poiWalkActive=false;scope.poiMiniUpdate();assert(els.poiMiniHud.hidden);
});
test('map raster fills unexplored pixels black and only paints distinct known terrain',()=>{
 const pixels=[],g={fillStyle:'',fillRect(...args){pixels.push([this.fillStyle,...args])},
  beginPath(){},arc(){},fill(){},stroke(){},fillText(){}};
 const scope=run({});
 vm.runInContext(`{
  const cells=new Uint8Array(41*41);cells[840-5]=2;cells[840-4]=3;
  cells[840-3]=4;cells[840-2]=6;
  poiLocalPaint(cv,{cells,crop:poiLocalCrop(11,10),marks:[],x:11,z:10,y:0,facing:0});
 }`,Object.assign(scope,{cv:{width:144,height:144,getContext:()=>g}}));
 assert.deepEqual(pixels[0],['#000',0,0,144,144]);
 assert.equal(pixels.length,5,'only the four charted tiles are colored');
 assert.equal(new Set(pixels.slice(1).map(p=>p[0])).size,4,'ground, road, water and entrance remain distinct');
 assert(pixels.slice(1).every((p,i)=>p.slice(1).every(Number.isInteger)&&(!i||pixels[i][1]+pixels[i][3]===p[1])));
});

test('minimap and attached location panel sit nearer the top-left but respect the display cutout',()=>{
 assert.match(html,/#poiMiniHud\s*\{[^}]*top:max\(5px,calc\(env\(safe-area-inset-top,0px\) - 46px\)\)[^}]*left:max\(5px,env\(safe-area-inset-left,0px\)\)/);
 assert.match(html,/#poiMiniHud\s*\{[^}]*background:transparent!important[^}]*backdrop-filter:none/,'aside reset must beat the legacy important shade');
});

test('all four upper-left surfaces blend directly with the scene without a blur backing',()=>{
 const css=html.match(/#app #viewWrap :is\(#poiMiniMap,#poiLocationPanel,#poiClockHud\)\s*\{([^}]+)\}/)?.[1];
 assert(css,'scope the flat alpha to the four upper-left surfaces');
 assert.match(css,/background-color:var\(--workshop-panel-surface\)!important/);
 assert.match(css,/backdrop-filter:none/);
 assert.match(css,/box-shadow:0 1px 4px #07191045/);
});
test('mine quest marker appears only once nearby surveyed, and only on the surface',()=>{
 const outlines=[],draws=[];
 const g={fillRect(x,y,w,h){if(x===0&&y===0&&w===144&&h===144)draws.push(1)},strokeRect(){},beginPath(){},arc(){},fill(){},stroke(){},fillText(){},
  clearRect(){},drawImage(){},moveTo(x,z){outlines.push([x,z])},lineTo(){},closePath(){}};
 const mk=()=>({width:144,height:144,getContext:()=>g});
 let quests=[];
 const els={poiMiniHud:{},poiMiniMap:mk(),poiLocationName:{},poiLocationStars:{setAttribute(){}}};
 const scope=run({$:id=>els[id],document:{createElement:mk},facilitySite:{id:'base',mine:{entrance:{x:116,z:64,y:0}}},
  poiQuestMiniTargets:()=>quests,poiWalkActive:true,pineAIActive:false,pineGameActive:false,
  poiWalkLevel:0,poiWalkFacing:0,poiWalkX:22,poiWalkZ:26,MAP_W:128,MAP_H:96,world:[],
  isFloor:()=>false,isWallId:()=>false,poiWalkPassableDoor:()=>false,BRIDGE_IDS:new Set(),ROAD_IDS:new Set()});
 scope.poiMiniUpdate();assert.equal(outlines.length,0);
 quests=[{id:'mine-survey',x:116,z:64,y:0}];scope.poiMiniUpdate();
 assert.equal(outlines.length,0,'accepted task does not leak a far-away map pin');
 assert.equal(scope.poiMiniSnapshot().topologyBuilds,1);assert.equal(draws.length,2);
 scope.poiMiniUpdate();assert.equal(draws.length,2);
 scope.poiWalkX=115;scope.poiWalkZ=63;scope.poiMiniUpdate();
 const scale=144/41;
 assert.deepEqual(outlines,[[21.5*scale,21.5*scale-5.5]]);
 scope.poiWalkLevel=-1;scope.poiMiniUpdate();assert.equal(outlines.length,1,'no marker below ground');
 scope.poiWalkLevel=0;quests=[];scope.poiMiniUpdate();assert.equal(outlines.length,1);
});
