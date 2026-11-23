const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function setup(reduced=false,loading=false){
 const animations=[];
 const panel={animate(frames,timing){
  const state={frames,timing,canceled:false,cancel(){this.canceled=true}};
  animations.push(state);return state;
 }};
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
