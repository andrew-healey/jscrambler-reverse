import assert from "node:assert";
import { is } from "../assert-utils.js";
import { deepenFlow } from "./control-flow.js";
import * as Shift from "shift-ast";
import {refactor} from "shift-refactor";
import {commonMethods} from "refactor-plugin-common"

export const demo = `
  const I5 = {L_zBkB0: function (Y6) {
    const F2 = function (V0) {
      const v8 = [];
      var r6 = 0;
      while (r6 < V0.length) {
        v8.O9Y46j(t_LLgd.m2y_So(V0[r6] + 75));
        r6++;
      }
      var f5, z2;
      do {
        f5 = v8.K5Qk_s(function () {
          ("Unpacked from graph");
          return .5 - K_0X3E.t6owL1();
        }).y0u7Hh("");
        z2 = q9FmM[f5];
      } while (!z2);
      return z2;
    };
    var P6 = "", H0 = z7ZyVR(F2([9, -5, 40, 24, -18, 3])());
    while (0 < H0.length) {
      if (0 === Y6.length) {}
      P6 += t_LLgd.m2y_So(H0.l$EpJt(0) ^ Y6.l$EpJt(0));
      y8++, Y0++;
    }
    P6 = P6.z$pNz9("\`");
    var G8 = 0;
    const i7 = function (u6) {
      var R1 = 2;
      for (; R1 !== 17;) {
        switch (R1) {
          case 20:
            P6.l8Ms_3.o3QaKx(P6, P6.N0jkgX(-4, 4).N0jkgX(0, 2));
            R1 = 5;
            break;
          case 7:
            R1 = G8 === 3 && u6 === 98 ? 6 : 14;
            break;
          case 4:
            R1 = G8 === 1 && u6 === 121 ? 3 : 9;
            break;
          case 10:
            R1 = G8 === 6 && u6 === 11 ? 20 : 19;
            break;
          case 14:
            R1 = G8 === 4 && u6 === 133 ? 13 : 12;
            break;
          case 6:
            P6.l8Ms_3.o3QaKx(P6, P6.N0jkgX(-8, 8).N0jkgX(0, 6));
            R1 = 5;
            break;
          case 5:
            return G8++;
            break;
          case 18:
            return H6(u6);
            break;
          case 13:
            P6.l8Ms_3.o3QaKx(P6, P6.N0jkgX(-8, 8).N0jkgX(0, 7));
            R1 = 5;
            break;
          case 19:
            I5.L_zBkB0 = H6;
            R1 = 18;
            break;
          case 1:
            P6.l8Ms_3.o3QaKx(P6, P6.N0jkgX(-7, 7).N0jkgX(0, 6));
            R1 = 5;
            break;
          case 3:
            P6.l8Ms_3.o3QaKx(P6, P6.N0jkgX(-5, 5).N0jkgX(0, 4));
            R1 = 5;
            break;
          case 9:
            R1 = G8 === 2 && u6 === 42 ? 8 : 7;
            break;
          case 11:
            P6.l8Ms_3.o3QaKx(P6, P6.N0jkgX(-7, 7).N0jkgX(0, 5));
            R1 = 5;
            break;
          case 2:
            R1 = G8 === 0 && u6 === 16 ? 1 : 4;
            break;
          case 8:
            P6.l8Ms_3.o3QaKx(P6, P6.N0jkgX(-3, 3).N0jkgX(0, 1));
            R1 = 5;
            break;
          case 12:
            R1 = G8 === 5 && u6 === 155 ? 11 : 10;
            break;
        }
      }
    };
    const H6 = function (K9) {
      return P6[K9];
    };
    return i7;
  }("KW(0NA")};

  G2ioL_ = q9FmM[643565].L_zBkB0(11) === 51 ? 14 : 13;

  window[q9FmM[643565].L_zBkB0(7)] = undefined;
`;

export default (sess) => {
  const oneParamBuiltins = sess(
    `:matches(VariableDeclaration[kind=const][declarators.length=1] > VariableDeclarator, ReturnStatement) > ObjectExpression[properties.length=1] > DataProperty[name.type=StaticPropertyName] > CallExpression[arguments.length=1][arguments.0.type=LiteralStringExpression] > FunctionExpression[params.items.length=1]`
  );
  oneParamBuiltins.forEach((builtin) => {
		console.log("Found one!")
    const parent = sess(builtin).parents().get(0);

    const dataProp = sess(builtin).parents().parents().get(0);
    const propName = dataProp.name.value;

    const args = parent.arguments;
    assert.equal(args.length, 1);

    const [shiftStr] = args;
    is(shiftStr, "LiteralStringExpression");
    const key = shiftStr.value;
    const arrString =
      sess(
        `FunctionDeclaration > FunctionBody > ReturnStatement:first-child > LiteralStringExpression`
      ).get(0) ??
      sess(
        `CallExpression[callee.type=IdentifierExpression][callee.name=decodeURI][arguments.length=1][arguments.0.type=LiteralStringExpression] > LiteralStringExpression`
      ).get(0);
    assert(arrString);
    is(arrString, "LiteralStringExpression");
    const rawArr = arrString.value;
		console.log("rawArr",rawArr.slice(0,100))

    const delimeter = sess(builtin)(
      `CallExpression[callee.type=StaticMemberExpression][arguments.length=1] > LiteralStringExpression[value.length=1]`
    ).get(0);
    assert(delimeter);
    is(delimeter, "LiteralStringExpression");
    const delim = delimeter.value;

    const dec = decodeURI(rawArr);
    let ret = "";
    for (let i = 0; i < dec.length; i++)
      ret += String.fromCharCode(
        dec.charCodeAt(i) ^ key.charCodeAt(i % key.length)
      );
    const arr = ret.split(delim);

    //console.log(arr);

    // Now, it's time to use the weird control-flow graph contents of the string arr function.

    const twoNumCall = `CallExpression[arguments.length=2]:matches([arguments.0.type=LiteralNumericExpression], [arguments.0.type=UnaryExpression])[arguments.1.type=LiteralNumericExpression]`;

    const allSplits = sess(builtin)(
      `ExpressionStatement > CallExpression > ${twoNumCall}`
    );

    const modInfo = allSplits
      .map((numCall) => {
        is(numCall, "CallExpression");

        const numCalls = sess(numCall)(twoNumCall);
        if (numCalls.nodes.length !== 2) return;

        const numParams = numCalls.map((call) =>
          call.arguments.map((arg) => arg.value ?? -arg.operand.value)
        );

        const endSlice = numParams.find(
          (numSet) => numSet[0] === -numSet[1]
        )[1];
        const slicedSubset = numParams.find((numSet) => numSet[0] === 0)[1];

        const ifStmt = sess(numCall)
          .parents()
          .parents()
          .parents()
          .parents()
          .parents()
          .get(0);
        is(ifStmt, "IfStatement");

        const { test } = ifStmt;
        is(test, "BinaryExpression");
        assert.equal(test.operator, "&&");
        const { left, right } = test;
        // Find which side--left or right--corresponds to run #.

        const runTest = [left, right].find((test) => {
          is(test, "BinaryExpression");
          assert.equal(test.operator, "===");

          const ident = test.left;
          const variable = sess(ident).lookupVariable()[0];

          const { declarations } = variable;
          assert.equal(declarations.length, 1);
          const [decl] = declarations;
          const declParent = sess(decl.node).parents().get(0);
          return declParent.type === "VariableDeclarator";
        });

        const testTarget = runTest.right;
        is(testTarget, "LiteralNumericExpression");
        const runNum = testTarget.value;

        return {
          runNum,
          endSlice,
          slicedSubset,
        };
      })
      .filter((el) => el);

    /*
    const deepFlow = deepenFlow(sess(builtin), undefined, undefined, true);
    assert(deepFlow);
    const { cases, startVal } = deepFlow; // Telling deepenFlow to *only* return the cases.

    const getCase = (id) => cases.find((aCase) => aCase.id === id);
    const getParents = (id) =>
      cases.filter((aCase) => aCase.children.includes(id));

    const startCase = getCase(startVal);

    assert.equal(startCase.children.length, 2);
    const cons = getCase(startCase.children[0]);
    assert.equal(cons.children.length, 1);
    const [hubId] = cons.children;
    const hub = getCase(hubId);

    assert.equal(hub.children.length, 0);
    assert.equal(hub.statements.length, 1);
    assert.equal(hub.statements[0].type, "ReturnStatement");

    const hubParents = getParents(hubId);

    const modInfo = hubParents.map((hubP) => {
      const myParents = getParents(hubP.id);
      assert.equal(myParents.length, 1);
      const [decision] = myParents;

      // Now, two parts. 1: find the run # when this action happens. 2: the action goes "slice n items off the end. take m of those, put them on the front." Find that m,n.
      const { conditional } = decision;
      is(conditional, "BinaryExpression");
      assert.equal(conditional.operator, "&&");
      const { left, right } = conditional;
      // Find which side--left or right--corresponds to run #.

      const runTest = [left, right].find((test) => {
        is(test, "BinaryExpression");
        assert.equal(test.operator, "===");

        const ident = test.left;
        const variable = sess(ident).lookupVariable()[0];

        const { declarations } = variable;
        assert.equal(declarations.length, 1);
        const [decl] = declarations;
        const declParent = sess(decl.node).parents().get(0);
        return declParent.type === "VariableDeclarator";
      });

      const testTarget = runTest.right;
      is(testTarget, "LiteralNumericExpression");
      const runNum = testTarget.value;

      // Part 2.
      // For reference:
      // P6.l8Ms_3.o3QaKx(P6, P6.N0jkgX(-4, 4).N0jkgX(0, 2));

      const numCalls = sess(hubP.statements[0])(
        `CallExpression[arguments.length=2]:matches([arguments.0.type=LiteralNumericExpression], [arguments.0.type=UnaryExpression])[arguments.1.type=LiteralNumericExpression]`
      );

      const numParams = numCalls.map((call) =>
        call.arguments.map((arg) => arg.value??-arg.operand.value)
      );

      const endSlice = numParams.find((numSet) => numSet[0] === -numSet[1])[1];
      const slicedSubset = numParams.find((numSet) => numSet[0] === 0)[1];

      return {
        runNum,
        endSlice,
        slicedSubset,
      };
    });
		*/

    const sortedOps = modInfo.sort((a, b) => a.runNum - b.runNum);

    let tempArr = arr;
    for (let op of sortedOps) {
      tempArr = [
        ...tempArr.slice(-op.endSlice).slice(0, op.slicedSubset),
        ...tempArr.slice(0, -op.endSlice),
      ];
    }

		// i.e. get all *string-valued* calls. The first few will be number-valued.
    const allCalls = sess(
      `:not(ConditionalExpression[consequent.type=LiteralNumericExpression][alternate.type=LiteralNumericExpression] > BinaryExpression) > CallExpression[callee.property=${JSON.stringify(
        propName
      )}][arguments.length=1][arguments.0.type=LiteralNumericExpression]`
    );
		console.log("How many calls?", allCalls.nodes.length);

    allCalls.replace((oneCall) => {
      const args = oneCall.arguments;
      const [shiftNum] = args;
      const arrIdx = shiftNum.value;

      const strVal = tempArr[arrIdx % tempArr.length];

      return new Shift.LiteralStringExpression({
        value: strVal,
      });
    });

    // TODO For the first few calls, this should *not* return a string. It should return the index of the current run.
  });

	const newSess=refactor(sess.print(),commonMethods);
	newSess.convertComputedToStatic();
	return newSess;
};
