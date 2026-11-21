const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||path.join(__dirname,'../world-editor.html'),'utf8');
const cut=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i+1);assert(i>=0&&j>i,a);return html.slice(i,j);};
const draw=vm.runInNewContext(cut('function tri(','function diamond(')+cut('function rot2(','function addPart(')+
 cut('const POI_FORT_PARTS=','function poiCanalQuayGeometry(')+`;((rot)=>{
  const m={p:[],n:[],c:[]};poiFortGeometry(m,'poiFortGate',0,0,0,rot);return m.p;
 })`);
function masonry(faces,u,h,side){
 for(const [a,b,c] of faces){
  if(![a,b,c].every(p=>side*p[2]>.30))continue;
  const s=(d,e)=>(u-e[0])*(d[1]-e[1])-(d[0]-e[0])*(h-e[1]);
  const ns=[s(a,b),s(b,c),s(c,a)];
  const area=(a[0]-b[0])*(a[1]-c[1])-(a[0]-c[0])*(a[1]-b[1]);
  if(Math.abs(area)>1e-9&&(ns.every(v=>v>=-1e-8)||ns.every(v=>v<=1e-8)))return true;
 }
 return false;
}
test('stone fills both gate spandrels to the adjacent walls and cap without reducing the three-tile aperture',()=>{
 for(const rot of [0,3]){
  const raw=draw(rot),faces=[];
  const local=idx=>{
   const [x,y,z]=raw.slice(idx,idx+3);
   return rot===0?[x,y,z]:[-z,y,x];
  };
  for(let i=0;i<raw.length;i+=9)faces.push([local(i),local(i+3),local(i+6)]);
  for(const sign of [-1,1]){
   for(const x of [1.40,1.48])for(const h of [1.52,1.83,2.10,2.45,2.76,2.805])
    for(const face of [-1,1])assert(masonry(faces,sign*x,h,face),[rot,sign,x,h,face]);
   for(const x of [.65,.92,1.12])for(const h of [2.58,2.75,2.805])
    assert(masonry(faces,sign*x,h,1),[rot,sign,x,h]);
  }
  for(const x of [0,-1,1,-1.145,1.145])for(const h of [.09,.60,1.15,1.62])
   assert(!masonry(faces,x,h,1),[rot,x,h]);
  assert(!masonry(faces,0,2.45,1),'same central arch height');
 }
});
