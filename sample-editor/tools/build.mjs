import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const names = [
  '01-renderer.js',
  '02-scene-registry.js',
  '02-yanaka-town.js',
  '02-store-products.js',
  '02-convenience.js',
  '03-math.js',
  '04-camera-gestures.js',
  '05-audio.js',
  '06-joystick.js',
  '07-scene-editor.js',
  '07-shots.js',
  '07-collision.js',
  '07-camera-collision.js',
  '07-character.js',
  '07-npcs.js',
  '08-game-loop.js',
];
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const source = names.map((name) => read('src/' + name)).join('');
const template = read('src/page.template.html');
const marker = '@@GAME_JS@@';
if (template.split(marker).length !== 2) {
  throw new Error('Expected exactly one script insertion point');
}
new Script(source, { filename: 'sample-editor/game.js' });
const output = template.replace(marker, source);
const label = output.match(/id="v">v(\d+)<\/div>/);
if (!label) throw new Error('Missing visible v number');
const gradle = read('app/build.gradle');
const versionName = gradle.match(/versionName\s+'(\d+)'/);
if (!versionName || versionName[1] !== label[1]) {
  throw new Error('UI v and Android versionName must agree');
}
const outputFile = path.join(root, 'index.html');
if (process.argv.includes('--check')) {
  if (fs.readFileSync(outputFile, 'utf8') !== output) {
    throw new Error('index.html is stale. Run: node sample-editor/tools/build.mjs');
  }
  console.log('OK: JavaScript parses; distribution matches sources; version v' + label[1]);
} else {
  fs.writeFileSync(outputFile, output);
  console.log('Built sample-editor/index.html (v' + label[1] + ')');
}
