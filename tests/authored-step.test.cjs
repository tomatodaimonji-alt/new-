const {readFileSync}=require('node:fs'),a=require('node:assert/strict'),{Script}=require('node:vm'),{test}=require('node:test');
const html=readFileSync('world-editor.html','utf8');
const cut=(s,t)=>{const i=html.indexOf(s),j=html.indexOf(t,i+1);a(i>=0&&j>i,s);return html.slice(i,j)};
const build=new Script(html.match(/^const POI_SNOW_PASS=.*$/m)[0]+
 cut('function poiSnowPassMap()', '// END SNOW PASS PROTOTYPE')+
 cut('function extendTownWorldSouthPort(', '// Small same-frame woodland route')+
 cut('function extendTownWorldSouthForest(', 'function extendTownWorldMineApproach(')+
 cut('const POI_OVERLAND_ORIGINS=', 'function poiOverlandQueue(')+
 `const world=[],port=extendTownWorldSouthPort(world),forest=extendTownWorldSouthForest(world,port),snow=poiSnowPassMap();
  ({world,forest,snow,baseFoot:[poiOverlandGlobal('base',54,120),poiOverlandGlobal('base',54,119)],
   snowFoot:[poiOverlandGlobal('snowpass',12,4),poiOverlandGlobal('snowpass',12,5)]});`);
test('both same-realm steps cross real globally aligned 8×8 parcels on authored dry ground',()=>{
 const r=JSON.parse(JSON.stringify(build.runInNewContext()));
 const floor=(world,x,z)=>world.find(o=>o.y===0&&o.x===x&&o.z===z)?.type;
 a.equal(floor(r.world,54,120),'grassTrampled');a.equal(floor(r.world,54,119),'grassTrampled');
 a.equal(floor(r.snow.map.world,12,4),'roadGravelFull');a.equal(floor(r.snow.map.world,12,5),'roadGravelFull');
 a.deepEqual(r.baseFoot,[[54,120],[54,119]]);a.deepEqual(r.snowFoot,[[60,143],[60,144]]);
 for(const [[x,z],[u,v]] of [r.baseFoot,r.snowFoot])a(x===u&&Math.abs(z-v)===1&&Math.floor(z/8)!==Math.floor(v/8));
 const d=(x,z,u,v)=>Math.hypot(x-u,z-v);
 a(r.forest.props.some(t=>/^tree/.test(t.type)&&d(t.x,t.z,54,119)>21&&d(t.x,t.z,54,119)<24));
 a(r.snow.snowRoute.some(t=>d(t.x,t.z,12,4)>18));
 // This is world source only. No static geometry coordinate can prove sightline.
});
