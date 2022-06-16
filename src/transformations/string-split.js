import { is } from "../assert-utils.js";
import * as Shift from "shift-ast";
import assert from "node:assert";

export const demo = `
var Y5_40 = "P";
Y5_40 += "O";
Y5_40 += "S";
Y5_40 += "T";
`;

export default (sess) => {
  const varLiterals = sess(
    "VariableDeclaration[kind=var] > VariableDeclarator > LiteralStringExpression"
  );
  const varDecls = varLiterals.parents();
  varDecls.forEach((decl) => {
    const { init } = decl;
    is(init, "LiteralStringExpression");
    const initialValue = init.value;
    const variable = sess(decl).lookupVariable()[0];

    assert(variable);

    const { references, name } = variable;

    const writeTargets = references
      .filter((ref) => ref.accessibility.isWrite)
      .map((ref) => ref.node);
    const writeAssignments = sess(writeTargets)
      .parents()
      .filter((node) => node.type === "CompoundAssignmentExpression");

    const allAreStrings = writeAssignments.nodes.every(
      (write) =>
        write.expression.type === "LiteralStringExpression" &&
        write.operator == "+="
    );

    if (allAreStrings && writeAssignments.nodes.length > 0) {
      const writeStmts = writeAssignments.parents();

      const writeBlocks = writeStmts.parents();

      const haveSameBlock = writeBlocks.nodes.every(
        (node) => node === writeBlocks.nodes[0]
      );

      if (haveSameBlock) {
        // Assume these are compressible.

        const sharedBlock = writeBlocks.nodes[0];

        const allStatements =
          sharedBlock.type === "SwitchCase"
            ? sharedBlock.consequent
            : sess(sharedBlock).statements().nodes;

        const sortedStmts = writeStmts.nodes.sort(
          (a, b) => allStatements.indexOf(a) - allStatements.indexOf(b)
        );

        const sortedLiterals = sortedStmts.map((stmt) => {
          const { expression } = stmt;
          is(expression, "CompoundAssignmentExpression");
          const shiftStr = expression.expression;
          is(shiftStr, "LiteralStringExpression");
          return shiftStr.value;
        });

        const finalStr = initialValue + sortedLiterals.join("");

        const finalVal = new Shift.LiteralStringExpression({
          value: finalStr,
        });

        decl.init = finalVal;
        const ogDeclaration = sess(decl).parents().get(0);
        is(ogDeclaration, "VariableDeclaration");
        ogDeclaration.kind = "const";

        writeStmts.delete();
      }
    }
  });
};
