const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function snippet(start,end){
 const a=html.indexOf(start),b=html.indexOf(end,a+1);
 assert(a>=0&&b>a,'missing '+start);
 return html.slice(a,b);
}
function fixture(){
 const host={hidden:true,lines:[],append(line){this.lines.push(line)}};
 const heading={textContent:'アナウンス'};
 const document={createElement:()=>({dataset:{},setAttribute(){},remove(){host.lines=host.lines.filter(l=>l!==this)}})};
 const c=vm.createContext({$:id=>(id==='poiMessagePanel'||id==='poiMessageLog')?host:id==='poiMessageHeading'?heading:null,document,poiWalkActive:true,pineAIActive:false});
 vm.runInContext(snippet('const POI_MESSAGE_LIFETIME=','function poiCombatHud('),c);
 return {c,host,heading};
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
 assert.match(html,/<section id="poiPartyHud"[^>]+>[\s\S]*?<div id="poiMessagePanel" hidden/);
 assert.match(html,/#poiMessageStack\{[^}]*bottom:calc\(100% \+ var\(--poi-hud-gap\)\)[^}]*pointer-events:none[^}]*\}\s*#poiMessagePanel\{[^}]*background:var\(--workshop-panel-surface\)/);
 assert(snippet('function poiInventoryPickup(','function poiInventoryDraw(').includes('poiMessagePush'));
 const dialogue=snippet('function poiNpcMenuRender(','function poiNpcMenuStep(');
 assert(dialogue.includes('poiMessageSpeak'));
 assert(snippet('function poiTownDialogueDraw(','// END TOWN DIALOGUE').includes('poiTownDialogueElement'));
});
test('the overhead resident bubble and tail share the panel tint without fading text',()=>{
 assert.match(html,/#poiTownSpeech\{[^}]*color:#fff8e7;[^}]*background:var\(--workshop-panel-surface\)/);
 assert.match(html,/#poiTownSpeech::after\{[^}]*border-top-color:var\(--workshop-panel-surface\)/);
 assert.doesNotMatch(html,/#poiTownSpeech\{[^}]*\bopacity:/);
});
test('announcement names the defeated monster and does not duplicate the working log as a toast',()=>{
 const {c,host}=fixture(),toasts=[];
 Object.assign(c,{byId:t=>({name:t==='monsterSlime'?'スライム':'ゴブリン'}),toast:s=>toasts.push(s)});
 assert.equal(typeof c.poiAnnounceDefeat,'function');
 c.poiAnnounceDefeat('monsterSlime',400);assert.deepEqual(host.lines.map(l=>l.textContent),['スライムを倒した']);
 assert.deepEqual(toasts,[]);
 c.poiWalkActive=false;c.poiAnnounceDefeat('monsterGoblin',500);
 assert.deepEqual(toasts,['ゴブリンを倒した']);
 const attack=snippet('function poiWalkAction(){','function poiWalkReset(');
 assert.match(attack,/if\(!state\.hp\)\{[\s\S]*?poiAnnounceDefeat\(obj\.type,now\)/);
});
test('announcement heading is outside its live log and the 2.3 height ratio is preserved',()=>{
 assert.match(html,/<div id="poiMessagePanel" hidden><div id="poiMessageHeading">アナウンス<\/div><div id="poiMessageLog" role="log" aria-labelledby="poiMessageHeading"/);
 assert.match(html,/#poiMessageStack\{[^}]*height:230%/);
});

test('newest announcement uses two lines while history yields space',()=>{
 assert.match(html,/\.poiMessageLine\{[^}]*-webkit-line-clamp:1/);
 assert.match(html,/\.poiMessageLine:last-child\{-webkit-line-clamp:2/);
});
test('player speech owns the heading and body; pending notices return without resetting their time',()=>{
 const {c,host,heading}=fixture();
 c.poiMessagePush('3G拾った！','gold',500);
 assert.equal(c.poiMessageSpeak('厩舎番','馬は落ち着いてる。',1000),true);
 assert.equal(heading.textContent,'厩舎番');
 assert.deepEqual(host.lines.filter(l=>!l.hidden).map(l=>l.textContent),['馬は落ち着いてる。']);
 c.poiMessagePush('スライムを倒した','defeat',1600);
 assert.equal(heading.textContent,'厩舎番');
 assert.deepEqual(host.lines.filter(l=>!l.hidden).map(l=>l.textContent),['馬は落ち着いてる。']);
 c.poiMessageEndSpeech(5700);
 assert.equal(heading.textContent,'アナウンス');
 assert.deepEqual(host.lines.filter(l=>!l.hidden).map(l=>l.textContent),['スライムを倒した']);
 c.poiMessageUpdate(6600);assert.equal(host.hidden,true);
});
test('Play mini messages use the announcement log, but editor and blocking dialog messages are left alone',()=>{
 const {c,host}=fixture(),legacy=[];
 const out={textContent:'',classList:{add:v=>legacy.push('add:'+v),remove:v=>legacy.push('remove:'+v)}};
 Object.assign(c,{performance:{now:()=>150},toastEl:out,clearTimeout(){},setTimeout(){},poiRouteMiniMessage:null});
 c.poiRouteMiniMessage=c.poiMessageRouteMini;
 vm.runInContext(snippet('function toast(message)','if(!gl)'),c);
 c.toast('HPは満タンです。');assert.equal(host.lines[0]?.textContent,'HPは満タンです。');assert.equal(out.textContent,'');
 c.pineAIActive=true;c.toast('AI編集');assert.equal(out.textContent,'AI編集');
 c.pineAIActive=false;c.poiWalkActive=false;c.toast('編集しました');assert.equal(out.textContent,'編集しました');
 c.poiWalkActive=true;c.document.querySelector=()=>({});c.toast('必須のエラー');assert.equal(out.textContent,'必須のエラー');
});
test('dialogue choices occupy a separate glass panel just above the ordinary speech card',()=>{
 assert.match(html,/<div id="poiMessageStack">\s*<div id="poiMessagePanel" hidden>[^\n]*<\/div><\/div>\s*<div id="poiNpcMenu"/);
 assert.doesNotMatch(html,/#poiMessagePanel\[data-npc-menu\]/);
 assert.match(html,/#poiNpcMenu\{[^}]*bottom:calc\(100% \+ var\(--poi-hud-gap\)\)[^}]*left:0[^}]*background:var\(--workshop-panel-surface\)/);
});
test('short space below mini HUD uses paired options without overlapping it',()=>{
 const css=html.match(/#poiNpcMenu\[data-compact\]\{([^}]+)\}/)?.[1];
 assert.match(css||'',/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 const target={setAttribute(){},removeAttribute(){},getBoundingClientRect:()=>({top:215,bottom:243})};
 const attrs={},menu={children:[target],hidden:false,toggleAttribute:(k,v)=>attrs[k]=v,
  style:{setProperty:(_k,v)=>attrs.room=v},getBoundingClientRect:()=>({left:8,right:216,width:208,top:215,bottom:247})};
 const stage={getBoundingClientRect:()=>({top:50})},mini={getBoundingClientRect:()=>({left:5,right:106,bottom:204})};
 const c={poiTownDialogue:{index:0},$:k=>({poiNpcMenu:menu,viewWrap:stage,poiMiniHud:mini}[k])};
 vm.runInNewContext(snippet('function poiNpcMenuMark(','function poiNpcMenuRender('),c);
 c.poiNpcMenuMark();
 assert.deepEqual(attrs,{'data-compact':true,room:'40px'});
});
test('last choice scrolls into the independent menu instead of moving the speech card',()=>{
 const row={setAttribute(){},removeAttribute(){},getBoundingClientRect:()=>({top:279,bottom:307})};
 const menu={children:[row,row,row],hidden:false,scrollTop:0,getBoundingClientRect:()=>({top:209,bottom:247})};
 const c={poiTownDialogue:{index:2},$:k=>k==='poiNpcMenu'?menu:null};
 vm.runInNewContext(snippet('function poiNpcMenuMark(','function poiNpcMenuRender('),c);
 c.poiNpcMenuMark();assert.equal(menu.scrollTop,63);
});
