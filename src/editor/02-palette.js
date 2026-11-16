/*__PINE_SHARED_BLOCK_CATALOG__*/palette.push(...[["pineSuperGlass","ガラス正面壁","wall"],["pineSuperDoor","自動ガラス入口","wall"],["pineSuperShutter","荷受けシャッター","wall"],["pineSuperShelf","ゴンドラ棚","decor"],["pineSuperCooler","壁面冷蔵ケース","decor"],["pineSuperFreezer","冷凍平ケース","decor"],["pineSuperCheckout","レジ台","decor"],["pineSuperProduce","青果平台","decor"],["pineSuperCart","カート置場","decor"],["pineSuperStripe","駐車区画線","decor"],["pineSuperCurb","縁石","decor"],["pineSuperSign","看板","decor"],["pineSuperAC","空調室外機","decor"],["pineSuperBollard","車止め","decor"],["pineSuperRack","業務用棚","decor"]].map(([id,name,cat])=>({id,name,cat,icon:'▣'})));
const catalog=new Map(palette.map(p=>[p.id,p]));let selected='wall',mode='place',rotation=0,level=0,hideUpper=false,worldMaxLevel=0,world=[],models=[],prefabs=[],undoStack=[],redoStack=[],hover=null,dragPainting=false,yaw=Math.PI/4,zoom=1,panX=0,panZ=0,dirty=true,sceneMesh=null,cursorMesh=null,cursorDirty=true,modelParts=[],activeModelId=null;
const byId=id=>catalog.get(id)||models.find(m=>m.id===id)||prefabs.find(p=>p.id===id);
const cellKey=(x,z,y=0)=>x+','+z+','+y;
const validPos=(x,z)=>Number.isInteger(x)&&Number.isInteger(z)&&x>=0&&z>=0&&x<MAP_W&&z<MAP_H;
const safeColor=s=>/^#[0-9a-f]{6}$/i.test(s);
const hexRGB=s=>[1,3,5].map(i=>parseInt(s.slice(i,i+2),16)/255);
