#!/usr/bin/env python3
"""Decode a v88 3D World Workshop AI screenshot into the exact original map.

Usage: python tools/decode_ai_screenshot.py screenshot.png -o layout.json
Requires: Pillow, numpy. The full magenta frame must be inside the screenshot.
"""
import argparse
import gzip
import json
from pathlib import Path
import numpy as np
from PIL import Image

PALETTE=np.array([(20,20,20),(226,52,57),(25,162,87),(40,89,226),
                  (247,198,56),(170,59,225),(32,200,208),(244,244,244)],dtype=np.int32)

def fnv32(buf):
    h=2166136261
    for b in buf:
        h=((h^b)*16777619)&0xffffffff
    return h

def symbols_to_bytes(symbols):
    out=bytearray()
    carry=0
    bits=0
    for symbol in symbols:
        carry=(carry<<3)|int(symbol)
        bits+=3
        while bits>=8:
            bits-=8
            out.append((carry>>bits)&255)
            carry&=(1<<bits)-1
    return bytes(out)

def decode(path):
    image=np.array(Image.open(path).convert('RGB'),dtype=np.uint8)
    r,g,b=image[:,:,0],image[:,:,1],image[:,:,2]
    finder=(r>205)&(g<90)&(b>115)&(b<220)
    ys,xs=np.where(finder)
    if len(xs)<100:
        raise ValueError('Magenta border not found. Send the original full screenshot.')
    x0,x1=int(xs.min()),int(xs.max())+1
    y0,y1=int(ys.min()),int(ys.max())+1
    width,height=x1-x0,y1-y0
    cx=(x0+x1)//2
    border=0
    for y in range(y0,min(y0+40,y1)):
        if not finder[y,cx]:
            break
        border+=1
    if border<2:
        cy=(y0+y1)//2
        for x in range(x0,min(x0+40,x1)):
            if not finder[cy,x]:
                break
            border+=1
    if border<2:
        raise ValueError('Finder frame damaged. An original PNG is required.')
    candidates=[]
    for cols in range(20,min(350,width//2)+1):
        unit=(width-2*border)/cols
        if not 2.5<=unit<=35:
            continue
        rows=round((height-2*border)/unit)
        if rows<1 or abs(height-2*border-rows*unit)>max(2,unit*.5):
            continue
        candidates.append((abs(unit-border*1.25),cols,rows,unit))
    candidates.sort()
    for _,cols,rows,unit in candidates:
        for offset in (0,-.20,.20):
            xx=np.clip(np.rint(x0+border+(np.arange(cols)+.5+offset)*unit).astype(int),0,image.shape[1]-1)
            yy=np.clip(np.rint(y0+border+(np.arange(rows)+.5+offset)*unit).astype(int),0,image.shape[0]-1)
            samples=image[yy[:,None],xx[None,:]].reshape(-1,3).astype(np.int32)
            delta=samples[:,None,:]-PALETTE[None,:,:]
            symbols=(delta*delta).sum(axis=2).argmin(axis=1)
            raw=symbols_to_bytes(symbols)
            if len(raw)<12 or raw[:4]!=b'PGA1':
                continue
            size=int.from_bytes(raw[4:8],'little')
            expected=int.from_bytes(raw[8:12],'little')
            if not 0<size<=len(raw)-12:
                continue
            payload=raw[12:12+size]
            if fnv32(payload)!=expected:
                continue
            result=json.loads(gzip.decompress(payload).decode('utf-8'))
            if result.get('format')!='pine-ai-screenshot-v1':
                raise ValueError('Unexpected screenshot data format.')
            save=result.get('save')
            if not isinstance(save,dict) or not isinstance(save.get('world'),list):
                raise ValueError('Missing saved map.')
            return result,{'cols':cols,'rows':rows,'compressed_bytes':size}
    raise ValueError('Checksum mismatch: screenshot was clipped or reduced. Send the original PNG without cropping.')

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('screenshot',type=Path)
    parser.add_argument('-o','--output',type=Path)
    args=parser.parse_args()
    result,meta=decode(args.screenshot)
    output=args.output or args.screenshot.with_suffix('.layout.json')
    output.write_text(json.dumps(result['save'],ensure_ascii=False,indent=2),encoding='utf-8')
    count=len(result['save']['world'])
    print(f"Verified {count} exact objects, {meta['compressed_bytes']} gzip bytes, grid {meta['cols']}x{meta['rows']}.")
    print(f"Saved full JSON: {output}")

if __name__=='__main__':
    main()
