const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function setup(reduced=false,loading=false,layout=null){
 const animations=[];
 const panel={animate(frames,timing){
  const state={frames,timing,canceled:false,cancel(){this.canceled=true}};
  animations.push(state);return state;
 }};
 if(layout){panel.closest=selector=>selector==='#viewWrap'?{hasAttribute:()=>true,clientWidth:layout.screen}:null;
  panel.offsetParent={offsetLeft:layout.left};panel.offsetWidth=layout.card;}
 const startup={loading};
 const c={panel,window:{pineStartup:startup},matchMedia:()=>({matches:reduced})};
 const i=h.indexOf('// BEGIN LOCATION PANEL MOTION'),j=h.indexOf('// END LOCATION PANEL MOTION');
 assert(i>=0&&j>i,'v210 has dedicated lightweight location panel motion');
 vm.createContext(c);vm.runInContext(h.slice(i,j),c);
 return {animations,startup,call:(area=null)=>{c.area=area;return vm.runInContext('poiLocationMotion(panel,area)',c)}};
}
const a={name:'拠点',stars:'☆☆☆☆☆'},b={name:'外',stars:'★☆☆☆☆'};
test('only changed visible label or stars animate; topology/floor/position and first show do not',()=>{
 const x=setup();x.call(a);x.call({...a,x:42,z:22,level:1});assert.equal(x.animations.length,0);
 x.call(b);assert.equal(x.animations.length,1);
 x.call({...b,level:0});assert.equal(x.animations.length,1);
 x.call({...b,stars:'★★☆☆☆'});assert.equal(x.animations.length,2);
 assert(x.animations[0].canceled);
 const {frames,timing}=x.animations[1];
 assert.equal(frames.at(-1).transform,'translateX(0) scale(1)');
 assert(frames.some(v=>v.transform.includes('scale(1.24)')));
 assert(timing.duration>=900&&timing.duration<=1100);
});
test('hidden/reset route cancels without retrigger on opening; reduced motion stays still',()=>{
 const x=setup();x.call(a);x.call(b);x.call(null);
 assert(x.animations[0].canceled);
 x.call(a);assert.equal(x.animations.length,1);
 const y=setup(true);y.call(a);y.call(b);assert.equal(y.animations.length,0);
});
test('startup-inert spawn then actual saved position both settle silently; first real boundary animates',()=>{
 const x=setup(false,true);
 x.call(a);x.call(b);
 assert.equal(x.animations.length,0,'hidden fallback spawn is never a visible area change');
 x.startup.loading=false;
 x.call(b);assert.equal(x.animations.length,0);
 x.call(a);assert.equal(x.animations.length,1,'first player-driven boundary still animates');
});
test('landscape cue brightens only the fixed area card; motion never overlaps the party',()=>{
 for(const [screen,left,card] of [[568,5,77],[844,24,94],[1120,58,100],[520,350,90]]){
  const x=setup(false,false,{screen,left,card});x.call(a);x.call(b);
  const {frames,timing}=x.animations[0],peak=frames[1];
  assert(frames.every(v=>!v.transform));
  assert(peak.boxShadow.includes('inset')&&peak.boxShadow.includes(',.72'));
  assert(timing.duration>=1650&&timing.duration<=1850);
  assert((1-frames.at(-2).offset)*timing.duration>1000,'the cue maintains its long ease-out');
  assert.equal(frames.at(-1).boxShadow,frames[0].boxShadow);
 }
 const reduced=setup(true,false,{screen:844,left:24,card:94});
 reduced.call(a);reduced.call(b);assert.equal(reduced.animations.length,0);
});
test('every area has ten stars without changing existing game difficulty',()=>{
 const start=h.indexOf('function poiRegionAt('),end=h.indexOf('// BEGIN LOCATION PANEL MOTION',start);
 assert(start>=0&&end>start);
 const region=Function(`const POI_SAFE_TOWN=[];
 const poiNorthTrailRegion=()=>({name:'水辺の道',difficulty:1});
 `+h.slice(start,end)+';return poiRegionAt;')();
 assert.equal(region({name:'拠点',difficulty:0},0,0).stars,'☆☆☆☆☆☆☆☆☆☆');
 const lowland=region({id:'base',townOffset:0},5,10,false,0);
 assert.equal(lowland.difficulty,1);
 assert.equal(lowland.stars,'★☆☆☆☆☆☆☆☆☆');
 assert.match(h,/#poiLocationPanel\{min-width:0;display:grid;grid-template-columns:minmax\(0,1fr\)/);
 assert.match(h,/危険度 '\+area.difficulty\+'／10/);
});

