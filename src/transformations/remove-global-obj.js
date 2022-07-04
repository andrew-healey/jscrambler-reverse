import assert from "node:assert";
import { is } from "../assert-utils.js";
import { refactor } from "shift-refactor";

export const demo = `
q9FmM.F9cTsN = F9cTsN;
H9ldg3(q9FmM[244428]);
q9FmM[643565] = function () {
	// ...
}
(function(){
	q9FmN;
	// Real code here.
})();
`;

export default (sess) => {
	const getCalledFunctions = ()=>{
		const allDecls=sess("Script > FunctionDeclaration");
		const funcs=allDecls.lookupVariable();
		return funcs.filter(func=>{
			const {declarations,references,name}=func;
			const reads=references.filter(ref=>!ref.accessibility.isWrite);
			return reads.length>0;
		});
	}

	const funcsBefore=getCalledFunctions();

  const globalIife = sess(
    `AssignmentExpression:matches([binding.type=ComputedMemberAssignmentTarget], [binding.type=StaticMemberAssignmentTarget]) > CallExpression[arguments.length=0] > FunctionExpression[params.items.length=0]`
  ).first();

	assert.equal(globalIife.nodes.length, 1);
  const globalAssign = globalIife.parents().parents().get(0);
  is(globalAssign, "AssignmentExpression");

  const { binding } = globalAssign;
	assert(binding.type === "ComputedMemberAssignmentTarget" || binding.type === "StaticMemberAssignmentTarget");
  const { object } = binding;
  if (object.type !== "IdentifierExpression") return;
  const global = sess(object).lookupVariable()[0];

  const { references } = global;
	// i.e. globalVar;
  const statementRefs = references.filter((ref) => {
    const { node } = ref;
    const parent = sess(node).parents().get(0);
    return parent.type === "ExpressionStatement";
  });
  const sessRefs = sess(statementRefs.map((ref) => ref.node));
  sessRefs.parents().delete();

	const taintedStatements = sess("Script > *").filter(node=>{
		const $node=sess(node);
		const globalRefs=$node(`IdentifierExpression[name=${JSON.stringify(global.name)}]`);
		return globalRefs.nodes.length>0;
	});

	taintedStatements.delete();

	sess=refactor(sess.print());

	const funcsAfter=getCalledFunctions();

	const afterNames=funcsAfter.map(func=>func.name);

	const deletedFuncs=funcsBefore.filter(func=>!afterNames.includes(func.name));
	console.log("deletedFuncs",deletedFuncs.map(func=>func.name));

	// Now, delete all those funcs which are no longer used.
	deletedFuncs.forEach(func=>{
		const {name}=func;
		const funcDecl=sess(`FunctionDeclaration > BindingIdentifier[name=${JSON.stringify(name)}]`).first().parents();
		funcDecl.delete();
	});

	return sess

};
