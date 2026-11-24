const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const api=()=>{
const i=h.indexOf('// BEGIN ENEMY HELD WEAPON'),j=h.indexOf('// END ENEMY HELD WEAPON');
a.ok(i>=0&&j>i,'authored held weapon rig');
return vm.runInNewContext(h.slice(i,j)+';poiEnemyWeaponRig');};
const active={start:0,hit:800,pending:true,motion:0};
const impact={...active,pending:false,visualHitAt:800};
test('held sword types cut across the attack, knight alternate mirrors, and bosses/unarmed are not rerigged',()=>{
 const rig=api();
 for(const type of ['equipBoneSword','equipIronSword']){
  const wind=rig(type,{phase:'windup'},active,480),hit=rig(type,{phase:'impact'},impact,800);
  a.equal(wind.weapon,type);a(wind.yaw>1);a(Math.abs(hit.yaw)<.24);
  a(rig(type,{phase:'recover'},impact,900).yaw<-.65);
  if(type==='equipIronSword')a(rig(type,{phase:'windup'},{...active,motion:1},480).yaw< -1);
 }
 for(const type of ['fireWand','equipNorthMinotaurAxe',null])a.equal(rig(type,{phase:'windup'},active,480),null);
});
test('bow draws until original contact, spear extends, staff channels at bolt time, long staff and mace descend',()=>{
 const rig=api(),at=(id,t,a0=active)=>rig(id,{phase:a0.pending?'windup':'impact'},a0,t);
 a(at('equipWoodBow',700).draw>.8);a.equal(at('equipWoodBow',800,impact).draw,0);
 a(at('equipWoodSpear',800,impact).hand[2]-at('equipWoodSpear',400).hand[2]>.55);
 a(at('equipPlainStaff',620).tilt>at('equipPlainStaff',440).tilt+.65);
 for(const type of ['equipLongStaff','equipStoneMace']){
  const hold=at(type,440),hit=at(type,800,impact);
  a(hold.hand[1]>1.10&&hit.hand[1]<hold.hand[1]);
  a(hold.tilt<-.3&&hit.tilt>1.4);
 }
});
test('actual held mesh rotates around its connected grip, and bow string/nocked arrow follow drawn hand until release',()=>{
 const cut=(x,y)=>{const i=h.indexOf(x);return h.slice(i,h.indexOf(y,i+1))};
 const rods=[],grips=[],arrows=[];
 const c={naturalBranch:(_m,...v)=>rods.push(v.slice(0,6)),cube:(_m,x,y,z)=>grips.push([x,y,z]),
  diamond:(_m,x,y,z)=>arrows.push([x,y,z])};
 vm.createContext(c);
 vm.runInContext(cut('function characterArmRotation(','function roundStack(')+
  cut('// BEGIN ENEMY HELD WEAPON','// END ENEMY HELD WEAPON'),c);
 const prop=(x,y)=>({p:[x,y,0,x,y+1,0],n:[0,1,0,0,1,0],c:[.5,.5,.5,.5,.5,.5]});
 const m=()=>({p:[],n:[],c:[]});
 const r=c.poiEnemyWeaponRig('equipWoodSpear',{phase:'impact'},impact,800),out=m();
 c.poiEnemyHeldMesh(out,prop(0,.6),r,0,0,0,.79,.6);
 a.deepEqual(out.p.slice(0,3),Array.from(r.hand));a.deepEqual(grips[0],Array.from(r.hand));
 a(out.p[5]>out.p[2]+.78);
 rods.length=0;grips.length=0;
 const draw=c.poiEnemyWeaponRig('equipWoodBow',{phase:'release'},active,750),bow=m();
 c.poiEnemyHeldMesh(bow,prop(.34,.57),draw,0,0,0,.67,.57);
 a.deepEqual(bow.p.slice(0,3),Array.from(draw.hand));a.deepEqual(grips[0],Array.from(draw.hand));
 a.deepEqual(rods[0].slice(3),rods[1].slice(0,3),'both ends lead to same drawn nock');
 a.deepEqual(grips[1],rods[0].slice(3),'rear hand physically pulls the string');
 a.equal(arrows.length,1);
 const loose=c.poiEnemyWeaponRig('equipWoodBow',{phase:'impact'},impact,800);
 c.poiEnemyHeldMesh(m(),prop(.34,.57),loose,0,0,0,.67,.57);
 a.equal(arrows.length,1,'released arrow no longer rendered gripped');
});
