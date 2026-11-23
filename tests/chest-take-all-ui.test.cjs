const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
test('chest header has a native, unambiguous action immediately before Close',()=>{
 const header=html.match(/<div class="poiChestHeader"><div id="poiChestHeading">([^\n]+)<\/div>/)?.[1];
 assert.match(header,/<button id="poiChestTakeAll" type="button">全てインベントリへ入れる<\/button>\s*<button id="poiChestClose"/);
 assert.match(html,/#poiChestTakeAll\{[^}]*margin-left:auto[^}]*height:25px[^}]*white-space:nowrap/);
 assert.equal((html.match(/id="poiChestTakeAll"/g)||[]).length,1);
});
test('button delegates once while chest is reachable and leaves it open; closed/dragging clicks are inert',()=>{
 const listeners=new Map(),seen=[];
 const c=vm.createContext({
  drag:null,reachable:true,$:id=>({addEventListener:(event,action)=>listeners.set(id+':'+event,action)}),
  poiChestCloseFromUi:()=>seen.push('close'),poiChestIsOpen:()=>c.reachable,
  poiStorageTapGate:{cancel:()=>seen.push('clear pending detail')},
  poiBagSelectSource:value=>seen.push(value),
  poiChestTakeAll:()=>seen.push('transaction')
 });
 const lines=html.match(/ \$\('poiChestTakeAll'\)\?\.addEventListener\('click',\(\)=>\{[\s\S]*?\n \}\);/)?.[0];
 assert(lines,'wired in the existing inventory listener block');
 vm.runInContext(lines,c);
 const click=listeners.get('poiChestTakeAll:click');
 c.reachable=false;click();assert.deepEqual(seen,[]);
 c.reachable=true;c.drag={};click();assert.deepEqual(seen,[]);
 c.drag=null;click();assert.deepEqual(seen,['clear pending detail',null,'transaction']);
});
