import { is } from "../assert-utils.js";
import assert from "node:assert";

export const demo = `
    var Y5_68 = "";
    Y5_68 = ":";
    const Y5_70 = "b";
    const Y5_81 = "yU";
    var Y5_74 = "";
    Y5_74 = "";
    const Y5_32 = "a";
    Y5_74 = "+";
    var Y5_23 = "";
    Y5_23 = "hgc";
    const Y5_86 = "q";
    var Y5_28 = "";
    Y5_28 = "TY";
`;

export default (sess) => {
  const varLiterals = sess(
    "VariableDeclaration[kind=var] > VariableDeclarator > :matches(LiteralStringExpression, LiteralNumericExpression)"
  );
  const varDecls = varLiterals.parents();
  varDecls.forEach((decl) => {
    const variable = sess(decl).lookupVariable()[0];

    assert(variable);

    const { references, name } = variable;

    const writeTargets = references
      .filter((ref) => ref.accessibility.isWrite)
      .map((ref) => ref.node);
    const writeAssignments = sess(writeTargets)
      .parents()
      .filter((node) => node.type === "AssignmentExpression");

    const sameTypeExprs = writeAssignments.nodes.every(
      (write) =>
        write.expression.type === writeAssignments.nodes[0].expression.type
    );

    if (sameTypeExprs && writeAssignments.nodes.length > 0) {
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

        const stmtIdxes = writeStmts.nodes.map((stmt) =>
          allStatements.indexOf(stmt)
        );

        const biggestIdx = Math.max(...stmtIdxes);

        const finalStatement = allStatements[biggestIdx];
        is(finalStatement, "ExpressionStatement");
        const { expression } = finalStatement;
        is(expression, "AssignmentExpression");
        const finalVal = expression.expression;
        if (
          finalVal.type === "LiteralStringExpression" ||
          finalVal.type === "LiteralNumericExpression"
        ) {
          decl.init = finalVal;
          const ogDeclaration = sess(decl).parents().get(0);
          is(ogDeclaration, "VariableDeclaration");
          ogDeclaration.kind = "const";

          writeStmts.delete();
        }
      }
    }
  });
};
