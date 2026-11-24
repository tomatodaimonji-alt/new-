const assert=require('node:assert/strict'),{test}=require('node:test'),{readFileSync}=require('node:fs'),vm=require('node:vm');
const h=readFileSync(process.env.WORLD_HTML||'world-editor.html','utf8');
const a=h.indexOf('function poiDavidSacredRoofGeometry('),b=h.indexOf('function poiDavidTunnelArt(',a);
assert(a>=0&&b>a);
function render(cx,cz){
 const result=[],tri=(m,a,b,c,color)=>m.push({a,b,c,color}),quad=(m,a,b,c,d,c0)=>{tri(m,a,b,c,c0);tri(m,a,c,d,c0);};
 const box=[],c=vm.createContext({tri,quad,cube:(m,...args)=>box.push(args)});
 vm.runInContext(h.slice(a,b),c); c.poiDavidSacredRoofGeometry(result,cx,cz);return {result,box};
}
function down(t){
 const v=t.b.map((x,i)=>x-t.a[i]),w=t.c.map((x,i)=>x-t.a[i]);
 return v[2]*w[0]-v[0]*w[2]<-1e-4;
}
test('readable true opaque underside climbs into the vault, still closed from every wedge',()=>{
 const {result,box}=render(24.5,104.5),roof=result.filter(down);
 assert(roof.length>=500);
 assert(result.length*3<5500,'fixed small GPU mesh budget');
 const pts=roof.flatMap(r=>[r.a,r.b,r.c]);
 const min=Math.min(...pts.map(v=>v[1])),max=Math.max(...pts.map(v=>v[1]));
 assert(min<=7.62&&min>7.30&&max>12.8&&max<14.3,{min,max});
 for(let i=0;i<40;i++){
  const theta=i*Math.PI*2/40;
  assert(pts.some(([x,y,z])=>Math.abs(x-(24.5+Math.cos(theta)*18.22))<1e-6&&Math.abs(z-(104.5+Math.sin(theta)*18.22))<1e-6&&Math.abs(y-7.62)<1e-6),'physical rim closes sector '+i);
 }
 const stones=new Set(roof.map(x=>x.color.map(v=>v.toFixed(3)).join(',')));
 assert(stones.size>=8,'real interior stone bands/ribs have visible shading differences');
 assert.deepEqual(box[0].slice(0,3),[24.5,14.12,104.5],'unchanged exterior top key');
});
