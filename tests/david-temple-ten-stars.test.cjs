const {test}=require('node:test'),assert=require('node:assert/strict'),{readFileSync}=require('node:fs'),vm=require('node:vm');
const html=readFileSync(process.env.WORLD_HTML||'world-editor.html','utf8');
function snippet(from,to){
 const a=html.indexOf(from),b=html.indexOf(to,a);
 assert.ok(a>=0&&b>a,from);return html.slice(a,b);
}
const tier=html.match(/return \{depth:1,name,difficulty:(\d+),bounds,ring,approach,entrance:P\(24,entry\)/);
assert.ok(tier,'canonical authored temple return');
const c=vm.createContext({$:()=>stars,poiDungeonTravelKey:(s,x,z,y)=>y===-1&&x===64&&z===24?'northFort':null});
const stars={textContent:null,labels:{},setAttribute(k,v){this.labels[k]=v}};
vm.runInContext(snippet('const POI_SAFE_TOWN=','// BEGIN LOCATION PANEL MOTION')+
 snippet('function poiDavidTempleContains(','function poiDavidTempleRecoverPosition(')+
 'function updateStars(area){'+snippet('  const stars=$(\'poiLocationStars\')','\n }')+'\n}',c);
const site={id:'base',davidTemple:{name:'オルヴァスの大神殿',difficulty:+tier[1],bounds:{y:0},ring:{x:24,z:158,radius:18}},
 northFort:{name:'北の古砦',difficulty:5}};
const verify=(x,z,y,name,count)=>{
 const area=c.poiRegionAt(site,x,z,false,y);
 assert.equal(area.name,name);assert.equal(area.difficulty,count);
 c.updateStars(area);
 assert.equal(stars.textContent,'★'.repeat(count)+'☆'.repeat(10-count));
 assert.equal(stars.labels['aria-label'],'危険度 '+count+'／10');
};
test('the Great Temple HUD renders ten filled stars and the correct accessibility value',()=>verify(24,158,0,'オルヴァスの大神殿',10));
test('the real region selector and HUD retain town, open world and North Fort star counts',()=>{
 verify(24,158,-1,'外',1);verify(6,6,0,'拠点',0);verify(64,24,-1,'北の古砦',5);
});
