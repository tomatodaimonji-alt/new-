const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const modes=['place','erase','rotate','select','relocate','duplicate','pick'];
test('the cursor mesh paints only in editor and play with an explicit editing tool',()=>{
 const start=html.indexOf('function pineDrawEditCursor('),end=html.indexOf('function makeCursor(',start);
 assert(start>=0&&end>start,'render gate for the yellow edit cursor');
 const draws=[],mesh={},vp={};
 const scope=vm.createContext({draw:(...args)=>draws.push(args),cursorMesh:mesh,vp});
 vm.runInContext(html.slice(start,end),scope);
 for(const play of [false,true])for(const game of [false,true])for(const mode of [...modes,'move','idle']){
  scope.poiWalkActive=play;scope.pineGameActive=game;scope.mode=mode;draws.length=0;
  scope.pineDrawEditCursor(vp);
  const expected=!play||(!game&&modes.includes(mode));
  assert.equal(draws.length,Number(expected),JSON.stringify({play,game,mode}));
  if(expected)assert.deepEqual(draws[0],[mesh,vp]);
 }
 assert.match(html,/drawSignOverlays\(p.vp,daylight\);pineDrawEditCursor\(p.vp\);/,'frame must use the scoped gate');
});
test('intentional check overlays and normal tap actions remain separate',()=>{
 assert.match(html,/pineDrawChecks\(p.vp\)/);
 assert.match(html,/if\(pineCheckMode\)pineToggleCheck\(pos.x,pos.z\);else changeCell\(pos.x,pos.z\)/);
});
