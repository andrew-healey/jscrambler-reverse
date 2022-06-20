import * as Shift from "shift-ast";

export const demo=`
(function(){
	// Whole script goes here...
})()
`

export default (sess)=>{
	const script=sess("Script").get(0);
	const {statements}=script;
	if(statements.length==1){
		const [statement]=statements;
		if(statement.type==="ExpressionStatement"){
			const {expression}=statement;
			if(expression.type==="CallExpression"&&expression.arguments.length==0){
				const {callee}=expression;
				if(callee.type==="FunctionExpression"&&callee.params.items.length==0){
					const {body}=callee;
					script.statements=body.statements;

					// This could create a problem with returns.
					const returnStmt=sess(":matches(Script > ForStatement > BlockStatement > Block > SwitchStatement > SwitchCase > ReturnStatement, Script > ReturnStatement)");
					returnStmt.replace(stmt=>{
						const {expression}=stmt;
						const val=expression===null?new Shift.LiteralNullExpression({}):expression;
						return new Shift.ExpressionStatement({
							expression:val
						});
					})
				}
			}
		}
	}
}