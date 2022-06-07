import assert from 'node:assert';
import { is } from '../assert-utils.js';
import { codeGen } from 'shift-codegen';
import { refactor } from 'shift-refactor';
import { writeFileSync } from 'node:fs';
import Shift from 'shift-ast';
import Scarbon from 'scarbon';

const countParents = ({ id }, cases) => {
  return cases.filter((aCase) => aCase.children.includes(id)).length;
};

const deleteNodes = (cases, idsToKill) => {
  idsToKill.forEach((id) => {
    const idxToKill = cases.findIndex((node) => node.id == id);
    if (idxToKill !== -1) {
      cases.splice(idxToKill, 1);
    }
  });
  return idsToKill;
};

const replaceChildren = (cases, idToKill, newId) => {
  const newEdgeLog = [];
  for (let aCase of cases) {
    const childIdx = aCase.children.indexOf(idToKill);
    if (childIdx != -1) {
      cases.children[childIdx] = newId;
      newEdgeLog.push([aCase.id, newId]);
    }
  }
  return newEdgeLog;
};

const getCase = (id, cases) => cases.find((aCase) => aCase.id === id);

const checkCase = (aCase, endVal) => {
  assert.notEqual(aCase.id, undefined);
  assert(aCase.children.length < 3);
  assert.equal(
    !!aCase.conditional,
    aCase.children.length == 2,
    "Unconditional nodes can't point to two children." +
      aCase.conditional +
      aCase.children.length,
  );
};

const renderer = await new Scarbon({
  lang: 'js',
});
const scarbon = (code) => {
  const svg = renderer.svg(code);
  const dataUrl = `data:image/svg+xml;utf8,${svg.replace(/$\s/gm, ' ')}`;
  return svg;
};

console.log(
  scarbon(`
console.log(a+2*3);
`),
);

const stringify = (statements) => {
  const newBlock = new Shift.Block({
    statements,
  });
  const sess = refactor(newBlock);
  return sess.codegen()[0];
  //return codeGen(newBlock);
};

/**
 * makeCase
 * Converts a Shift node of a case into my own Case type.
 * Return type: Case
 **/
const makeCase = (shiftCase, stateName) => {
  const { test, consequent } = shiftCase;

  is(test, 'LiteralNumericExpression');

  const id = test.value;

  assert.notEqual(consequent.length, 0);

  is(consequent[consequent.length - 1], 'BreakStatement');

  const statements = consequent.slice(0, consequent.length - 1);

  assert.notEqual(statements.length, 0);

  const lastStatement = statements[statements.length - 1];
  if (lastStatement.type === 'ReturnStatement') {
    return {
      id,
      statements,
      children: [],
      conditional: undefined,
    };
  }
  if (lastStatement.type === 'ReturnStatement') {
    console.log(statements.map((st) => st.type));
  }

  is(lastStatement, 'ExpressionStatement');
  const assignExp = lastStatement.expression;
  is(assignExp, 'AssignmentExpression');

  const { binding, expression } = assignExp;

  is(binding, 'AssignmentTargetIdentifier');
  assert.equal(binding.name, stateName);

  const prevStatements = statements.slice(statements.length - 1);

  if (expression.type === 'LiteralNumericExpression') {
    // Simple linear step.
    return {
      id,
      statements: prevStatements,
      children: [expression.value],
      conditional: undefined,
    };
  }

  if (expression.type === 'ConditionalExpression') {
    const conditional = expression.test;

    const { consequent, alternate } = expression;
    is(consequent, 'LiteralNumericExpression');
    is(alternate, 'LiteralNumericExpression');

    return {
      id,
      statements: prevStatements,
      children: [consequent.value, alternate.value],
      conditional,
    };
  }

  assert.fail("Case doesn't match any known pattern.");
};

/*
 * type Reduction {
 *   nodesDeleted:number[]
 *   edgesAdded:[number,number][]
 *   editedNodes:number[]
 * }
 */

/**
 * reduceCases
 * Iterates through all cases in the object. If it finds a pair of nodes it can reduce, it reduces them and returns info about the reduction. Otherwise, returns undefined.
 * Return type: Reduction?
 **/
const reduceCases = (cases, stateName, startVal) => {
  for (let aCase of cases) {
    checkCase(aCase);
  }

  for (let caseNum in cases) {
    const aCase = cases[caseNum];

    // Check for floating cases.
    if (startVal !== aCase.id && countParents(aCase, cases) == 0) {
      cases.splice(caseNum, 1);
      return {
        nodesDeleted: [aCase.id],
        edgesAdded: [],
        editedNodes: [],
      };
    }

    // Check for linearness.
    if (aCase.children.length == 1) {
      const child = getCase(aCase.children[0], cases);
      if (child !== aCase && countParents(child, cases) == 1) {
        aCase.statements = [...aCase.statements, ...child.statements];
        aCase.condition = child.condition;
        aCase.children = child.children;
        const nodesDeleted = deleteNodes(cases, [child.id]);
        const newEdges = replaceChildren(cases, child.id, aCase.id);

        return {
          nodesDeleted,
          edgesAdded: newEdges,
          editedNodes: [aCase],
        };
      }
    }

    if (aCase.children.length == 2) {
      const cons = getCase(aCase.children[0], cases);
      const alt = getCase(aCase.children[1], cases);
      console.log('Found two children. IDS are', cons.id, alt.id);

      const isSimpleLeaf = (node) =>
        countParents(node, cases) == 1 && node.children.length == 0;

      if (isSimpleLeaf(cons) && isSimpleLeaf(alt)) {
        const makeBlock = (node) =>
          new Shift.BlockStatement({
            block: new Shift.Block({
              statements: node.statements,
            }),
          });
        const finalIf = new Shift.IfStatement({
          test: aCase.conditional,
          consequent: makeBlock(cons),
          alternate: makeBlock(alt),
        });
        const nodesDeleted = deleteNodes(cases, [cons.id, alt.id]);
        aCase.statements = [...aCase.statements, finalIf];
        aCase.children = [];
        aCase.conditional = undefined;

        return {
          nodesDeleted,
          edgesAdded: [],
          editedNodes: [aCase],
        };
      }
    }
  }

  // By default, return nothing.
};

const deepenFlow = (sess) => {
  const switcher = sess(
    `VariableDeclarationStatement:first-child + ForStatement > BlockStatement > Block > SwitchStatement`,
  ).get(0);
  is(switcher, 'SwitchStatement');

  if (!switcher) return false;

  const forLoop = sess(switcher).parents().parents().parents().get(0);
  is(forLoop, 'ForStatement');

  const containingBlock = sess(forLoop).parents().get(0); // Block-like object.
  assert(
    containingBlock.statements,
    'Containing block has no statements. Not blocky. Type: ' +
      containingBlock?.type,
  );

  const stateDeclSt = sess(containingBlock).statements().get(0);
  is(stateDeclSt, 'VariableDeclarationStatement');

  const decl = stateDeclSt.declaration;
  assert.equal(decl.declarators.length, 1);

  const stateVar = decl.declarators[0];

  const { binding, init } = stateVar;

  assert(binding);
  assert(init);

  const stateName = binding.name;
  const startVal = init.value;

  assert(stateName);
  assert(startVal);

  const { test } = forLoop;

  is(test, 'BinaryExpression');

  const { left, right } = test;

  is(left, 'IdentifierExpression');
  assert.equal(left.name, stateName);

  is(right, 'LiteralNumericExpression');

  const endVal = right.value;

  const { discriminant, cases } = switcher;
  is(discriminant, 'IdentifierExpression');
  assert.equal(discriminant.name, stateName);

  /*
   * type Case {
   *   id:number;
   *   statements:Shift.____Statement[];
   *   conditional:Shift.____Expression;
   *   children:number[];
   * }
   */

  const builtInCase = {
    id: endVal,
    statements: [],
    children: [],
  };

  const foundCases = cases.map((foundCase) =>
    makeCase(foundCase, stateName, startVal),
  );

  const allCases = [...foundCases, builtInCase];

  // For logging purposes
  const bareCases = allCases
    .map((aCase) => ({
      id: aCase.id,
      code: stringify(aCase.statements),
    }))
    .map((aCase) => {
      const { code } = aCase;
      return {
        ...aCase,
        svg: scarbon(code),
      };
    });
  const bareEdges = allCases.flatMap(({ id, children }) =>
    children.map((child) => [id, child]),
  );
  const allReplacements = [];

  // Save record of modifications to a JSON file.
  const save = () => {
    const saveObj = {
      cases: bareCases,
      edges: bareEdges,
      steps: allReplacements,
    };

    const serialized = JSON.stringify(saveObj, null, 2);

    writeFileSync('graph.json', serialized);
  };

  save();

  while (true) {
    const replacement = reduceCases(allCases, stateName, startVal);

    if (!replacement) {
      break;
    }

    const newEdits = replacement.editedNodes.map((node) => {
      const code = stringify(node.statements);
      const svg = scarbon(code);

      return {
        id: node.id,
        code,
        svg,
      };
    });

    const newReplacement = {
      nodesDeleted: replacement.nodesDeleted,
      edgesAdded: replacement.edgesAdded,
      editedNodes: newEdits,
    };

    allReplacements.push(newReplacement);

    save();
  }

  assert.equal(allCases.length, 1, "The graph didn't fully reduce.");
  assert.fail('Demo fail.');

  const [finalCase] = allCases;
  assert.equal(finalCase.children.length, 0);

  containingBlock.statements = [
    ...finalCase.statements,
    ...containingBlock.statements.slice(2),
  ]; // Remove the variable declaration and switch statement.

  sess(forLoop).delete();
  sess(stateDeclSt).delete();

  return true;
};

export default (sess) => {
  // Cleanup.
  const { session } = sess;

  while (true) {
    const deepenedFlow = deepenFlow(sess);

    if (!deepenedFlow) {
      break;
    }
    //sess.isDirty(true);
  }

  //session.globalState.conditionalCleanup();
};
