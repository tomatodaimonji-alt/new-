const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function span(a,b){const i=h.indexOf(a),j=h.indexOf(b,i+1);assert(i>=0&&j>i,a);return h.slice(i,j)}
test('mine area is a floor-aware named region with danger rank without changing open-field music',()=>{
 const c=vm.createContext({});
 vm.runInContext(span('const POI_SAFE_TOWN=','const poiMiniStatic='),c);
 const site={id:'base',townOffset:22,buildings:[],mine:{entrance:{x:116,z:64,y:0},stairs:{x:116,z:62,y:0},bounds:{x1:112,z1:52,x2:123,z2:63,y:-1}}};
 assert.equal(c.poiRegionAt(site,116,64,false,0).name,'廃坑入口');
 assert.equal(c.poiRegionAt(site,120,55,false,-1).stars,'★★★☆☆☆☆☆☆☆');
 assert.equal(c.poiRegionAt(site,120,55,false,0).name,'外');
 assert.equal(c.poiRegionAt(site,116,64).name,'外','existing outdoor music caller is intentionally unchanged');
 assert.equal(c.poiRegionAt(site,105,60,false,-1).name,'外');
});
test('only a genuine guard victory grants one payout and saves it with the existing kit',()=>{
 const paid=[],messages=[],alerts=[];let kit={gold:3,potions:2},fail=false;
 const c=vm.createContext({facilitySite:{id:'base',mine:{guardian:{x:120,z:55,y:-1,type:'monsterMineGuard'}}},
  poiWalkLevel:-1,poiHotbarHasKit:()=>true,poiHotbarRead:()=>kit,POI_ECONOMY_GOLD_MAX:999999,
  poiEconomyWrite:n=>{if(fail)return false;kit=n;paid.push(n);return true},poiEconomyRefresh(){},
  poiMessagePush:(...m)=>{messages.push(m);return true},toast:m=>alerts.push(m)});
 vm.runInContext(span('const POI_MINE_REWARD_ID=','function poiEconomyStop()'),c);
 const guard={x:120,z:55,y:-1,type:'monsterMineGuard'};
 assert.equal(c.poiMineGuardianDefeat({...guard,type:'monsterSlime'},{hp:0}),false);
 assert.equal(c.poiMineGuardianDefeat(guard,{hp:99}),false);
 fail=true;assert.equal(c.poiMineGuardianDefeat(guard,{hp:0}),false);assert.equal(kit.gold,3);
 assert.deepEqual(alerts,['初討伐報酬を保存できませんでした。']);
 fail=false;assert.equal(c.poiMineGuardianDefeat(guard,{hp:0}),true);assert.equal(kit.gold,12);
 assert.equal(kit.claimedCaches[0],'mine-guardian');assert.equal(kit.potions,2);
 assert.equal(c.poiMineGuardianDefeat(guard,{hp:0}),false);
 assert.equal(paid.length,1);assert.deepEqual(messages,[['初討伐報酬：9G','gold']]);
});
