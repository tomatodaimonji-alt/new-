const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const h=fs.readFileSync(process.env.QA_HTML||'world-editor.html','utf8');
const slice=(a,b)=>{const i=h.indexOf(a),j=h.indexOf(b,i+1);assert.ok(i>=0&&j>i,'features present');return h.slice(i,j)};
test('first explicit innkeeper Talk points from east gate through ruins and distinguishes slow wet and dry west',()=>{
 const c={};vm.createContext(c);
 const {innkeeper}=vm.runInContext(slice('const POI_NPC_EXTRA_SPEECH=','const POI_NPC_MENU_LABELS=')+'\nPOI_NPC_EXTRA_SPEECH',c);
 assert.match(innkeeper[0],/東門.*川下.*崩れた石壁.*階段/);
 assert.match(innkeeper[0],/西.*濡れず.*まっすぐ.*浅瀬.*足/);
 assert.match(h,/topics\[\(d.topicIndex\+\+\)%topics.length\]/);
});
test('waymark reads only exact live Surface stone from adjacent facing, never through a modal',()=>{
 const sign={x:119,z:84,y:0,type:'ruinStonePost'};
 const c={facilitySite:{id:'base',chapel:{approach:{waymark:sign}}},world:[sign],poiWalkLevel:0,poiWalkX:119,poiWalkZ:85,poiWalkFacing:0,
  poiWalkActive:true,pineAIActive:false,text:[],toast:t=>c.text.push(t),document:{querySelector:()=>c.modal}};
 vm.createContext(c);vm.runInContext(slice('function poiChapelWaymarkReachable(','function poiWayfarerWell('),c);
 assert.equal(c.poiChapelReadWaymark(),true);
 assert.match(c.text[0],/礼拝堂.*階段.*西.*乾いた.*浅瀬.*遅/);
 c.poiWalkFacing=1;assert.equal(c.poiChapelReadWaymark(),false);
 c.poiWalkFacing=0;c.poiWalkLevel=-1;assert.equal(c.poiChapelReadWaymark(),false);
 c.poiWalkLevel=0;c.modal=true;assert.equal(c.poiChapelReadWaymark(),false);
 c.modal=false;c.world=[];assert.equal(c.poiChapelReadWaymark(),false);
 c.world=[sign];c.facilitySite.id='mine';assert.equal(c.poiChapelReadWaymark(),false);
 assert.equal(c.text.length,1);
 assert.match(h,/poiChapelWaymarkReachable\(\)\)\?'trail-sign'/);
 assert.match(h,/\|\|\(typeof poiChapelReadWaymark==='function'&&poiChapelReadWaymark\(\)\)/);
});
