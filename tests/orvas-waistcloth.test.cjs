const a=require('node:assert/strict'),{test}=require('node:test'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function cut(p,q){const i=h.indexOf(p),j=h.indexOf(q,i+p.length);a(i>=0&&j>i,p);return h.slice(i,j)}
test('fifth item is a safe authored-neighbor drop and old trusted v295 marker earns just this once',()=>{
 const c=vm.createContext({facilitySite:{id:'base',davidTemple:{boss:{x:41,z:74,y:0}}},
  poiEquipmentDurabilityMax:t=>t==='armorOrvasWaistcloth'?96:100,poiInventoryOrdinarySlots:k=>k.slots||[],
  poiAnyChestHas:()=>false,poiArmorWorn:k=>k.worn||{}});
 vm.runInContext(cut('// BEGIN ORVAS REWARD CORE','// END ORVAS REWARD CORE'),c);
 const ev=x=>vm.runInContext(x,c);
 const fresh=ev("poiOrvasRewardGrant({potions:1})");
 a.equal(fresh.orvasRewards,31);a.equal(fresh.armedDrops.length,5);
 const d=fresh.armedDrops.at(-1);
 a.deepEqual(JSON.parse(JSON.stringify(d)),{id:'orvas-waistcloth',type:'armorOrvasWaistcloth',x:42,z:75,y:0,durability:96});
 a.equal(ev("poiOrvasRewardRestore({orvasRewards:15},null,150).armedDrops.length"),1);
 a.equal(ev("poiOrvasRewardRestore({orvasRewards:31},null,150).armedDrops"),undefined);
 a.equal(ev("poiOrvasRewardRestore({orvasRewards:7},null,150).armedDrops"),undefined);
 a.equal(ev("poiOrvasRewardGrant({worn:{legs:'armorOrvasWaistcloth'},orvasRewards:15}).armedDrops"),undefined);
});
test('registered as pants with equal protection and actual boss skirt art scaled to a player, retaining real slit',()=>{
 const c=vm.createContext({POI_KNIFE_DURABILITY:55,tri:(m,...v)=>m.p.push(...v.slice(0,3).flat()),
  quad:(m,a,b,c,d)=>m.p.push(...a,...b,...c,...a,...c,...d)});
 vm.runInContext(cut('const POI_STARTER_ARMOR=','function poiEquipmentDurabilityPercent(')+
  cut('function poiDavidSkirt(','function poiDavidLeapBodyY(')+cut('// BEGIN ORVAS WAISTCLOTH MODEL','// END ORVAS WAISTCLOTH MODEL'),c);
 a.equal(c.poiArmorCategory('armorOrvasWaistcloth'),'legs');
 a.equal(c.poiArmorDefense('armorOrvasWaistcloth'),c.poiArmorDefense('starterTrousers'));
 a.equal(c.poiEquipmentDurabilityMax('armorOrvasWaistcloth'),96);
 const m={p:[]};c.poiOrvasWaistclothGeometry(m,0,0,0);
 const yy=m.p.filter((_,i)=>i%3===1);
 a(yy.length>350&&Math.min(...yy)>.10&&Math.max(...yy)<.60);
 // A front-facing ray crosses the covered thigh, but has a genuine gap
 // in front of the other thigh, not merely a painted narrow stripe.
 const ray=(x,y)=>{for(let i=0;i<m.p.length;i+=9){
  const [ax,ay,az,bx,by,bz,cx,cy,cz]=m.p.slice(i,i+9),d=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);
  if(Math.abs(d)<1e-9)continue;
  const u=((by-cy)*(x-cx)+(cx-bx)*(y-cy))/d,v=((cy-ay)*(x-cx)+(ax-cx)*(y-cy))/d,w=1-u-v;
  if(u>=0&&v>=0&&w>=0&&az*u+bz*v+cz*w>.095)return true;
 }return false;};
 a(ray(-.12,.25));a(!ray(.12,.25));
});
