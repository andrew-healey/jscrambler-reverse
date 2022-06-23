import { is } from "../assert-utils.js";

export const demo=`
const m0_7 = {Q2nRNh1: function () {
	// Presumably integrity checks.
}};
const player= function (k4, s9, w7, v1, E9, K5, F9, q8, e1, g0, C8, y_) {
	var p8 = 16;
	q9FmM[633873].Q2nRNh1();
	// ...
}

function something(){
	return {e0k3lkP: function () {
		// More integrity checks
	}};
}
const setKeyListener= function (o4) {
	if (q9FmM[413996].e0k3lkP()) {
		// ...
	}
}
`;

export default (sess)=>{
	const noParamBuiltins=sess(`:matches(VariableDeclaration[kind=const][declarators.length=1] > VariableDeclarator, ReturnStatement) > ObjectExpression[properties.length=1] > DataProperty[name.type=StaticPropertyName] > FunctionExpression[params.items.length=0]`);
	noParamBuiltins.forEach(builtin=>{
		const prop=sess(builtin).parents().get(0);
		const {name,expression}=prop;
		is(name,"StaticPropertyName");
		is(expression,"FunctionExpression");

		const {value:propName}=name;

		const allCalls = sess(`CallExpression[callee.property=${JSON.stringify(propName)}]`);

		const callParents=allCalls.parents();

		const statements=callParents.filter(parent=>parent.type==="ExpressionStatement");
		statements.delete();

		const ifs=callParents.filter(parent=>parent.type==="IfStatement");
		ifs.replace(ifStmt=>ifStmt.consequent)
		
		//console.log("Deleted",propName);

	})
};