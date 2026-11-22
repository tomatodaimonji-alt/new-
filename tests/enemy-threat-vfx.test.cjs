const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function fixture(){
 const a=html.indexOf('const POI_ENEMY_THREAT_TINT='),b=html.indexOf('function render()',a);
 assert(a>=0&&b>a);const log=[],pulled=[];
 const scope=vm.createContext({poiWalkActive:true,pineAIActive:false,poiWalkLevel:0,
  world:[{x:4,z:5,y:0,type:'stone'}],nowThreats:[],
  terrainY:()=>.2,validPos:(x,z)=>x>=0&&z>=0,ROAD_IDS:new Set(),
  facilityCreekIndex:{bridgeHeight:new Map([['8,8',.61]])},
  mesh:()=>({p:[]}),upload:m=>{log.push(['upload',m.p.length]);return m},
  tri:(m,...p)=>m.p.push(...p.slice(0,3).flat()),
  draw:(_mesh,vp)=>pulled.push(Array.from(vp.slice(12,16))),
  gl:{BLEND:'BLEND',CONSTANT_ALPHA:0,ONE_MINUS_CONSTANT_ALPHA:1,SRC_ALPHA:2,ONE_MINUS_SRC_ALPHA:3,
   enable:k=>log.push(['enable',k]),disable:k=>log.push(['disable',k]),blendColor:(...v)=>log.push(['color',v[3]]),
   blendFunc:(...v)=>log.push(['blend',...v]),depthMask:flag=>log.push(['mask',flag])},
 });
 scope.poiEnemyThreatTiles=()=>scope.nowThreats;
 vm.runInContext(html.slice(a,b),scope);
 return {scope,log,pulled,vp:new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1])};
}
test('actual threat tiles project over the scene floor, dedupe and never disable depth testing',()=>{
 const {scope,log,pulled,vp}=fixture();
 scope.nowThreats=[{x:4,z:5,y:0,start:100,hit:700},{x:4,z:5,y:0,start:100,hit:800},
  {x:8,z:8,y:0,start:200,hit:600},{x:1,z:2,y:1,start:100,hit:700}];
 scope.poiDrawEnemyThreatTiles(350,vp);
 assert.deepEqual(pulled.map(p=>p.map(v=>+v.toFixed(3))),[[4.5,.35,5.5,1],[8.5,.63,8.5,1]]);
 assert.equal(log.filter(e=>e[0]==='upload').length,1);
 assert.deepEqual(log.filter(e=>e[0]==='disable'),[['disable','BLEND']]);
 assert.deepEqual(log.filter(e=>e[0]==='mask'),[['mask',false],['mask',true]]);
 scope.poiDrawEnemyThreatTiles(500,vp);assert.equal(log.filter(e=>e[0]==='upload').length,1);
 scope.poiDrawEnemyThreatTiles(800,vp);assert.equal(pulled.length,4);
 scope.pineAIActive=true;scope.poiDrawEnemyThreatTiles(300,vp);assert.equal(pulled.length,4);
});
test('translucent warning ramps softly before impact, never beyond 36 percent',()=>{
 const {scope}=fixture(),t={start:100,hit:700};
 assert.equal(scope.poiEnemyThreatAlpha(t,99),0);assert.equal(scope.poiEnemyThreatAlpha(t,700),0);
 const a=[100,200,450,699].map(now=>scope.poiEnemyThreatAlpha(t,now));
 assert(a[0]>.06&&a[3]<=.36&&a.every((v,i)=>i===0||v>a[i-1]));
});
