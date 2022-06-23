import * as Shift from "shift-ast";
import assert from "node:assert";
import { is } from "../assert-utils.js";

export const demo=`
function test(a){
	var W1 = [arguments];
	W1[9] = {};
	W1[9].h = W1[0][0] * 5;
	W1[9].t = 0;
	return W1[9];
}
`;

export default (sess) => {
  const argumentStrs = sess(
    `VariableDeclarator > ArrayExpression[elements.length=1] > IdentifierExpression[name=arguments]`
  );
  const varDecls = argumentStrs.parents().parents();

  varDecls.lookupVariable().forEach((variable) => {
    const { declarations, references } = variable;

    // Get scope of variable declaration.
    const [declaration] = declarations;
    assert(declaration, "No declaration was found.");
    let currNode = sess(declaration.node);
    while (
      !currNode.get(0).type.includes("Function") ||
      currNode.get(0).type.includes("Body")
    ) {
      currNode = currNode.parents();
    }
    const functionParent = currNode.get(0);

    // Replace all references. Also replace arguments[n] with the nth param name.
    references.forEach(({ node, accessibility }) => {
      const $node = sess(node);
      const $parent = $node.parents();
      const parent = $parent.get(0);
      if (accessibility.isWrite) {
        return; //$parent.parents().parents().delete();
      }

      if (parent.type === "ComputedMemberAssignmentTarget") {
        const { expression } = parent;
        if (expression.type === "LiteralNumericExpression") {
          const newName = `${variable.name}_${expression.value}`;

          return $parent.replace(
            () => new Shift.AssignmentTargetIdentifier({ name: newName })
          );
        }
      } else if (parent.type === "ComputedMemberExpression") {
        const { expression } = parent;
        if (expression.type === "LiteralNumericExpression") {
          if (expression.value === 0) {
            const $grandParent = $parent.parents(); // some_arr[0][4]
            const grandParent = $grandParent.get(0);

						assert(grandParent.type === "ComputedMemberExpression"||grandParent.type === "ComputedMemberAssignmentTarget");
            const { expression } = grandParent;
            is(expression, "LiteralNumericExpression");

            const { params } = functionParent;

            const param = params.items[expression.value];
            if (param) {
              is(param, "BindingIdentifier");

              return $grandParent.replace(param.name);
            } else {
              console.log(
                "Func " + $grandParent.print() + ":",
                sess(functionParent).print()
              );
            }
          } else {
            const newName = `${variable.name}_${expression.value}`;
            return $parent.replace(
              () => new Shift.IdentifierExpression({ name: newName })
            );
          }
        } else {
          assert.fail("Not a number literal.");
        }
      }

      assert.fail(`Unexpected parent type: ${parent.type}`);
    });

    // Now, delete the main declaration.

    const varDeclSt = sess(declaration.node).parents().parents().parents();
    varDeclSt.replace(
      new Shift.ExpressionStatement({
        expression: new Shift.LiteralStringExpression({
          value: `Replaced variable ${variable.name}`,
        }),
      })
    );
  });

};
