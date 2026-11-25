import type {Metadata} from "next";
import {Suspense} from "react";
import {CatalogView} from "../../../components/store/catalog-view";

export const metadata:Metadata={title:"Katalog",description:"Barcha modellar, narxlari so‘mda va mavjudligi."};

export default function CatalogPage(){
  return <div className="sf-wrap sf-catalog">
    <Suspense fallback={<div className="sf-catalog-head"><h1>Katalog.</h1></div>}><CatalogView/></Suspense>
  </div>;
}
