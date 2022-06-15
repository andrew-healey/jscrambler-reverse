import { is } from "../assert-utils.js";
import assert from "node:assert"
import * as Shift from "shift-ast";

export const demo = `
	var r6 = 0;
	while (r6 < V0.length) {
		v8.O9Y46j(t_LLgd.m2y_So(V0[r6] + 75));
		r6++;
	}

	p0 = x_ - 1;
	while (p0 >= 0) {
		g5 = 0;
		I$ = 0;
		q9 = I$;
		do {
			q9 = I$;
			I$ = n3[g5];
			c5 = I$ - q9;
			g5++;
		} while (p0 >= I$);
		s3 = q9 + (p0 - q9 + I2 * T3) % c5;
		N6[T3][s3] = N6[p0];
		p0 -= 1;
	}
`;

export default (sess) => {
  const updateExprs = sess(
    `:matches(VariableDeclarationStatement, ExpressionStatement[expression.type=AssignmentExpression]) + WhileStatement[test.type=BinaryExpression] > BlockStatement > Block > ExpressionStatement:last-child > :matches(AssignmentExpression, UpdateExpression, CompoundAssignmentExpression)`
  );

  updateExprs.forEach((expr) => {
    const whileBody = sess(expr).parents().parents().parents();
    is(whileBody.get(0), "BlockStatement");
    const whileLoop = whileBody.parents();
    is(whileLoop.get(0), "WhileStatement");

    const blocks = whileLoop.parents();
    const firstBlock = blocks.get(0);
    const allStatements =
      firstBlock.type === "SwitchCase"
        ? firstBlock.consequent
        : sess(firstBlock).statements().nodes;

    const whileIdx = allStatements.indexOf(whileLoop.get(0));
    const varDeclSt = allStatements[whileIdx - 1];
    assert(
      varDeclSt.type === "VariableDeclarationStatement" ||
        varDeclSt.type === "ExpressionStatement"
    );

    const declarator = (() => {
      if (varDeclSt.type === "VariableDeclarationStatement") {
        // Get variable in declaration.
        const { declaration } = varDeclSt;
        is(declaration, "VariableDeclaration");
        const {
          declarators: [declarator],
        } = declaration;
        is(declarator, "VariableDeclarator");
        return {
					declaration,
					binding:declarator.binding,
					init:declarator.init,
				};
      } else {
        const { expression } = varDeclSt;
        is(expression, "AssignmentExpression");
        const { binding, expression:init } = expression;
        return { declaration:expression, binding, init: expression };
      }
    })();
		const {declaration} = declarator; // A make-believe "declaration" which I will use as the init of the for loop.
    const variable = sess(declarator.binding).lookupVariable()[0];

    // Get variable in while loop test.

    const { test } = whileLoop.get(0);
    is(test, "BinaryExpression");
    const { left } = test;
    if (left.type === "IdentifierExpression") {
      const testVar = sess(left).lookupVariable()[0];

			assert(["UpdateExpression","CompoundAssignmentExpression","AssignmentExpression"].includes(expr.type))
      // Get variable in update.
			const operand=expr.operand??expr.binding;
      if (operand.type === "AssignmentTargetIdentifier") {
        const updateVar = sess(operand).lookupVariable()[0];

        if (updateVar === testVar && testVar === variable) {
          // i.e. these three values match and we have a for loop to make.

          const keptStatements = whileBody.get(0).block.statements.slice(0, -1);

          const newBody = new Shift.BlockStatement({
            block: new Shift.Block({
              statements: keptStatements,
            }),
          });

          const loop = new Shift.ForStatement({
            init: declaration,
            test,
            update: expr,
            body: newBody,
          });

          console.log("Replaced", updateVar.name);
          whileLoop.replace(loop);
          sess(varDeclSt).delete();
        }
      }
    }
  });
};
