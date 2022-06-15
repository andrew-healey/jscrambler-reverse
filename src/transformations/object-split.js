import assert from "node:assert";

export const demo=`
	q9FmM[633873] = function () {
		("Unpacked from graph");
		"Replaced variable m0";
		m0_5 = undefined;
		var m0_7 = {};
		m0_7.Q2nRNh1 = function () {
			// ...
		};
		return m0_7;
	}();
`

export default (sess)=>{
	const allObjVars = sess(`VariableDeclaration[kind=var] > VariableDeclarator[init.type=ObjectExpression] > BindingIdentifier`);

	allObjVars.forEach((objVar) => {
		const variable = sess(objVar).lookupVariable()[0];
		console.log(variable);

		const { declarations, references } = variable;
		if(declarations.length!==0) return;
		const writers=references.filter(ref=>ref.accessibility.isWrite);

		if(writers.length>0){
			return;
		}

		console.log(references.map(ref=>ref.node));
		assert.fail("Not implemented");
	});
};