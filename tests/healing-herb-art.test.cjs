const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||path.join(__dirname,'../world-editor.html'),'utf8');
function cut(a,b){const i=html.indexOf(a),j=html.indexOf(b,i+1);assert(i>=0&&j>i,a);return html.slice(i,j);}
test('private herb geometry is low-poly, stands on its tile and shares the thumbnail dispatcher',()=>{
 const draw=vm.runInNewContext(cut('function tri(','function diamond(')+cut('function naturalBranch(','function naturalCrown(')+
  cut('function poiDrawHealingHerb(','function deco(')+
  `;(x,y,z)=>{const m={p:[],n:[],c:[]};poiDrawHealingHerb(m,x,y,z);return m}`);
 const {p,n,c}=draw(18,3,11),v=[];
 for(let i=0;i<p.length;i+=3)v.push(p.slice(i,i+3));
 assert(p.length/9>35&&p.length/9<150);
 assert.equal(p.length,n.length);assert.equal(p.length,c.length);
 assert(v.every(([x,y,z])=>Math.abs(x-18)<.45&&Math.abs(z-11)<.45&&y>=3&&y<3.85));
 assert(v.some(([,y])=>y<3.045)&&v.some(([,y])=>y>3.54));
 assert(c.some((v,i)=>i%3===1&&v>.65),'bright young leaves pop against the hotbar');
 assert.match(html,/if\(id==='poiHealingHerb'\)\{poiDrawHealingHerb\(m,x,y,z\);return\}/);
 assert.doesNotMatch(html,/\{id:'poiHealingHerb',name:/,'not a palette/save object');
});
test('inventory icon requests the same private herb and renders only once with transparent margins',()=>{
 const assets=[];
 const ctx=vm.createContext({document:{createElement:tag=>({tag,dataset:{}})},drawWallThumbnail(cv,id,options){assets.push({cv,id,options});return true;}});
 vm.runInContext(cut('let poiHealingHerbIconCache=','function poiHotbarSwordIcon('),ctx);
 const a=ctx.poiHotbarHerbIcon(),b=ctx.poiHotbarHerbIcon();
 assert.equal(a,b);assert.equal(assets.length,1);assert.equal(assets[0].id,'poiHealingHerb');
 assert.deepEqual([a.width,a.height,a.dataset.itemModel],[96,96,'poiHealingHerb']);
 assert.equal(assets[0].options.transparent,true);assert.equal(assets[0].options.rot,0);
});
