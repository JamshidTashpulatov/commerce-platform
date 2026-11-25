import {LogoutButton} from "../../components/logout-button";
import Link from "next/link";
import type {ReactNode} from "react";
import {configuredStoreId} from "../../lib/server/db";
import {requireStoreRole} from "../../lib/server/auth";
export const dynamic="force-dynamic";
export default async function StaffLayout({children}:{children:ReactNode}){
 let role:string|null=null;
 if(process.env.STAFF_WORKSPACE_ENABLED==="true"){
  try{role=(await requireStoreRole(configuredStoreId(),["owner","admin","seller"]))?.role??null;}catch{}
 }
 if(!role)return <main className="container order-workspace"><h1>Sotuvchi ish maydoni</h1><section className="surface"><h2>Kirish mavjud emas.</h2><p>Himoyalangan ish maydoni uchun vakolatli xodim sessiyasi va server sozlamalari kerak.</p><Link href="/login" className="secondary">Telegram orqali kirish</Link></section></main>;
 return <div className="dashboard"><aside className="sidebar"><Link className="brand" href="/staff">Do‘kon.</Link><Link className="staff-nav" href="/staff">Buyurtmalar</Link><Link className="staff-nav" href="/staff/new">Yangi buyurtma</Link>{(role==="owner"||role==="admin")&&<><Link className="staff-nav" href="/staff/finance">Fond hisoboti</Link><Link className="staff-nav" href="/staff/cashbook">Kassa</Link><Link className="staff-nav" href="/staff/suppliers">Yetkazib beruvchilar</Link><Link className="staff-nav" href="/staff/inventory">Ombor</Link><Link className="staff-nav" href="/staff/catalog">Mahsulotlar</Link><Link className="staff-nav" href="/staff/investors">Investorlar</Link><Link className="staff-nav" href="/staff/settings">Sozlamalar</Link></>}<p className="muted staff-role">{role==="owner"?"Egasi":role==="admin"?"Administrator":"Sotuvchi"}</p><LogoutButton/></aside><main className="dash-content">{children}</main></div>;
}
