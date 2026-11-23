const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {test}=require('node:test');
const vm=require('node:vm');
const h=readFileSync(process.argv[2]||'world-editor.html','utf8');
test('clean HUD only activates inside rotating touch play and keeps old portrait editor controls',()=>{
 assert.ok(h.includes('id="poiLandscapeMenuToggle"'));
 const a=h.indexOf('/* Full-bleed landscape play HUD */'),b=h.indexOf('</style>',a);
 assert.ok(a>=0&&b>a);
 const css=h.slice(a,b);
 assert.match(css,/@media \(orientation: landscape\) and \(pointer: coarse\) and \(min-width: 520px\)/);
 assert.match(css,/has\(#viewWrap\[data-analog-play\]\)[^{]*\{[^}]*grid-template-rows:minmax\(0,1fr\)!important[^}]*padding:0!important/);
 assert.ok(css.includes('#app:not(.gameWorldMode):has(#viewWrap[data-analog-play]),')&&
  css.includes('#app.gameWorldMode:has(#viewWrap[data-analog-play]){'),'app grid must tie or outrank earlier mode-specific CSS');
 assert.match(css,/> :is\(header,#mobileTabs,footer,#palette,#inspector\)\{display:none!important\}/);
 assert.match(css,/#poiWalkAction\{[^}]*width:76px[^}]*height:66px/);
 assert.ok(h.includes('id="undo"')&&h.includes('id="redo"')&&h.includes('id="poiWalkToggle"')&&h.includes('id="pineAIPlayView"'));
});
test('landscape menu reuses existing view, sound and confirmation routes; reset cannot bypass confirm',()=>{
 const a=h.indexOf('// BEGIN LANDSCAPE MENU'),b=h.indexOf('// END LANDSCAPE MENU',a);
 assert.ok(a>=0&&b>a);
 const calls=[],listeners={},toggle={hidden:true,setAttribute(k,v){this[k]=v},focus(){calls.push('focus')},addEventListener(k,fn){listeners.toggle=fn}};
 const panel={hidden:true,addEventListener(k,fn){listeners.panel=fn}};
 const sound={hidden:true},nodes={poiLandscapeMenuToggle:toggle,poiLandscapeMenu:panel,poiSoundPanel:sound,
  poiLandscapeVersion:{},poiLandscapeVolume:{setAttribute(k,v){this[k]=v}},
  app:{querySelector(){return {textContent:'3Dワールド工房（v215）'}}},
  poiThirdView:{click(){calls.push('view')}},poiSoundSettingsToggle:{click(){sound.hidden=!sound.hidden;calls.push('volume')}}};
 const ctx=vm.createContext({$:k=>nodes[k], poiStopRepeat(){calls.push('stop')}, poiGameResetOpen(){calls.push('confirm')},
  document:{addEventListener(){}},poiShopIsOpen:()=>false});
 vm.runInContext(h.slice(a,b)+';this.sync=poiLandscapeMenuSync;',ctx);
 assert.equal(nodes.poiLandscapeVersion.textContent,'v215');
 ctx.sync(true);
 assert.equal(toggle.hidden,false);listeners.toggle();assert.equal(panel.hidden,false);
 for(const key of ['view','volume','reset']){
  if(panel.hidden)listeners.toggle();
  listeners.panel({target:{closest:()=>({dataset:{landscapeAction:key},disabled:false})}});
 }
 assert.deepEqual(calls.filter(a=>['view','volume','confirm'].includes(a)),['view','volume','volume','confirm']);
 assert.equal(panel.hidden,true);ctx.sync(false);
 assert.equal(toggle.hidden,true);assert.equal(toggle['aria-expanded'],'false');
});
