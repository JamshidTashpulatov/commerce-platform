import "server-only";
import {validPolicy,type PricingPolicy} from "../installment-pricing";
export function installmentPolicy():PricingPolicy|null{
 const initial=process.env.INSTALLMENT_MIN_INITIAL_BPS;
 const markup=process.env.INSTALLMENT_MONTHLY_MARKUP_BPS;
 if(!initial||!markup||!/^\d{1,5}$/.test(initial)||!/^\d{1,5}$/.test(markup))return null;
 const policy={minimumInitialBps:Number(initial),monthlyMarkupBps:Number(markup)};
 return validPolicy(policy)?policy:null;
}
