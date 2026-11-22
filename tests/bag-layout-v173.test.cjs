const assert=require('node:assert/strict');
const {test}=require('node:test');
const html=require('node:fs').readFileSync(process.env.HTML||'world-editor.html','utf8');
test('Bag holds exactly five visible rows of five, apart from equipment and portrait',()=>{
 const slots=html.split('<div id="poiBagSlots">')[1]?.split('</div>')[0]||'';
 const cells=[...slots.matchAll(/<button[^>]*data-bag-slot="(\d+)"[^>]*>/g)];
 assert.deepEqual(cells.filter(x=>!x[0].includes(' hidden')).map(x=>+x[1]),Array.from({length:24},(_,i)=>i));
 assert.match(slots,/data-bag-slot="8"[\s\S]*id="poiBagWallet"[\s\S]*id="poiGoldValue"[\s\S]*data-bag-slot="9"/);
 assert.doesNotMatch(html.split('<section id="poiBagPanel"')[1].split('<div id="poiBagGrid"')[0],/金貨|poiBagWallet/);
 assert.match(html,/#poiBagSlots\{[^}]*grid-template-columns:repeat\(5,var\(--poi-bag-cell\)\)[^}]*grid-template-rows:repeat\(5,var\(--poi-bag-cell\)\)/);
 assert.match(html,/#poiBagGrid\{[^}]*column-gap:8px/);
 assert.match(html,/#poiBagSlots\{grid-column:1;grid-row:1/);
 assert.match(html,/#poiBagGear\{grid-column:2;grid-row:1/);
 const gear=html.split('<div id="poiBagGear">')[1]?.split('</canvas>')[0]||'';
 assert.equal((gear.match(/data-gear-slot=/g)||[]).length,4);
 assert.match(gear,/<canvas id="poiAvatarPreview"/);
});
test('Chest retains two rows and the hotbar retains all nine existing controls',()=>{
 assert.match(html,/#poiChestGrid\{[^}]*grid-template-columns:repeat\(9,[^}]*grid-template-rows:repeat\(2,/);
 assert.deepEqual([...html.matchAll(/<button[^>]*data-hotbar-slot="(\d+)"/g)].map(x=>+x[1]),Array.from({length:9},(_,i)=>i));
});
