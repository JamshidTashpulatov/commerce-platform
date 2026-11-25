export type FundingWeight={investorId:string;capital:bigint};
// Pure preview: proportional by funding weight. Does not post or transfer money.
export function allocateProportionally(amount:bigint,weights:readonly FundingWeight[]){
 if(amount<BigInt(0)||!weights.length||weights.some(w=>!w.investorId||w.capital<=BigInt(0))||new Set(weights.map(w=>w.investorId)).size!==weights.length)throw new Error("INVALID_ALLOCATION");
 const total=weights.reduce((n,w)=>n+w.capital,BigInt(0));
 const rows=weights.map(w=>({investorId:w.investorId,amount:amount*w.capital/total,remainder:amount*w.capital%total}));
 const remaining=amount-rows.reduce((n,r)=>n+r.amount,BigInt(0));
 const ranked=[...rows].sort((a,b)=>a.remainder===b.remainder?(a.investorId<b.investorId?-1:a.investorId>b.investorId?1:0):a.remainder>b.remainder?-1:1);
 for(let i=0;i<Number(remaining);i++)ranked[i].amount+=BigInt(1);
 return rows.map(({investorId,amount})=>({investorId,amount}));
}
export function previewReceiptAllocation(principal:bigint,profit:bigint,weights:readonly FundingWeight[]){
 const capital=allocateProportionally(principal,weights);
 const earnings=allocateProportionally(profit,weights);
 return capital.map((row,i)=>({investorId:row.investorId,principal:row.amount,profit:earnings[i].amount,total:row.amount+earnings[i].amount}));
}
