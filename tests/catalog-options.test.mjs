import test from "node:test";
import assert from "node:assert/strict";
import {validGroups,validSelection,variantImage,matchingVariants} from "../lib/catalog-options.ts";
const groups=[{name:"Rang",affectsPrice:false,values:[{label:"A",imageUrl:"https://images.example.com/a.png"},{label:"B",imageUrl:null}]},{name:"Komplekt",affectsPrice:true,values:[{label:"Standart",imageUrl:null},{label:"Plus",imageUrl:null}]}];
test("dynamic groups and complete combinations",()=>{
 assert.equal(validGroups(groups,u=>u.startsWith("https://images.example.com/")),true);
 assert.equal(validSelection(groups,{Rang:"A",Komplekt:"Plus"}),true);
 assert.equal(validSelection(groups,{Rang:"A"}),false);
 assert.equal(validSelection(groups,{Rang:"A",Komplekt:"Unknown"}),false);
 assert.equal(validGroups([...groups,groups[0]],()=>true),false);
});
test("image precedence and actual combinations",()=>{
 const selection={Rang:"A",Komplekt:"Plus"};
 assert.equal(variantImage(groups,selection,null,"fallback"),"https://images.example.com/a.png");
 assert.equal(variantImage(groups,selection,"override","fallback"),"override");
 assert.equal(matchingVariants([{option_values:selection},{option_values:{Rang:"B",Komplekt:"Standart"}}],{Rang:"A"}).length,1);
});
