export type Product = { id: string; name: string; category: string; price: number; colors: string[]; stock: number; specs: Record<string,string>; symbol: string };
export const products: Product[] = [
{id:"phone",name:"Phone Pro",category:"Smartfonlar",price:12000000,colors:["Titanium","Black","White"],stock:12,specs:{Displey:"6.3 inch",Xotira:"256 GB",Protsessor:"Pro chip"},symbol:"phone"},
{id:"laptop",name:"Notebook Air",category:"Noutbuklar",price:16500000,colors:["Silver","Midnight"],stock:8,specs:{Displey:"13.6 inch",Xotira:"512 GB",Protsessor:"M-series"},symbol:"laptop"},
{id:"tablet",name:"Tablet Pro",category:"Planshetlar",price:9800000,colors:["Silver","Black"],stock:10,specs:{Displey:"11 inch",Xotira:"256 GB",Protsessor:"Pro chip"},symbol:"tablet"},
{id:"headphones",name:"Headphones",category:"Aksessuarlar",price:2300000,colors:["White","Black"],stock:18,specs:{Displey:"—",Xotira:"—",Protsessor:"Audio chip"},symbol:"headphones"}
];
export const money=(value:number)=>new Intl.NumberFormat("uz-UZ").format(value)+" UZS";
