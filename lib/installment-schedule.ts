export function validDate(v:unknown):v is string{
 return typeof v==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
}
export function buildSchedule(total:bigint,initial:bigint,months:number,first:string){
 if(!Number.isSafeInteger(months)||months<1||months>60||!validDate(first)||total<=initial||initial<BigInt(0))throw new Error("INVALID_SCHEDULE");
 const balance=total-initial;const count=BigInt(months);
 if(balance<count)throw new Error("INVALID_SCHEDULE");
 const base=balance/count;const extra=balance%count;
 const [year,month,day]=first.split("-").map(Number);
 if(year<2000||year>2090)throw new Error("INVALID_SCHEDULE");
 return Array.from({length:months},(_,i)=>{
  const last=new Date(Date.UTC(year,month+i,0)).getUTCDate();
  const due=new Date(Date.UTC(year,month-1+i,Math.min(day,last))).toISOString().slice(0,10);
  return {sequence_no:i+1,due_date:due,amount_uzs:(base+(BigInt(i)<extra?BigInt(1):BigInt(0))).toString()};
 });
}
