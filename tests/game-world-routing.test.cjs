const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const block=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i+1);assert(i>=0&&j>i,'missing '+a);return html.slice(i,j)};
test('base uses one visible name, while gallery preview and bottom entry use different launch modes',()=>{
 const sites=vm.runInNewContext(block('const FACILITY_SITES=','function buildFacilitySite')+';FACILITY_SITES');
 assert.equal(sites.find(p=>p.id==='base').name,'ゲーム世界');
 const bottom=block("$('enterGameWorld').addEventListener","$('").split('\n')[0];
 assert.match(bottom,/facilityNavigate\('base',true\)/);
 assert(!bottom.includes('pineGameEnter'));
 assert.match(html,/open\.addEventListener\('click',\(\)=>facilityNavigate\(record\.id\)\)/);
 assert.match(html,/legacy\.id='legacyAdventureEntry'/);
 assert.match(html,/legacy\.addEventListener\('click',\(\)=>pineGameEnter\(\)\)/);
 assert.match(html,/facilitySite\.id==='base'\?'ゲーム世界へ':'この施設をプレイ'/);
});
test('safe navigation removes stale launch flags from Back, explicit exit and unrelated POI URLs',()=>{
 const arrivals=[],returns=[],x={URL,URLSearchParams,facilitySite:null,
  location:{href:'https://example.test/world-editor.html?test=1',assign:s=>arrivals.push(new URL(s)),replace:s=>returns.push(new URL(s))},
  history:{replaceState:(a,b,s)=>returns.push(new URL(s))},facilityApproveLeave:()=>true,
  workshopResumeLeaving:false,workshopResumeWrite:()=>{}};
 vm.createContext(x);
 vm.runInContext(block('function facilityNavigate(','function facilityExportMap('),x);
 x.facilityNavigate('base',true);
 assert.equal(arrivals[0].searchParams.get('facility'),'base');
 assert.equal(arrivals[0].searchParams.get('facility-play'),'1');
 assert.equal(arrivals[0].searchParams.get('test'),'1');
 assert.equal(returns[0].searchParams.get('facility-return'),'1');
 assert.equal(returns[0].searchParams.get('facility-play'),null);
 x.location.href=arrivals[0].href;x.facilitySite={id:'base'};
 x.facilityNavigate('stable',true);
 assert.equal(arrivals[1].searchParams.get('facility'),'stable');
 assert.equal(arrivals[1].searchParams.get('facility-play'),null);
 assert.equal(returns[1].searchParams.get('facility-play'),null);
 x.facilityExit();
 assert.equal(returns[2].searchParams.get('facility-return'),'1');
 for(const p of ['facility','facility-play'])assert.equal(returns[2].searchParams.get(p),null);
 x.facilityApproveLeave=()=>false;x.facilityNavigate('stable');x.facilityExit();
 assert.equal(arrivals.length,2);assert.equal(returns.length,3);
});
test('only explicit base launches play; cold/update resumes remain separate',()=>{
 const x=vm.runInNewContext(block('function facilityPlayOnOpen(','function facilityNavigate(')+';facilityPlayOnOpen');
 for(const [params,id,expected] of [
  ['facility=base&facility-play=1','base',true],['facility=base','base',false],
  ['facility=base&facility-play=1&facility-return=1','base',false],
  ['facility=stable&facility-play=1','stable',false],['revision=118','base',false],
  ['facility-play=1','base',false],['facility=base&facility-play=2','base',false]
 ])assert.equal(x(new URLSearchParams(params),id),expected,params);
});
