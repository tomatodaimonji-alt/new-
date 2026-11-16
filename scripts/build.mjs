#!/usr/bin/env node
// PINE single-file offline builds. No npm dependencies, network, or dynamic imports.
// Usage: node scripts/build.mjs [--check]
// Source sections are fragments of one ordered IIFE, NOT standalone ES modules.
// Do not add an import/export or a script tag between the sections.
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join,resolve} from 'node:path';
import {Script} from 'node:vm';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const groups={
 game:{
  directory:'src/game',output:'forest-game-prototype.html',
  sections:[
   '01-runtime.js','02-palette.js','03-geometry.js','04-scene.js',
   '05-editor-ui.js','06-editor-data-and-demos.js','07-island-migration.js',
   '08-island-zones.js','09-military-expansion.js','10-seamless-world.js',
   '11-zone-geometry.js','12-collision-and-interiors.js','13-player-loop.js',
   '14-game-entry.js'
  ]
 },
 editor:{
  directory:'src/editor',output:'world-editor.html',
  sections:['01-runtime.js','02-palette.js','03-geometry.js',
   '04-scene.js','05-ui-and-render.js','06-data-and-demos.js']
 }
};
export function bundle(group){
 const d=join(root,group.directory);
 const pre=readFileSync(join(d,'shell-before-script.html'),'utf8');
 const shared={
  '/*__PINE_SHARED_ROOF_GEOMETRY__*/':readFileSync(join(root,'src/shared/roof-geometry.fragment.js'),'utf8'),
  '/*__PINE_SHARED_WALL_FACADE__*/':readFileSync(join(root,'src/shared/wall-facade.fragment.js'),'utf8'),
  '/*__PINE_SHARED_BRIDGE_TYPES__*/':readFileSync(join(root,'src/shared/bridge-types.fragment.js'),'utf8'),
  '/*__PINE_SHARED_FENCE_GEOMETRY__*/':readFileSync(join(root,'src/shared/fence-geometry.fragment.js'),'utf8'),
  '/*__PINE_SHARED_BLOCK_CATALOG__*/':readFileSync(join(root,'src/shared/block-catalog.fragment.js'),'utf8').trimEnd(),
  '/*__PINE_SHARED_HARBOR_PALETTE__*/':readFileSync(join(root,'src/shared/harbor-palette.fragment.js'),'utf8').trimEnd(),
  '/*__PINE_SHARED_HARBOR_GEOMETRY__*/':readFileSync(join(root,'src/shared/harbor-geometry.fragment.js'),'utf8').trimEnd()
 };
 let code=group.sections.map(p=>readFileSync(join(d,p),'utf8')).join('');
 for(const [token,fragment] of Object.entries(shared)){
  const n=code.split(token).length-1;
  if(n!==1)throw Error(group.output+': expected exactly one '+token+', found '+n);
  code=code.replace(token,fragment);
 }
 if(code.includes('__PINE_SHARED_HARBOR_'))throw Error(group.output+': unresolved shared-source marker');
 const post=readFileSync(join(d,'shell-after-script.html'),'utf8');
 if(!pre.endsWith('<script>')||!post.startsWith('</script>'))
  throw Error(group.output+': HTML shell does not bracket the script');
 new Script(code,{filename:group.output});
 return pre+code+post;
}
export function run(check=false){
 for(const group of Object.values(groups)){
  const output=join(root,group.output),result=bundle(group);
  if(check){
   const existing=readFileSync(output,'utf8');
   if(existing!==result)throw Error(group.output+' differs from src. Run: node scripts/build.mjs');
   process.stdout.write(group.output+': exact match ('+result.length+' chars)\n');
  }else{
   writeFileSync(output,result);
   process.stdout.write('Built '+group.output+' ('+result.length+' chars)\n');
  }
 }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
 run(process.argv.includes('--check'));
