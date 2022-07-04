import assert from "node:assert";
import { is } from "../assert-utils.js";
import {refactor} from "shift-refactor";

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

export default (sess) => {
  const constLiterals = sess(
    "VariableDeclaration[kind=const] > VariableDeclarator > :matches(LiteralStringExpression, LiteralNumericExpression, ObjectExpression,StaticMemberExpression[object.type=IdentifierExpression],IdentifierExpression)",
  );
  const constDecls = constLiterals.parents();

  constDecls.forEach((decl) => {
    const { init } = decl;
    const isLiteral = init.type !== "ObjectExpression";

    const variable = sess(decl).lookupVariable()[0];
    assert(variable);

    const { references, name } = variable;

    const reads = references
      .filter((ref) => !ref.accessibility.isWrite)
      .map((ref) => ref.node);

    if (isLiteral || reads.length === 1) {
      sess(reads).replace(() => init);
			// Now, decide whether or not to delete the *declarator* or *declaration statement*.
			const $declarator=sess(decl);
			const $declaration=$declarator.parents();
			const declaration=$declaration.get(0);
			if(declaration.declarators.length==1){
				const $declarationStatement=$declaration.parents();
				$declarationStatement.delete();
			} else {
				$declarator.delete();
			}
    }
  });

	/*
  const constDeclStmts = constDecls.parents().parents();
  is(constDeclStmts.get(0), "VariableDeclarationStatement");

  constDeclStmts.delete();
	*/

	return sess;
};
