const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),{test}=require('node:test');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const java=fs.readFileSync(process.env.MAIN_ACTIVITY||'app/src/main/java/jp/tsukacchi/htmlplayer/MainActivity.java','utf8');
test('render does not tick while the current Activity is backgrounded, despite extra animation frames',()=>{
 const a=h.indexOf('function render(){'),b=h.indexOf(' if(poiScreenNoteFrozen())',a);
 const called=[];
 const c={window:{pineStartup:{}},requestAnimationFrame:()=>called.push('queued'),poiGameFrozen:()=>true,poiGameDeferred:new Set(),poiScreenNoteFrozen:()=>{called.push('passed guard');return true}};
 vm.runInNewContext(h.slice(a,b)+'\n if(poiScreenNoteFrozen())return;\n}\nrender();',c);
 assert(!called.includes('passed guard'),'no game frame proceeds during background');
});
test('the existing live Activity cannot reload HTML from onResume or updater callback',()=>{
 const a=java.indexOf('void onResume()'),b=java.indexOf('private void createWeb()',a);
 assert(!java.slice(a,b).includes('.loadUrl('),'same Activity onResume must keep its WebView document');
 const i=java.indexOf('private void checkForUpdate()');
 assert(!java.slice(i).includes('activatePending()'),'a pending download must not replace the live page');
});
