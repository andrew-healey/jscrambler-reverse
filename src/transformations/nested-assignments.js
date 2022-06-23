import { is } from "../assert-utils.js";
import * as Shift from "shift-ast";

export const demo=`
Y9[Q$Q$_[643565].L_zBkB0(98)] = V = Util[Q$Q$_[643565].L_zBkB0(10)](r5[Q$Q$_[643565].L_zBkB0(98)], V)
`

const unNestAssignments=(sess)=>{
	let hasReplaced=false;
	const nestedStatements=sess("ExpressionStatement > AssignmentExpression > AssignmentExpression").parents().parents();
	nestedStatements.forEach(statement=>{
		is(statement,"ExpressionStatement");
		const assignOne=statement.expression;
		is(assignOne,"AssignmentExpression");
		const assignTwo=assignOne.expression;
		is(assignTwo,"AssignmentExpression");

		const bindingMap={
			"IdentifierExpression":"AssignmentTargetIdentifier",
			"ComputedMemberExpression":"ComputedMemberAssignmentTarget",
			"StaticMemberExpression":"StaticMemberAssignmentTarget",
		};

		const innerBinding=assignTwo.binding;
		const mappedType=bindingMap[innerBinding.type];
		if(mappedType){
			const newStatement=new Shift.ExpressionStatement({
				expression:assignTwo,
			});
			const newExpression=new Shift[mappedType](assignTwo.binding)
			newExpression.type=mappedType; // Just in case.
			assignOne.expression=newExpression;
			sess(statement).prepend(newStatement);
			hasReplaced=true;
		}

	})

	return hasReplaced;
}

export default (sess) => {
	while(unNestAssignments(sess)){}
}