const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const grab=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i+1);assert(i>=0&&j>i,'missing '+a);return html.slice(i,j)};
test('paper doll reserves the top-right 4×4 without losing any writable inventory cell',()=>{
 const slots=[...html.matchAll(/<button type="button" data-bag-slot="(\d+)"([^>]*)>/g)];
 assert.deepEqual(slots.filter(r=>!/\bhidden\b/.test(r[2])).map(r=>+r[1]),Array.from({length:29},(_,i)=>i));
 assert.deepEqual(slots.filter(r=>!/\bdisabled\b/.test(r[2])).map(r=>+r[1]),Array.from({length:18},(_,i)=>i));
 assert.deepEqual([...html.matchAll(/<button type="button" data-gear-slot="([^"]+)"/g)].map(r=>r[1]),['head','torso','legs','feet']);
 assert.match(html,/#poiGearColumn\{[^}]*grid-column:6;grid-row:1\/5/);
 assert.match(html,/#poiAvatarPreview\{[^}]*grid-column:7\/10;grid-row:1\/5/);
 assert.match(html,/:is\(#poiBagClose,#poiChestClose\)\{/);
 assert.match(html,/<button id="poiBagClose"[^>]+aria-label="インベントリを閉じる"[^>]*>×<\/button>/);
});
test('real standing mesh depicts all gear, and idle held blade points slightly further forward',()=>{
 const x={mesh:()=>({p:[],n:[],c:[]})};
 vm.createContext(x);
 vm.runInContext(grab('function tri(','function addPart(')+grab('function characterHuman(','function roundStack(')+
  grab('function poiBuildPlayerMesh(','const POI_MONSTER_BREAK_MS='),x);
 x.deco=(m,id)=>x.cube(m,0,.25,0,.12,1.1,.10,[.8,.6,.3]);
 const naked=x.poiBuildPlayerMesh(null,null,null),outfit={head:{type:'starterCap'},torso:{type:'starterTunic'},legs:{type:'starterTrousers'},feet:{type:'starterBoots'}};
 for(const part of Object.keys(outfit)){
  const one=x.poiBuildPlayerMesh(null,null,{[part]:outfit[part]});
  assert(one.p.length>naked.p.length,part);
 }
 assert(x.poiBuildPlayerMesh(null,null,outfit).p.length>naked.p.length);
 assert.deepEqual(x.poiBuildPlayerMesh(null,null,Object.fromEntries(Object.entries(outfit).map(([part,cell])=>[part,cell.type]))).p,
  x.poiBuildPlayerMesh(null,null,outfit).p,'raw cached kit and inventory preview generate identical geometry');
 const old=x.poiBuildPlayerMesh('equipWoodSword',{edgeTilt:.18},null),ready=x.poiBuildPlayerMesh('equipWoodSword',null,null);
 const front=m=>Math.max(...m.p.slice(naked.p.length).filter((_,i)=>i%3===2));
 assert(front(ready)>front(old)+.045);
 assert.match(html,/poiWalkMesh=upload\(poiBuildPlayerMesh\(/);
 assert.match(html,/modelMesh:poiBuildPlayerMesh\(/);
});
