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
