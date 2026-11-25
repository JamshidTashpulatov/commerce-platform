"use client";
import {useRef} from "react";

/**
 * A studio photo whose plain background should disappear into its tile. When
 * the image loads, its edge colour is sampled (the CDN allows CORS reads) and
 * painted onto the nearest [data-tone] container, so the photo's background
 * and the tile become one surface. Busy edges (lifestyle photos) are left alone.
 */
export function ToneImage(props:React.ImgHTMLAttributes<HTMLImageElement>){
  const ref=useRef<HTMLImageElement>(null);
  const sample=(img:HTMLImageElement)=>{
    const target=img.closest<HTMLElement>("[data-tone]");
    if(!target||!img.naturalWidth)return;
    try{
      const w=32,h=Math.max(8,Math.round(32*img.naturalHeight/img.naturalWidth));
      const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;
      const ctx=canvas.getContext("2d",{willReadFrequently:true});if(!ctx)return;
      ctx.drawImage(img,0,0,w,h);
      const d=ctx.getImageData(0,0,w,h).data;
      const px:number[][]=[];
      for(let x=0;x<w;x++){px.push([...d.slice(x*4,x*4+3)],[...d.slice(((h-1)*w+x)*4,((h-1)*w+x)*4+3)]);}
      for(let y=0;y<h;y++){px.push([...d.slice(y*w*4,y*w*4+3)],[...d.slice((y*w+w-1)*4,(y*w+w-1)*4+3)]);}
      // Use the most common edge colour, so a product touching one edge does not
      // spoil it; give up when the edge has no dominant plain colour.
      const key=(p:number[])=>p.map(v=>v>>2).join(",");
      const counts=new Map<string,number[][]>();
      for(const p of px){const k=key(p);counts.set(k,[...(counts.get(k)??[]),p]);}
      const top=[...counts.values()].sort((a,b)=>b.length-a.length)[0];
      const near=px.filter(p=>Math.hypot(p[0]-top[0][0],p[1]-top[0][1],p[2]-top[0][2])<=10);
      if(near.length<px.length*0.6)return;
      const avg=[0,1,2].map(c=>near.reduce((s,p)=>s+p[c],0)/near.length);
      target.style.backgroundColor=`rgb(${avg.map(Math.round).join(",")})`;
    }catch{/* tainted canvas or decode issue: keep the default tile colour */}
  };
  return <img ref={ref} crossOrigin="anonymous" {...props} onLoad={e=>{sample(e.currentTarget);props.onLoad?.(e);}}
    // eslint-disable-next-line jsx-a11y/alt-text
  />;
}
