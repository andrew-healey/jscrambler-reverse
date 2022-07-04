import { is } from "../assert-utils.js";
import assert from "node:assert"


export const demo=`
var k7 = 244428;
var L5 = q9FmM[k7];
var J8 = 12;
if(true){
	console.log(J8+1)
}
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
		if(allWrites.length<2){
			// This means the var decl is the only time it's written.

			// First, let's find the parent block of the declaration.
			let declParent=sess(declarator);
			while(!declParent.get(0).type.endsWith("Statement")){
				declParent=declParent.parents();
			}
			const declBlock=declParent.parents().get(0);

			// Now, check that the variable can become block-scoped without being destroyed.
			const canReachDeclaration=node=>{
				let currNode=sess(node);
				while(currNode.nodes.length){
					currNode=currNode.parents();
					if(currNode.get(0)===declBlock) return true;
				}
				return false;
			}

			const allSameBlock=variable.references.every(ref=>canReachDeclaration(ref.node));

			if(allSameBlock){
				decl.kind = "const";
				console.log("Constified", binding.name);
			}
		}
	})

}