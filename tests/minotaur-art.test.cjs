const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.argv[2]||process.env.HTML||'world-editor.html','utf8');
const cut=(a,b)=>{let i=h.indexOf(a),j=h.indexOf(b,i+a.length);assert(i>=0&&j>i,'missing '+a);return h.slice(i,j)};
function fixture(){
 const geo=cut('// BEGIN NORTH MINOTAUR ART','// END NORTH MINOTAUR ART');
 const base='function mesh(){return {p:[],n:[],c:[]}}\n'+cut('function tri(m,','function addPart(m,')+cut('function naturalBranch(m,','function naturalCrown(m,');
 return vm.runInNewContext(base+geo+';({art:poiNorthMinotaurGeometry,pose:poiNorthMinotaurArtPose,mesh})');
}
function bounds(m,filter=()=>true){
 const p=[];
 for(let i=0;i<m.p.length;i+=3)if(filter(m.c.slice(i,i+3)))p.push(m.p.slice(i,i+3));
 assert(p.length>0);
 return [0,1,2].map(k=>[Math.min(...p.map(v=>v[k])),Math.max(...p.map(v=>v[k]))]);
}
const horn=col=>col[0]>.67&&col[1]>.53&&col[2]>.31&&col[0]>col[2]+.1;
const steel=col=>col[2]>.40&&col[2]>col[0]+.025;
test('native monster routing and dynamic pose, not a replacement for another enemy',()=>{
 assert.match(h,/case 'monsterNorthMinotaur':\s*poiNorthMinotaurGeometry\(m,x,y,z\);break/);
 assert.match(h,/art==='monsterNorthMinotaur'.{0,90}poiNorthMinotaurArtPose\(attack\?s\.playerAttack:null,now\)/s);
 assert.match(h,/case 'monsterMineGuard':\s*\{\s*\/\/ An abandoned slate/);
});
test('low-poly geometry has matching normal/colour channels, prominent twin pale horns and broad steel axe',()=>{
 const {art,mesh}=fixture(),m=mesh();art(m,0,0,0);
 assert.equal(m.p.length,m.n.length);assert.equal(m.p.length,m.c.length);
 assert(m.p.length/3<4200,'bounded per pose');assert(m.p.length/3>900,'substantial silhouette');
 assert(m.p.concat(m.n,m.c).every(Number.isFinite));
 const total=bounds(m),a=bounds(m,horn),b=bounds(m,steel);
 assert(total[1][0]<=.002&&total[1][1]>=2.45);
 assert(a[0][0]<-.69&&a[0][1]>.69&&a[1][1]>2.45,'symmetric projecting bone tips');
 assert(b[1][1]-b[1][0]>.29&&b[0][1]-b[0][0]>.25,'steel head spans a visible silhouette');
});
test('charge lowers and thrusts pale horns while axe launches through a different space',()=>{
 const {art,mesh,pose}=fixture();
 const model=(a,t)=>{const m=mesh();art(m,0,0,0,pose(a,t));return m};
 const neutral=model(null,0);
 const hornWind={northAttack:'horn',start:0,hit:700,pending:true},axeWind={northAttack:'axe',start:0,hit:700,pending:true};
 const crouch=model(hornWind,690),backswing=model(axeWind,530),
  across=model({...axeWind,pending:false,visualHitAt:700},700),
  finish=model({...axeWind,pending:false,visualHitAt:700},816);
 const nh=bounds(neutral,horn),ch=bounds(crouch,horn),bb=bounds(backswing,steel),
  ab=bounds(across,steel),fb=bounds(finish,steel);
 assert(ch[1][1]<nh[1][1]-.29&&ch[2][1]>nh[2][1]+.30);
 assert(bb[0][0]>.9&&bb[2][0]<-.35,'axe drawn on right back flank');
 assert(ab[2][0]>1.20&&ab[0][0]<.6,'steel head passes through forward center at contact');
 assert(fb[0][1]<-.8,'steel head crosses to the opposite flank');
 const heights=[bb[1],ab[1],fb[1]].map(([low,high])=>(low+high)/2);
 assert(Math.max(...heights)-Math.min(...heights)<.18,'the complete blade stays roughly horizontal');
});
test('palette name, neutral model height and lock anchor have matching AI registry without duplicate IDs',()=>{
 assert.match(h,/{id:'monsterNorthMinotaur',name:'ミノタウロス',icon:'♉',cat:'character'}/);
 assert.match(h,/const POI_ENEMY_HEAD_HEIGHT=\{[^}]*monsterNorthMinotaur:2\.66/);
 assert.match(h,/const POI_COMBAT_TORSO_HEIGHT=\{[^}]*monsterNorthMinotaur:1\.51/);
 const entries=JSON.parse(h.match(/const pineAINumberEntries=(.*);\n/)[1]);
 assert.deepEqual(entries.filter(e=>e.id==='monsterNorthMinotaur'),[{number:'360',id:'monsterNorthMinotaur',name:'ミノタウロス'}]);
 assert.equal(entries.filter(e=>e.number==='360').length,1);
});
