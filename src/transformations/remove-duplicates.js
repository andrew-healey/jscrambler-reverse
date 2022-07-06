import { AssignmentTargetIdentifier } from "shift-ast";
import { isShiftNode } from "shift-refactor";
import { is } from "../assert-utils.js";
import assert from "node:assert";
import * as Shift from "shift-ast";
import {refactor} from "shift-refactor"

export const demo = `
  const m0_7 = {Q2nRNh1: function () {
		// ...
  }};

	q9FmM.k0 = function () {
		return typeof q9FmM[633873].Q2nRNh1 === "function" ? q9FmM[633873].Q2nRNh1.apply(q9FmM[633873], arguments) : q9FmM[633873].Q2nRNh1;
	};

	Q7.k0();
`;

export default (session) => {
	const utilFunc=`
		_call=(func)=>typeof func==="function"?func:()=>func;
	`;
  const alternateDefs = session(
    `AssignmentExpression[binding.type=StaticMemberAssignmentTarget] > FunctionExpression[params.items.length=0] > FunctionBody > ReturnStatement > ConditionalExpression[consequent][alternate][test.operator="==="][test.left.operator="typeof"]`
  );

  alternateDefs.forEach((ifSt) => {
    is(ifSt, "ConditionalExpression");
    const { test } = ifSt;
    is(test, "BinaryExpression");
    const { left } = test;
    is(left, "UnaryExpression");
    const { operand } = left;

    const $ifSt = session(ifSt);
    const $func = $ifSt.parents().parents().parents();
    const func = $func.get(0);
    is(func, "FunctionExpression");

    const $assign = $func.parents();
    const assign = $assign.get(0);
    is(assign, "AssignmentExpression");

    const { binding } = assign;
    is(binding, "StaticMemberAssignmentTarget");

    const { property } = binding;

		console.log("Replacing duplicates of", property);

    const allCalls = session(
      `CallExpression[callee.type=StaticMemberExpression][callee.property=${JSON.stringify(
        property
      )}]`
    );
    const allCalledMembers = session(allCalls.map((call) => call.callee));

		const newCallee = operand;
		/*
		const newCallee = new Shift.CallExpression({
			callee:new Shift.IdentifierExpression({
				name:"_call"
			}),
			arguments:[
				operand
			]
		});
		*/

    allCalledMembers.replace(() => newCallee);

		// Now, delete the defunct duplicate.
		$assign.parents().delete();
  });

	const out=`
	${utilFunc};
	${session.print()};
	`;

	return refactor(out);
};