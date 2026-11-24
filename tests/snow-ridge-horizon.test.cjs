const fs=require('node:fs'),a=require('node:assert/strict'),{test}=require('node:test');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
test('no fictional Snow mountain survives; rendered neighbors are actual owned Snow ground chunks',()=>{
 a.doesNotMatch(h,/poiSnowHorizonMesh|facilityDrawSnowHorizon|POI_SNOW_HORIZON/);
 a.match(h,/poiOverlandSpecFor\('snowpass',snow,map\.world,map\.width,map\.height\)/);
 a.match(h,/if\(region\.owns&&!region\.owns\(x,z\)\)continue/);
 a.match(h,/draw\(m,view\)/);
});
