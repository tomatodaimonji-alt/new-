// Injected only into a QA copy. Capture the exact final stock wall spans after
// its face-cull and warm-light bake; no product geometry policy is replaced.
function poiTestTransportRemember(m,start,o){
 if(!window.__transportSpans||o.y!==0||!['stonewall','woodwall'].includes(o.type)||m.p.length/3<=start)return;
 if(Math.hypot(o.x-poiWalkX,o.z-poiWalkZ)>16)return;
 const a=start*3,count=m.p.length/3-start,anchor=[o.x+.5,terrainY(o.x,o.z),o.z+.5];
 const world=new Float32Array(count*9),local=new Float32Array(count*9);
 let h=2166136261,g=7776281;
 const hash=n=>{h=Math.imul(h^(n|0),16777619);g=Math.imul(g^(n|0),1597334677)};
 for(let i=0;i<count;i++)for(let j=0;j<3;j++){
  const k=a+i*3+j,b=i*9+j,v=m.p[k]-anchor[j],n=m.n[k],c=m.c[k];
  world[b]=m.p[k];local[b]=v;
  world[b+3]=local[b+3]=n;world[b+6]=local[b+6]=c;
  hash(Math.round(v*1e7));hash(Math.round(n*1e7));hash(Math.round(c*1e7));
 }
 window.__transportSpans.push({anchor,world,local,count,key:[o.type,count,h>>>0,g>>>0].join(':')});
}
function poiTestTransportGroup(){
 facilityInvalidateScenes();window.__transportSpans=[];render();
 const p=parameters(),sites=window.__transportSpans;window.__transportSpans=null;
 const variants=new Map();
 for(const s of sites){
  const [x,y,z]=s.anchor;
  if(!poiOverlandBoxVisible(p.vp,[x-.57,y,z-.57,x+.57,y+1.45,z+.57]))continue;
  const group=variants.get(s.key)??[];group.push(s);variants.set(s.key,group);
 }
 const set=[...variants.values()].filter(a=>a.length>=3&&a[0].count*a.length<28000).sort((a,b)=>b.length*b[0].count-a.length*a[0].count)[0];
 if(!set)return {error:'no visible repeated module',candidates:[...variants].map(([k,a])=>[k,a.length]),seen:sites.length};
 // Audit grouping by full data independently of its compact hash.
 const checks=set.filter(s=>s.local.every((v,i)=>Math.abs(v-set[0].local[i])<=2e-7));
 if(checks.length!==set.length)throw Error('archetype hash collision or non-equivalent local vertices');
 window.__transportGroup={set,p};
 return {sites:sites.length,key:set[0].key,n:set.length,nativeType:set[0].key.split(':')[0],count:set[0].count};
}
function poiTestTransportDraw(mode,pretendNoExtension=false){
 const {p,set}=window.__transportGroup;
 const wall=new Float32Array(set.reduce((n,q)=>n+q.world.length,0));let at=0;
 for(const q of set){wall.set(q.world,at);at+=q.world.length}
 const native=gl.getExtension('ANGLE_instanced_arrays');
 if(mode==='instance'&&(!native||pretendNoExtension))mode='indexed-fallback';
 let vertices=wall,element=null,positions=null,draws=0,used=0,prog=program;
 const fresh=[];
 const put=(kind,payload)=>{let b=gl.createBuffer();fresh.push(b);gl.bindBuffer(kind,b);gl.bufferData(kind,payload,gl.STATIC_DRAW);used+=payload.byteLength;return b};
 if(mode.startsWith('indexed')){
  const rows=[],keys=new Map();element=new Uint16Array(wall.length/9);
  for(let i=0,j=0;i<wall.length;i+=9,j++){
   const r=Array.from(wall.subarray(i,i+9)),k=r.join(','),index=keys.get(k);
   if(index===undefined){const n=keys.size;if(n>65535)throw Error('indexed batch exceeds uint16');keys.set(k,n);rows.push(...r);element[j]=n}
   else element[j]=index;
  }
  vertices=Float32Array.from(rows);
 }else if(mode==='instance'){
  vertices=set[0].local;positions=Float32Array.from(set.flatMap(x=>x.anchor));
  const src=VERT.replace('attribute vec3 aCol;','attribute vec3 aCol;attribute vec3 aShift;')
   .replace('vec4(aPos,1.0)','vec4(aPos+aShift,1.0)').replace('vWorldHeight=aPos.y;vLootXZ=aPos.xz;','vWorldHeight=aPos.y+aShift.y;vLootXZ=aPos.xz+aShift.xz;');
  prog=gl.createProgram();gl.attachShader(prog,sh(gl.VERTEX_SHADER,src));gl.attachShader(prog,sh(gl.FRAGMENT_SHADER,FRAG));
  gl.linkProgram(prog);if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(prog));
 }
 const canvasW=canvas.width,canvasH=canvas.height;
 const read=()=>{const v=new Uint8Array(canvasW*canvasH*4);gl.readPixels(0,0,canvasW,canvasH,gl.RGBA,gl.UNSIGNED_BYTE,v);return [...v]};
 const light=poiTownSceneLight();gl.useProgram(program);gl.uniform3f(loc.daylight,...light);
 gl.uniform4f(loc.occlusionInfo,0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 draw(sceneMesh?.ground,p.vp);
 const ref=read();
 gl.useProgram(prog);
 const attr=k=>gl.getAttribLocation(prog,k),uniform=k=>gl.getUniformLocation(prog,k);
 put(gl.ARRAY_BUFFER,vertices);
 for(const [k,d] of [['aPos',0],['aNorm',12],['aCol',24]]){const i=attr(k);gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,3,gl.FLOAT,false,36,d)}
 gl.uniformMatrix4fv(uniform('uMVP'),false,p.vp);gl.uniform3f(uniform('uTownDaylight'),...light);
 if(element){put(gl.ELEMENT_ARRAY_BUFFER,element);gl.drawElements(gl.TRIANGLES,element.length,gl.UNSIGNED_SHORT,0);draws++}
 else if(positions){
  const i=attr('aShift');put(gl.ARRAY_BUFFER,positions);gl.enableVertexAttribArray(i);
  gl.vertexAttribPointer(i,3,gl.FLOAT,false,12,0);native.vertexAttribDivisorANGLE(i,1);
  native.drawArraysInstancedANGLE(gl.TRIANGLES,0,vertices.length/9,set.length);draws++;
  native.vertexAttribDivisorANGLE(i,0);gl.disableVertexAttribArray(i);gl.vertexAttrib3f(i,0,0,0);
 }else{gl.drawArrays(gl.TRIANGLES,0,vertices.length/9);draws++}
 const image=read(),err=gl.getError(),visible=image.filter((x,i)=>Math.abs(x-ref[i])>10).length;
 for(const b of fresh)gl.deleteBuffer(b);
 gl.useProgram(program);if(prog!==program)gl.deleteProgram(prog);
 return {mode,bytes:used,draws,native:!!native,visible,w:canvasW,h:canvasH,err,image};
}
