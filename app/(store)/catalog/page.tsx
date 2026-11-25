import type {Metadata} from "next";
import {Suspense} from "react";
import {CatalogView} from "../../../components/store/catalog-view";
import {wrap} from "../../../components/store/bits";

export const metadata:Metadata={title:"Katalog",description:"Barcha modellar, narxlari so‘mda va mavjudligi."};

export default function CatalogPage(){
  return <div className={wrap+" pb-20"}>
    <Suspense fallback={<h1 className="pt-16 text-5xl font-semibold">Katalog.</h1>}><CatalogView/></Suspense>
  </div>;
}
