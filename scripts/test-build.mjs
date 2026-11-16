#!/usr/bin/env node
// Static regression checks for the split PINE source; no external packages.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,join} from 'node:path';
import {bundle,run,groups} from './build.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const game=bundle(groups.game);
const editor=bundle(groups.editor);
run(true);
function required(s,terms,label){for(const term of terms)assert.ok(s.includes(term),label+': missing '+term)}
required(game,[
 'function pineExtendWorld(){','function pineChunkWindow(){',
 'function pineBoatAction(){','function pineAddHarbors(props){',
 'function gameBridgeCanStep(','function bridgeSpanElevation(',
 'function gameRestoreProgress(){','function gameRebuildBlock(){',
 'function gamePersistProgress(','PINE · v3.3'
],'game');
required(editor,['function makePineHarborDemo(){','PINE・港湾と船着場'],'editor');
assert.ok(!game.includes('function pineTravel('),'Map swapping must remain removed');
assert.ok(!game.includes('function pineMakeMainland('),'Separate mainland world must remain removed');
assert.ok(!game.includes('[[73,66,93],[41,82,92]]'),'Old unrealistic piers must remain removed');
// Verify the entire block catalog and harbor geometry come from shared sources.
const sharedCatalog=readFileSync(join(root,'src/shared/block-catalog.fragment.js'),'utf8').trimEnd();
const sharedPalette=readFileSync(join(root,'src/shared/harbor-palette.fragment.js'),'utf8').trimEnd();
const sharedGeometry=readFileSync(join(root,'src/shared/harbor-geometry.fragment.js'),'utf8').trimEnd();
assert.equal(sharedCatalog.split('/*__PINE_SHARED_HARBOR_PALETTE__*/').length-1,1,
 'Shared block catalog must reference harbor palette exactly once');
for(const g of Object.values(groups)){
 const rawPalette=readFileSync(join(root,g.directory,'02-palette.js'),'utf8');
 const rawGeometry=readFileSync(join(root,g.directory,'03-geometry.js'),'utf8');
 assert.equal(rawPalette.split('/*__PINE_SHARED_BLOCK_CATALOG__*/').length-1,1,
  g.output+' must reference one shared block catalog');
 assert.equal(rawGeometry.split('/*__PINE_SHARED_HARBOR_GEOMETRY__*/').length-1,1,
  g.output+' must reference one shared harbor 3D geometry');
 assert.ok(!rawPalette.includes("id:'bridgeStone'"),g.output+' copied the shared catalog');
 assert.ok(!rawGeometry.includes('function pineHarborGeometry('),g.output+' duplicated harbor geometry');
}
for(const output of [game,editor]){
 assert.ok(output.includes(sharedPalette),'Built HTML missing shared harbor entries');
 assert.ok(output.includes(sharedGeometry),'Built HTML missing shared harbor geometry');
 assert.ok(!output.includes('__PINE_SHARED_'),'Unresolved shared source marker');
}
// Shared architectural meshes must be defined in one source and embedded once.
const sharedArchitecture=[
 ['/*__PINE_SHARED_ROOF_GEOMETRY__*/','src/shared/roof-geometry.fragment.js','function connectedRoofGeometry('],
 ['/*__PINE_SHARED_WALL_FACADE__*/','src/shared/wall-facade.fragment.js','function houseFacadeDetails('],
 ['/*__PINE_SHARED_BRIDGE_TYPES__*/','src/shared/bridge-types.fragment.js','const BRIDGE_IDS='],
 ['/*__PINE_SHARED_FENCE_GEOMETRY__*/','src/shared/fence-geometry.fragment.js','function connectedFenceGeometry(']
];
for(const [marker,path,symbol] of sharedArchitecture){
 const content=readFileSync(join(root,path),'utf8');
 assert.ok(content.includes(symbol),path+' missing expected definition');
 for(const g of Object.values(groups)){
  const raw=readFileSync(join(root,g.directory,'03-geometry.js'),'utf8');
  assert.equal(raw.split(marker).length-1,1,g.output+' must reference exactly one '+path);
  assert.ok(!raw.includes(symbol),g.output+' still contains duplicated '+symbol);
 }
 for(const html of [game,editor]){
  assert.ok(html.includes(content),path+' is not embedded unchanged');
  assert.ok(!html.includes(marker),'Shared marker left unresolved: '+marker);
 }
}
// Important: bridge elevation/rendering differ intentionally; do not unify blindly.
const rawGameGeometry=readFileSync(join(root,'src/game/03-geometry.js'),'utf8');
const rawEditorGeometry=readFileSync(join(root,'src/editor/03-geometry.js'),'utf8');
assert.ok(rawGameGeometry.includes('const bridgeDeckLevels=new Map()'),'Game bridge height cache was lost');
assert.ok(!rawEditorGeometry.includes('const bridgeDeckLevels=new Map()'),'Editor unexpectedly inherited game bridge cache');
assert.ok(rawGameGeometry.includes('function bridgeSpanElevation('));
assert.ok(rawEditorGeometry.includes('function bridgeSpanElevation('));
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
// v3.3: validate the 18x8 landing craft, 20 standing slots and both berths.
const carrierSource=readFileSync(join(root,'src/shared/landing-craft-geometry.fragment.js'),'utf8');
const carrier=new Function(`
 const shapes=[],cube=(m,x,y,z,w,h,d)=>shapes.push({x,y,z,w,h,d});
 ${carrierSource}
 pineLandingCraftGeometry({},0,0);
 return {length:PINE_SHIP_LENGTH,beam:PINE_SHIP_BEAM,capacity:PINE_SHIP_CAPACITY,
  minY:Math.min(...shapes.map(v=>v.y)),
  maxY:Math.max(...shapes.map(v=>v.y+v.h)),
  minX:Math.min(...shapes.map(v=>v.x-v.w/2)),
  maxX:Math.max(...shapes.map(v=>v.x+v.w/2)),
  minZ:Math.min(...shapes.map(v=>v.z-v.d/2)),
  maxZ:Math.max(...shapes.map(v=>v.z+v.d/2)),
  primitives:shapes.length};
`)();
assert.equal(carrier.length,18);
assert.equal(carrier.beam,8);
assert.equal(carrier.capacity,20);
assert.ok(carrier.minY<=-2.9,'Three-cell submerged hull missing');
assert.ok(carrier.maxY>3,'Wheelhouse above freeboard missing');
assert.ok(carrier.minX<=-8.9&&carrier.maxX>=8.9,'Bow and stern incomplete');
assert.ok(carrier.minZ<-3.5&&carrier.maxZ>3.5,'Hull too narrow');
const boatRuntime=readFileSync(join(root,'src/game/10-seamless-world.js'),'utf8');
const slotLine=boatRuntime.split('\n').find(l=>l.includes('const pineTroopSlot=i=>'));
assert.ok(slotLine,'Troop deck slot table missing');
const slot=new Function(slotLine+' return pineTroopSlot;')();
const slots=Array.from({length:20},(_,i)=>slot(i));
assert.equal(new Set(slots.map(x=>x.join(','))).size,20,'Overlapping troop slots');
for(const [x,z] of slots)assert.ok(x>-4&&x<4&&z>-3&&z<3,'Troop outside usable deck');
const dockStart=boatRuntime.indexOf('function pineBoatDock(){');
const dockEnd=boatRuntime.indexOf('function pineBoatNearPier(){',dockStart);
assert.ok(dockStart>=0&&dockEnd>dockStart,'Docking logic missing');
const dockSource=boatRuntime.slice(dockStart,dockEnd);
const where=new Function('pineBoatX','pineBoatZ',
 'const PINE_ISLAND_BERTH=110.5,PINE_MAINLAND_BERTH=142.5,PINE_BERTH_Z=67.5;'
 +dockSource+'return pineBoatDock();');
assert.equal(where(110.5,67.5),'island');
assert.equal(where(142.5,67.5),'mainland');
assert.equal(where(125,67.5),null,'No open sea disembark');
assert.equal(where(142.5,70),null,'No off-quay disembark');
assert.ok(boatRuntime.includes('if(pineGangwayMesh&&pineBoatDock())'),
 'Boarding gangway only appears while docked');
assert.ok(game.includes('id="pineTroopButton"')&&game.includes("$('pineTroopButton').addEventListener"),
 'Troop boarding button is missing');
assert.ok(editor.includes('48×40・大型輸送艇と軍港'),'Editor lacks ship-scale sample');
assert.ok(editor.includes('pineLandingCraftGeometry(m,o.x+.5'),'Editor must share the ship mesh');
assert.ok(game.includes('troopCount:pineTroopCount,troopMode:pineTroopMode'),
 'Troop count must persist with save');
assert.ok(readFileSync(join(root,'PINE_WORLD_RULES.md'),'utf8').includes('マップ切り替えは禁止'));
process.stdout.write('PINE source & core regression checks: PASS\n');
