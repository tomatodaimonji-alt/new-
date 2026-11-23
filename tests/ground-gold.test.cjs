const {readFileSync}=require('node:fs');
const assert=require('node:assert/strict');
const {test}=require('node:test');
const html=readFileSync(process.argv[2] || process.env.HTML || 'world-editor.html','utf8');
function get(name){
 const start=html.indexOf('function '+name+'(');
 assert.ok(start>=0,'missing gameplay function '+name);
 const end=html.indexOf('\n}',start);
 return html.slice(start,end+2);
}
test('uses nearest reachable empty cells, with facing-first ties',()=>{
 const nearest=Function(get('poiDropNearestCell')+';return poiDropNearestCell;')();
 const step=(x,z,fx,fz)=>Math.abs(x-fx)+Math.abs(z-fz)===1&&!(x===0&&z===-1);
 const reject=(x,z)=>!(x===1&&z===0);
 assert.deepEqual(nearest(0,0,0,4,step,reject),{x:-1,z:0});
 assert.deepEqual(nearest(0,0,0,4,step,(x,z)=>x===2&&z===0),{x:2,z:0});
 assert.equal(nearest(0,0,0,1,step,(x,z)=>x===2&&z===0),null);
});
test('validates saved piles independently of normal items',()=>{
 const read=Function('const POI_INVENTORY_LIMIT=8,POI_ECONOMY_GOLD_MAX=999999,MAX_MAP=999;const validPos=(x,z)=>x>=0&&z>=0;'+get('poiGroundGoldDecode')+';return poiGroundGoldDecode;')();
 const coin={x:2,z:3,y:-1,amount:5};
 assert.deepEqual(read([coin,coin,{...coin,x:3,amount:0},{...coin,z:12,y:0}]),[coin,{...coin,z:12,y:0}]);
});
test('checks wallet amount, stores two separate piles in one write each, and recovers on the same floor',()=>{
 const make=Function(`
  const POI_ECONOMY_GOLD_MAX=999999;let kit={gold:8,worn:{head:'cap'},goldBagOrder:['wallet']},poiWalkLevel=0;
  let denied=false,writes=0;
  const poiInventoryAllowed=()=>true,poiHotbarRead=()=>kit;
  const poiDropGroundLocation=()=>({location:{x:(kit.groundGold?.length||0)+1,z:2,y:0}});
  const poiEconomyWrite=next=>{if(denied)return false;kit=next;writes++;return true};
  const poiEconomyRefresh=()=>{},poiSound=()=>{},poiMessagePush=()=>true,toast=()=>{};
  `+get('poiWalletGold')+';'+get('poiGroundGoldDrop')+';'+get('poiGroundGoldPickup')+`
  return {drop:poiGroundGoldDrop,pick:poiGroundGoldPickup,kit:()=>kit,
   deny:v=>denied=v,floor:v=>poiWalkLevel=v,writes:()=>writes,cap:()=>kit={...kit,gold:999998}};
 `);
 const game=make(),before=game.kit();
 assert.equal(game.drop(1.5).reason,'amount');assert.equal(game.drop(9).reason,'amount');
 game.deny(true);assert.equal(game.drop(3).reason,'storage');assert.equal(game.kit(),before);
 game.deny(false);assert.ok(game.drop(3).ok);assert.ok(game.drop(2).ok);
 assert.equal(game.writes(),2);assert.deepEqual(game.kit().groundGold,[{x:1,z:2,y:0,amount:3},{x:2,z:2,y:0,amount:2}]);
 assert.equal(game.kit().gold,3);assert.equal(game.kit().worn,before.worn);assert.equal(game.kit().goldBagOrder,before.goldBagOrder);
 game.floor(-1);assert.equal(game.pick(1,2),false);game.floor(0);
 game.deny(true);assert.equal(game.pick(1,2),false);assert.equal(game.kit().gold,3);
 game.deny(false);assert.equal(game.pick(1,2),true);assert.equal(game.kit().gold,6);
 game.cap();assert.equal(game.pick(2,2),true);assert.equal(game.kit().gold,999999);assert.equal(game.kit().groundGold[0].amount,1);
});
