const test=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.WORLD_HTML||'world-editor.html','utf8');
const cut=(x,y)=>{const i=h.indexOf(x),j=h.indexOf(y,i+1);a(i>=0&&j>i,x);return h.slice(i,j)};
test('real play frame submits the ground cue first and beam only after opaque actors and weapons',()=>{
 const src=cut('function render(){','let savedMapRestoreFailed');
 const q=src.indexOf('poiDrawDavidCue(now,p.vp)'),mon=src.indexOf('poiMonsterRender(now,p.vp,sacredPeek)'),
  avatar=src.indexOf('poiDrawWalkAvatar(p.vp,now)'),weapon=src.indexOf('poiPlayerWeaponDraw(now,p.vp)'),
  beam=src.indexOf('poiDrawDavidBeam(now,p.vp,davidBeam)');
 a.ok(q>=0&&q<mon&&mon<avatar&&avatar<weapon&&weapon<beam,{q,mon,avatar,weapon,beam});
});
test('late beam is translucent, honors existing depth, and does not leak GL state',()=>{
 const calls=[],names=['BLEND','CONSTANT_ALPHA','ONE_MINUS_CONSTANT_ALPHA','SRC_ALPHA','ONE_MINUS_SRC_ALPHA'];
 const gl=Object.fromEntries(names.map(s=>[s,s]));
 for(const k of ['enable','disable','blendFunc','blendColor','depthMask'])gl[k]=(...args)=>calls.push([k,...args]);
 const s=h.indexOf('function poiDrawDavidBeam(');
 a.ok(s>=0,'late beam has a scoped GL state guard');
 const got=vm.runInNewContext(cut('function poiDrawDavidBeam(','// END DAVID TEMPLE CUES')+'\npoiDrawDavidBeam',{gl,poiDavidDrawThermalBeam:()=>calls.push(['beam'])});
 got(65,[],null);a.equal(calls.length,0);
 got(65,[],{emission:{alpha:.8},reduced:false,cue:{beamVisible:true,beam:{}}});
 a.deepEqual(calls,[['enable','BLEND'],['blendFunc','CONSTANT_ALPHA','ONE_MINUS_CONSTANT_ALPHA'],['depthMask',false],['beam'],['depthMask',true],['blendFunc','SRC_ALPHA','ONE_MINUS_SRC_ALPHA'],['blendColor',0,0,0,0],['disable','BLEND']]);
});
