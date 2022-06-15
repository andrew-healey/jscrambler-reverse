import { is } from "../assert-utils.js";
import * as Shift from "shift-ast";

export const demo = `
	var r6 = 0;
	while (r6 < V0.length) {
		v8.O9Y46j(t_LLgd.m2y_So(V0[r6] + 75));
		r6++;
	}
`;

export default (sess) => {
  const updateExprs = sess(
    `VariableDeclarationStatement + WhileStatement[test.type=BinaryExpression] > BlockStatement > Block > ExpressionStatement:last-child > UpdateExpression`
  );

  updateExprs.forEach((expr) => {
		const whileBody = sess(expr).parents().parents().parents();
		is(whileBody.get(0),"BlockStatement");
    const whileLoop = whileBody.parents();
    is(whileLoop.get(0), "WhileStatement");

    const blocks = whileLoop.parents();
    const firstBlock = blocks.get(0);
    const allStatements =
      firstBlock.type === "SwitchCase"
        ? firstBlock.consequent
        : sess(firstBlock).statements().nodes;
		
		const whileIdx=allStatements.indexOf(whileLoop.get(0));
		const varDeclSt = allStatements[whileIdx-1];
		is(varDeclSt,"VariableDeclarationStatement");

		// Get variable in declaration.
		const {declaration}=varDeclSt;
		is(declaration,"VariableDeclaration");
		const {declarators:[declarator]}=declaration;
		is(declarator,"VariableDeclarator");
		const variable = sess(declarator.binding).lookupVariable()[0];

		// Get variable in while loop test.

		const {test}=whileLoop.get(0);
		is(test,"BinaryExpression");
		const {left}=test;
		if(left.type==="IdentifierExpression"){
			const testVar = sess(left).lookupVariable()[0];
			
			// Get variable in update.
			is(expr,"UpdateExpression");
			const {operand} = expr;
			if(operand.type==="AssignmentTargetIdentifier"){
				const updateVar = sess(operand).lookupVariable()[0];

				if(updateVar===testVar && testVar===variable){
					// i.e. these three values match and we have a for loop to make.


					const keptStatements = whileBody.get(0).block.statements.slice(0,-1);

					const newBody = new Shift.BlockStatement({
						block:new Shift.Block({
							statements:keptStatements,
						})
					})

					const loop = new Shift.ForStatement({
						init:declaration,
						test,
						update:expr,
						body:newBody
					})

					console.log("Replaced",updateVar.name);
					whileLoop.replace(loop);
					sess(varDeclSt).delete();
				}
			}
		}
  });
};
