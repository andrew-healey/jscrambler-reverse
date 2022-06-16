import { is } from "../assert-utils.js";
import * as Shift from "shift-ast";

export const demo = `
q9FmM[393964] = function (i4, R8, T4) {
  return {A6pyK9q: function E0(x_, I2, n3) {
		// ...
  }(i4, R8, T4)};
}(35, 12, [35]);

  var f8 = q9FmM[393964].A6pyK9q()[23][32][28];
  for (; f8 !== q9FmM[393964].A6pyK9q()[10][24][23];) {
    switch (f8) {
      case q9FmM[393964].A6pyK9q()[3][29][20]:
        g1[q9FmM[643565].L_zBkB0(63)][q9FmM[643565].L_zBkB0(144)] = q9FmM[643565].L_zBkB0(107);
        f8 = q9FmM[393964].A6pyK9q()[20][8][8];
        break;
		}
	}
		`;

(sess)=>{
		if(allCalls.nodes.length===0) return;

    const propName = allCalls.get(0).callee.property;
    const $parents = allCalls.parents();
    if (
      $parents.nodes.every(
        (node) =>
          node.type === "ComputedMemberExpression" &&
          node.expression.type === "LiteralNumericExpression"
      )
    ) {
      // Assume this is used for array num obfuscation.
    }
  }

export default (sess) => {
  const propDefs = sess(`DataProperty[name.type=StaticPropertyName]`);
  const [goodDef] = propDefs.nodes.flatMap((propDef) => {
    // i.e. we have found an object property defining this function.

    // Now, we look for a list of props--one is an array, two are numbers.

    const hasRightArgs = (callExpr) => {
			is(callExpr,"CallExpression");
      const args = callExpr.arguments;
      if (args.length !== 3) return false;
      const numericArgs = args.filter(
        (arg) => arg.type === "LiteralNumericExpression"
      );
      if (numericArgs.length !== 2) return false;
      const argNumbers = numericArgs.map((arg) => arg.value);

      const arrayArgs = args.filter((arg) => arg.type === "ArrayExpression");
      if (arrayArgs.length !== 1) return false;
      const [arrayArg] = arrayArgs;
      if (arrayArg.elements.length !== 1) return false;
      const [element] = arrayArg.elements;
      if (element.type !== "LiteralNumericExpression") return false;
      const { value } = element;
      if (!argNumbers.includes(value)) return false;

      return {
        length: value,
        multiplier: argNumbers.find((arg) => arg !== value),
      };
    };

    let currParent = sess(propDef);

    const isParentGood = (parent) =>
      parent.type === "CallExpression" && hasRightArgs(parent);
    while (!isParentGood(currParent.get(0))) {
      currParent = currParent.parents();
			if(currParent.nodes.length==0) return [];
    }

    if (isParentGood(currParent.get(0))) {
      // i.e. we found a good set of params.
      const { length, multiplier } = hasRightArgs(currParent.get(0));
			return [{
				length,
				multiplier,
				propDef
			}];
    }

		return [];
  });

	if(goodDef){
		const { length, multiplier, propDef } = goodDef;
		is(propDef,"DataProperty");
		is(propDef.name,"StaticPropertyName");

		const propName = propDef.name.value;

		// Now, find all references and replace them with numbers.

		const allCalls = sess(`CallExpression[callee.property=${JSON.stringify(propName)}]`);
		allCalls.forEach(aCall=>{
			// Find the indexing. Replace it.
			const indexesTaken=[];
			let prevMember;
			let $aMember=sess(aCall).parents();
			while($aMember.get(0).type==="ComputedMemberExpression"){
				indexesTaken.push($aMember.get(0).expression.value);
				prevMember=$aMember.get(0);
				$aMember=$aMember.parents();
			}

			const calculatedIndex=indexesTaken.reduce((acc,curr)=>(acc*-multiplier+curr)%length,0);
			const positivedIndex=(calculatedIndex+length)%length; // Convert -12 to 23

			sess(prevMember).replace(()=>new Shift.LiteralNumericExpression({
				value:positivedIndex
			}));

		})
	}


  // Now, un-invalidate some things.
  sess(
	`ExpressionStatement > LiteralStringExpression[value=/Invalidated -- .*/]`
  )
    .parents()
    .delete();
};