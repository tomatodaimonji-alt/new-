const {test}=require('node:test'),a=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const env=()=>{
 const lo=h.indexOf('// BEGIN UNIFORM EXTERIOR SHELL'),hi=h.indexOf('// END UNIFORM EXTERIOR SHELL');
 a(lo>=0&&hi>lo,'independent exterior-only shell classification exists');
 const c=vm.createContext({facilityParams:new URLSearchParams('uniform-shell=1'),POI_UNIFORM_OUTDOOR:true,poiSacredTempleVisualMember:()=>true});
 vm.runInContext(h.slice(lo,hi),c);return c;
};
test('only the actual physical structural shell is ordinary exterior, not candles, floor, figures or same types on another site',()=>{
 const c=env(),site={id:'base',davidTemple:{depth:1,bounds:{x1:6,x2:42,z1:124,z2:176},ring:{x:24,z:158}}},part=type=>({type,x:24,z:158,y:0});
 for(const id of ['poiDavidWallRound','poiDavidGatePier','poiDavidWallHeader','poiDavidWallTunnel','poiDavidSacredRoof','poiDavidTunnelRoof'])a(c.poiUniformShellMember(site,part(id)));
 for(const id of ['poiDavidCandleSconce','roadRoyalFull','monsterStoneDavid','poiPortFishStall','poiDavidWaystone'])a(!c.poiUniformShellMember(site,part(id)));
 a(!c.poiUniformShellMember({id:'snowpass'},part('poiDavidWallRound')));
 a(!c.poiUniformShellMember(site,{...part('poiDavidSacredRoof'),z:20}));
});
