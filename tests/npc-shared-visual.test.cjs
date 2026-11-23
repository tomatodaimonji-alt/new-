const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const part=(a,b)=>{const i=h.indexOf(a),j=h.indexOf(b,i+a.length);assert(i>=0&&j>i);return h.slice(i,j)};
function fixture(){
 const c=vm.createContext({});
 vm.runInContext('const mesh=()=>({p:[],n:[],c:[]});const EQUIPMENT_IDS=["equipWoodSword"];'+
  part('function tri(','function addPart(')+part('function characterArmRotation(','function roundStack(')+
  part('function characterHuman(','function poiStarterGearGeometry(')+part('function poiStarterGearGeometry(','function characterArmRotation(')+
  part('function poiRoleItemGeometry(','function poiFantasyEquipmentGeometry(')+
  `function deco(m,t,x,y,z){if(t==='humanKnight'){m.stationaryKnight=true;return}if(t==='equipWoodSword'){cube(m,x,y,z,.10,1,.11,[.2,.3,.5]);return}if(!poiRoleItemGeometry(m,t,x,y,z))throw Error(t)}`+
  part('const poiTownNpcModelCache=','function poiTownResidentsDraw('),c);
 const run=code=>JSON.parse(JSON.stringify(vm.runInContext(code,c)));
 return run;
}
test('ordinary uniforms, actual head gear and capless live civilians share real posed model, unlike stationary props',()=>{
 const run=fixture();
 const out=run(`(()=>{
  const role={type:'humanVillager'},base={head:'starterCap',torso:'starterTunic',legs:'starterTrousers',feet:'starterBoots'};
  const a={role,gear:base,weapon:null},b={...a,gear:{...base,head:null}},c={...a,gear:{head:null,torso:null,legs:null,feet:null}};
  const m=poiTownNpcModel(role.type,a),n=poiTownNpcModel(role.type,b),free=poiTownNpcModel(role.type,c);
  return {roleRig:m.roleRig,keyA:poiTownNpcGearVisualKey(a),keyB:poiTownNpcGearVisualKey(b),
   hat:m.p.length-n.p.length,head:Math.max(...free.p.filter((_,i)=>i%3===1)),
   shorts:free.c.some((v,i)=>i%3===0&&v===.30&&free.c[i+1]===.31&&free.c[i+2]===.29),
   undershirt:free.c.some((v,i)=>i%3===0&&v===.36&&free.c[i+1]===.35&&free.c[i+2]===.31),
   stationary:poiTownNpcModel('humanKnight').stationaryKnight};
 })()`);
 assert(out.roleRig&&out.keyA!==out.keyB&&out.hat>0);
 assert(out.shorts&&!out.undershirt&&out.head>1.30);
 assert(out.stationary);
});
test('live adventurer uses true iron torso and held sword without old shield; tool grips are valid for player',()=>{
 const run=fixture();
 const result=run(`(()=>{
  const m=poiTownNpcModel('humanKnight',{role:{type:'humanKnight'},gear:{torso:'armorIronTorso'},weapon:'equipWoodSword'});
  return {rig:m.roleRig,held:m.townParts.held,shield:m.townParts.shield,sword:m.townParts.sword,old:m.stationaryKnight};
 })()`);
 assert(result.rig&&result.held[1]>result.held[0]);assert(!result.shield&&!result.sword&&!result.old);
 assert.match(h,/const weapon=\(EQUIPMENT_IDS\.includes\(held\)\|\|!!poiRoleToolGripStyle\(held\)\)\?held:null/);
 assert.match(h,/poiTownNpcHeldPose\(a,/);
});
test('role rigs move opposite feet and hand-held item stays attached during ordinary gait',()=>{
 const run=fixture();
 const motion=run(`[
  poiTownNpcGaitZ(-.12,.15,.10,null,null),poiTownNpcGaitZ(.12,.15,.10,null,null),
  poiTownNpcGaitZ(.272,.55,.10,null,null),poiTownNpcGaitZ(.272,.55,.10,{strike:1},null),
  poiTownNpcGaitZ(.272,.55,.10,null,{right:1})
 ]`);
 assert(Math.abs(motion[2]+.035)<1e-9);assert.deepEqual(motion.slice(0,2),[-.10,.10]);assert.deepEqual(motion.slice(3),[0,0]);
 assert.match(h,/part\.roleRig[^\n]+poiTownNpcGaitZ/);
});
