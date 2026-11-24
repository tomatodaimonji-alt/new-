const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const part=(a,b)=>{const i=h.indexOf(a),j=h.indexOf(b,i+a.length);assert(i>=0&&j>i);return h.slice(i,j)};
function sample(){
 const c=vm.createContext({console});
 vm.runInContext('const mesh=()=>({p:[],n:[],c:[]});'+part('function tri(','function addPart(')+
 part('function characterArmRotation(','function roundStack(')+
 part('function characterHuman(','function poiStarterGearGeometry('),c);
 return code=>JSON.parse(JSON.stringify(vm.runInContext(code,c)));
}
test('play-only base rig covers all-unequipped body with modest cloth, leaving authored human props unchanged',()=>{
 assert.match(h,/characterHuman\(body,0,0,0,false,bowAim\|\|fist\?null:pose,gear,true\)/);
 const run=sample(),before=run("const make=(modest,gear=null)=>{const m=mesh();m.townParts={};characterHuman(m,0,0,0,false,null,gear,modest);return m};make(false)");
 const body=run("make(true,{head:null,torso:null,legs:null,feet:null})");
 assert(body.p.length>before.p.length);
 assert(body.c.some((v,i)=>i%3===0&&v===.30&&body.c[i+1]===.31&&body.c[i+2]===.29));
 assert(!before.c.some((v,i)=>i%3===0&&v===.30&&before.c[i+1]===.31&&before.c[i+2]===.29));
});
test('cloth silhouettes and held-ground/portrait rigs share gear data and relight only authored role wearers',()=>{
 assert.match(h,/poiTownNpcModel\(a\.role\.type,a\)/);
 assert.match(h,/function poiNpcPortrait\(actor\)/);
 assert.match(h,/poiTownNpcGearVisualKey\(actor\)/);
 for(const id of ['armorMerchantCoat','armorGuildUniform','armorCookApron','armorCookHat','equipFryingPan','equipLadle','equipBallpointPen'])assert(h.includes(id),id);
 assert.match(h,/inPart\(i,'held'\)/);
});
test('all role costumes have distinct actual vertex/colour signatures with finite geometry and chef hat height',()=>{
 const run=sample();
 const rigs=run(`(()=>{
  const rig=(torso,head=null)=>{const m=mesh();characterHuman(m,0,0,0,false,null,{torso,head},true);return m;};
  return [rig('armorMerchantCoat'),rig('armorGuildUniform'),rig('armorCookApron','armorCookHat')];
 })()`);
 const includes=(m,swatch)=>m.c.some((v,i)=>i%3===0&&v===swatch[0]&&m.c[i+1]===swatch[1]&&m.c[i+2]===swatch[2]);
 for(const [m,s] of rigs.map((m,i)=>[m,[[.21,.42,.39],[.50,.21,.27],[.31,.43,.29]][i]])){
  assert(includes(m,s));assert.equal(m.p.length,m.n.length);assert.equal(m.n.length,m.c.length);
  assert(m.p.every(Number.isFinite)&&m.n.every(Number.isFinite)&&m.c.every(Number.isFinite));
 }
 assert(Math.max(...rigs[2].p.filter((_,i)=>i%3===1))>1.68);
 assert.notDeepEqual(rigs[0].c,rigs[1].c);
});
test('shared NPC render model caches by outfit and attaches real role tool to its palm',t=>{
 if(!h.includes('function poiRoleItemGeometry(')){t.skip('requires merged asset patch');return}
 const c=vm.createContext({});
 vm.runInContext('const mesh=()=>({p:[],n:[],c:[]});'+part('function tri(','function addPart(')+
  part('function characterArmRotation(','function roundStack(')+
  part('function characterHuman(','function poiStarterGearGeometry(')+part('function poiRoleItemGeometry(','function poiFantasyEquipmentGeometry(')+
  'function deco(m,t,x,y,z){if(!poiRoleItemGeometry(m,t,x,y,z))throw new Error(t)}'+
  part('const poiTownNpcModelCache=','function poiTownResidentsDraw('),c);
 const specs=[['armorMerchantCoat','equipBallpointPen',null],['armorGuildUniform','equipLadle',null],['armorCookApron','equipFryingPan','armorCookHat']];
 const result=JSON.parse(JSON.stringify(vm.runInContext(`(${JSON.stringify(specs)}).map(([torso,weapon,head])=>{
  const actor={role:{type:'humanMerchant'},weapon,gear:{torso,head,legs:null,feet:null}};
  const m=poiTownNpcModel(actor.role.type,actor),again=poiTownNpcModel(actor.role.type,actor);
  const points=m.p.slice(...m.townParts.held),xs=points.filter((_,i)=>i%3===0),ys=points.filter((_,i)=>i%3===1);
  return {same:m===again,key:poiTownNpcGearVisualKey(actor),count:points.length/3,width:Math.max(...xs)-Math.min(...xs),above:Math.max(...ys)-.55,
   grip:xs.some((x,i)=>Math.abs(x-.272)<.06&&ys[i]<.55)&&xs.some((x,i)=>Math.abs(x-.272)<.06&&ys[i]>.55)};
 })`,c)));
 assert.equal(new Set(result.map(m=>m.key)).size,3);
 for(const prop of result)assert(prop.same&&prop.count>=180&&prop.above>.25&&prop.grip,prop.key);
 assert(result[2].width>.31,'silhouette of actual cast-iron pan remains broad in equipped geometry');
});
