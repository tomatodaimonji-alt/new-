const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const html=readFileSync(process.argv[2]||'world-editor.html','utf8');
const marker='// BEGIN TOWN VISITOR CHOICES';
const end='// END TOWN VISITOR CHOICES';
function choose(){
 const i=html.indexOf(marker),j=html.indexOf(end);
 assert(i>=0&&j>i,'contextual visitor choice module is not implemented');
 return vm.runInNewContext(html.slice(i,j)+'\npoiTownVisitorChoose');
}
const long={m:840,ends:910,mealNeed:true,hasCompany:false,personality:'social',distance:{meal:4,market:3,company:2},reachable:{meal:true,market:true,company:true}};
test('a hungry visitor chooses food and a sociable fed one chooses company when there is someone nearby',()=>{
 const f=choose();assert.equal(f(long),'meal');
 assert.equal(f({...long,mealNeed:false,hasCompany:true}),'company');
});
test('a merchant without an urgent need chooses a market break, never an unwalkable goal',()=>{
 const f=choose();assert.equal(f({...long,mealNeed:false,personality:'market'}),'market');
 assert.equal(f({...long,reachable:{},hasCompany:true}),null);
});
test('the visitor does not start an optional trip that cannot fit before returning to duty',()=>{
 const f=choose();assert.equal(f({...long,m:908,hasCompany:true}),null);
});
test('production visitor routine consults context only for an explicit break, before generic movement',()=>{
 assert.match(html,/if\(plan\.freeUntil.*poiTownVisitorChoice/s);
 assert.match(html,/function poiTownNpcRoutine[\s\S]{0,690}poiTownDailyRoutine\(a,clock,now,budget\)/);
});
test('visitor break uses existing movement, does not switch destinations mid-break and resumes the scheduled work',()=>{
 const i=html.indexOf(marker),j=html.indexOf('// END TOWN DAILY LIFE',i),seen=[];
 const west={role:{id:'westpeddler',role:'visitor',public:{x:40,z:44,y:0}},x:42,z:44,y:0,index:2,recessed:false};
 const c=vm.createContext({poiWalkX:42,poiWalkZ:44,poiWalkLevel:0,poiTownNpcActors:[west],poiTownDailyRoad:()=>true,poiTownNpcVersion:0,seen,west,
   poiTownNpcAct:(a,label)=>{a.activity=label},
   poiTownNpcMove:(a,p,label)=>{seen.push([p.x,p.z,label]);return true}});
 const block=html.slice(i,html.indexOf(end,i))+html.slice(html.indexOf('function poiTownDailyPoint',i),html.indexOf('function poiTownDailyRoad',i))+html.slice(html.indexOf('function poiTownDailyRoutine',i),j);
 vm.runInContext(block+`
   const work={goal:{x:42,z:45,y:0},label:'visit',recessed:false},
         breakPlan={goal:{x:52,z:44,y:0},label:'market-browse',recessed:false,freeUntil:900};
   poiTownDailyRoutine(west,{minute:870,absoluteMinute:2310},20,{plans:2},breakPlan);
   poiTownDailyRoutine(west,{minute:889,absoluteMinute:2329},700,{plans:2},breakPlan);
   poiTownDailyRoutine(west,{minute:901,absoluteMinute:2341},1400,{plans:2},work);
 `,c);
 assert.deepEqual(seen,[[39,39,'going-visit'],[39,39,'going-visit'],[42,45,'going-visit']]);
 assert.equal(west.mealDay,1);assert.equal(west.activity,'visit');
});
test('visitor choices are confined to the existing daily routine section',()=>{
 const choices=html.indexOf('// BEGIN TOWN VISITOR CHOICES'),end=html.indexOf('// END TOWN VISITOR CHOICES');
 assert(choices>html.indexOf('// BEGIN TOWN DAILY LIFE')&&end<html.indexOf('// END TOWN DAILY LIFE'));
});
