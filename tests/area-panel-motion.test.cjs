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
test('landscape area transition sits to the right of the HUD, grows moderately, and eases home slowly',()=>{
 for(const [screen,left,card] of [[568,5,77],[844,24,94],[1120,58,100]]){
  const x=setup(false,false,{screen,left,card});x.call(a);x.call(b);
  const {frames,timing}=x.animations[0],peak=frames[1];
  const m=/^translateX\(([0-9.]+)px\) scale\(([0-9.]+)\)$/.exec(peak.transform);
  assert.ok(m);const dx=+m[1],grow=+m[2];
  assert(dx>=card+8&&dx<=148.5);
  assert(grow>=1.45&&grow<=1.55);
  assert(left+dx+grow*card<=screen-10);
  assert(timing.duration>=1650&&timing.duration<=1850);
  assert((1-frames.at(-2).offset)*timing.duration>1000,'return alone is longer than before');
  assert.equal(frames.at(-1).transform,'translateX(0) scale(1)');
 }
});
test('landscape excursion fits if extreme left safe area leaves less horizontal room; reduced motion still skips it',()=>{
 const cramped=setup(false,false,{screen:520,left:350,card:90});
 cramped.call(a);cramped.call(b);
 assert.match(cramped.animations[0].frames[1].transform,/translateX\(23px\)/);
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
