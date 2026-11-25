export type ImageSources={src:string;srcSet?:string;hiRes:string;alpha:boolean;ratio:number|null};

// Apple's image CDN resizes on request. Ask for sensible widths instead of the
// stored original, which can be 5120px wide. A non-numeric version token signs
// the exact size and the CDN returns 404 for any other, so those stay as stored.
export function imageSources(raw:string):ImageSources{
  let url:URL|null=null;
  try{url=new URL(raw);}catch{/* relative upload path */}
  if(!url||url.hostname!=="store.storeimages.cdn-apple.com")return {src:raw,hiRes:raw,alpha:false,ratio:null};
  const wid=Number(url.searchParams.get("wid")),hei=Number(url.searchParams.get("hei"));
  const alpha=url.searchParams.get("fmt")==="png-alpha";
  const ratio=wid&&hei?wid/hei:null;
  if(!wid||!hei||!/^\d*$/.test(url.searchParams.get(".v")??""))return {src:raw,hiRes:raw,alpha,ratio};
  const at=(w:number)=>{const u=new URL(url);u.searchParams.set("wid",String(w));u.searchParams.set("hei",String(Math.round(w*hei/wid)));return u.toString();};
  const widths=[480,800,1200,1600,2400].filter(w=>w<wid);
  widths.push(Math.min(wid,3200));
  return {src:at(Math.min(wid,1200)),srcSet:widths.map(w=>at(w)+" "+w+"w").join(", "),hiRes:at(Math.min(wid,3200)),alpha,ratio};
}
