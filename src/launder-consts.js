import * as Shift from "shift-ast";

export const demo = `
if (this[$_EFCX(0)] == this[$_EFDp(78)]) const r = n[$_EFDp(53)];
`;

export default (sess)=>{
	const constIfStatements = sess(`IfStatement > VariableDeclarationStatement[declaration.kind=const]`);

	constIfStatements.replace(declStatement=>{
		return new Shift.BlockStatement({
			block:new Shift.Block({
				statements:[declStatement]
			})
		})
	})
}