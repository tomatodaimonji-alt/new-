const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(process.env.HTML||path.join(__dirname,'../world-editor.html'),'utf8');
test('NPC bag contains only positive carried holdings and model-backed gear, never commerce stock',()=>{
 const a=html.indexOf('function poiNpcInventoryItems('),b=html.indexOf('function poiNpcInventoryView(',a);
 assert(a>=0&&b>a,'read-only inventory item projection missing');
 const c=vm.createContext({});vm.runInContext(html.slice(a,b),c);
 const inventory=(coins,herbs)=>JSON.parse(JSON.stringify(c.poiNpcInventoryItems({coins,herbs,stock:{cannedFood:9}})));
 assert.deepEqual(inventory(5,2),[{type:'gold',count:5},{type:'healingHerb',count:2}]);
 assert.deepEqual(inventory(0,0),[]);assert.deepEqual(inventory(-1,0),[]);
});
