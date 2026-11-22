const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const h=fs.readFileSync(process.env.HTML||path.join(__dirname,'..','world-editor.html'),'utf8');
test('money has one inventory cell, not a header, HUD or saved stack',()=>{
 assert.doesNotMatch(h,/id="poiGoldHud"/);
 assert.match(h,/<div id="poiBagSlots">[\s\S]*?data-bag-slot="8"[\s\S]*?id="poiBagWallet"[\s\S]*?id="poiGoldValue">0<\/strong>[\s\S]*?data-bag-slot="9"/);
 assert.match(h,/<div id="poiClockHud" hidden>[^\n]+id="poiClockValue"/);
 assert.equal((h.match(/id="poiGoldValue"/g)||[]).length,1);
 assert.match(h,/if\(open\).*poiWalletSync\(poiEconomyGold\(\)\)/);
});
test('wallet updater renders exact changed balance including zero without side effects',()=>{
 const a=h.indexOf('function poiWalletSync('),b=h.indexOf('function poiShopSync(',a);
 assert.ok(a>=0&&b>a);
 let value='0',writes=0;
 const node={get textContent(){return value},set textContent(x){writes++;value=x}};
 const c=vm.createContext({$:id=>id==='poiGoldValue'?node:null});
 vm.runInContext(h.slice(a,b),c);c.poiWalletSync(963);c.poiWalletSync(963);
 assert.deepEqual([value,writes],['963',1]);
 c.poiWalletSync(0);assert.equal(value,'0');
});
