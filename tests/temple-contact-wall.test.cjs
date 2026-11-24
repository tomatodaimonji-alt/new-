const a=require('node:assert/strict'),{test}=require('node:test'),{readFileSync}=require('node:fs'),vm=require('node:vm');
const src=readFileSync(process.env.HTML||'world-editor.html','utf8');
const start=src.indexOf('function poiSacredContactWallAmount('),end=src.indexOf('function poiSacredContactWallIndex(',start);
const h=vm.runInNewContext((start>=0&&end>start?src.slice(start,end):'function poiSacredContactWallAmount(){return 0}')+';poiSacredContactWallAmount');
const site={id:'base',davidTemple:{depth:1,bounds:{x1:6,x2:42,z1:124,z2:176}}};
const sample={type:'poiDavidWallRound',x:42,z:158,y:0};
test('only nearby real exterior collision walls become fully readable before contact',()=>{
 a.equal(h(site,sample,42.8,158,0),1);
 a.equal(h(site,sample,44,158,0),1);
 a.equal(h(site,sample,45.3,158,0),1);
 a(h(site,sample,47,158,0)>.3&&h(site,sample,47,158,0)<1);
 a.equal(h(site,sample,51,158,0),0);
 a.equal(h(site,sample,42.8,158,1),0);
 a.equal(h({...site,id:'snowpass'},sample,42.8,158,0),0);
 for(const type of ['poiDavidSacredRoof','poiDavidCandleSconce','monsterStoneDavid','stoneWall'])
  a.equal(h(site,{...sample,type},42.8,158,0),0);
 a.equal(h(site,{...sample,x:45},45.5,158,0),0,'must be authored temple perimeter');
});
test('north porch geometry depends on physical access, never orbit angle',()=>{
 const a0=src.indexOf('function poiSacredTunnelPresentation('),b=src.indexOf('function poiSacredInteriorPlayer(',a0);
 const f=vm.runInNewContext((a0>=0&&b>a0?src.slice(a0,b):'function poiSacredTunnelPresentation(){return false}')+';poiSacredTunnelPresentation');
 const area={id:'base',davidTemple:{depth:1,entrance:{x:24,z:128},interior:{minX:23,maxX:25,exitZ:142}}};
 a(f(area,24,125,0),'physical northern entry already submits the same interior scene');
 a(f(area,25.7,125,0),'the stone porch shoulder sees physical tunnel too');
 a(!f(area,25.7,130,0),'not from behind a side wall');
 a(f(area,24,128,0));a(f(area,24,135,0));
 a(!f(area,29,125,0));a(!f(area,24,119,0));a(!f(area,42,158,0));a(!f(area,24,125,1));
 a(!f({...area,id:'snowpass'},24,125,0));
});

test('contact terrain uses continuous world-space feather and not the temple Bayer grid',()=>{
 const i=src.indexOf('function poiSacredContactWallDraw(vp){'),j=src.indexOf('// END NEAR CONTACT WALLS',i),pass=src.slice(i,j);
 a(!pass.includes('loc.sacredTempleHide'),'contact wall must not be perforated by screen-pixel threshold');
 a.match(pass,/loc\.sacredContactWall/);
 a.match(src,/float contactFog=smoothstep\(3\.8,8\.5,length\(vLootXZ-uSacredContactWall\.xy\)\)/);
 a.match(pass,/finally/);
});
