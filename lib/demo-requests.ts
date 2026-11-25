export type DemoRequest={id:string;product:string;storage:string;color:string;quantity:number;total:number;createdAt:string};
const KEY="commerce_demo_requests_v1";
export function readDemoRequests():DemoRequest[]{
  try{const data:unknown=JSON.parse(localStorage.getItem(KEY)??"[]");
    if(!Array.isArray(data))return [];
    return data.filter((r):r is DemoRequest=>r&&typeof r.id==="string"&&typeof r.product==="string"&&typeof r.storage==="string"&&typeof r.color==="string"&&Number.isSafeInteger(r.quantity)&&r.quantity>0&&Number.isSafeInteger(r.total)&&r.total>=0&&typeof r.createdAt==="string").slice(0,50);
  }catch{return [];}
}
export function saveDemoRequest(request:DemoRequest){
  localStorage.setItem(KEY,JSON.stringify([request,...readDemoRequests()].slice(0,50)));
}
