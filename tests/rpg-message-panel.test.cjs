const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function snippet(start,end){
 const a=html.indexOf(start),b=html.indexOf(end,a+1);
 assert(a>=0&&b>a,'missing '+start);
 return html.slice(a,b);
}
function fixture(){
 const host={hidden:true,lines:[],append(line){this.lines.push(line)}};
 const document={createElement:()=>({dataset:{},setAttribute(){},remove(){host.lines=host.lines.filter(l=>l!==this)}})};
 const c=vm.createContext({$:id=>id==='poiMessagePanel'?host:null,document,poiWalkActive:true,pineAIActive:false});
 vm.runInContext(snippet('const POI_MESSAGE_LIFETIME=','function poiCombatHud('),c);
 return {c,host};
}
test('recent RPG messages keep two cues at most, expire, and never carry over to editor or AI',()=>{
 const {c,host}=fixture();
 c.poiMessagePush('3G拾った！','gold',500);assert.equal(host.hidden,false);
 assert.equal(host.lines[0].textContent,'3G拾った！');
 c.poiMessagePush('3G拾った！','gold',600);
 assert.equal(host.lines.length,2,'two confirmed pickups must not be collapsed');
 c.poiMessagePush('受付：こんにちは。','dialogue',800);
 c.poiMessagePush('受付：こんにちは。','dialogue',900);
 assert.deepEqual(host.lines.map(l=>l.textContent),['3G拾った！','受付：こんにちは。']);
 c.poiMessageUpdate(5600);assert.equal(host.lines.length,1);
 c.poiMessageUpdate(5800);assert.equal(host.hidden,true);
 for(const state of ['pineAIActive','poiWalkActive']){
  c.poiMessagePush('薬草を拾った！','item',6000);
  c[state]=!c[state];c.poiMessageUpdate(6010);c.poiMessagePush('無視','item',6020);
  assert.equal(host.hidden,true);assert.equal(host.lines.length,0);
  c[state]=!c[state];c.poiMessageUpdate(6030);assert.equal(host.hidden,true);
 }
});
test('successful coin pickup reports exact G and failed save adds no message',()=>{
 const {c,host}=fixture();
 Object.assign(c,{poiEconomyAllowed:()=>true,poiEconomyDrops:new Map([['3,8',{amount:3}]]),
  poiEconomyCaches:new Map(),poiHotbarRead:()=>({gold:2}),POI_ECONOMY_GOLD_MAX:100,
  poiEconomyWrite:()=>false,poiEconomyRefresh(){},poiSound(){},toast(){},performance:{now:()=>0}});
 vm.runInContext(snippet('function poiEconomyCollect(','function poiEconomySnapshot('),c);
 assert.equal(c.poiEconomyCollect(3,8),false);assert.equal(host.lines.length,0);
 c.poiEconomyWrite=()=>true;
 assert.equal(c.poiEconomyCollect(3,8),true);assert.equal(host.lines[0].textContent,'3G拾った！');
});
test('panel is anchored to party grid without moving adjacent controls or replacing the dialogue bubble',()=>{
 assert.match(html,/<section id="poiPartyHud"[^>]+>[\s\S]*?<div id="poiMessagePanel" role="log"[^>]* hidden/);
 assert.match(html,/#poiMessagePanel\{[^}]*bottom:calc\(100% \+ var\(--poi-hud-gap\)\)[^}]*pointer-events:none[^}]*background:var\(--workshop-panel-surface\)/);
 assert(snippet('function poiInventoryPickup(','function poiInventoryDraw(').includes('poiMessagePush'));
 const dialogue=snippet('function poiTownDialogueAction(','function poiTownDialogueDraw(');
 assert(dialogue.includes('poiMessagePush'));assert(dialogue.includes('poiTownDialogueElement'));
});
test('the overhead resident bubble and tail share the panel tint without fading text',()=>{
 assert.match(html,/#poiTownSpeech\{[^}]*color:#fff8e7;[^}]*background:var\(--workshop-panel-surface\)/);
 assert.match(html,/#poiTownSpeech::after\{[^}]*border-top-color:var\(--workshop-panel-surface\)/);
 assert.doesNotMatch(html,/#poiTownSpeech\{[^}]*\bopacity:/);
});
