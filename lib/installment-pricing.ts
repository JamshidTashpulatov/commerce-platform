export type PricingPolicy={minimumInitialBps:number;monthlyMarkupBps:number};
const BPS=BigInt(10000);
export function validPolicy(p:PricingPolicy){
 return Number.isInteger(p.minimumInitialBps)&&p.minimumInitialBps>0&&p.minimumInitialBps<10000&&Number.isInteger(p.monthlyMarkupBps)&&p.monthlyMarkupBps>=0&&p.monthlyMarkupBps<=10000;
}
export function minimumInitial(cost:bigint,policy:PricingPolicy){
 if(cost<=BigInt(0)||!validPolicy(policy))throw new Error("INVALID_COST_OR_POLICY");
 return (cost*BigInt(policy.minimumInitialBps)+BPS-BigInt(1))/BPS;
}
export function priceInstallment(cost:bigint,initial:bigint,months:number,policy:PricingPolicy){
 const minimum=minimumInitial(cost,policy);
 if(initial<minimum||initial>=cost||!Number.isSafeInteger(months)||months<1||months>60)throw new Error("INVALID_TERMS");
 const principal=cost-initial;
 // Flat markup on original financed principal, rounded once to whole UZS.
 const markup=(principal*BigInt(policy.monthlyMarkupBps)*BigInt(months)+BPS/BigInt(2))/BPS;
 const total=cost+markup;
 if(total>BigInt("999999999999")||total-initial<BigInt(months))throw new Error("INVALID_TOTAL");
 return {cost:cost.toString(),initial:initial.toString(),minimum:minimum.toString(),principal:principal.toString(),markup:markup.toString(),total:total.toString(),months,...policy};
}
