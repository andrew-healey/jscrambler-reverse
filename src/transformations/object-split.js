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

  allObjVars.nodes.reverse().forEach((objVar) => {
    const variable = sess(objVar).lookupVariable()[0];
    const { declarations, references } = variable;

    const writers = references.filter((ref) => ref.accessibility.isWrite);

    if (declarations.length === 1 && writers.length === 1) {
      const nodes = sess(references.map((ref) => ref.node));

      const memberTargets = nodes
        .map((node) => {
          const propChain = [];
          let $node = sess(node).parents();
          while ($node.get(0).type.endsWith("MemberExpression")) {
            propChain.push($node.get(0));
            $node = $node.parents();
          }
          const finalNode = $node.get(0);
          if (finalNode.type.endsWith("MemberAssignmentTarget")) {
            const assignment = $node.parents().get(0);
            if (assignment.type === "AssignmentExpression") {
              const { binding, expression } = assignment;
              propChain.push(binding);
              return {
                props: propChain,
                value: expression,
                assignExp: assignment,
              };
            }
          }
          return undefined;
        })
        .filter((node) => node);

			const allAreStatic = memberTargets.every((target) => target.props.every(prop=>prop.type.startsWith("StaticMember")));

			if(!(allAreStatic && memberTargets.length>0)) {
				console.log("Not all static",variable.name);
				return;
			}

      const depthLast = memberTargets.sort(
        (a, b) => a.props.length - b.props.length
      );

      // Now, construct the objects.

      /*
			type Obj {
				deepList:{
					props:Shift.Node[],
					value:Shift.Node,
					assignExp:Shift.AssignmentExpression,
				}[],
				value?:Shift.Node,
			}
			*/
      // Note: An Obj can have either a value or children.

      let startObj = {
        deepList: depthLast,
        value: undefined,
      };

      const makeProp = (shiftNode) => {
        if (shiftNode.property) {
          return new Shift.StaticPropertyName({
            value: shiftNode.property,
          });
        }
        const { expression } = shiftNode;
        assert(expression);
        return new Shift.ComputedPropertyName({
          expression,
        });
      };

      const stringify = (node) => sess(node).print();

      const convertToShift = (uncertainObj) => {
        if (uncertainObj.value) return uncertainObj.value;
        const { deepList } = uncertainObj;
        const shallow = deepList.filter(({ props }) => props.length === 1);
        const realChildren = [];
        shallow.forEach((member) => {
          const { props, value, assignExp } = member;
          const [prop] = props;
          const isObj =
            value.type === "ObjectExpression" && value.properties.length === 0;
          const deeperList = deepList.filter(
            (otherProp) =>
              otherProp.props.length > 1 &&
              stringify(otherProp.props[0]) === stringify(prop)
          ); // i.e. if I'm defining the value of .a, then match all .a.b.c paths.
					deeperList.forEach(subObject=>subObject.props.shift()); // Remove redundant prop.
          const newObj = isObj
            ? {
                deepList: deeperList,
                value: undefined,
              }
            : {
                deepList: [],
                value,
              };
          realChildren.push([prop, newObj]);
        });

        const objProps = realChildren.map(([realProp, realChild]) => {
          const value = convertToShift(realChild);
          const prop = makeProp(realProp);
          return new Shift.DataProperty({
            name: prop,
            expression:value,
          });
        });

        return new Shift.ObjectExpression({
          properties: objProps,
        });
      };

			const newObj=convertToShift(startObj);

			/*
      const newObj = new Shift.ObjectExpression({
        properties: objectProps.map(
          ([property, expression]) =>
            new Shift.DataProperty({
              name: new Shift.StaticPropertyName({
                value: property,
              }),
              expression,
            })
        ),
      });
			*/

      const $objVar = sess(objVar); // BindingIdentifier
      const $declarator = $objVar.parents();
      const $objExpr = $declarator("ObjectExpression");
      $objExpr.replace(newObj);

			const myAssignExps=sess(memberTargets.map(({ assignExp })=>assignExp));
			const myStatements=myAssignExps.parents().filter(node=>node.type==="ExpressionStatement");
			myStatements.delete();

    }
  });
};
