const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function fixture({hidden=false}={}){
 const a=h.indexOf('// BEGIN PINE STARTUP COVER'),b=h.indexOf('// END PINE STARTUP COVER');
 assert(a>=0&&b>a,'independent startup cover controller');
 const frames=[],timers=new Map(),events=new Map(),log=[],nodes=new Map();
 for(const id of ['pineStartupCover','pineStartupMessage','pineStartupProgress','pineStartupActions','pineStartupRetry','pineStartupEditor','app']){
  const node={value:0,hidden:false,inert:true,dataset:{state:'loading'},addEventListener:(k,v)=>events.set(id+':'+k,v)};
  nodes.set(id,node);
 }
 let id=0;
 const document={hidden,getElementById:k=>nodes.get(k),addEventListener:(k,v)=>events.set('doc:'+k,v)};
 const url=new URL('https://example.test/world-editor.html?facility=base&facility-play=1&test=1#x');
 const c=vm.createContext({window:null,document,console:{error:()=>{}},URL,location:{href:url.href,reload:()=>log.push('reload'),replace:x=>log.push(x)},
  addEventListener:(k,v)=>events.set('window:'+k,v),requestAnimationFrame:f=>frames.push(f),
  setTimeout:f=>{timers.set(++id,f);return id},clearTimeout:id=>timers.delete(id)});
 c.window=c;vm.runInContext(h.slice(a,b),c);
 return {api:c.pineStartup,nodes,frames,timers,document,log,events,step:async()=>{for(const f of frames.splice(0))f();await new Promise(resolve=>setImmediate(resolve))}};
}
test('paint the independent loader before heavy startup and reveal only when first rendered and initialized',async()=>{
 const f=fixture();let resumeInit;
 const cover=f.nodes.get('pineStartupCover'),bar=f.nodes.get('pineStartupProgress');
 const start=f.api.start(async()=>{
  await f.api.checkpoint(2,'world');
  await f.api.checkpoint(3,'draw');
  await new Promise(resolve=>{resumeInit=resolve});
 });
 assert.equal(bar.value,0);assert.equal(cover.hidden,false);
 await f.step();assert.equal(bar.value,0);
 await f.step();assert.equal(bar.value,1);
 await f.step();await f.step();assert.equal(bar.value,2);
 await f.step();await f.step();assert.equal(bar.value,3);
 await f.step();await f.step();assert.equal(typeof resumeInit,'function');
 const frame=f.api.rendered();assert.equal(bar.value,4);
 assert.equal(cover.hidden,false,'full gauge remains up for the next paint');
 await f.step();await f.step();await frame;
 assert.equal(cover.hidden,false,'completed rendering is not completed initialization');
 resumeInit();await start;
 assert.equal(cover.hidden,true);assert.equal(f.nodes.get('app').inert,false);
 assert.equal(f.timers.size,0);assert.equal(cover.dataset.state,'ready');

 const g=fixture();const started=g.api.start(()=>{});
 await g.step();await g.step();await g.step();await g.step();await started;
 assert.equal(g.nodes.get('pineStartupCover').hidden,false,'registration alone is not a rendered frame');
 assert.equal(g.nodes.get('app').inert,true);
 const rendered=g.api.rendered();await g.step();await g.step();await rendered;
 assert.equal(g.nodes.get('pineStartupCover').hidden,true);
});
test('errors leave an actionable failure cover; retry and safe editor change only URL',async()=>{
 const f=fixture();const start=f.api.start(()=>{throw Error('gl unavailable')});
 await f.step();await f.step();await f.step();await f.step();await start;
 assert.equal(f.nodes.get('pineStartupCover').dataset.state,'failed');
 assert.equal(f.nodes.get('pineStartupCover').hidden,false);
 assert.equal(f.nodes.get('pineStartupActions').hidden,false);
 assert.equal(f.nodes.get('pineStartupProgress').hidden,true);
 await f.api.rendered();assert.equal(f.nodes.get('pineStartupCover').hidden,false,'late callbacks cannot remove the failure');
 f.events.get('pineStartupRetry:click')();f.events.get('pineStartupEditor:click')();
 assert.deepEqual(f.log,['reload','https://example.test/world-editor.html?startup-editor=1&test=1']);
});
test('hidden pages never time out before their first frame; failures prevent delayed init from running',async()=>{
 const f=fixture({hidden:true});let called=false;
 const start=f.api.start(()=>{called=true});assert.equal(f.timers.size,0);
 f.document.hidden=false;f.events.get('doc:visibilitychange')();assert.equal(f.timers.size,1);
 [...f.timers.values()][0]();await f.step();await f.step();await start;
 assert.equal(called,false);assert.equal(f.nodes.get('pineStartupCover').dataset.state,'failed');
});
test('HTML signals only a real rendered scene and safe-editor start suppresses existing automatic writes',()=>{
 assert(h.indexOf('id="pineStartupCover"')<h.indexOf('id="app"'),'pre-application cover markup');
 assert.match(h,/\(sceneMesh\?\.count>0\|\|sceneMesh\?\.ground\?\.count>0\)&&\s*canvas\.clientWidth>0&&canvas\.clientHeight>0&&p\.vp\.every\(Number\.isFinite\)&&!gl\.isContextLost\(\)\)\{\s*poiGameResetSync\(\);\s*window\.pineStartup\.rendered\(/);
 assert.match(h,/const facilityReturn=startupEditor\|\|/);
 assert.match(h,/if\(startupEditor\|\|!workshopResumePermitted/);
 assert.match(h,/workshopResumeWrite\(undefined,startupEditor\|\|facilityParams/);
 assert.match(h,/if\(!startupEditor&&poiGameResetPending\(localStorage\)\)/);
});
test('startup never shows the editor entry label on an unpainted Game World footer',()=>{
 assert.match(h,/<div id="app" inert>/);
 assert.match(h,/#app\[inert\]\s*\{[^}]*opacity:0!important[^}]*pointer-events:none!important/);
 assert.match(h,/#app\[inert\] dialog\s*\{visibility:hidden!important/);
 assert.match(h,/#pineStartupCover\s*\{[^}]*background:#08141a/);
 assert.match(h,/!gl\.isContextLost\(\)\)\{\s*poiGameResetSync\(\);\s*window\.pineStartup\.rendered\(\)/);
 const sync=h.match(/function poiGameResetSync\(\)\{[^\n]*\n[^\n]*\n[^\n]*\n\}/)?.[0];
 assert.ok(sync);
 const button={textContent:'ゲーム世界へ'},c=vm.createContext({facilitySite:{id:'base'},poiWalkActive:true,$:()=>button});
 vm.runInContext(sync,c);c.poiGameResetSync();assert.equal(button.textContent,'初期化');
 c.poiWalkActive=false;c.poiGameResetSync();assert.equal(button.textContent,'ゲーム世界へ');
});

