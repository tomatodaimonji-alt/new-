const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const readFunction=name=>{
 const start=html.indexOf('function '+name+'('),end=html.indexOf('\n}',start);
 assert(start>=0&&end>start,name);return html.slice(start,end+2);
};
test('wallet immediately shows loaded balance, and an empty wallet has no drop affordance',()=>{
 const fixture=Function(`
 const amount={textContent:''},attrs=new Map(),wallet={
  hasAttribute:k=>attrs.has(k),getAttribute:k=>attrs.get(k),setAttribute:(k,v)=>attrs.set(k,v),
  toggleAttribute:(k,on)=>on?attrs.set(k,''):attrs.delete(k)
 };
 const $=id=>({poiBagWallet:wallet,poiGoldValue:amount}[id]);
 `+readFunction('poiWalletSync')+`
 return {wallet,amount,sync:gold=>poiWalletSync(gold)};
 `)();
 fixture.sync(21);assert.equal(fixture.wallet.hasAttribute('data-wallet-empty'),false);
 assert.equal(fixture.wallet.getAttribute('aria-label'),'金貨 21');assert.equal(fixture.amount.textContent,'21');
 fixture.sync(0);assert.equal(fixture.wallet.hasAttribute('data-wallet-empty'),true);
 assert.equal(fixture.wallet.getAttribute('aria-label'),'空の金貨枠');assert.equal(fixture.amount.textContent,'');
 assert.doesNotMatch(html,/poiBagGoldDrop/);
});
test('bag open and subsequent render both send the authoritative balance to wallet UI',()=>{
 const open=readFunction('poiBagSetOpen'),render=readFunction('poiBagUiRender');
 assert.match(open,/if\(open\)poiWalletSync\(poiEconomyGold\(\)\)/);
 assert.match(render,/\bgold=poiEconomyGold\(\)/);
 assert.match(render,/poiWalletSync\(gold\)/);
 assert.doesNotMatch(render,/\bstate\.gold\b/);
});
