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
 const c={gl,loc:{outdoorSight:7},poiWallProgram:{},poiWallUniformActive:false,poiWallUniformState:Object.create(null)};
 vm.createContext(c);vm.runInContext(shadow,c);
 c.poiWallUniformWrite('uniform4f','outdoorSight',14,70,1,.25);
 a.deepEqual(programValues[7],[14,70,1,.25]);a.deepEqual([...c.poiWallUniformState.outdoorSight[1]],[14,70,1,.25]);
 a.ok(fragment.includes('uOutdoorSight'));a.equal(c.poiWallUniformState.hitFlash,undefined);
 a.doesNotMatch(h,/gl\.uniform[1234]f\(loc\./);
});

test('setters inside optional wall group update the currently bound program, not a foreign location',()=>{
 const source=h.slice(h.indexOf('function poiWallUniformWrite('),h.indexOf("try{initSignProgram()}catch"));
 let active='base';const calls=[];
 const gl={useProgram(p){active=p},uniform4f(key,...args){a.ok(key.startsWith(active),active+' received '+key);calls.push([key,...args])}};
 const c={gl,program:'base',loc:{sharedCanopy:'baseShared'},poiWallLoc:{sharedCanopy:'wallShared'},poiWallProgram:'wall',poiWallUniformState:Object.create(null),poiWallUniformActive:false};
 vm.createContext(c);vm.runInContext(source,c);
 c.poiWallUniformWrite('uniform4f','sharedCanopy',0,0,0,0);
 c.poiWallUniformUse();
 c.poiWallUniformWrite('uniform4f','sharedCanopy',1,2,18,48);
 c.poiWallUniformWrite('uniform4f','sharedCanopy',0,0,0,0);
 c.poiWallUniformRestore();
 c.poiWallUniformWrite('uniform4f','sharedCanopy',3,4,18,48);
 a.deepEqual(calls.map(x=>x[0]),['baseShared','wallShared','wallShared','wallShared','baseShared']);
});
test('the private shader option preserves native facility resume but is not recognized without test mode',()=>{
 const src=h.slice(h.indexOf('function workshopResumePermitted('),h.indexOf('function workshopResumeRead('));
 const c={URLSearchParams};vm.createContext(c);vm.runInContext(src,c);
 const base='resume=1&uniform-outdoor=1&uniform-shell=1&uniform-split=1&hybrid-gate=1&hybrid-wall=1&hybrid-wall-opt=1';
 const run=q=>c.workshopResumePermitted(new URLSearchParams(q));
 a.equal(run(base+'&test=1&dedicated-wall=1'),true);
 a.equal(run(base+'&dedicated-wall=1'),false);
 a.equal(run(base+'&test=1&dedicated-wall=2'),false);
 a.equal(run(base+'&test=1&dedicated-wall=1&alien=1'),false);
});
