const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
test('real shortcut and inventory grids expose nine hotbar cells and two of five available rows',()=>{
 assert.equal((html.match(/<button type="button" data-hotbar-slot="/g)||[]).length,9);
 const bag=[...html.matchAll(/<button type="button" data-bag-slot="(\d+)"([^>]*)>/g)];
 assert.deepEqual(bag.map(m=>[+m[1],/ disabled\b/.test(m[2])]),Array.from({length:45},(_,i)=>[i,i>=18]));
 assert.match(html,/<button id="poiBagToggle"[^>]*aria-label="インベントリ"[^>]*aria-expanded="false" aria-controls="poiBagPanel"/);
 assert.match(html,/#poiBagGrid\{[^}]*grid-template-columns:repeat\(9,minmax\(0,1fr\)\)[^}]*grid-template-rows:repeat\(5,minmax\(0,1fr\)\)/);
});
test('a locked slot or protected UI cannot become a world drop',()=>{
 const a=html.indexOf('function poiBagGestureTarget('),b=html.indexOf('function poiBagWire()',a);
 assert(a>=0&&b>a);const scope=vm.createContext({});
 vm.runInContext(html.slice(a,b),scope);
 const stage={left:0,top:0,right:320,bottom:690};
 const box={left:10,top:200,right:310,bottom:400};
 const f=(pt,move,slot=null,blocked=false)=>scope.poiBagGestureTarget(pt,move,slot,blocked,stage,[box]);
 assert.equal(f({x:31,y:240},40,{disabled:true}),null);
 assert.equal(f({x:31,y:240},40),null);
 const slot={disabled:false};assert.equal(f({x:31,y:240},20,slot).slot,slot);
 assert.equal(f({x:9,y:120},40,null,true),null);
 assert.equal(f({x:-10,y:120},40),null);
 assert.equal(f({x:100,y:110},20),null);
 assert.equal(f({x:100,y:110},40).kind,'drop');
});
