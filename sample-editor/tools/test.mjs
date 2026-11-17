import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
execFileSync(process.execPath, [path.join(root, 'tools/build.mjs'), '--check'], { stdio: 'inherit' });
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const requirements = [
 ['landscape canvas', 'id="scene"'],
 ['visible version', 'id="v">v'],
 ['dynamic pad', 'beginFloatingPad('],
 ['camera rotation', 'cameraYaw-='],
 ['camera pitch', 'cameraPitch=clamp('],
 ['pinch', 'pinchDistance'],
 ['footsteps', 'footstep(running)'],
 ['ambient audio', 'function unlockAudio('],
 ['town collision', 'function blocked('],
 ['animation', 'requestAnimationFrame(frame)'],
 ['detailed player', 'function renderDetailedPlayer('],
 ['NPC scene records', 'const npcs='],
 ['NPC walking routes', 'function updateNPCs('],
 ['NPC shared character mesh', 'function renderNPCs('],
 ['NPC player collision', 'function npcBlocks('],
 ['jointed character limbs', 'function playerLimb('],
 ['foot stance swing', 'function footCycle('],
 ['contact shadow', 'function renderPlayerShadow('],
 ['shadow blend', 'gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA)'],
 ['shadow opacity reset', 'gl.uniform1f(locOpacity,1)'],
 ['leg IK', 'function solveWalkingKnee('],
 ['motion blend', 'characterMovementBlend'],
 ['character head', 'playerOval(headX,1.616'],
 ['POI registry', 'const scene='],
 ['independent shop records', 'function defaultShop('],
 ['building edit controls', 'function editShop('],
 ['saved scene edits', 'function saveSceneEdits('],
 ['scene edit UI', 'id="editPanel"'],
 ['camera shot registry', 'const shootState='],
 ['shot playback', 'function updateShots('],
 ['portrait preview', 'id="portraitGuide"'],
 ['frame crop', 'gl.scissor(viewX,0,viewWidth,h)'],
 ['shooting UI', 'id="shootPanel"'],
 ['convenience POI', "id:'convenience-study'"],
 ['independent fixtures', 'function renderStoreFixture('],
 ['original product catalog', 'const STORE_PRODUCTS='],
 ['cylindrical cans and bottles', 'function storeCylinder('],
 ['reusable SKU models', 'function renderOriginalProduct('],
 ['mixed shelf categories', 'function populateStoreShelf('],
 ['cold case goods', 'function populateColdCase('],
 ['store camera presets', 'const STORE_SHOT_PRESETS='],
 ['preset selector', 'function chooseStoreCamera('],
 ['preset buttons', 'data-shot="preset-exterior"'],
 ['walkable convenience entrance', 'function convenienceBlocked('],
 ['store render', 'for(const item of convenienceBuffers)'],
 ['store navigation', 'id="storeJump"'],
 ['camera segment collision', 'function cameraSegmentBox('],
 ['camera obstacle range', 'function cameraAllowedFactor('],
 ['smooth camera recovery', 'function resolveExplorationCamera('],
 ['no camera adjustment during shooting', 'shootState.enabled?idealEye:resolveExplorationCamera('],
];
for (const [name, token] of requirements) {
 if (!html.includes(token)) throw new Error('Missing feature: ' + name);
}
const workflow = fs.readFileSync(path.join(root, '../.github/workflows/build-sample-editor-apk.yml'), 'utf8');
const version = html.match(/id="v">v(\d+)<\/div>/)?.[1];
if (!workflow.includes('SampleEditor-v' + version + '-APK')) {
 throw new Error('Workflow artifact name differs from displayed version v' + version);
}
console.log('OK: sample-editor source and packaging smoke checks');
