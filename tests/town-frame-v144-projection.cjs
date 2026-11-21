// Exact crop/inverse of the public v144 expansion, not the legacy builder.
// This lets older assertions exercise the current production site's records.
const oldCell=({x,z})=>x>=10&&x<118&&z>=10&&z<78;
const axes=new Set(['x','z','x1','x2','z1','z2']);
function unshift(value){
 if(Array.isArray(value))return Array.from(value,unshift);
 if(!value||typeof value!=='object')return value;
 return Object.fromEntries(Object.entries(value).map(([k,v])=>[
  k,axes.has(k)&&typeof v==='number'?v-10:unshift(v)
 ]));
}
function originalFrame(site){
 const out=unshift({...site,map:{...site.map,world:site.map.world.filter(oldCell)},
  creek:{...site.creek,deep:site.creek.deep.filter(oldCell)}});
 Object.assign(out.map,{width:108,height:68,size:108});
 out.townOffset-=10;
 return out;
}
module.exports={originalFrame,oldCell};
