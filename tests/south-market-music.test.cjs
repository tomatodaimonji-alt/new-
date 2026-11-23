const {test}=require('node:test'),a=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const fixture=require('./orchestral-legacy-fixture.cjs');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function slice(first,last){
 const i=h.indexOf(first),j=h.indexOf(last,i+1);
 a(i>=0&&j>i,first);return h.slice(i,j);
}
function marketFixture(){
 const f=fixture(),build=vm.runInNewContext(slice('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+';buildFacilitySite');
 f.f.facilitySite={...build('base'),id:'base'};
 Object.assign(f.f,{POI_SAFE_TOWN:[],POI_WILD_GATES:[],POI_WILD_LANDMARKS:[],
  validPos:()=>true,poiWildZone:()=>false,facilityFloorOwner:()=>null});
 f.run(slice('function poiRegionAt(','const poiMiniStatic=')+slice('function poiSouthTownContains(','function poiSouthMarketRole('));
 return f;
}
test('live market music has both plucked and sustained voices within an independent bounded loop',()=>{
 const f=marketFixture();a.equal(f.tick(10,101,112,0).active,'market');
 const m=f.deck('market'),voices=[];
 for(let t=10.2;t<10+m.score.duration*2;t+=.2){
  const frame=f.tick(t,101,112,0);a(frame.voices<=21);
  voices.push(frame.voices);
 }
 a(voices.some(n=>n>=2));a(m.cycle>=1);
 a(m.score.events.some(n=>n.instrument==='harp'||n.instrument==='pizzicato'||n.instrument==='pizz'));
 a(m.score.events.some(n=>n.instrument==='strings'||n.instrument==='clarinet'||n.instrument==='flute'));
 a(m.score.events.every(e=>e.time>=0&&e.time+e.len<=m.score.duration+1e-6&&e.vel>0&&e.vel<=1));
});
test('only inside the named town chooses market audio; outdoor fade and stop release the market deck',()=>{
 const f=marketFixture();
 a.equal(f.tick(10,101,112,0).active,'market');
 const market=f.deck('market');a(market.sources.size>0);
 a.equal(f.tick(10.2,105,100,0).active,'outside');
 a(f.calls.some(([gain,v,t,d])=>gain===market.bus.gain&&v===0&&t===10.2&&d>0));
 a.equal(f.tick(11.3,105,100,0).active,'outside');
 a.equal(f.deck('market'),undefined);a.equal(market.sources.size,0);
 a.equal(f.tick(11.5,101,112,0).active,'market');
 const restarted=f.deck('market');a(restarted.sources.size>0);a.notEqual(restarted,market);
 f.run('poiAudioStop(true);document.hidden=true');
 a.equal(f.tick(12,101,112,0).active,null);
 a.equal(f.deck('market'),undefined);a.equal(restarted.sources.size,0);
});
test('north fort and otherworld have real, distinct native score envelopes without replacing market',()=>{
 const f=marketFixture();
 const lead=zone=>JSON.stringify(f.deck(zone).score.events.slice(0,12));
 a.equal(f.tick(10,101,112,0).active,'market');const market=lead('market');
 a.equal(f.tick(10.4,100,90,-1).active,'otherworld');const otherworld=lead('otherworld');
 a.equal(f.tick(10.8,64,13,-1).active,'northFort');const fort=lead('northFort');
 a(f.deck('northFort').sources.size>0);a.notEqual(fort,otherworld);a.notEqual(fort,market);
});
