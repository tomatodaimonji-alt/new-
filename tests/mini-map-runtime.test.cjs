const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const snippet=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i+1);assert(i>=0&&j>i,'missing '+a);return html.slice(i,j)};
const run=(scope={})=>{
 vm.createContext(scope);
 vm.runInContext(snippet('const POI_SAFE_TOWN=','function poiWalkStatus('),scope);
 return scope;
};
test('explicit town coverage does not grant zero-risk rating to the similarly named outside routes',()=>{
 const {poiRegionAt:region}=run(),base={id:'base',name:'ゲーム世界'};
 for(const [x,z] of [[19,21],[19,46],[60,45],[47,15],[10,41],[37,41],[27,16]])
  assert.deepEqual({...region(base,x,z)},{name:'拠点',difficulty:0,stars:'☆☆☆☆☆'});
 for(const [x,z] of [[63,45],[19,47],[67,38],[0,0],[86,39]])
  assert.deepEqual({...region(base,x,z)},{name:'外',difficulty:1,stars:'★☆☆☆☆'});
 assert.deepEqual({...region({id:'stable',name:'厩舎'},15,35)},{name:'厩舎',difficulty:0,stars:'☆☆☆☆☆'});
 assert.equal(region({id:'future',name:'未踏の地',difficulty:8},1,1).stars,'★★★★★');
 assert.equal(region({id:'future',name:'未踏の地',difficulty:-2},1,1).stars,'☆☆☆☆☆');
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
 assert(!els.poiMiniHud.hidden);assert.equal(scope.poiMiniSnapshot().topologyBuilds,builds+1);
 assert(labels.includes('2F'),'keep upper-floor information visible after replacing the old status');
 scope.poiWalkLevel=0;scope.poiMiniUpdate();assert.equal(scope.poiMiniSnapshot().topologyBuilds,builds+1);
 scope.poiMiniInvalidate();scope.poiMiniUpdate();assert.equal(scope.poiMiniSnapshot().topologyBuilds,builds+2);
 scope.poiWalkActive=false;scope.poiMiniUpdate();assert(els.poiMiniHud.hidden);
});
test('map raster leaves the shared glass visible behind terrain and at the edges',()=>{
 const ops=[];
 const g={fillStyle:'',strokeStyle:'',fillRect(...args){ops.push(['fill',this.fillStyle,...args]);},
  strokeRect(...args){ops.push(['outline',this.strokeStyle,...args]);},fillText(){}};
 const scope=run({document:{createElement:()=>({getContext:()=>g})},MAP_W:20,MAP_H:20,
  world:[{x:10,z:10,y:0,type:'stone'},{x:11,z:10,y:0,type:'earth'},{x:12,z:10,y:0,type:'water'},{x:13,z:10,y:0,type:'poiFortGate'}],isFloor:t=>t==='stone',isWallId:()=>false,
  poiWalkPassableDoor:()=>false,BRIDGE_IDS:new Set(),ROAD_IDS:new Set()});
 const map=scope.poiMiniDrawTopology(144,144,0);
 const pixels=ops.filter(o=>o[0]==='fill');
 assert.equal(pixels.length,4,'no solid background fill over the shared panel');
 const alpha=pixels.map(o=>Number(o[1].match(/,([.\d]+)\)$/)?.[1]));
 assert(alpha[0]>=.29&&alpha[0]<=.38,'glass shows through ordinary terrain');
 assert(alpha[1]>alpha[0]&&alpha[2]>alpha[0]&&alpha[3]>alpha[1],'roads, water and entrances remain distinct');
 assert(pixels.every((p,i)=>p.slice(2).every(Number.isInteger)&&(!i||pixels[i-1][2]+pixels[i-1][4]===p[2])),'translucent adjacent cells must not overlap');
 assert(ops.some(o=>o[0]==='outline'&&o[2]===map.ox&&o[3]===map.oy),'north-up map retains a ground-level boundary');

});

test('minimap and attached location panel sit nearer the top-left but respect the display cutout',()=>{
 assert.match(html,/#poiMiniHud\s*\{[^}]*top:max\(5px,calc\(env\(safe-area-inset-top,0px\) - 46px\)\)[^}]*left:max\(5px,env\(safe-area-inset-left,0px\)\)/);
 assert.match(html,/#poiMiniHud\s*\{[^}]*background:transparent!important[^}]*backdrop-filter:none/,'aside reset must beat the legacy important shade');
});

test('all four upper-left surfaces blend directly with the scene without a blur backing',()=>{
 const css=html.match(/#app #viewWrap :is\(#poiMiniMap,#poiLocationPanel,#poiGoldHud,#poiClockHud\)\s*\{([^}]+)\}/)?.[1];
 assert(css,'scope the flat alpha to the four upper-left surfaces');
 assert.match(css,/background-color:var\(--workshop-panel-surface\)!important/);
 assert.match(css,/backdrop-filter:none/);
 assert.match(css,/box-shadow:0 1px 4px #07191045/);
});
