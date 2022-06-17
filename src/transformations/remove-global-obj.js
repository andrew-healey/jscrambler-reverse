import assert from "node:assert";

export const demo=`
q9FmM.F9cTsN = F9cTsN;
H9ldg3(q9FmM[244428]);
q9FmM[643565] = function () {
	// ...
}
(function(){
	q9FmN;
	// Real code here.
})();
`

export default (sess) => {
	const globals=sess("Script > FunctionDeclaration[body.statements.length=0]").lookupVariable();
	globals.forEach(global=>{
		const {references}=global;
		const statementRefs = references.filter(ref=>{
			const {node}=ref;
			const parent=sess(node).parents().get(0)
			return parent.type==="ExpressionStatement";
		});
		const sessRefs=sess(
			statementRefs.map(ref=>ref.node)
		)
		sessRefs.parents().delete();
	})
	
	const nonIife=sess("Script > :not(ExpressionStatement[expression.type=CallExpression][expression.arguments.length=0][expression.callee.type=FunctionExpression][expression.callee.params.items.length=0])");
	nonIife.delete();

	const iifes=sess("Script > ExpressionStatement > CallExpression > FunctionExpression");
	assert.equal(iifes.nodes.length,1);
	const iife=iifes.get(0);

	const script=sess("Script").get(0);
	script.statements=iife.body.statements;
	
	sess(iife).delete();
}