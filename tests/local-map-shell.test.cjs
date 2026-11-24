const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const ell=(s,start,end)=>{const i=s.indexOf(start),j=s.indexOf(end,i+1);a.ok(i>=0&&j>i,start);return s.slice(i,j)};
test('the expanded map uses one matching glass surface and a lighter backdrop',()=>{
 const s=ell(h,'#poiLocalMapDialog{','#poiLocationPanel{');
 a.match(s,/#poiLocalMapDialog\{[^}]*background:var\(--workshop-panel-surface\)/);
 a.match(s,/#poiLocalMapDialog::backdrop\{background:rgba\(8,17,13,\.32\)\}/);
});
test('landscape shell gets a real dock but leaves original square raster and all playback hooks',()=>{
 const s=ell(h,'#poiLocalMapDialog{','#poiLocationPanel{');
 a.match(s,/@media \(orientation:landscape\) and \(min-width:480px\)/);
 a.match(s,/#poiLocalMapCard\{[^}]*grid-template-areas:'map header' 'map controls'/);
 a.match(s,/#poiLocalMapLarge\{[^}]*aspect-ratio:1/);
 a.match(h,/<canvas id="poiLocalMapLarge" width="492" height="492"/);
 a.match(h,/POI_LOCAL_SIDE=41/);
 a.match(h,/function poiLocalOverlayZoom\(/);
});
