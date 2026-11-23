const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const readFunction=name=>{
 const start=html.indexOf('function '+name+'('),end=html.indexOf('\n}',start);
 assert(start>=0&&end>start,name);return html.slice(start,end+2);
};
test('gold action shows immediately with loaded wallet and hides when it is empty',()=>{
 const fixture=Function(`
 let balance=21;const drop={hidden:true},amount={textContent:''};
 const $=id=>({poiBagGoldDrop:drop,poiGoldValue:amount}[id]);
 `+readFunction('poiWalletSync')+`
 return {drop,amount,sync:gold=>poiWalletSync(gold)};
 `)();
 fixture.sync(21);assert.equal(fixture.drop.hidden,false);assert.equal(fixture.amount.textContent,'21');
 fixture.sync(0);assert.equal(fixture.drop.hidden,true);assert.equal(fixture.amount.textContent,'');
});
test('bag open and subsequent render both send the authoritative balance to wallet UI',()=>{
 const open=readFunction('poiBagSetOpen'),render=readFunction('poiBagUiRender');
 assert.match(open,/if\(open\)poiWalletSync\(poiEconomyGold\(\)\)/);
 assert.match(render,/\bgold=poiEconomyGold\(\)/);
 assert.match(render,/poiWalletSync\(gold\)/);
 assert.doesNotMatch(render,/\bstate\.gold\b/);
});
