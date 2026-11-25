const a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.argv[2],'utf8');
a(html.includes('frontierWaterSurface(m)'),'shoreline mesh must not use square tile tops');
const names=['frontierWaterSurface','frontierTimberBridgeGeometry','frontierShoreDetails'];
for(const name of names)a(html.includes('function '+name+'('),name);
const s=html.slice(html.indexOf('// BEGIN FRONTIER RIVER ART'),html.indexOf('// END FRONTIER RIVER ART'));
const context=vm.createContext({bridgeX:[58,70],FRONTIER_BRIDGE:{west:58,east:70,north:29,south:32},WOOD_BRIDGE_DECK_TOP:.065,
 surfaceNoise:(a,b)=>(Math.sin(a*3+b*2)+1)*.5,frontierSampleHeight:(x,z)=>Math.abs(x-64)*.33-1,
 frontierRiver:(x,z)=>Math.abs(x-64)-3.5,frontierSmooth:(a,b,x)=>Math.max(0,Math.min(1,(x-a)/(b-a))),frontierTrack:()=>30.5,
 tri:(m,a,b,c,color)=>(m.water.push({a,b,c,color}),m.c.push(...color,...color,...color)),cube:(m,x,y,z,w,h,d,col)=>m.boxes.push({x,y,z,w,h,d,col}),
 naturalBranch:(m,...r)=>m.rails.push(r),diamond:()=>{}});
const m=context.m={water:[],boxes:[],rails:[],c:[]};
vm.runInContext(s+';frontierWaterSurface(m);frontierTimberBridgeGeometry(m);frontierShoreDetails(m);',context);
a(m.water.length>300&&m.water.length<5000);
a(m.water.some(({a})=>a[0]%1!==0&&a[0]%1!==.5),'shoreline must cut across grid edges');
a(m.water.every(({a,b,c})=>[a,b,c].flat().every(Number.isFinite)));
const planks=m.boxes.filter(o=>Math.abs(o.y+o.h-.065)<1e-7&&o.w<.28&&o.d>2.8);
a(planks.length>50&&planks.length<85,'individually laid cross-boards');
a.equal(new Set(planks.map(o=>o.col[0])).size>12,true);
const rail=m.boxes.filter(o=>o.y>.8&&o.w>2);
a(rail.length>=6&&rail.every(o=>o.z<29.3||o.z>31.7),'outer railing only, clear route and ends');
console.log('Joined depth-tinted water, clipped banks, one plausible timber span with open ends.');
