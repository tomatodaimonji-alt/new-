const {test}=require('node:test'),a=require('node:assert/strict'),f=require('node:fs'),vm=require('node:vm');
const h=f.readFileSync(process.env.HTML||'../world-editor.html','utf8');
test('stock VERT has no wall attributes or work; dedicated VERT retains exact wall shading',()=>{
 const s=n=>h.match(new RegExp("const "+n+"='([^'\\n]+)';"))?.[1];
 a.ok(s('WALL_VERT'));a.ok(!s('VERT').includes('aHybridWall'));a.match(s('WALL_VERT'),/wallShade\(n\)\/wallShade\(aNorm\)/);a.match(s('VERT'),/vHybridWallBand=vec2\(0\.0\)/);
});
test('all shared fragment uniform writes mirror by name; untouched defaults stay zero',()=>{
 const shadow=h.slice(h.indexOf('function poiWallUniformWrite('),h.indexOf('function poiWallUniformUse(',h.indexOf('function poiWallUniformWrite(')));
 const fragment=h.slice(h.indexOf('const FRAG='),h.indexOf('function sh('));
 const programValues={};const gl={uniform4f(key,...args){programValues[key]=args}};
 const c={gl,loc:{outdoorSight:7},poiWallProgram:{},poiWallUniformState:Object.create(null)};
 vm.createContext(c);vm.runInContext(shadow,c);
 c.poiWallUniformWrite('uniform4f','outdoorSight',14,70,1,.25);
 a.deepEqual(programValues[7],[14,70,1,.25]);a.deepEqual([...c.poiWallUniformState.outdoorSight[1]],[14,70,1,.25]);
 a.ok(fragment.includes('uOutdoorSight'));a.equal(c.poiWallUniformState.hitFlash,undefined);
 a.doesNotMatch(h,/gl\.uniform[1234]f\(loc\./);
});
