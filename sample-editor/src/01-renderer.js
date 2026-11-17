
'use strict';
const canvas=document.getElementById('scene'),gl=canvas.getContext('webgl',{antialias:true,alpha:false,powerPreference:'high-performance'});
if(!gl){document.body.textContent='この端末ではWebGLを使用できません';throw Error('WebGL unavailable')}
const vs='attribute vec3 p;attribute vec3 color;uniform mat4 vp;varying vec3 c;void main(){gl_Position=vp*vec4(p,1.);c=color;}';
const fs='precision mediump float;varying vec3 c;void main(){gl_FragColor=vec4(c,1.);}';
function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s}
const prog=gl.createProgram();gl.attachShader(prog,shader(gl.VERTEX_SHADER,vs));gl.attachShader(prog,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(prog);gl.useProgram(prog);
const locP=gl.getAttribLocation(prog,'p'),locC=gl.getAttribLocation(prog,'color'),locVP=gl.getUniformLocation(prog,'vp');
const vertices=[];
function color(hex){return [(hex>>16&255)/255,(hex>>8&255)/255,(hex&255)/255]}
function tri(a,b,c,col){for(const v of [a,b,c])vertices.push(...v,...col)}
function quad(a,b,c,d,col){tri(a,b,c,col);tri(a,c,d,col)}
function box(x,y,z,w,h,d,hex){
 const c=color(hex),top=c.map(t=>Math.min(1,t*1.12)),side=c.map(t=>t*.83),dark=c.map(t=>t*.72),X=x-w/2,Z=z-d/2,U=x+w/2,V=z+d/2,T=y+h;
 quad([X,T,Z],[U,T,Z],[U,T,V],[X,T,V],top);
 quad([X,y,V],[U,y,V],[U,T,V],[X,T,V],c);quad([U,y,Z],[X,y,Z],[X,T,Z],[U,T,Z],side);
 quad([U,y,V],[U,y,Z],[U,T,Z],[U,T,V],dark);quad([X,y,Z],[X,y,V],[X,T,V],[X,T,Z],side);
}
// Ellipsoid meshes for rounded shoulders, head, limbs and soft body silhouette.
function ellipsoid(cx,cy,cz,rx,ry,rz,hex,longitude=12,latitude=8){
 const c=color(hex);
 for(let v=0;v<latitude;v++){
  const a=Math.PI*v/latitude,b=Math.PI*(v+1)/latitude;
  for(let u=0;u<longitude;u++){
   const p=Math.PI*2*u/longitude,q=Math.PI*2*(u+1)/longitude;
   const point=(th,ph)=>[cx+rx*Math.sin(th)*Math.cos(ph),cy+ry*Math.cos(th),cz+rz*Math.sin(th)*Math.sin(ph)];
   const x=point(a,p),y=point(b,p),z=point(b,q),w=point(a,q);
   quad(x,y,z,w,c.map(k=>k*(.76+.24*Math.max(0,Math.sin(a)*Math.cos(p)*.5+.5))));
  }
 }
}
function seeded(a,b){let t=Math.sin(a*127.1+b*311.7)*43758.5453;return t-Math.floor(t)}
