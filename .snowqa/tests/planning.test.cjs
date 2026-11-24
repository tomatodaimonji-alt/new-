const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const c=vm.runInNewContext(fs.readFileSync(process.env.CORE||'core.js','utf8')+';({to:poiOverlandGlobal,from:poiOverlandLocal,choose:poiOverlandQueue,index:poiOverlandIndex})'),plain=v=>JSON.parse(JSON.stringify(v));
test('same fractional pose survives both seam directions in a shared global frame',()=>{
 const g=c.to('base',49.17,127.59);
 a.deepEqual(plain(c.from('snowpass',...g)),[12.170000000000002,-.4099999999999966]);
 a.deepEqual(plain(c.to('snowpass',...c.from('snowpass',...g))),plain(g));
 a.deepEqual(plain(c.to('milda',12,0)),[52,157]);
});
test('cache candidates are bounded, nearest first, and select real neighbor cells before the seam',()=>{
 const maps=[{id:'base',width:128,height:128},{id:'snowpass',width:24,height:29},{id:'milda',width:25,height:30}];
 const q=c.choose(maps,49,120);
 a.ok(q.length<=18);
 a.ok(q.some(v=>v.id==='base')&&q.some(v=>v.id==='snowpass'));
 a.ok(!q.some(v=>v.id==='milda'));
 a.ok(q.every((v,i)=>!i||q[i-1].d<=v.d));
 a.equal(new Set(q.map(v=>v.key)).size,q.length);
 const back=c.choose(maps,49,131);
 a.ok(back.some(v=>v.id==='base')&&back.some(v=>v.id==='snowpass'));
});
test('real authored records partition by ownership without transforming stored grid identity',()=>{
 const floor={x:7,z:7,y:0,type:'roadGravelFull'},tree={x:8,z:7,y:0,type:'treePine'},underground={x:7,z:7,y:-1,type:'stone'};
 const p=c.index([floor,tree,underground]);
 a.equal(p.floors.get('7,7'),floor.type);a.equal(p.bands.get('0,0')[0],floor);a.equal(p.bands.get('1,0')[0],tree);
 a.ok(![...p.bands.values()].flat().includes(underground));
});

test('bounded local mesh is not culled when touching the camera clip and behind boxes are culled',()=>{
 const whole=fs.readFileSync('surface.js','utf8'),i=whole.indexOf('function poiOverlandBoxVisible('),j=whole.indexOf('function poiOverlandPresent(',i);
 const visible=vm.runInNewContext(whole.slice(i,j)+';poiOverlandBoxVisible');
 const vp=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
 a.ok(visible(vp,[.85,-.5,-.5,2,.5,.5]));
 a.equal(visible(vp,[1.2,-.5,-.5,2,.5,.5]),false);
 a.equal(visible(vp,[-2,-.5,-.5,-1.2,.5,.5]),false);
});
test('streamed actors keep every conservatively visible distant model; normal maps are unchanged',()=>{
 const whole=fs.readFileSync('surface.js','utf8'),take=(a,b)=>whole.slice(whole.indexOf('function '+a+'('),whole.indexOf('function '+b+'('));
 const ctx={terrainY:()=>0,poiOverlandDrawing:true,poiWalkViewX:0,poiWalkViewZ:0};
 const visible=vm.runInNewContext(take('poiOverlandActorVisible','poiOverlandNeighborVP')+
  take('poiOverlandBoxVisible','poiOverlandPresent')+';poiOverlandActorVisible',ctx);
 const zoomOutVP=[.0125,0,0,0,0,.1,0,0,0,0,.0125,0,0,0,0,1];
 a.equal(visible(zoomOutVP,50,0,0),true,'long zoom-out still draws a model inside the projection');
 a.equal(visible(zoomOutVP,81,0,0),true,'clip boundary padding keeps weapon and stride geometry');
 a.equal(visible(zoomOutVP,85,0,0),false,'outside padded frustum can skip model generation');
 a.equal(visible(zoomOutVP,0,30,0),true,'nearby actors always stay present');
 ctx.poiOverlandDrawing=false;
 a.equal(visible(zoomOutVP,85,0,0),true,'the legacy renderer is not altered');
});
