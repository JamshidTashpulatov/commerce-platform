export type OrderDetails={
 orderStatus:"Yangi"|"Jarayonda"|"Bekor qilingan";
 saleStatus:"Sotilmagan"|"Sotilgan";
 deliveryStatus:"Yetkazilmagan"|"Yo‘lda"|"Yetkazilgan";
 method:"Belgilanmagan"|"Naqd"|"Nasiya";
 salePrice:number;cost:number;initial:number;received:number;months:number;rate:number;
 fundingA:number;fundingB:number;customerSaved:boolean;
};
const KEY="commerce_demo_order_details_v1";
export function defaultDetails(total:number):OrderDetails{return {orderStatus:"Yangi",saleStatus:"Sotilmagan",deliveryStatus:"Yetkazilmagan",method:"Belgilanmagan",salePrice:total,cost:0,initial:0,received:0,months:1,rate:0,fundingA:0,fundingB:0,customerSaved:false};}
export function readDetails(id:string,total:number):OrderDetails{
 try{const data=JSON.parse(localStorage.getItem(KEY)??"{}");return {...defaultDetails(total),...data[id]};}catch{return defaultDetails(total);}
}
export function saveDetails(id:string,details:OrderDetails){
 const data=JSON.parse(localStorage.getItem(KEY)??"{}");
 localStorage.setItem(KEY,JSON.stringify({...data,[id]:details}));
}
