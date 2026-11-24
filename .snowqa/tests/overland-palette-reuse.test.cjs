const test=require('node:test'),a=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const h=fs.readFileSync(process.env.PALETTE_HTML||'world-editor.html','utf8');
function cut(a,b){const i=h.indexOf(a),j=h.indexOf(b,i+1);if(i===-1||j<i)return '';return h.slice(i,j)}
test('only a held crossing may reuse the exact already-presented base palette',()=>{
 const site={id:'base'},objects=[],models=[],prefabs=[],selected='treeOak';
 const p={site,objects,models,prefabs,selected},args=[site,objects,models,prefabs,selected,true];
 const reuse=vm.runInNewContext(cut('let poiOverlandPalettePresentation','function refreshPalette')+'\nthis.poiOverlandPaletteCanReuse');
 a.equal(typeof reuse,'function','isolated narrow palette reuse eligibility');
 a.equal(reuse(p,...args),true);
 a.equal(reuse(null,...args),false);
 for(let i=0;i<args.length;i++){
  const changed=args.map((v,k)=>i===k?null:v);
  a.equal(reuse(p,...changed),false);
 }
});
