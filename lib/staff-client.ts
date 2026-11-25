export type StaffOrder={id:string;source:"staff"|"website";request_status:string;sale_status:string;fulfillment_status:string;revision:number;created_at:string;total_uzs?:string;website_reference?:string|null};
export type StaffVariant={id:string;name:string;color:string;storage_label:string|null;quantity:number;price_uzs:string};
export type StaffItem={variant_id:string;name:string;color:string;storage_label:string|null;quantity:number;unit_price_uzs:string};
export const requestLabels:Record<string,string>={new:"Yangi",in_progress:"Jarayonda",cancelled:"Bekor qilingan"};
export const saleLabels:Record<string,string>={not_sold:"Sotilmagan",sold:"Sotilgan"};
export const deliveryLabels:Record<string,string>={not_delivered:"Yetkazilmagan",in_transit:"Yo‘lda",delivered:"Yetkazilgan"};
export const sourceLabels:Record<string,string>={staff:"Sotuvchi",website:"Sayt"};
export function formatUzs(value:string|bigint){try{return new Intl.NumberFormat("uz-UZ").format(BigInt(value))+" UZS";}catch{return "—";}}
export function formatDate(value:string){const date=new Date(value);return Number.isNaN(date.getTime())?"—":new Intl.DateTimeFormat("uz-UZ",{dateStyle:"medium",timeZone:"Asia/Tashkent"}).format(date);}
export async function staffFetch<T>(url:string,method="GET",body?:unknown):Promise<T>{
 const res=await fetch(url,{method,credentials:"same-origin",cache:"no-store",...(body===undefined?{}:{headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})});
 const data=await res.json().catch(()=>null);
 if(!res.ok)throw new Error(typeof data?.error==="string"?data.error:"So‘rov bajarilmadi. Qayta urinib ko‘ring.");
 return data as T;
}
