export function splitApprovedProfit(profit:bigint,investorShareBps:number){
 if(profit<BigInt(0)||!Number.isSafeInteger(investorShareBps)||investorShareBps<0||investorShareBps>10000)throw new Error("INVALID_PROFIT_SPLIT");
 const investorPool=(profit*BigInt(investorShareBps))/BigInt(10000);
 return {investorPool,businessShare:profit-investorPool};
}
