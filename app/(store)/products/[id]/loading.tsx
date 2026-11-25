import {Skeleton} from "@/components/ui/skeleton";
import {wrap} from "../../../../components/store/bits";

export default function Loading(){
  return <div className={wrap+" pb-16"} aria-busy="true">
    <p className="sr-only" role="status">Mahsulot yuklanmoqda</p>
    <div className="flex flex-col gap-3 pt-8 pb-8 tablet:pt-14 tablet:pb-12" aria-hidden="true">
      <Skeleton className="h-4 w-20 bg-sf-alt"/><Skeleton className="h-11 w-[min(320px,70vw)] bg-sf-alt"/><Skeleton className="h-4 w-32 bg-sf-alt"/>
    </div>
    <div className="grid gap-10 desktop:grid-cols-[minmax(0,1fr)_360px] desktop:gap-14" aria-hidden="true">
      <Skeleton className="aspect-4/3 rounded-[18px] bg-sf-alt"/>
      <div className="flex flex-col gap-4"><Skeleton className="h-7 w-1/2 bg-sf-alt"/><Skeleton className="h-16 bg-sf-alt"/><Skeleton className="h-16 bg-sf-alt"/><Skeleton className="mt-6 h-56 rounded-[18px] bg-sf-alt"/></div>
    </div>
  </div>;
}
