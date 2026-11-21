const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||path.join(__dirname,'../world-editor.html'),'utf8');
test('play UI has a rectangle for location/stars and only one real HP slot in four equal places, anchored above unchanged controls',()=>{
 assert.match(html,/<aside id="poiMiniHud" hidden[\s\S]*?<canvas id="poiMiniMap" width="144" height="144"[\s\S]*?<div id="poiLocationPanel">[\s\S]*?id="poiLocationName"[\s\S]*?id="poiLocationStars"[\s\S]*?<\/aside>/);
 assert.match(html,/<div id="poiWalkPad">\s*<section id="poiPartyHud" hidden[\s\S]*?data-party-slot="0"[\s\S]*?プレイヤー[\s\S]*?<progress id="poiPlayerHp"[\s\S]*?<\/section>\s*<div id="poiHotbar"/);
 assert.equal((html.match(/data-party-slot="/g)||[]).length,1);
 assert.match(html,/#poiPartyHud\s*\{[^}]*bottom:calc\(100% \+ var\(--poi-hud-gap\) \* 2 \+ var\(--poi-hotbar-size\)\)[^}]*grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
 assert.match(html,/#poiMiniHud,#poiPartyHud\s*\{[^}]*pointer-events:none/);
 assert.match(html,/#viewWrap:has\(#pineAIMode:not\(\[hidden\]\)\) #poiPartyHud/);
 assert.doesNotMatch(html,/id="poiCombatHud"|攻撃力 '\+POI_PLAYER_ATTACK/);
});
test('HP progress reflects the live player and is hidden outside play without changing gameplay state',()=>{
 const ui={poiPartyHud:{},poiPlayerHp:{}};
 const x=vm.createContext({$:key=>ui[key]||null,poiWalkActive:false,poiPlayerHP:100,POI_PLAYER_MAX_HP:100});
 const a=html.indexOf('function poiCombatHud('),b=html.indexOf('function poiDamageNumber(',a);
 const run=s=>vm.runInContext(s,x);
 run(html.slice(a,b)+';poiCombatHud()');assert.equal(ui.poiPartyHud.hidden,true);
 run('poiWalkActive=true;poiPlayerHP=42;poiCombatHud()');
 assert.equal(ui.poiPartyHud.hidden,false);assert.equal(ui.poiPlayerHp.value,42);assert.equal(ui.poiPlayerHp.max,100);
 run('poiWalkActive=false;poiCombatHud()');assert.equal(ui.poiPartyHud.hidden,true);
});
