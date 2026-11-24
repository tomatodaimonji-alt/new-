const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
test('clock is physically after the map but before the area and adopts its exact width',()=>{
 const i=h.indexOf('<aside id="poiMiniHud"'),j=h.indexOf('</aside>',i);a.ok(i>=0&&j>i);
 const html=h.slice(i,j);
 a.ok(html.indexOf('id="poiMiniOpen"')<html.indexOf('id="poiClockHud"')&&html.indexOf('id="poiClockHud"')<html.indexOf('id="poiLocationPanel"'));
 a.match(h,/#poiClockHud\{box-sizing:border-box;width:var\(--poi-area-width\)/);
});
test('area clue physically grows down/returns, never crosses a rectangular control or expands horizontally',()=>{
 const i=h.indexOf('// BEGIN LOCATION PANEL MOTION'),j=h.indexOf('// END LOCATION PANEL MOTION',i),c=vm.createContext({});
 a.ok(i>=0&&j>i);vm.runInContext(h.slice(i,j),c);
 const area={left:5,right:145,top:105,bottom:145,width:140,height:40},stage={bottom:320};
 const controls=[{left:150,right:270,top:4,bottom:203,width:120,height:199},
  {left:5,right:125,top:155,bottom:275,width:120,height:120}];
 a.equal(c.poiLocationGrowth(area,stage,controls).scale,1.2125);
 a.equal(c.poiLocationGrowth(area,stage,controls.slice(0,1)).scale,1.27);
 a.equal(c.poiLocationGrowth(area,{bottom:145},[]).scale,1);
 const tight=c.poiLocationGrowth(area,{bottom:149},[],101);
 a.equal(tight.up,2.5);a.equal(tight.scale,1.125);
 a.ok(area.top-tight.up>=102.5&&area.top-tight.up+area.height*tight.scale<=147.5);
 a.match(h.slice(i,j),/transform:peak/);a.match(h.slice(i,j),/scaleY\(1\)/);
});
