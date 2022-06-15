// Tabling this for now. I have to do array de-obfuscation and object de-obfuscation first.

export default (session)=>{
	const alternateDefs=session(`
	AssignmentExpression[binding.type=StaticMemberAssignmentTarget] > FunctionExpression[params.items.length=0] > FunctionBody > IfStatement[consequent][alternate][test.operator="==="][test.left.operator="typeof"]
	`);
	

	return session;
};