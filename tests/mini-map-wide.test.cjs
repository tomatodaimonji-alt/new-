const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const part=(s,a,b)=>{const i=s.indexOf(a),j=s.indexOf(b,i+1);if(i<0||j<=i)throw Error('missing '+a);return s.slice(i,j)};
test('closed HUD matches area width while preserving original map height',()=>{
 const css=part(h,'/* BEGIN WIDE HUD MAP */','/* END WIDE HUD MAP */');
 a.match(css,/#poiMiniOpen\{width:var\(--poi-area-width\)/);
 a.match(css,/#poiMiniMap\{width:100%;height:var\(--poi-mini-size\);aspect-ratio:auto/);
 a.match(h,/<canvas id="poiLocalMapLarge" width="492" height="492"/);
});
test('survey extensions render with square tiles at the old scale without moving the player off center',()=>{
 const c=vm.createContext({POI_LOCAL_SIDE:41});
 vm.runInContext(part(h,'// BEGIN WIDE HUD MAP','// END WIDE HUD MAP'),c);
 const m=c.poiLocalHudMetrics(154,93.6,144);
 a.equal(m.width,237);a.equal(m.height,144);a.equal(m.wing,14);
 a.equal(m.shift,46.5);a.equal(m.scale,144/41);
 a.equal(c.poiLocalHudMetrics(100,100,144).wing,0);
 a.equal(c.poiLocalHudMetrics(100,100,144).width,144);
});
