const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function load(project){
 const s=h.indexOf('// BEGIN ENEMY HEALTH GEOMETRY'),e=h.indexOf('// END ENEMY HEALTH GEOMETRY');
 const x=h.indexOf('function poiDavidHeadPoint('),y=h.indexOf('const POI_DAVID_GAIT_STRIDE=',x);
 const d=h.indexOf('function poiDavidLeapCrouch('),f=h.indexOf('function poiDavidRig(',d);
 a(d>=0&&f>d,'same real leap/crouch rig is shared with bar');
 return Function('poiWorldToScreen',h.slice(x,y)+h.slice(d,f)+
 'const '+h.match(/POI_DAVID_CROWN_RIM=\[[^\]]+\];/)[0]+h.match(/const POI_MINOTAUR_HORN_TIP=\[[^\]]+\];/)[0]+
 h.slice(h.indexOf('function poiDavidLeapBodyY('),h.indexOf('function poiDavidMakePrism('))+
 h.match(/function rot2\([^\n]+/)[0]+'\n'+
 h.slice(s,e)+';return poiEnemyHealthAnchor')(project);
}
test('Orvas low angle anchors near actual crown rather than projected full body front corners',()=>{
 const anchor=load((_v,x,y,z)=>({x:x*12,y:800-y*55-z*45}));
 const origin={x:4,y:0,z:10,heading:0,scale:1},box={top:5.2,radius:1.5};
 const before=anchor(null,origin,box),after=anchor(null,origin,{crown:'orvas'});
 a(after.y>before.y+45);a(Math.abs(after.y-(800-5.095*55-10*45))<12);
 const standard=load((_v,x,y,z)=>({x:x,y:800-y*28-z*65}));
 a(standard(null,origin,{crown:'orvas'}).y-standard(null,origin,box).y>50);
});
test('same crown follows airborne elevation and actual articulated crouch/scale',()=>{
 const anchor=load((_v,x,y,z)=>({x,y:500-y*40}));
 const p={x:4,y:0,z:10};
 const base=anchor(null,p,{crown:'orvas'});
 const crouch=anchor(null,{...p,rig:{kind:'leap',phase:'windup',progress:1}},{crown:'orvas'});
 const air=anchor(null,{...p,y:3,rig:{kind:'leap',phase:'windup',progress:1}},{crown:'orvas'});
 a(crouch.y-base.y>16);a(Math.abs(crouch.y-air.y-120)<1e-8);
 a(anchor(null,{...p,scale:.75},{crown:'orvas'}).y>base.y+48);
 const born=anchor(null,p,{crown:'minotaur',head:0}),lunged=anchor(null,p,{crown:'minotaur',head:1});
 a(lunged.y>born.y+11);
});
