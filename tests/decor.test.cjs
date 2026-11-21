const {test}=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const seg=(x,y)=>{const a=html.indexOf(x),b=html.indexOf(y,a+1);assert(a>=0&&b>a);return html.slice(a,b)};
test('Decorations category and AI IDs are additive',()=>{
 assert.match(html,/label:'装飾品'/);
 for(const type of ['poiLedgerPapers','poiPenHolder']) {
  assert.match(html,new RegExp("id:'"+type+"'"));
  assert.match(html,new RegExp('"number":"[0-9]+","id":"'+type+'"'));
 }
});
test('Editor stacks two decorations on top of a table without replacing it; erase peels one off',()=>{
 const world=[{x:2,z:2,y:0,type:'woodfloor',rot:0},{x:2,z:2,y:0,type:'table',rot:0}];
 const c=vm.createContext({world,level:0,mode:'place',selected:'poiLedgerPapers',rotation:0,pineGameActive:false,poiWalkActive:false,prefabs:[],
  pineObjectSelection:null,pineSelectedTile:null,validPos:()=>true,ROAD_IDS:new Set(),MATCHED_COUNTER_IDS:new Set(),byId:()=>true,snapshot(){},commit(){},updateSelected(){},toast(){},
  pineSetWorldSelection(o,x,z){c.pineObjectSelection=o;c.pineSelectedTile={x,z,y:0}}
 });
 vm.runInContext(seg('function isFloor(t)','function stampPrefab(')
  +'changeCell(2,2);selected="poiPenHolder";changeCell(2,2);changeCell(2,2);',c);
 assert.deepEqual(world.map(o=>o.type),['woodfloor','table','poiLedgerPapers','poiPenHolder']);
 c.mode='erase';
 vm.runInContext('changeCell(2,2);changeCell(2,2);',c);
 assert.deepEqual(world.map(o=>o.type),['woodfloor','table','poiLedgerPapers']);
});
test('Decor uses real support height only on the matching tile and floor',()=>{
 if(!html.includes('const PINE_TABLETOP_KINDS='))assert.fail('missing tabletop geometry helpers');
 const c=vm.createContext({MATCHED_COUNTER_IDS:new Set(['stonewallCounter'])});
 const out=vm.runInContext(seg('const PINE_TABLETOP_KINDS=','// v63: two-stage editor actions')+`
 const a={type:'poiLedgerPapers',x:4,z:7,y:-1};
 const b={type:'poiPenHolder',x:4,z:7,y:0};
 const c={type:'bowlClay',x:4,z:7,y:1};
 const support=pineTabletopSupportIndex([{...a,type:'roundTableWood'},{...b,type:'counterWood'},{...c,type:'stonewallCounter'}]);
 [pineTabletopElevation(a,support),pineTabletopElevation(b,support),pineTabletopElevation(c,support),
 pineTabletopElevation({...b,y:2},support),pineTabletopElevation({x:4,z:7,y:0,type:'table'},support)]
 `,c);
 assert.deepEqual([...out],[.80,.988,.984,0,0]);
 assert.match(html,/pineDrawTabletopDecor\(m,o,tabletopSupports,tabletopCeilings\)/);
});
test('Rotated prefab keeps its tabletop stack; legacy generic placements still replace',()=>{
 const world=[{x:5,z:7,y:0,type:'woodfloor',rot:0},{x:5,z:7,y:0,type:'oldStatue',rot:0}];
 const prefabs=[{id:'saved',w:2,h:1,tiles:[{x:1,z:0,y:0,type:'poiLedgerPapers',rot:2},
 {x:1,z:0,y:0,type:'woodfloor',rot:0},{x:1,z:0,y:0,type:'table',rot:1},
 {x:1,z:0,y:0,type:'poiPenHolder',rot:0},
 {x:0,z:0,y:0,type:'barrel',rot:2},{x:0,z:0,y:0,type:'crate',rot:0}]}];
 const ctx=vm.createContext({world,prefabs,selected:'saved',rotation:1,level:0,ROAD_IDS:new Set(),
 MATCHED_COUNTER_IDS:new Set(),validPos:()=>true,facilitySite:null,MAX_LEVEL:9,snapshot(){},commit(){},toast(){}});
 vm.runInContext(seg('function isFloor(t)','function updateStats()')+'stampPrefab(5,6);',ctx);
 assert.deepEqual(world.filter(o=>o.x===5&&o.z===7).map(o=>[o.type,o.rot]),
  [['woodfloor',1],['table',2],['poiLedgerPapers',3],['poiPenHolder',1]]);
 assert.deepEqual(world.filter(o=>o.x===5&&o.z===6).map(o=>o.type),['crate']);
});
test('Decor without furniture does not outrank legacy overlap selection',()=>{
 const world=[{x:2,z:2,y:0,type:'basketProduce',rot:0},{x:2,z:2,y:0,type:'crate',rot:0}];
 const ctx=vm.createContext({world,level:0,ROAD_IDS:new Set(),MATCHED_COUNTER_IDS:new Set()});
 assert.equal(vm.runInContext(seg('function isFloor(t)','function pineApplyObjectAction(')+'pineWorldObjectAt(2,2).type',ctx),'crate');
});
test('Clicking objects > decorations > writing > ledger selects it as place brush',()=>{
 const node=tag=>({tag,children:[],events:{},appendChild(o){this.children.push(o)},append(...o){this.children.push(...o)},replaceChildren(){this.children=[]},
   addEventListener(k,v){this.events[k]=v}});
 const root=node('main');
 const catalog=new Map([['poiLedgerPapers',{name:'帳簿と書類'}],['poiPenHolder',{name:'羽根ペン立て'}]]);
 const ctx=vm.createContext({document:{createElement:node},$:()=>root,catalog,
  selected:'wall',mode:'move',objectExpanded:false,
  expandableRow(label,icon,open,fn){const o=node('button');o.textContent=label;o.events.click=fn;return o},
  updateSelected(){},refreshPalette(){},drawWallThumbnail(){},toast(){}});
 vm.runInContext(seg('function selectableTile(','function openWallSelector(')+
  seg('const OBJECT_GROUPS=','let characterExpanded=')+'renderObjectList()',ctx);
 const find=(node,label)=>node.textContent===label||node.title===label?node:node.children.map(v=>find(v,label)).find(Boolean);
 for(const label of ['オブジェクト','装飾品','帳簿・筆記具','帳簿と書類']){
  const btn=find(root,label);assert(btn?.events.click,'missing clickable '+label);btn.events.click();
 }
 assert.equal(ctx.selected,'poiLedgerPapers');assert.equal(ctx.mode,'place');
});
test('Prefab cannot partially stamp a wall that would orphan existing tabletop items',()=>{
 for(const type of ['poiLedgerPapers','basketProduce']){
  const world=[{x:5,z:7,y:0,type:'table',rot:0},{x:5,z:7,y:0,type,rot:0}];
  const prior=JSON.stringify(world), prefabs=[{id:'saved',w:2,h:1,tiles:[
   {x:0,z:0,y:0,type:'brickfloor',rot:0},{x:1,z:0,y:0,type:'stonewall',rot:0}]}];
  const events=[];
  const ctx=vm.createContext({world,prefabs,selected:'saved',rotation:1,level:0,ROAD_IDS:new Set(),
   MATCHED_COUNTER_IDS:new Set(),validPos:()=>true,facilitySite:null,MAX_LEVEL:9,
   snapshot(){events.push('undo')},commit(){events.push('save')},toast(msg){events.push(msg)}});
  vm.runInContext(seg('function isFloor(t)','function updateStats()')+'stampPrefab(5,6);',ctx);
  assert.equal(JSON.stringify(world),prior);
  assert.equal(events.length,1);
  assert.match(events[0],/装飾品/);
 }
});
test('Tall stacked decorations fit under a real same-tile next floor only',()=>{
 assert(html.includes('function pineDrawTabletopDecor('),'missing tabletop clearance');
 const ctx=vm.createContext({MATCHED_COUNTER_IDS:new Set(),isFloor:t=>t==='woodfloor',terrainY:()=>.2,
  mesh:()=>({p:[],n:[],c:[]}),deco(m,id,x,y,z,rot){
   m.p.push(x-.2,y,z+.1,x+.2,y+.7,z-.1);m.n.push(1,0,0,0,1,0);m.c.push(.3,.4,.5,.5,.4,.3);
  }});
 const counts=vm.runInContext(seg('const PINE_TABLETOP_KINDS=','// v63: two-stage editor actions')+`
  const o={type:'jugClay',x:4,z:7,y:0,rot:3};
  const support=pineTabletopSupportIndex([{...o,type:'counterWood'}]);
  const m=mesh(),n=mesh(),ordinary=mesh();
  const y0=1.188;
  pineDrawTabletopDecor(m,o,support,pineTabletopCeilings([{...o,type:'woodfloor',y:1}]));
  pineDrawTabletopDecor(n,o,support,pineTabletopCeilings([{...o,type:'woodfloor',y:1,x:5}]));
  pineDrawTabletopDecor(ordinary,o,new Map(),pineTabletopCeilings([{...o,type:'woodfloor',y:1}]));
  [m.p[1],m.p[4],n.p[4],ordinary.p[4],m.n.length,m.c.length,y0]
 `,ctx);
 const [base,capped,open,standalone,normals,colors,expectedBase]=counts;
 assert(Math.abs(base-expectedBase)<1e-9);
 assert(capped<1.6 && capped>1.5);
 assert(Math.abs(open-1.888)<1e-9);
 assert(Math.abs(standalone-.9)<1e-9);
 assert.equal(normals,6);assert.equal(colors,6);
});
