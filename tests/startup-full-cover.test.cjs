const {test}=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm');
const html=fs.readFileSync(process.argv[2]||'world-editor.html','utf8');
function setup(){
 const elements=new Map(), callbacks=[], events={};
 const element=id=>{if(!elements.has(id))elements.set(id,{hidden:false,inert:true,value:0,dataset:{state:'loading'},setAttribute(){},addEventListener(n,cb){events[id+':'+n]=cb}});return elements.get(id)};
 const document={getElementById:element,addEventListener(){},hidden:false};
 const window={addEventListener(n,cb){events[n]=cb}};
 const context={document,window,requestAnimationFrame(cb){callbacks.push(cb)},setTimeout(cb){events.timeout=cb;return 1},clearTimeout(){delete events.timeout},console:{error(){}}};
 vm.runInNewContext(html.match(/\/\/ BEGIN PINE STARTUP COVER[\s\S]+?\/\/ END PINE STARTUP COVER/)[0],context);
 const frame=async()=>{for(const cb of callbacks.splice(0))cb();await Promise.resolve();await Promise.resolve()};
 return {startup:window.pineStartup,cover:element('pineStartupCover'),bar:element('pineStartupProgress'),app:element('app'),actions:element('pineStartupActions'),events,frame};
}
test('opacity guard exists before app is parsed, without collapsing its canvas layout',()=>{
 const css=html.slice(0,html.indexOf('<div id="app"'));
 assert.match(css,/#app\[inert\]\s*\{[^}]*opacity:0!important/);
 assert.match(css,/#pineStartupCover\s*\{[^}]*background:#08141a/);
 assert.match(css,/<progress id="pineStartupProgress"[^>]*max="4"[^>]*value="0"/);
 assert.match(html,/<div id="app" inert>/);
});
test('real milestones hold the game behind cover until init and painted frame',async()=>{
 const {startup,cover,bar,app,frame}=setup();
 let continueInit;
 startup.start(async()=>{
  await startup.checkpoint(2,'地図を準備中…');
  await startup.checkpoint(3,'最初の画面を描画中…');
  await new Promise(resolve=>continueInit=resolve);
 });
 await frame(); await frame(); assert.equal(bar.value,1); assert.equal(app.inert,true);
 await frame(); await frame(); assert.equal(bar.value,2);
 await frame(); await frame(); assert.equal(bar.value,3);
 await frame(); await frame();
 startup.rendered(); assert.equal(bar.value,4); assert.equal(cover.hidden,false);
 await frame(); await frame(); assert.equal(cover.hidden,false);
 continueInit(); await frame(); assert.equal(cover.hidden,true); assert.equal(app.inert,false);
});
test('timeout keeps game hidden and does not permit subsequent reveal',async()=>{
 const {startup,cover,app,actions,events,frame}=setup();
 startup.start(()=>{}); events.timeout(); startup.rendered();
 await frame(); await frame();
 assert.equal(cover.dataset.state,'failed'); assert.equal(cover.hidden,false);
 assert.equal(app.inert,true); assert.equal(actions.hidden,false);
});
