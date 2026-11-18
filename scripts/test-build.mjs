#!/usr/bin/env node
// Standalone World Workshop editor source integrity checks.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,join} from 'node:path';
import {bundle,run,groups} from './build.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const editor=bundle(groups.editor);
run(true);
for(const symbol of ['function pineSupermarketPOI(','function pineBuildPOICategories(){','id="poiWalkPad"','id="palette"','id="inspector"',"register.id='registerPOI'"]){
 assert.ok(editor.includes(symbol),'World Workshop missing '+symbol);
}
const sourceDir=join(root,'src/editor');
assert.ok(readFileSync(join(sourceDir,'02-palette.js'),'utf8').includes('/*__PINE_SHARED_BLOCK_CATALOG__*/'));
assert.ok(readFileSync(join(sourceDir,'03-geometry.js'),'utf8').includes('/*__PINE_SHARED_HARBOR_GEOMETRY__*/'));
assert.ok(!editor.includes('__PINE_SHARED_'),'Unresolved shared geometry marker');
assert.ok(editor.includes("expandableRow('地面タイル'"),'Ground tile category label missing');
assert.ok(editor.includes('height*.55+1.2)*.84'),'Map-fit margin missing');
assert.ok(editor.includes("['wholesale','スーパー',36,24,1"),'Single supermarket sample missing');
assert.ok(!editor.includes("['compact','小型スーパー'"),'Removed supermarket variant still visible');
process.stdout.write('World Workshop source checks: PASS\n');
