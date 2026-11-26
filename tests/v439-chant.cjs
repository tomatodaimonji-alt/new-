const {readFileSync}=require('node:fs'),vm=require('node:vm'),a=require('node:assert/strict'),{test}=require('node:test');
const h=readFileSync(process.argv[2]||'candidate.html','utf8');
const cut=(s,b,e)=>{const i=s.indexOf(b),j=s.indexOf(e,i+b.length);a(i>=0&&j>i,b);return s.slice(i,j)};
function world(){
 const c=vm.createContext({});vm.runInContext(cut(h,'function tri(m,','function cube(')+cut(h,'function characterArmRotation(','function roundStack(')+
  cut(h,'const POI_PLAYER_BLOCK_ARM=','function poiPlayerArmCrate(')+cut(h,'function poiRegnaChantVisual(','function poiIceFangDraw(')+
  'const a={},q={owner:"frontierregna",actor:a,source:"resident",caster:{x:5,z:4},s:{x:7,z:4},start:20,hit:1200,done:false};a.frontierSkillCast=q;',c);
 return s=>JSON.parse(JSON.stringify(vm.runInContext(s,c)));
}
test('right wrist genuinely extends forward in existing rig, circle draws progressively and stops on impact',()=>{
 const r=world(),w=t=>r('poiRegnaChantHand(poiRegnaChantVisual(a,'+t+',"resident"),5,0,4,'+t+');q.visualHand');
 const zero=w(20),reach=w(350);a(reach.x-zero.x>.24&&reach.y-zero.y>.20);
 const verts=(u,t)=>r('(()=>{const m={p:[],n:[],c:[]};poiRegnaChantCircle(m,q,'+t+','+u+');return m.p})()');
 a.equal(verts(0,350).length,0);
 const low=verts(.21,350),mid=verts(.47,350),last=verts(.98,350);
 a(low.length>0&&low.length<mid.length&&mid.length<last.length&&last.length<=930);
 const x=last.filter((_,i)=>i%3===0);a(Math.min(...x)>reach.x+.18&&Math.max(...x)<reach.x+.20);
 a.equal(verts(.45,550).length,0);r('q.done=true');a.equal(verts(.8,350).length,0);
});
test('scoped already-casting party and resident only; actual game skill/target effect logic unchanged',()=>{
 const r=world();
 a.equal(r('poiRegnaChantVisual(a,350,"party")'),null);
 a.equal(r('q.source="party";!!poiRegnaChantVisual(a,350,"party")'),true);
 a.equal(r('poiRegnaChantVisual(a,1200,"party")'),null);
 a.equal(r('q.owner=null;poiRegnaChantVisual(a,350,"party")'),null);
});
