import "server-only";
import {customerKeys,unseal,fieldContext} from "./customer-crypto";
export function customerConfig(){
 if(process.env.CUSTOMER_RECORDS_ENABLED!=="true")throw new Error("CUSTOMER_RECORDS_DISABLED");
 return customerKeys(process.env.CUSTOMER_DATA_KEY);
}
type CustomerRow={id:string;name_cipher:string;phone_cipher:string;has_passport:boolean};
export function customerSummary(row:CustomerRow,store:string,key:Buffer){
 const name=unseal(key,row.name_cipher,fieldContext(store,row.id,"name"));
 const phone=unseal(key,row.phone_cipher,fieldContext(store,row.id,"phone"));
 return {id:row.id,name,phone_masked:phone.slice(0,4)+" ••• •• "+phone.slice(-2),has_passport:row.has_passport};
}
