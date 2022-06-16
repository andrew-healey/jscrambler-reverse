import assert from "node:assert"
import { is } from "../assert-utils.js";

export const demo = `
switch (/* ... */) {
	case 63:
		const X4_55 = "Z7";
		break;
	case 69:
		if (M9_3[X4_55] === X4_90) {
			M9_7[M9_3[X4_61]].h += true;
		}
		break;
}
`;

export default (sess)=>{
	const constLiterals=sess("VariableDeclaration[kind=const] > VariableDeclarator > :matches(LiteralStringExpression, LiteralNumericExpression)");
	const constDecls=constLiterals.parents();

	constDecls.forEach((decl)=>{
		const {init} = decl;

		const variable=sess(decl).lookupVariable()[0];
		assert(variable);

		const {references,name}=variable;

		const reads=references
		.filter(ref=>!ref.accessibility.isWrite)
		.map(ref=>ref.node);

		sess(reads).replace(()=>init)

	});

	const constDeclStmts=constDecls.parents().parents()
	is(constDeclStmts.get(0),"VariableDeclarationStatement");

	constDeclStmts.delete();

}