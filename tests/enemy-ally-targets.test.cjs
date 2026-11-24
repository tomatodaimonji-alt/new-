const {test}=require('node:test'),a=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
test('real valid ally takes nearest clear intent; keep original player on tie, realm, wall and ineligible faction',()=>{
 const from=h.indexOf('// BEGIN HOSTILE ALLY TARGET CHOICE'),to=h.indexOf('// END HOSTILE ALLY TARGET CHOICE');
 a(from>=0&&to>from);
 const hero={x:13,z:10,y:0},a1={id:'slimeSoul',x:10,z:11,y:0},src={x:10,z:10};
 const b=vm.createContext({poiCompanionActor:a1,poiCompanionAllowed:()=>true,poiCompanionSame:()=>true,poiCompanionPlace:()=>({}),
  poiWalkX:hero.x,poiWalkZ:hero.z,poiWalkLevel:0,poiCompanionPose:a=>a,
  poiCompanionEncounterAllows:()=>true,poiCompanionAttackClear:(_src,p)=>!b.wall?.(p),
  poiAimOrigin:()=>hero,poiDungeonVisualVisible:()=>true});
 vm.runInContext(h.slice(from,to),b);
 const enemy={type:'monsterSkeleton',y:0};
 a.equal(b.poiEnemyAllyChoice(enemy,{},src,100,6,hero).actor,a1);
 hero.x=11;a.equal(b.poiEnemyAllyChoice(enemy,{},src,100,6,hero),null);
 hero.x=13;b.wall=p=>p===a1||p.z===11;a.equal(b.poiEnemyAllyChoice(enemy,{},src,100,6,hero),null);
 b.wall=p=>p.x===13;hero.x=10.5;hero.z=10;b.wall=p=>p.x===10.5;
 a.equal(b.poiEnemyAllyChoice(enemy,{},src,100,6,hero).actor,a1);
 a.equal(b.poiEnemyAllyChoice(enemy,{townOwned:true},src,100,6,hero),null);
 a1.y=-1;a.equal(b.poiEnemyAllyChoice(enemy,{},src,100,6,hero),null);
});
test('allied red warning submission is absent; genuine beam, hostile cue and ground effects remain',()=>{
 a.match(h,/if\(ally&&!emission\)return;/);
 a.match(h,/const \{lane\}=finishing\|\|ally\?/);
 a.match(h,/if\(emission\)\{[\s\S]{0,850}poiDavidThermalBeam\(q/);
 a.match(h,/if\(visual.kind==='stomp'\)poiDavidImpactStomp\(visual,now\)/);
});
