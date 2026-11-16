#!/usr/bin/env node
// Static regression checks for the split PINE source; no external packages.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,join} from 'node:path';
import {bundle,run} from './build.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const game=bundle({
 directory:'src/game',output:'forest-game-prototype.html',
 sections:['01-runtime.js','02-palette.js','03-geometry.js','04-scene.js',
 '05-editor-ui.js','06-editor-data-and-demos.js','07-island-migration.js',
 '08-island-zones.js','09-military-expansion.js','10-seamless-world.js',
 '11-zone-geometry.js','12-collision-and-interiors.js','13-player-loop.js',
 '14-game-entry.js']
});
const editor=bundle({
 directory:'src/editor',output:'world-editor.html',
 sections:['01-runtime.js','02-palette.js','03-geometry.js',
 '04-scene.js','05-ui-and-render.js','06-data-and-demos.js']
});
run(true);
function required(s,terms,label){for(const term of terms)assert.ok(s.includes(term),label+': missing '+term)}
required(game,[
 'function pineExtendWorld(){','function pineChunkWindow(){',
 'function pineBoatAction(){','function pineAddHarbors(props){',
 'function gameBridgeCanStep(','function bridgeSpanElevation(',
 'function gameRestoreProgress(){','function gameRebuildBlock(){',
 'function gamePersistProgress(','PINE · v3.2'
],'game');
required(editor,['function makePineHarborDemo(){','PINE・港湾と船着場'],'editor');
assert.ok(!game.includes('function pineTravel('),'Map swapping must remain removed');
assert.ok(!game.includes('function pineMakeMainland('),'Separate mainland world must remain removed');
assert.ok(!game.includes('[[73,66,93],[41,82,92]]'),'Old unrealistic piers must remain removed');
const harborNames=['pineHarborPier','pineHarborQuay','pineHarborBollard',
 'pineHarborFender','pineHarborLamp','pineHarborPallet','pineHarborSign'];
for(const id of harborNames){
 assert.ok(game.includes("id:'"+id+"'"),'Missing game block '+id);
 assert.ok(editor.includes("id:'"+id+"'"),'Missing editor block '+id);
}
function commonGeometry(s){
 const start=s.indexOf('function pineHarborGeometry(m,o){');
 const end=s.indexOf('function bridgeConnectedGeometry(',start);
 assert.ok(start>=0&&end>start,'Shared harbor geometry missing');
 return s.slice(start,end);
}
assert.equal(commonGeometry(game),commonGeometry(editor),
 'Harbor block 3D geometry diverged between game and editor');
assert.ok(readFileSync(join(root,'PINE_WORLD_RULES.md'),'utf8').includes('マップ切り替えは禁止'));
process.stdout.write('PINE source & core regression checks: PASS\n');
