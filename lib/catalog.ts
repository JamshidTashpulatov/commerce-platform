import {formatMoney} from "./money";
export type Product = { id: string; name: string; category: string; price: number; colors: string[]; stock: number; specs: Record<string,string>; symbol: string };
export const products: Product[] = [
{id:"phone",name:"Phone Pro",category:"Smartfonlar",price:12000000,colors:["Titan","Qora","Oq"],stock:12,specs:{Displey:"6.3 dyuym",Xotira:"256 GB",Protsessor:"Pro chipi"},symbol:"phone"},
{id:"laptop",name:"Notebook Air",category:"Noutbuklar",price:16500000,colors:["Kumush","To‘q ko‘k"],stock:8,specs:{Displey:"13.6 dyuym",Xotira:"512 GB",Protsessor:"M-series"},symbol:"laptop"},
{id:"tablet",name:"Tablet Pro",category:"Planshetlar",price:9800000,colors:["Kumush","Qora"],stock:10,specs:{Displey:"11 dyuym",Xotira:"256 GB",Protsessor:"Pro chipi"},symbol:"tablet"},
{id:"headphones",name:"Quloqchin",category:"Aksessuarlar",price:2300000,colors:["Oq","Qora"],stock:18,specs:{Displey:"—",Xotira:"—",Protsessor:"Audio chipi"},symbol:"headphones"}
];
/** Demo pages under /dashboard: whole US dollars, like the rest of the store. */
export const money=(value:number)=>formatMoney(value);
