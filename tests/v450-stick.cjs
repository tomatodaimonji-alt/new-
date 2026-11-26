const fs=require('node:fs'),vm=require('node:vm'),a=require('node:assert/strict'),{test}=require('node:test');
const base=fs.readFileSync(process.env.WORKSHOP_BASE_HTML||'../workshop-frontier-v449/candidate.html','utf8'),h=fs.readFileSync(process.env.WORKSHOP_HTML||'candidate.html','utf8');
const cut=(s,b,e)=>{const i=s.indexOf(b),j=s.indexOf(e,i+b.length);a(i>=0&&j>i,b);return s.slice(i,j)};
function rig(s){
 const poseEvents=[],c=vm.createContext({facilitySite:{id:'frontier'},poiWalkLevel:0,poiBowType:t=>t==='equipWoodBow',
  poiRoleClothingGeometry:()=>false,poiStarterGearGeometry(){},frontierGuardHat(){},poiHumanGearType:t=>t??null,poiRoleClothingTone:()=>null,
  frontierFitSoles:(m,r)=>poseEvents.push(['soles',r.length]),poiBareFistShift:(p,x,y,z)=>[x,y,z,1,0],
  poiBareFistRig:()=>vm.runInContext('poiPlayerWeaponHands({},0)',c),poiSpearType:t=>t==='equipWoodSpear',
  poiBuildWorldSpear:(m,p,g)=>poseEvents.push(['spear',g]),POI_RIGID_HELD_LEAD:{},POI_HELD_AXE_EDGE:{},
  poiRoleToolGripStyle:()=>null,
  poiAimUnit:(x,z)=>({x:x/(Math.hypot(x,z)||1),z:z/(Math.hypot(x,z)||1)}),
  poiWeaponArrowGeometry:(m,x,y,z,dx,dz)=>poseEvents.push(['arrow',x,y,z,dx,dz])});
 vm.runInContext("const mesh=()=>({p:[],n:[],c:[]});\n"+cut(s,'function tri(m,','function detailedTree(')+
  cut(s,'function humanRingProfile(','function frontierGuardHat(')+
  cut(s,'function characterArmRotation(','function roundStack(')+
  cut(s,'const POI_PLAYER_BLOCK_ARM=','// BEGIN INSTANT MELEE ART')+
  cut(s,'function poiBowAimPoints(','function poiWalkAvatar(')+
  'function characterHuman(m){cube(m,0,0,0,.32,1.34,.21,[.6,.4,.3]);}function deco(m){cube(m,0,0,0,.074,.72,.052,[.95,.85,.95]);}',c);
 return {build:(...args)=>vm.runInContext('poiBuildPlayerMesh',c)(...args),get:exp=>vm.runInContext(exp,c),poseEvents};
}
const norm=(v)=>JSON.parse(JSON.stringify(v)),args=(weapon,pose,gear={},stride=0,heading=.6,hero=true)=>[weapon,pose,gear,stride,0,2,.03,3,heading,true,null,hero];
test('main-player entry emits a visibly thin rounded character with active feet and attacks; party remains exact',()=>{
 const before=rig(base),now=rig(h);
 const params=args('equipIronSword',{strike:.55,guard:.22,twist:.11});
 const old=before.build(...params),hero=now.build(...params);
 a(hero.playerStick);a(hero.p.length>0&&hero.p.length<16000);
 a.equal(hero.p.length,hero.c.length);a.equal(hero.p.length,hero.n.length);a(hero.p.every(Number.isFinite));
 a(now.poseEvents.some(q=>q[0]==='soles'&&q[1]===2));
 const end=90; // final 30 verts from identical non-spear weapon renderer
 a.deepEqual(norm(hero.p.slice(-end)),norm(old.p.slice(-end)));
 a.deepEqual(norm(now.build(...args('equipIronSword',params[1],{},0,.6,false)).p),norm(old.p));
 const walk=now.build(...args('equipIronSword',params[1],{},.11,.6));
 a.notDeepEqual(norm(walk.p.slice(0,150)),norm(hero.p.slice(0,150)));
 const body=now.get('poiStickHeroBody({})');
 const x=body.p.filter((_,i)=>i%3===0&&body.p[i+1]>=.66&&body.p[i+1]<.84);
 a(Math.max(...x)-Math.min(...x)<.18,'slim torso');
 const ys=body.p.filter((_,i)=>i%3===1);
 a(Math.abs(Math.min(...ys))<1e-10&&Math.max(...ys)>1.40);
});
test('bow uses the same nock and spear uses the same held socket, wardrobe and scope wiring stay separate',()=>{
 const one=rig(base),two=rig(h);
 for(const weapon of ['equipWoodBow','equipWoodSpear']){
  const p=weapon==='equipWoodBow'?{bowDraw:.8,twist:.1,bowReleased:false}:{strike:.84,guard:.45};
  one.build(...args(weapon,p));two.build(...args(weapon,p));
 }
 a.deepEqual(norm(two.poseEvents.filter(x=>x[0]!=='soles')),norm(one.poseEvents));
 const empty=two.get('poiStickHeroBody({})'),leather=two.get("poiStickHeroBody({feet:'armorLeatherShoes'})");
 a.notDeepEqual(norm(empty.p.slice(0,200)),norm(leather.p.slice(0,200)));
 a.equal(two.get('poiStickHeroBody({})'),empty);
 a.equal((cut(h,'function poiWalkAvatar(','const POI_MONSTER_BREAK_MS=').match(/,true,undefined,true\)\)/g)||[]).length,4);
 a(!cut(h,'function poiHumanPartyMesh(','// END HUMAN PARTY').includes('playerStick'));
 a(h.includes('poiDrawPaperDoll(view,poiBuildPlayerMesh(weapon,null,gear,0,0,0,0,0,null,false,undefined,true))'));
});
