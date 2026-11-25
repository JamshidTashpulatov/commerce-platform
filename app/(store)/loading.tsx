import {Skeleton} from "@/components/ui/skeleton";

export default function Loading(){
  return <div className="flex min-h-[70vh] flex-col items-center gap-3 pt-14" aria-busy="true">
    <p className="sr-only" role="status">Sahifa yuklanmoqda</p>
    <Skeleton className="h-4 w-16 bg-sf-alt"/><Skeleton className="h-14 w-[min(360px,80vw)] bg-sf-alt"/><Skeleton className="h-6 w-[min(420px,85vw)] bg-sf-alt"/>
    <Skeleton className="mt-8 aspect-video w-[min(1180px,100vw)] rounded-none bg-sf-alt"/>
  </div>;
}
