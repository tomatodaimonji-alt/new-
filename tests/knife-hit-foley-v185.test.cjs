const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),crypto=require('node:crypto');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const c=vm.createContext({});
vm.runInContext(h.slice(h.indexOf('function poiKitchenKnifePcm('),h.indexOf('const poiKitchenKnifeCache=')),c);
const rate=24000,peak=a=>Math.max(...a.map(Math.abs)),rms=(a,s,e)=>Math.sqrt(a.slice(s*24,e*24).reduce((p,n)=>p+n*n,0)/((e-s)*24));
test('knife contact has a short sharp transient followed by three isolated, progressively softer splatter accents',()=>{
 const a=c.poiKitchenKnifePcm('hit',rate);
 assert(peak(a)>.36&&peak(a)<.75);
 assert(rms(a,1,14)>.075);
 const pulse=[[51,56,43,49],[84,90,75,80],[118,125,108,114]];
 const strengths=pulse.map(([s,e,qs,qe])=>{
  const after=rms(a,s,e),quiet=rms(a,qs,qe);
  assert(after>quiet*2.5&&after>.004);
  return after;
 });
 assert(strengths[0]>strengths[1]&&strengths[1]>strengths[2]);
 assert(rms(a,162,170)<.001);
});
test('knife swing is bit-identical and contact stays on existing hit path',()=>{
 const a=c.poiKitchenKnifePcm('attack',rate);
 assert.equal(crypto.createHash('sha256').update(Buffer.from(a.buffer)).digest('hex'),'614d9102f538515e844e0c25caf5a907d28da476eb5c076cb24f4f9b8c60ca13');
 assert.match(h,/poiPlayImpactBuffer\(poiKitchenKnifeBuffer\('hit'\),contact,\.72\)/);
 assert.match(h,/poiPlayImpactBuffer\(poiKitchenKnifeBuffer\('attack'\),now\+\.05,\.63\)/);
});
