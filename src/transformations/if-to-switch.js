import assert from "node:assert";
import * as Shift from "shift-ast";
import { is } from "../assert-utils.js";

export const demo=`
var G2ioL_ = 2;
while (G2ioL_ !== 13) {
  if (G2ioL_ === 3) {
    G2ioL_ = "BACKGROUND" === 63 ? 9 : 8;
  } else if (G2ioL_ === 1) {
    q9FmM.U3 = 14;
    G2ioL_ = 5;
  } else if (G2ioL_ === 9) {
    q9FmM.J6 = 78;
    G2ioL_ = 8;
  } else if (G2ioL_ === 4) {
    q9FmM.R3 = 16;
    G2ioL_ = 3;
  } else if (G2ioL_ === 2) {
    G2ioL_ = "x" >= 40 ? 1 : 5;
  } else if (G2ioL_ === 5) {
    G2ioL_ = "closePath" != "Lato" ? 4 : 3;
  } else if (G2ioL_ === 8) {
    G2ioL_ = "div" == "fillRect" ? 7 : 6;
  } else if (G2ioL_ === 14) {
    q9FmM.J1 = 32;
    G2ioL_ = 13;
  } else if (G2ioL_ === 6) {
    G2ioL_ = "marginTop" === 51 ? 14 : 13;
  } else if (G2ioL_ === 7) {
    q9FmM.v5 = 17;
    G2ioL_ = 6;
  }
}
`

export default (sess)=>{
	const getParentIf = sel=>sel.parents().parents().parents();
	const ifElses = getParentIf(sess(`IfStatement[test.type=BinaryExpression][test.operator="==="][test.left.type=IdentifierExpression] > BlockStatement > Block > IfStatement:first-child`));

	const topLevelIfElses = ifElses.filter(ifElse=>{
		const $ifElse = sess(ifElse);
		const possibleParent = getParentIf($ifElse).get(0);
		return !ifElses.nodes.includes(possibleParent); // i.e. a child If statement should be ignored.
	})

	topLevelIfElses.forEach(ifElse=>{
		is(ifElse,"IfStatement");
		// Look down the AST until I find the last matching if.

		const cases=[];

		let varName;

		let currIf = ifElse;

		while(currIf?.type==="IfStatement"){
			const {test}=currIf;
			if(!(test.type==="BinaryExpression" && test.operator==="===")) break;
			const {left,right}=test;

			if(!(left.type==="IdentifierExpression"&&(varName??(varName=left.name))===left.name)) break;

			if(right.type!=="LiteralNumericExpression") break;

			const {value}=right;
			const {consequent}=currIf;
			if(consequent.type!=="BlockStatement") break;
			const {block}=consequent;
			if(block.type!=="Block") break;
			const {statements}=block;

			cases.push([value,statements]);

			currIf=currIf.alternate?.block?.statements?.[0];
		}

		const switchStatement=new Shift.SwitchStatement({
			discriminant:new Shift.IdentifierExpression({name:varName}),
			cases: cases.map(([value,statements])=>new Shift.SwitchCase({
				test:new Shift.LiteralNumericExpression({value}),
				consequent:[
					...statements,
					new Shift.BreakStatement({})
				]
			}))
		});

		sess(ifElse).replace(()=>switchStatement);

	})

}
