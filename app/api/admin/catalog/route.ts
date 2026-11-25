import {NextResponse} from "next/server";
import {database,configuredStoreId} from "../../../../lib/server/db";
import {requireStoreRole} from "../../../../lib/server/auth";
import {isUuid,sameOrigin,smallJson,privateHeaders} from "../../../../lib/server/http";
import {validGroups,validSelection,canonicalGroups,type OptionGroup} from "../../../../lib/catalog-options";
import {approvedImageUrl,localMediaId} from "../../../../lib/server/catalog-media";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:privateHeaders});
const str=(v:unknown,min:number,max:number):v is string=>typeof v==="string"&&v.trim().length>=min&&v.trim().length<=max;
const revision=(v:unknown):v is number=>typeof v==="number"&&Number.isSafeInteger(v)&&v>=0&&v<2147483647;
export async function GET(){
 try{
 const store=configuredStoreId();if(!await requireStoreRole(store,["owner","admin"]))return reply({error:"Ruxsat yo‘q"},403);
 const c=await database().connect();
 try{
 await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
 const p=await c.query("SELECT id,name,category,description,image_url,published,revision,option_groups FROM products WHERE store_id=$1 ORDER BY name,id LIMIT 201",[store]);
 const v=await c.query("SELECT id,product_id,sku,color,storage_label,price_uzs::text,quantity,active,revision,option_values,image_url FROM variants WHERE store_id=$1 AND product_id=ANY($2::uuid[]) ORDER BY product_id,sku LIMIT 1001",[store,p.rows.slice(0,200).map(r=>r.id)]);
 await c.query("COMMIT");return reply({products:p.rows.slice(0,200),variants:v.rows.slice(0,1000),truncated:p.rows.length>200||v.rows.length>1000,enabled:process.env.CATALOG_ADMIN_ENABLED==="true"});
 }catch{await c.query("ROLLBACK");return reply({error:"Katalogni yuklab bo‘lmadi"},503);}finally{c.release();}
 }catch{return reply({error:"Xizmat vaqtincha ishlamayapti"},503);}
}
export async function POST(request:Request){
 if(!sameOrigin(request))return reply({error:"Ruxsat yo‘q"},403);
 const b=await smallJson(request);if(!b)return reply({error:"Ma’lumotlarni tekshiring"},400);
 const action=b.action;
 if(action!=="createProduct"&&action!=="updateProduct"&&action!=="createVariant"&&action!=="updateVariant")return reply({error:"Noma’lum amal"},400);
 const product=action==="createProduct"||action==="updateProduct";
 const create=action==="createProduct"||action==="createVariant";
 if(create?!isUuid(b.key):!isUuid(b.id)||!revision(b.revision))return reply({error:"So‘rov ma’lumotlarini tekshiring"},400);
 if(product){
 if(!str(b.name,1,120)||!str(b.category,1,80)||!str(b.description,0,3000)||typeof b.published!=="boolean"||(b.imageUrl!==null&&(typeof b.imageUrl!=="string"||!approvedImageUrl(b.imageUrl))))return reply({error:"Mahsulot ma’lumotlarini yoki tasdiqlangan rasm manzilini tekshiring"},400);
 if(b.optionGroups!==undefined&&!validGroups(b.optionGroups,approvedImageUrl))return reply({error:"Xususiyatlar va qiymatlarni tekshiring"},400);
 if(create&&b.published)return reply({error:"Avval qoralama yarating va variant qo‘shing"},400);
 }else if((create&&!isUuid(b.productId))||!str(b.sku,1,80)||!str(b.color,1,80)||!str(b.storage,0,80)||typeof b.price!=="string"||!/^[1-9][0-9]{0,11}$/.test(b.price)||typeof b.active!=="boolean")return reply({error:"Variant ma’lumotlarini tekshiring"},400);
 if(!product&&b.imageUrl!==undefined&&b.imageUrl!==null&&(typeof b.imageUrl!=="string"||!approvedImageUrl(b.imageUrl)))return reply({error:"Variant rasmi tasdiqlangan manbadan bo‘lishi kerak"},400);
 try{
 const store=configuredStoreId();const actor=await requireStoreRole(store,["owner","admin"]);if(!actor)return reply({error:"Ruxsat yo‘q"},403);
 if(process.env.CATALOG_ADMIN_ENABLED!=="true")return reply({error:"Katalog tahriri hali yoqilmagan"},503);
 const c=await database().connect();
 try{
 await c.query("BEGIN");
 const fail=async(error:string,status=409)=>{await c.query("ROLLBACK");return reply({error},status);};
 const repeat=async(id:string)=>{await c.query("ROLLBACK");return reply({id,repeated:true});};
 const refs=[...(typeof b.imageUrl==="string"?[b.imageUrl]:[]),...(Array.isArray(b.optionGroups)?(b.optionGroups as OptionGroup[]).flatMap(g=>g.values.map(v=>v.imageUrl).filter((v):v is string=>typeof v==="string")):[])];
 const localIds=[...new Set(refs.map(localMediaId).filter((v):v is string=>v!==null))];
 if(localIds.length){const media=await c.query("SELECT id FROM catalog_media WHERE store_id=$1 AND id=ANY($2::uuid[])",[store,localIds]);if(media.rowCount!==localIds.length)return await fail("Rasm ushbu katalogda topilmadi",400);}
 let id:string;
 if(product){
 const name=String(b.name).trim(),category=String(b.category).trim(),description=String(b.description).trim();
 if(create){
 const groups=b.optionGroups??[];
 const r=await c.query("INSERT INTO products(store_id,name,category,description,image_url,published,request_key,option_groups) VALUES($1,$2,$3,$4,$5,false,$6,$7::jsonb) ON CONFLICT(store_id,request_key) DO NOTHING RETURNING id",[store,name,category,description,b.imageUrl,b.key,JSON.stringify(groups)]);
 if(!r.rowCount){const d=(await c.query("SELECT id,name,category,description,image_url,option_groups FROM products WHERE store_id=$1 AND request_key=$2",[store,b.key])).rows[0];return d&&d.name===name&&d.category===category&&d.description===description&&d.image_url===b.imageUrl&&canonicalGroups(d.option_groups)===canonicalGroups(groups as OptionGroup[])?await repeat(d.id):await fail("So‘rov kaliti band");}id=r.rows[0].id;
 }else{
 const lock=await c.query("SELECT revision,option_groups FROM products WHERE store_id=$1 AND id=$2 FOR UPDATE",[store,b.id]);
 if(!lock.rowCount)return await fail("Mahsulot topilmadi",404);
 if(lock.rows[0].revision!==b.revision)return await fail("Mahsulot o‘zgargan. Yangilang.");
 const groups=(b.optionGroups??lock.rows[0].option_groups) as OptionGroup[];
 const existing=await c.query("SELECT option_values FROM variants WHERE store_id=$1 AND product_id=$2",[store,b.id]);
 if(existing.rows.some(v=>!validSelection(groups,v.option_values)))return await fail("Mavjud variantlarga mos xususiyatlarni saqlang. Yangi xususiyat guruhini variantlardan oldin yarating.");
 if(b.published){const v=await c.query("SELECT 1 FROM variants WHERE store_id=$1 AND product_id=$2 AND active=true LIMIT 1",[store,b.id]);if(!v.rowCount)return await fail("Kamida bitta faol variant kerak");}
 const r=await c.query("UPDATE products SET name=$3,category=$4,description=$5,image_url=$6,published=$7,option_groups=$8::jsonb,revision=revision+1 WHERE store_id=$1 AND id=$2 RETURNING id",[store,b.id,name,category,description,b.imageUrl,b.published,JSON.stringify(groups)]);id=r.rows[0].id;
 }
 }else{
 const sku=String(b.sku).trim(),color=String(b.color).trim(),storage=String(b.storage).trim()||null;
 const productId=create?b.productId:(await c.query("SELECT product_id FROM variants WHERE store_id=$1 AND id=$2",[store,b.id])).rows[0]?.product_id;
 if(!productId)return await fail("Variant topilmadi",404);
 const lock=await c.query("SELECT published,option_groups FROM products WHERE store_id=$1 AND id=$2 FOR UPDATE",[store,productId]);if(!lock.rowCount)return await fail("Mahsulot topilmadi",404);
 const groups=lock.rows[0].option_groups as OptionGroup[];
 const selection=b.optionValues??{};
 if(!validSelection(groups,selection))return await fail("Variant barcha xususiyatlar qiymatiga ega bo‘lishi kerak",400);
 if(create){
 const d=(await c.query("SELECT id,product_id,sku,color,storage_label,price_uzs::text,active,option_values,image_url FROM variants WHERE store_id=$1 AND request_key=$2",[store,b.key])).rows[0];
 if(d)return d.product_id===String(productId).toLowerCase()&&d.sku===sku&&d.color===color&&d.storage_label===storage&&d.price_uzs===b.price&&d.active===b.active&&validSelection(groups,d.option_values)&&Object.entries(selection).every(([k,v])=>d.option_values[k]===v)&&d.image_url===(b.imageUrl??null)?await repeat(d.id):await fail("So‘rov kaliti band");
 const r=await c.query("INSERT INTO variants(store_id,product_id,sku,color,storage_label,price_uzs,active,quantity,request_key,option_values,image_url) VALUES($1,$2,$3,$4,$5,$6,$7,0,$8,$9::jsonb,$10) ON CONFLICT DO NOTHING RETURNING id",[store,productId,sku,color,storage,b.price,b.active,b.key,JSON.stringify(selection),b.imageUrl??null]);if(!r.rowCount)return await fail("SKU yoki xususiyatlar kombinatsiyasi band");id=r.rows[0].id;
 }else{
 const v=await c.query("SELECT revision,option_values,image_url FROM variants WHERE store_id=$1 AND id=$2 FOR UPDATE",[store,b.id]);if(!v.rowCount||v.rows[0].revision!==b.revision)return await fail("Variant o‘zgargan. Yangilang.");
 if(Object.entries(selection).some(([k,val])=>v.rows[0].option_values[k]!==val))return await fail("Mavjud SKU kombinatsiyasini o‘zgartirib bo‘lmaydi. Yangi variant yarating.");
 if(b.active===false&&lock.rows[0].published){const other=await c.query("SELECT 1 FROM variants WHERE store_id=$1 AND product_id=$2 AND id<>$3 AND active=true LIMIT 1",[store,productId,b.id]);if(!other.rowCount)return await fail("Avval mahsulotni katalogdan yashiring");}
 const duplicate=await c.query("SELECT 1 FROM variants WHERE store_id=$1 AND sku=$2 AND id<>$3",[store,sku,b.id]);if(duplicate.rowCount)return await fail("SKU band");
 const r=await c.query("UPDATE variants SET sku=$3,color=$4,storage_label=$5,price_uzs=$6,active=$7,image_url=$8,revision=revision+1 WHERE store_id=$1 AND id=$2 RETURNING id",[store,b.id,sku,color,storage,b.price,b.active,b.imageUrl===undefined?v.rows[0].image_url:b.imageUrl]);id=r.rows[0].id;
 }
 }
 await c.query("INSERT INTO audit_events(store_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,$3,$4,$5)",[store,actor.account_id,"catalog_"+action,product?"product":"variant",id]);
 await c.query("COMMIT");return reply({id},create?201:200);
 }catch(e){await c.query("ROLLBACK");return reply({error:"Katalog ma’lumotlarini saqlab bo‘lmadi"},503);}finally{c.release();}
 }catch{return reply({error:"Xizmat vaqtincha ishlamayapti"},503);}
}
