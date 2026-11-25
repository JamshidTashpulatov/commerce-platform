import pg from "pg";
const {DATABASE_URL,STORE_ID,ADMIN_EMAIL}=process.env;
const email=ADMIN_EMAIL?.trim().toLowerCase();
if(!DATABASE_URL||!STORE_ID||!email||email.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error("Set DATABASE_URL, STORE_ID and ADMIN_EMAIL");
const client=new pg.Client({connectionString:DATABASE_URL});
await client.connect();
try{
 await client.query("BEGIN");
 const store=await client.query("SELECT id FROM stores WHERE id=$1 FOR UPDATE",[STORE_ID]);
 if(!store.rowCount)throw new Error("Store must exist first");
 const admins=await client.query("SELECT m.account_id,a.email FROM memberships m LEFT JOIN admin_credentials a USING(store_id,account_id) WHERE m.store_id=$1 AND m.role IN ('admin','owner')",[STORE_ID]);
 if(admins.rows.length && !admins.rows.some(a=>a.email===email))throw new Error("An administrator already exists; review the existing membership");
 if(!admins.rows.length){
   const account=(await client.query("INSERT INTO accounts DEFAULT VALUES RETURNING id")).rows[0].id;
   await client.query("INSERT INTO memberships(store_id,account_id,role) VALUES($1,$2,'admin')",[STORE_ID,account]);
   await client.query("INSERT INTO admin_credentials(store_id,account_id,email) VALUES($1,$2,$3)",[STORE_ID,account,email]);
 }
 await client.query("COMMIT");
 console.log("Admin provisioned");
}catch(error){await client.query("ROLLBACK");throw error;}finally{await client.end();}
