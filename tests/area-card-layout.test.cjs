const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
test('location has a shared safe-area lane while title and stars may wrap',()=>{
 const css=h.slice(h.indexOf('/* BEGIN FIXED AREA CARD */'),h.indexOf('/* END FIXED AREA CARD */'));
 a.match(css,/#poiLocationPanel\{[^}]*width:var\(--poi-area-width\)/);
 a.match(css,/#poiLocationName,#poiLocationStars\{[^}]*white-space:normal[^}]*overflow-wrap:anywhere/);
 a.match(css,/--poi-area-width:clamp\([^;]+var\(--poi-land-left\)[^;]+var\(--poi-land-right\)/);
 a.match(css,/#poiPartyCards\{[^}]*left:calc\(var\(--poi-land-left\) \+ var\(--poi-area-width\) \+ var\(--poi-area-gap\)\)/);
});
test('area-change cue grows downward without a horizontal excursion over the party',()=>{
 const start=h.indexOf('// BEGIN LOCATION PANEL MOTION'),end=h.indexOf('// END LOCATION PANEL MOTION',start);
 a.ok(start>=0&&end>start);
 const f=[],view={hasAttribute:()=>true,clientWidth:568};
 const panel={closest:()=>view,offsetWidth:100,animate(frames,opts){f.push({frames,opts});return {cancel(){}}}};
 const c=vm.createContext({window:{pineStartup:{loading:false}},panel});
 vm.runInContext(h.slice(start,end)+"\npoiLocationMotion(panel,{name:'森',stars:'☆☆☆☆☆☆☆☆☆☆'});poiLocationMotion(panel,{name:'オルヴァスの大神殿',stars:'★★★★★★★★★★'});",c);
 a.equal(f.length,1);
 a.ok(f[0].frames.every(q=>/^scaleY\([0-9.]+\)$/.test(q.transform)),'no horizontal transform on the fixed landscape card');
 a.equal(f[0].frames[1].transform,'scaleY(1.27)');
 a.ok(f[0].frames.some(q=>String(q.boxShadow).includes('inset')),'the change still gives a local visual cue');
});
