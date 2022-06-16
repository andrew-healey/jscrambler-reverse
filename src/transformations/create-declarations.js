import { is } from "../assert-utils.js";
import * as Shift from "shift-ast";

export const demo = `
a={};
a.prop = 12;

m="";
m="hey";
`;

export default (sess) => {
  const assignments = sess(
    "ExpressionStatement > AssignmentExpression[binding.type=AssignmentTargetIdentifier]"
  );
  const variables = assignments.lookupVariable();
  const doneVariables = new Set();
  variables.forEach((variable) => {
    if (!doneVariables.has(variable)) {
      doneVariables.add(variable);
    } else {
      return; // Skip variables that I've already done.
    }
    const { declarations, references, name } = variable;
    if (declarations.length > 0) return;

    // Now, check if there's a "first" reference.

    const writeInfo = (() => {
      const writingRefs = references.filter(
        ({ accessibility }) => accessibility.isWrite
      );

      const allNodes = sess(writingRefs.map((ref) => ref.node));
      const statements = allNodes.parents().parents();
      const blocks = statements.parents();

      const blocksDoExist = blocks.nodes.length > 0;

      if (allNodes.nodes.length == 1 && blocksDoExist) {
        return {
          kind: "const",
          node: allNodes.get(0),
        };
      }

      if (writingRefs.length > 1) {
        const allBlocksEqual = blocks.nodes.every(
          (block) =>
            block === blocks.nodes[0] &&
            block.type !== "VariableDeclarationStatement"
        );

        if (allBlocksEqual && blocksDoExist) {
					const firstBlock = blocks.get(0);
					const allStatements = firstBlock.type==="SwitchCase"?firstBlock.consequent:sess(firstBlock).statements().nodes;
          const idxes = statements.map((statement) =>
            allStatements.indexOf(statement)
          );

          const minIdx = Math.min(...idxes);
          const firstAssignment = allStatements[minIdx];
					if(minIdx==-1){
						console.log(allStatements,blocks.nodes,statements)
					}
          is(firstAssignment, "ExpressionStatement");
          const { expression } = firstAssignment;
          is(expression, "AssignmentExpression");

          return {
            kind: "var",
            node: expression.binding,
          };
        }
      }
    })();

    // If there *is* a first, replace it with a proper declaration.
    if (writeInfo) {
      const { kind, node } = writeInfo;

      const $firstWrite = sess(node);
      const $assignment = $firstWrite.parents();
      is($assignment.get(0), "AssignmentExpression");
      const { binding, expression: init } = $assignment.get(0);
      const $statement = $assignment.parents();
			const statement=$statement.get(0);
			is(statement,"ExpressionStatement");
      $statement.replace(
        () =>
          new Shift.VariableDeclarationStatement({
            declaration: new Shift.VariableDeclaration({
              kind,
              declarators: [
                new Shift.VariableDeclarator({
                  binding,
                  init,
                }),
              ],
            }),
          })
      );
    }
  });
};
