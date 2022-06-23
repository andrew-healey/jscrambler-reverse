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
    "VariableDeclaration[kind=const] > VariableDeclarator > :matches(LiteralStringExpression, LiteralNumericExpression, ObjectExpression)"
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
			sess(decl).parents().parents().delete();
    }
  });

	/*
  const constDeclStmts = constDecls.parents().parents();
  is(constDeclStmts.get(0), "VariableDeclarationStatement");

  constDeclStmts.delete();
	*/

	return sess;
};
