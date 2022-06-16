import { is } from "../assert-utils.js";
import assert from "node:assert"


export const demo=`
var k7 = 244428;
var L5 = q9FmM[k7];
`

export default (sess)=>{
	const varBindings=sess("VariableDeclarationStatement > VariableDeclaration[kind=var][declarators.length=1] > VariableDeclarator[init.type] > BindingIdentifier");
	const varDeclarations=varBindings.parents().parents();

	varDeclarations.forEach(decl=>{
		is(decl,"VariableDeclaration");
		const {declarators}=decl;
		assert.equal(declarators.length,1);
		const [declarator]=declarators;
		const {binding}=declarator;
		const variable=sess(binding).lookupVariable()[0];

		const allWrites=variable.references.filter(({accessibility})=>accessibility.isWrite);
		if(allWrites.length==1){
			// This means the var decl is the only time it's written.
			decl.kind="const";
			console.log(`Constified ${variable.name}`);
		}
	})

}