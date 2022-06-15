import assert from "node:assert";
import { is } from "../assert-utils.js";
import * as Shift from "shift-ast";

export const demo = `
	q9FmM[633873] = function () {
		("Unpacked from graph");
		"Replaced variable m0";
		m0_5 = undefined;
		const m0_7 = {};
		m0_7.Q2nRNh1 = function () {
			// ...
		};
		return m0_7;
	}();
`;

export default (sess) => {
  const allObjVars = sess(
    `VariableDeclaration[kind=const] > VariableDeclarator[init.type=ObjectExpression][init.properties.length=0] > BindingIdentifier`
  );

	let assignStatements=[];

  allObjVars.forEach((objVar) => {
    const variable = sess(objVar).lookupVariable()[0];
    const { declarations, references } = variable;

    const writers = references.filter((ref) => ref.accessibility.isWrite);

    if (declarations.length === 1 && writers.length === 1) {
      const nodes = sess(references.map((ref) => ref.node));
      const parents = nodes.parents();

      const propSetters = parents.filter(
        (parent) => parent.type === "StaticMemberAssignmentTarget"
      );

      const assignExps = propSetters.parents();

      const objectProps = assignExps.map((exp) => {
        is(exp, "AssignmentExpression");
        const { binding, expression } = exp;
        is(binding, "StaticMemberAssignmentTarget");
        const { property } = binding;
        return [property, expression];
      });


      const newObj = new Shift.ObjectExpression({
        properties: objectProps.map(
          ([property, expression]) =>
            new Shift.DataProperty({
              name: new Shift.StaticPropertyName({
								value:property
							}),
              expression,
            })
        ),
      });
			assignStatements=[...assignStatements,...assignExps.parents().nodes];

			const $objVar = sess(objVar); // BindingIdentifier
			const $declarator = $objVar.parents();
			const $objExpr=$declarator("ObjectExpression");
			$objExpr.replace(newObj);
    }
  });
	sess(assignStatements).delete();
};
