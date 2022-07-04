import { is } from "../assert-utils.js";
import assert from "node:assert";
import * as Shift from "shift-ast";

export const demo = `
var $_DHHL = zmSjO.$_Cs,
  $_DHGK = ["$_DIAt"].concat($_DHHL),
  $_DHIT = $_DHGK[1];
$_DHGK.shift();
var $_DHJN = $_DHGK[0];
`;

export default (sess) => {
  const concatRecycles = sess(
    `VariableDeclarationStatement[declaration.declarators.length=3] + ExpressionStatement[expression.type=CallExpression][expression.callee.property=shift] + VariableDeclarationStatement > * > * > ComputedMemberExpression`
  );
  concatRecycles.forEach((recycle) => {
    const $recycleStatement = sess(recycle).parents().parents().parents();
    const recycleStatement = $recycleStatement.get(0);
    is(recycleStatement, "VariableDeclarationStatement");

    const containingBlock = $recycleStatement.parents().get(0);
    const statements =
      containingBlock.type === "SwitchCase"
        ? containingBlock.consequent
        : sess(containingBlock).statements().nodes;

    const recycleIdx = statements.indexOf(recycleStatement);

    const shiftStatement = statements[recycleIdx - 1];
    const initStatement = statements[recycleIdx - 2];
    is(initStatement, "VariableDeclarationStatement");
    const { declaration } = initStatement;
    is(declaration, "VariableDeclaration");
    assert.equal(declaration.declarators.length, 3);
    const [declarator, secondDeclarator, thirdDeclarator] =
      declaration.declarators;
    is(declarator, "VariableDeclarator");
    const { init } = declarator;

    const recycleBind = sess(recycle).parents().get(0).binding;
    is(recycleBind, "BindingIdentifier");

    const thirdBind = thirdDeclarator.binding;
    is(thirdBind, "BindingIdentifier");

    const bind = declarator.binding;
    is(bind, "BindingIdentifier");

    const newStatements = [bind, thirdBind, recycleBind].map(
      (binding) =>
        new Shift.VariableDeclarationStatement({
          declaration: new Shift.VariableDeclaration({
            declarators: [
              new Shift.VariableDeclarator({
                binding,
                init,
              }),
            ],
						kind:"var"
          }),
        })
    );

		sess(initStatement).replace(newStatements[0]);
		sess(shiftStatement).replace(newStatements[1]);
		sess(recycleStatement).replace(newStatements[2]);

  });
};
