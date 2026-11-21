const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||path.join(__dirname,'../world-editor.html'),'utf8');
test('the canal quay is an editable, low compact dry-bank lip with correct rot0 and rot2 orientation',()=>{
 assert.match(html,/{id:'poiCanalQuay',name:'運河・石の護岸',cat:'decor'/);
 assert.match(html,/"number":"336","id":"poiCanalQuay"/);
 const cut=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i+1);assert(i>=0&&j>i,a);return html.slice(i,j);};
 const draw=vm.runInNewContext(cut('function tri(','function diamond(')+cut('function rot2(','function addPart(')+
  cut('function poiCanalQuayGeometry(','function deco(')+`;((rot)=>{
  const m={p:[],n:[],c:[]};poiCanalQuayGeometry(m,0,0,0,rot);return m;})`);
 const first=draw(0),back=draw(2),nums=(m,n)=>m.p.filter((_,i)=>i%3===n);
 assert(first.p.length>=150&&first.p.length/9<=46);
 assert(nums(first,0).some(v=>v<=-.5)&&nums(first,0).some(v=>v>=.5));
 assert(nums(first,1).every(v=>v>=0&&v<.19));
 assert(nums(first,2).every(v=>v>=.31&&v<=.526),'keeps the walkable middle empty');
 assert(nums(back,2).every(v=>v<=-.31&&v>=-.526),'turns toward opposite water edge');
 assert.match(html,/if\(id==='poiCanalQuay'\)\{poiCanalQuayGeometry\(m,x,y,z,r\);return\}/);
});
test('fort culvert is a short through-wall opening, not a playable arch or a modified wall type',()=>{
 const cut=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i+1);assert(i>=0&&j>i,a);return html.slice(i,j);};
 const data=vm.runInNewContext(cut('function tri(','function diamond(')+cut('function rot2(','function addPart(')+
  cut('function poiFortCulvertGeometry(','function deco(')+`;(()=>{const m={p:[],n:[],c:[]};poiFortCulvertGeometry(m,0,0,0,1);return m.p})()`);
 const points=Array.from({length:data.length/3},(_,i)=>data.slice(i*3,i*3+3));
 assert(points.some(([x,y,z])=>y>2.3));
 assert(points.some(([x,y,z])=>Math.abs(z)<.04&&y>.40&&y<.59),'shallow arch crown');
 assert(!points.some(([x,y,z])=>Math.abs(z)<.17&&y<.4));
 assert(points.some(([x,y,z])=>x>.32)&&points.some(([x,y,z])=>x<-.32));
 assert(points.length/3<170);
});
