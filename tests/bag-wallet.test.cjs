const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const h=fs.readFileSync(process.env.HTML||path.join(__dirname,'..','world-editor.html'),'utf8');
test('money has one compact inventory header readout next to close, not a HUD or saved slot',()=>{
 assert.doesNotMatch(h,/id="poiGoldHud"/);
 assert.match(h,/<div id="poiBagHeading">インベントリ<\/div>\s*<div id="poiBagWallet"><span>金貨<\/span><strong id="poiGoldValue">0<\/strong><\/div>\s*<button id="poiBagClose"/);
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
