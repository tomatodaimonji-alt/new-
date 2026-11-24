const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(a,b)=>{const i=h.indexOf(a),j=h.indexOf(b,i+1);if(i<0||j<=i)throw Error('renderer block not found: '+a);return h.slice(i,j)};
function wasm(){
 const c=vm.createContext({terrainY:()=>0,facilitySite:{id:'base',davidTemple:{boss:{x:24,z:104,y:0,type:'monsterStoneDavid'}}}});
 vm.runInContext(cut('function tri(m,a,b,c,col){','function rot2(x,z,r)')+
   cut('// BEGIN STONE DAVID VISUAL','// END STONE DAVID VISUAL')+h.match(/^const POI_DAVID_AWAKENING=.*;/m)[0]+'\n'+
   cut('function poiMonsterPose(obj,s,now,locomotionOnly=false){','function poiMonsterFragmentTemplate(type)'),c);
 return c;
}
const sample=(c,p)=>JSON.parse(vm.runInContext(`(()=>{const m={p:[],n:[],c:[]};const d=poiDavidGeometry(m,0,0,0,${JSON.stringify(p)});return JSON.stringify({m,d})})()`,c));
test('the one dormant authored David presents his real face toward northern entrance, not south',()=>{
 const c=wasm();
 const heading=vm.runInContext("poiMonsterPose({x:24,y:0,z:104,type:'monsterStoneDavid'},{x:24,z:104},0).heading",c);
 a.equal(heading,Math.PI);
 const ctl=vm.runInContext("poiMonsterPose({x:25,y:0,z:104,type:'monsterStoneDavid'},{x:25,z:104},0).heading",c);
 a.equal(ctl,undefined);
});
test('carved dormant surface stays fixed, keeps size and gives actual head mesh limited extra detail',()=>{
 const c=wasm(),d=sample(c,{phase:'dormant'}),again=sample(c,{phase:'dormant',progress:1});
 a.deepEqual(d,again);
 const {p,c:colors}=d.m,max=Math.max(...p.filter((v,i)=>i%3===1));
 a.ok(max>4.95&&max<5.33);
 a.ok(p.length<=6900);
 a.ok(!colors.some((v,i)=>i%3===0&&v>.89&&colors[i+1]<.30));
 a.ok(p.some((x,i)=>i%3===0&&x>.43&&p[i+1]>4.56&&p[i+1]<4.86),'ear is a physical front-profile relief, not painted on an existing block');
 a.ok(p.filter((v,i)=>i%3===1&&v>4.99).length>36,'visible irregular crown relief');
});
test('only the sculpture head rotates along actual beam sweep; hand and sword contact stays unchanged',()=>{
 const c=wasm(),zero=sample(c,{phase:'beam-sweep',kind:'beam',dx:0,dz:1,beamDx:0,beamDz:1});
 const heading=.8,side=sample(c,{phase:'beam-sweep',kind:'beam',dx:0,dz:1,beamDx:Math.sin(heading),beamDz:Math.cos(heading)});
 const eye=(r,i)=>r.d.eyes.reduce((n,p)=>n+p[i],0)/2;
 a.ok(Math.abs(eye(side,0)-.29*Math.sin(heading))<1e-8);
 a.ok(Math.abs(eye(side,2)-.29*Math.cos(heading))<1e-8);a.equal(eye(side,1),4.75);
 for(const k of ['hands','swordTips','feet'])a.deepEqual(zero.d[k],side.d[k]);
 a.notDeepEqual(zero.m.p,side.m.p);
 a.ok(side.m.c.some((v,i)=>i%3===0&&v>.89&&side.m.c[i+1]<.30));
});

