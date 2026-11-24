const fs=require('node:fs'),vm=require('node:vm'),a=require('node:assert/strict'),{test}=require('node:test');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
test('tiny vertical gap uses horizontal room without shrinking tap targets or moving speech',()=>{
 const start=h.indexOf('function poiNpcToolshopMenuFit('),end=h.indexOf('function poiNpcMenuMark(',start);
 a(start>=0&&end>start,'checkout fit strategy missing');
 const g=vm.runInNewContext(h.slice(start,end)+';poiNpcToolshopMenuFit');
 const bounds={left:8,right:216,width:208,bottom:246.69},hud={left:5,right:106.39,bottom:219.47};
 const room=g(bounds,hud,{right:390});
 a(room.shift+bounds.left>hud.right);a.equal(room.width,208);
 const narrow=g(bounds,hud,{right:320});a(narrow.width>=148);a.equal(narrow.width+narrow.shift+bounds.left,312);
 a.equal(g({...bounds,bottom:320},hud,{right:390}),null,'ample below HUD: keep regular left');
 a.equal(g(bounds,{...hud,right:7},{right:390}),null,'HUD already out of the way');
 a.equal(g(bounds,hud,{right:220}),null,'do not squeeze an unusable side panel');
 a.match(h,/#poiNpcMenu\[data-counter-side\]/);
});
