import assert from "node:assert";
import { is } from "../assert-utils.js";
import { codeGen } from "shift-codegen";
import { refactor } from "shift-refactor";
import { writeFileSync } from "node:fs";
import Shift from "shift-ast";
import Scarbon from "scarbon";
import shiki from "shiki";
import rimraf from "rimraf";

const terminalWhitelist = ["ThrowStatement", "ReturnStatement"];
const isTerminal = (node) => {
  const lastStatement = node.statements[node.statements.length - 1];
  return terminalWhitelist.includes(lastStatement.type);
};

const parentsCache = new WeakMap();
const getParents = ({ id }, cases) => {
  /*
  if (!parentsCache.has(cases))
    parentsCache.set(
      cases,
      cases.reduce((parentMap, nextCase) => {
        for (let child of nextCase.children) {
          if (!(child in parentMap)) {
            parentMap[child] = [];
          }
          parentMap[child].push(nextCase);
        }
        return parentMap;
      }, {})
    );
  return parentsCache.get(cases)[id];
	*/
  return cases.filter((aCase) => aCase.children.includes(id));
};

const countParents = ({ id }, cases) => getParents({ id }, cases).length;

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
      aCase.children[childIdx] = newId;
      newEdgeLog.push([aCase.id, newId]);
    }
  }
  return newEdgeLog;
};

const makeBlock = (node) =>
  new Shift.BlockStatement({
    block: new Shift.Block({
      statements: node.statements,
    }),
  });

let casesCache = new WeakMap();
const getCase = (id, cases) => {
  if (!casesCache.has(cases))
    casesCache.set(
      cases,
      Object.fromEntries(cases.map((aCase) => [aCase.id, aCase]))
    );

  return casesCache.get(cases)[id];
};

const checkCase = (aCase, endVal) => {
  assert.notEqual(aCase.id, undefined);
  assert(aCase.children.length < 3);
  assert.equal(
    !!aCase.conditional,
    aCase.children.length == 2,
    "Unconditional nodes can't point to two children." +
      aCase.conditional +
      aCase.children.length
  );
};

const renderer = await new Scarbon({
  lang: "js",
});
const scarbon = (code) => {
  const modCode = code.replace(
    /"prettier-ignore";\s+break;/g,
    "// prettier-ignore"
  );
  const svg = renderer.svg(modCode);
  const dataUrl = `data:image/svg+xml;utf8,${svg.replace(/$\s/gm, " ")}`;
  return svg;
};

const shikiRenderer = await shiki.getHighlighter({
  theme: "nord",
});

const html = (code) => {
  const modCode = code.replace(/"prettier-ignore"/g, "// prettier-ignore");
  return shikiRenderer.codeToHtml(modCode, { lang: "js" });
};

const render = (code) => ({
  code,
  svg: scarbon(code),
  html: html(code),
});

const stringify = (statements) => {
  const newBlock = new Shift.Block({
    statements,
  });
  const sess = refactor(newBlock);
  return sess.codegen()[0];
  //return codeGen(newBlock);
};

const lookForLoop = (aCase, cases) => {
  assert.equal(aCase.children.length, 2);
  // Note: we're probably just assuming cons is the first. No flippy flippy stuff yet.

  const loopStart = aCase.id;
  const [firstChild, loopEnd] = aCase.children;

  let visitedNodes = new Set([loopStart, loopEnd]);
  let timesVisitingSelf = 0;
  let nodesVisitingEnd = [];

  let uncheckedNodes = [firstChild];

  while (uncheckedNodes.length) {
    const node = getCase(uncheckedNodes.pop(), cases);
    visitedNodes.add(node.id);
    const { children } = node;
    if (children.includes(loopEnd)) nodesVisitingEnd.push(node.id);
    if (children.includes(loopStart)) timesVisitingSelf++;
    const uncheckedChildren = children.filter(
      (childId) => !visitedNodes.has(childId)
    );
    uncheckedNodes = [...uncheckedNodes, ...uncheckedChildren];
  }

  const isLoop = timesVisitingSelf > 0;

  if (isLoop && nodesVisitingEnd.length > 0) {
    console.log("I found what looks like a broken loop. ID", loopStart);
    const breaks = nodesVisitingEnd;
    // Now, replace breaks with actual break nodes.

    const edgesDeleted = [];
    const edgesAdded = [];
    const nodesAdded = [];

    breaks.forEach((breakingNodeId) => {
      const breakingNode = getCase(breakingNodeId, cases);
      const newNode = {
        statements: [
          new Shift.ExpressionStatement({
            expression: new Shift.LiteralStringExpression({
              value: "prettier-ignore",
            }),
          }),
          new Shift.BreakStatement({}),
        ],
        children: [],
        conditional: undefined,
      };
      const maxNodeId = Math.max(...cases.map((aCase) => aCase.id));
      newNode.id = maxNodeId + 1;
      cases.push(newNode);
      casesCache.delete(cases);
      assert(getCase(newNode.id, cases) === newNode);
      nodesAdded.push(newNode);

      edgesAdded.push([newNode.id, loopStart]);

      breakingNode.children = breakingNode.children.map((childId) => {
        if (childId === loopEnd) {
          edgesDeleted.push([breakingNode.id, loopEnd]);
          edgesAdded.push([breakingNode.id, newNode.id]);

          return newNode.id;
        }
        return childId;
      });
    });

    return {
      nodesAdded,
      nodesDeleted: [],
      edgesAdded,
      edgesDeleted,
      editedNodes: [],
      type: "Loop Break",
    };
  }
};

/**
 * makeCase
 * Converts a Shift node of a case into my own Case type.
 * Return type: Case
 **/
const makeCase = (shiftCase, stateName, endVal) => {
  const { test, consequent } = shiftCase;

  is(test, "LiteralNumericExpression");

  const id = test.value;

  assert.notEqual(consequent.length, 0);

  is(consequent[consequent.length - 1], "BreakStatement");

  const statements = consequent.slice(0, consequent.length - 1);

  assert.notEqual(statements.length, 0);

  const lastStatement = statements[statements.length - 1];
  if (lastStatement.type === "ReturnStatement") {
    return {
      id,
      statements,
      children: [], // TODO: decide if I should include endVal or not.
      conditional: undefined,
    };
  }

  is(lastStatement, "ExpressionStatement");
  const assignExp = lastStatement.expression;
  is(assignExp, "AssignmentExpression");

  const { binding, expression } = assignExp;

  is(binding, "AssignmentTargetIdentifier");
  assert.equal(binding.name, stateName);

  const prevStatements = statements.slice(0, statements.length - 1);

  if (expression.type === "LiteralNumericExpression") {
    // Simple linear step.
    return {
      id,
      statements: prevStatements,
      children: [expression.value],
      conditional: undefined,
    };
  }

  if (expression.type === "ConditionalExpression") {
    const conditional = expression.test;

    const { consequent, alternate } = expression;
    is(consequent, "LiteralNumericExpression");
    is(alternate, "LiteralNumericExpression");

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
 * type Replacement {
 *   nodesDeleted:number[]
 *   nodesAdded?:number[]
 *   edgesAdded:[number,number][]
 *   edgesDeleted?: [number,number][]
 *   editedNodes:number[]
 * }
 */

const iterCases = function* (startVal, cases) {
  // Start at the first node. Look for all potential loops with DFS.

  const visitedNodes = new Set();

  let nodesToVisit = [startVal];

  while (nodesToVisit.length) {
    const node = getCase(nodesToVisit.pop(), cases);

    visitedNodes.add(node.id);

    yield node;

    const uncheckedChildren = node.children.filter(
      (childId) => !visitedNodes.has(childId)
    );

    nodesToVisit = [...nodesToVisit, ...uncheckedChildren];
  }
};

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
        type: "Dead Code",
      };
    }
  }

  for (let aCase of iterCases(startVal, cases)) {
    // Check for linearness.
    if (aCase.children.length == 1) {
      const child = getCase(aCase.children[0], cases);
      if (
        child !== aCase &&
        !child.children.includes(aCase.id) &&
        countParents(child, cases) == 1
      ) {
        aCase.statements = [...aCase.statements, ...child.statements];
        aCase.conditional = child.conditional;
        aCase.children = child.children;
        const newEdges = [
          ...replaceChildren(cases, child.id, aCase.id),
          ...aCase.children.map((childId) => [aCase.id, childId]),
        ];
        const nodesDeleted = deleteNodes(cases, [child.id]);

        return {
          nodesDeleted,
          edgesAdded: newEdges,
          editedNodes: [aCase],
          type: "Sequential Statement",
        };
      }

      if (aCase.children[0] === aCase.id) {
        // We have a while loop on our hands.

        const block = makeBlock(aCase);
        const newStatement = new Shift.WhileStatement({
          test: new Shift.LiteralBooleanExpression({
            value: true,
          }),
          body: block,
        });

        aCase.statements = [newStatement];
        aCase.children = [];

        const edgesDeleted = [[aCase.id, aCase.id]];
        const editedNodes = [aCase];

        return {
          nodesDeleted: [],
          edgesAdded: [],
          editedNodes,
          edgesDeleted,
          type: "Infinite Loop",
        };
      }
    }

    if (aCase.children.length == 2) {
      const realCons = getCase(aCase.children[0], cases);
      const realAlt = getCase(aCase.children[1], cases);

      for (let [cons, alt, invertConditional] of [
        [realCons, realAlt, false],
        [realAlt, realCons, true],
      ])
        if (
          (cons.children.length == 1 || cons === aCase) && // Make an exception for no-body while loops.
          cons.children[0] == aCase.id
        ) {
          if (
            (aCase.statements.length == 0 &&
              countParents(cons, cases) == 1 &&
              countParents(aCase, cases) == 2) ||
            cons === aCase // While loops that have no body.
          ) {
            const finalWhile = new Shift.WhileStatement({
              test: aCase.conditional,
              body: makeBlock(cons),
            });
            aCase.statements = [finalWhile];
            aCase.children = [alt.id];
            aCase.conditional = undefined;

						const nodesToDelete=cons.id===aCase.id?[]:[cons.id];

            const nodesDeleted = deleteNodes(cases, nodesToDelete);
            return {
              nodesDeleted,
              edgesAdded: [],
              editedNodes: [aCase],
              type: "While Loop",
            };
          }

          if (
            countParents(cons, cases) == 2 &&
            countParents(aCase, cases) == 1
          ) {
            cons.statements = [...cons.statements, ...aCase.statements];
            const finalDoWhile = new Shift.DoWhileStatement({
              test: aCase.conditional,
              body: makeBlock(cons),
            });
            cons.statements = [finalDoWhile];
            cons.children = [alt.id];
            cons.conditional = undefined;

            const nodesDeleted = deleteNodes(cases, [aCase.id]);
            return {
              nodesDeleted,
              edgesAdded: [[cons.id, alt.id]],
              editedNodes: [cons],
              type: "Do-While Loop",
            };
          }
        }
    }
  }

  // Next pass. This one checks for return-statement shenanigans.
  // It's after *everything else* because this is a last-ditch effort to make the code work. If it's not necessary, it messes things up.

  for (let allowReturnShenanigans of [false, true])
    for (let aCase of iterCases(startVal, cases)) {
      if (aCase.children.length == 2) {
        const realCons = getCase(aCase.children[0], cases);
        const realAlt = getCase(aCase.children[1], cases);

        const returnOptions = [
          "ReturnStatement",
          "ThrowStatement",
          "BreakStatement",
        ];
        const isReturn = (aCase) =>
          allowReturnShenanigans &&
          returnOptions.includes(
            aCase.statements[aCase.statements.length - 1]?.type
          );

        for (let [cons, alt, invertConditional] of [
          [realCons, realAlt, false],
          [realAlt, realCons, true],
        ]) {
          const makeConditional = () =>
            invertConditional
              ? new Shift.UnaryExpression({
                  operator: "!",
                  operand: aCase.conditional,
                })
              : aCase.conditional;

          if (
            countParents(cons, cases) == 1 &&
            countParents(alt, cases) == 1 &&
            alt.children.length < 2 &&
            cons.children.length < 2 &&
            (alt.children[0] == cons.children[0] ||
              isReturn(alt) ||
              isReturn(cons))
          ) {
            const finalIf = new Shift.IfStatement({
              test: makeConditional(),
              consequent: makeBlock(cons),
              alternate: makeBlock(alt),
            });
            const nodesDeleted = deleteNodes(cases, [cons.id, alt.id]);
            aCase.statements = [...aCase.statements, finalIf];
            aCase.children = [...new Set([...cons.children, ...alt.children])];
            aCase.conditional = undefined;

            return {
              nodesDeleted,
              edgesAdded: aCase.children.map((childId) => [aCase.id, childId]),
              editedNodes: [aCase],
              type: "If-Else Statement",
            };
          }

          if (
            countParents(cons, cases) == 1 &&
            ((cons.children.length == 1 && cons.children[0] == alt.id) ||
              isReturn(cons))
          ) {
            const finalIf = new Shift.IfStatement({
              test: makeConditional(),
              consequent: makeBlock(cons),
            });
            aCase.statements = [...aCase.statements, finalIf];
            aCase.children = [alt.id];

            aCase.conditional = undefined;

            const nodesDeleted = deleteNodes(cases, [cons.id]);

            return {
              nodesDeleted,
              edgesAdded: [],
              editedNodes: [aCase],
              type: "If Statement",
            };
          }
        }
      }
    }

  // Truly scraping the bottom of the barrel here. Looking for loops with break statements.

  for (let aCase of iterCases(startVal, cases)) {
    if (aCase.children.length == 2) {
      console.log("Checking node", aCase.id);
      const possibleBreakReplacements = lookForLoop(aCase, cases);
      if (possibleBreakReplacements) {
        return possibleBreakReplacements;
      }
    }
  }

  // By default, return nothing.
  // This might mean I made a mistake.
  // It might also mean the program uses "a: {break a;}" logic.
  // Not impossible, but a bit annoying.
};

export const deepenFlow = (sess, idx, customSave) => {
  const isDebugging = !!customSave;
  let forLoop;
  try {
    // TODO handle variable declarations and for loops which are split apart (but still in order).
    const switcher = sess(
      `:matches(VariableDeclarationStatement, ExpressionStatement[expression.type=AssignmentExpression]) ~ :matches(ForStatement, WhileStatement) > BlockStatement > Block:not([statements.0.type=ExpressionStatement][statements.0.expression.type=LiteralStringExpression][statements.0.expression.value=/Invalidated -- .*/]) > SwitchStatement`
    ).get(0);
    if (!switcher) return false;
    is(switcher, "SwitchStatement");

    const candidateLoop = sess(switcher).parents().parents().parents().get(0);
    assert(
      candidateLoop.type === "ForStatement" ||
        candidateLoop.type === "WhileStatement"
    );

    forLoop = candidateLoop;

    const { test } = candidateLoop;

    is(test, "BinaryExpression");

    const { left, right } = test;

    is(left, "IdentifierExpression");
    const stateName = left.name;
    //assert.equal(left.name, stateName);

    is(right, "LiteralNumericExpression");

    const endVal = right.value;

    const containingBlock = sess(forLoop).parents().get(0); // Block-like object.
    assert(
      containingBlock.statements,
      "Containing block has no statements. Not blocky. Type: " +
        containingBlock?.type
    );

    const fullBlock = sess(containingBlock).codegen()[0];
    writeFileSync("output/case-block.js", fullBlock);

    const statements = sess(containingBlock).statements().nodes;

    const forIdx = statements.indexOf(forLoop);

    // Check if this has been invalidated.

    const prevStatement = statements[forIdx - 1];
    if (prevStatement && prevStatement.type === "ExpressionStatement") {
      const { expression } = prevStatement;
      if (
        expression.type === "LiteralStringExpression" &&
        expression.value.startsWith("Invalidated -- ")
      ) {
        return;
      }
    }

    const stateDeclSt = statements.slice(0, forIdx).find((stmt) => {
			let startNode;

      if (stmt.type === "ExpressionStatement") {
        const { expression } = stmt;
        if (expression.type === "AssignmentExpression") {
          const { binding } = expression;
          if (
            binding.type === "AssignmentTargetIdentifier" &&
            binding.name === stateName
          ) {
            startNode = expression.expression;
          }
        }
      } else if (stmt.type === "VariableDeclarationStatement") {
        const { declaration } = stmt;
        if (declaration.type === "VariableDeclaration") {
          const { declarators } = declaration;
          if (declarators.length === 1) {
            const [declarator] = declarators;
            if (declarator.type === "VariableDeclarator") {
              const { binding } = declarator;
              if (
                binding.type === "BindingIdentifier" &&
                binding.name === stateName
              ) {
                startNode = declarator.init;
              }
            }
          }
        }
      }

			if(startNode){
				if(startNode.type==="LiteralNumericExpression"){
					return true;
				}
				if(startNode.type==="ConditionalExpression"&&startNode.consequent.type==="LiteralNumericExpression"&&startNode.alternate.type==="LiteralNumericExpression"){
					return true;
				}
			}

      return false;
    });

    // Extract state information from the initial variable declaration or assignment.
    const { binding, init } = (() => {
      if (stateDeclSt.type === "ExpressionStatement") {
        const { expression } = stateDeclSt;
        is(expression, "AssignmentExpression");
        const { binding, expression: init } = expression;
        return { binding, init };
      }
      is(stateDeclSt, "VariableDeclarationStatement");

      const decl = stateDeclSt.declaration;
      assert.equal(decl.declarators.length, 1);

      const stateVar = decl.declarators[0];

      return stateVar;
    })();

    assert(binding);
    assert(init);

		/* Deconstruct init into a single number.
		 * This is a bit of a process.
		 * 1. If it's a number, return its value.
		 * 2. If it's a ternary expression, create a new state (i.e. -1) with the conditional, append that to our states, and then set our start state to -1.
		*/

		const {startVal,extraCases}=(()=>{
			if(init.type==="LiteralNumericExpression"){
				return {
					startVal:init.value,
					extraCases:[]
				}
			}
			if(init.type==="ConditionalExpression"){
				const {test,consequent,alternate}=init;
				const startVal=-1;
				const newState={
					id:startVal,
					statements:[],
					conditional:test,
					children:[consequent,alternate].map(lit=>lit.value)
				}
				return {
					startVal,
					extraCases:[newState]
				}
			}
		})();

    assert(stateName);
    assert(startVal, "Start value is not a literal.");

    //console.log(`startVal: ${startVal}, endVal: ${endVal}`);

    const { discriminant, cases } = switcher;
    is(discriminant, "IdentifierExpression");
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
      makeCase(foundCase, stateName, endVal)
    );

    const allCases = [...foundCases, builtInCase, ...extraCases]; // Shift cases, end value, and optional injected value at the beginning.

    // For logging purposes
    const bareCases = allCases.map((aCase) => ({
      id: aCase.id,
      code: render(stringify(aCase.statements)),
    }));
    const bareEdges = allCases.flatMap(({ id, children }) =>
      children.map((child) => [id, child])
    );
    const allReplacements = [];

    // Save record of modifications to a JSON file.
    const save = (done) => {
      const saveObj = {
        done,
        startCase: startVal,
        cases: bareCases,
        edges: bareEdges,
        steps: allReplacements,
        code: render(fullBlock),
      };

      const serialized = JSON.stringify(saveObj, null, 2);

      writeFileSync(
        "output/" + (done ? "full" : "partial") + "-graph.json",
        serialized
      );
      const partialSave = customSave ?? "./graphs/" + idx + ".json";
      if (done) rimraf.sync(partialSave);

      const whichSave =
        customSave ?? (done ? `./graphs/done-${idx}.json` : partialSave);
      writeFileSync(whichSave, serialized);
    };

    save(false);

    let numOps = 0;

    while (true) {
      const replacement = reduceCases(allCases, stateName, startVal);

      if (!replacement) {
        break;
      }

      parentsCache.delete(allCases); // Allow the cache to be re-generated.

      numOps++;

      const newEdits = replacement.editedNodes.map((node) => {
        const code = isDebugging ? render(stringify(node.statements)) : {}; // Avoid expensive rendering when not in dedicated debug mode.

        return {
          id: node.id,
          code,
        };
      });

      console.log("\t" + replacement.type + " #" + numOps);

      const newReplacement = {
        nodesDeleted: replacement.nodesDeleted,
        edgesAdded: replacement.edgesAdded,
        editedNodes: newEdits,
        type: replacement.type,
      };

      allReplacements.push(newReplacement);

      if (isDebugging) {
        save(false); // In non-debug, avoid expensive saving.
      }
    }

    /*
    if (allCases.length > 1) {
      const caseViz = JSON.stringify(Object.fromEntries(
        allCases.map(({ id, children, code }) => [id, children])
      ),null,2);
      console.log(caseViz);
    }
		*/

    assert.equal(
      allCases.length,
      1,
      `The graph didn't fully reduce. IDX ${idx}, IDs ${JSON.stringify(
        allCases.map((aCase) => aCase.id)
      )}`
    );

    save(true);

    const [finalCase] = allCases;
    assert.equal(finalCase.children.length, 0);

    const preForLoop = containingBlock.statements.slice(0, forIdx);

    containingBlock.statements = [
      ...preForLoop.filter((stmt) => stmt !== stateDeclSt),
      new Shift.ExpressionStatement({
        expression: new Shift.LiteralStringExpression({
          value: "Unpacked from graph",
        }),
      }),
      ...finalCase.statements,
      ...containingBlock.statements.slice(forIdx + 1),
    ]; // Remove the variable declaration and switch statement.

    sess(forLoop).delete();
    sess(stateDeclSt).delete();
  } catch (err) {
    // Now, invalidate the loop so we don't get caught on it later.

    console.log(`\t${err.message}`);
    if (!forLoop) {
      console.log("Control flow program didn't even find a loop.");
    } else {
      const forBlock = forLoop.body.block;
      forBlock.statements = [
        new Shift.ExpressionStatement({
          expression: new Shift.LiteralStringExpression({
            value: "Invalidated -- " + err.message,
          }),
        }),
        ...forBlock.statements,
      ];
    }
  }

  return true;
};

const signature=Date.now();
export const newTarget={
	sanitize:(sess)=>{
		sess("NewTargetExpression").replace(`"new.target.${signature}"`);
	},
	restore:(sess)=>{
		sess(`LiteralStringExpression[value="new.target.${signature}"]`).replace(new Shift.NewTargetExpression({}));
	}
}

export default (sess, customSave) => {
	newTarget.sanitize(sess);

  // Un-invalidate graphs from the past.
  sess(
    `ExpressionStatement > LiteralStringExpression[value=/Invalidated -- .*/]`
  )
    .parents()
    .delete();

  // Cleanup.
  const { session } = sess;

  if (!customSave) rimraf.sync("./graphs/*.json");

  let idx = 0;

  while (true) {
    const deepenedFlow = deepenFlow(sess, idx, customSave);
    idx++;

    if (!deepenedFlow) {
      break;
    }
    //sess.isDirty(true);
  }

	newTarget.restore(sess);

};
