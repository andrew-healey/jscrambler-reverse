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
			cases.reduce((parentMap,nextCase)=>{
				for(let child of nextCase.children){
					if(!(child in parentMap)){
						parentMap[child]=[];
					}
					parentMap[child].push(nextCase);
					return parentMap;
				}
			},{})
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
  const svg = renderer.svg(code);
  const dataUrl = `data:image/svg+xml;utf8,${svg.replace(/$\s/gm, " ")}`;
  return svg;
};

const shikiRenderer = await shiki.getHighlighter({
  theme: "nord",
});

const html = (code) => {
  return shikiRenderer.codeToHtml(code, { lang: "js" });
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
        type: "Dead Code",
      };
    }

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
    }

    if (aCase.children.length == 2) {
      const cons = getCase(aCase.children[0], cases);
      const alt = getCase(aCase.children[1], cases);

      const isSimpleLeaf = (node) =>
        countParents(node, cases) == 1 && node.children.length < 2;

      if (
        isSimpleLeaf(cons) &&
        countParents(alt, cases) == 1 &&
        alt.children[0] == cons.children[0]
      ) {
        const finalIf = new Shift.IfStatement({
          test: aCase.conditional,
          consequent: makeBlock(cons),
          alternate: makeBlock(alt),
        });
        const nodesDeleted = deleteNodes(cases, [cons.id, alt.id]);
        aCase.statements = [...aCase.statements, finalIf];
        aCase.children = alt.children;
        aCase.conditional = undefined;

        return {
          nodesDeleted,
          edgesAdded: alt.children.map((childId) => [aCase.id, childId]),
          editedNodes: [aCase],
          type: "If-Else Statement",
        };
      }

      if (
        countParents(cons, cases) == 1 &&
        ((cons.children.length == 1 && cons.children[0] == alt.id) ||
          cons.statements[cons.statements.length - 1]?.type ===
            "ReturnStatement")
      ) {
        const finalIf = new Shift.IfStatement({
          test: aCase.conditional,
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

      if (
        (cons.children.length == 1 || cons === aCase) && // Make an exception for no-body while loops.
        cons.children[0] == aCase.id &&
        aCase.statements.length == 0
      ) {
        if (
          (countParents(cons, cases) == 1 && countParents(aCase, cases) == 2) ||
          cons === aCase // While loops that have no body.
        ) {
          const finalWhile = new Shift.WhileStatement({
            test: aCase.conditional,
            body: makeBlock(cons),
          });
          aCase.statements = [finalWhile];
          aCase.children = [alt.id];
          aCase.conditional = undefined;

          const nodesDeleted = deleteNodes(cases, [cons.id]);
          return {
            nodesDeleted,
            edgesAdded: [],
            editedNodes: [aCase],
            type: "While Loop",
          };
        }

        if (countParents(cons, cases) == 2 && countParents(aCase, cases) == 1) {
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

    // Switch statements. Ignoring for now.
    if (false && countParents(aCase, cases) > 2) {
      const parents = getParents(aCase, cases);

      if (
        parents.findIndex(
          (parent) =>
            parent.children.length !== 1 || countParents(parent, cases) !== 1
        ) == -1
      ) {
        const decisionNodes = parents.map(
          (parent) => getParents(parent, cases)[0]
        );

        // Order all decision nodes.

        const decisionChains = [];
        for (let decisionNode of decisionNodes) {
          let parentChain = decisionChains.findIndex((chain) =>
            chain[chain.length - 1].children.includes(decisionNode.id)
          );

          let proposedChain = [decisionNode];
          if (parentChain >= 0) {
            proposedChain = [
              ...decisionChains.splice(parentChain, 1),
              ...proposedChain,
            ];
          }

          let childChain = decisionChains.find((chain) =>
            decisionNode.children.includes(chain[0].id)
          );

          if (childChain >= 0) {
            proposedChain = [
              ...proposedChain,
              ...decisionChains.splice(childChain, 1),
            ];
          }

          decisionChains.push(proposedChain);
        }
        const [orderedChain] = decisionChains;

        const lastNode = orderedChain[orderedChain.length - 1];
        const defaultNode = lastNode.children[1];
        assert(
          (defaultNode.children.length == 1 &&
            defaultNode.children[0] === aCase.id) ||
            (defaultNode.children.length == 0 && isTerminal(defaultNode)),
          "The default node should go to post behavior. It does not."
        );

        const shiftCases = orderedChain.map((decisionNode) => {
          const behaviorNode = getCase(decisionNode.children[0], parents);
        });
      }
    }
  }

  // By default, return nothing.
};

export const deepenFlow = (sess, idx, customSave, justFindCases = false) => {
  let forLoop;
  try {
    // TODO handle variable declarations and for loops which are split apart (but still in order).
    const switcher = sess(
		`:matches(VariableDeclarationStatement, ExpressionStatement[expression.type=AssignmentExpression]) ~ :matches(ForStatement, WhileStatement) > BlockStatement > Block:not([statements.0.type=ExpressionStatement][statements.0.expression.type=LiteralStringExpression][statements.0.expression.value=/Invalidated -- .*/]) > SwitchStatement`
    ).get(0);
    if (!switcher) return false;
    is(switcher, "SwitchStatement");

    const candidateLoop = sess(switcher).parents().parents().parents().get(0);
		assert(candidateLoop.type==="ForStatement" || candidateLoop.type==="WhileStatement");

    const { test } = candidateLoop;

    is(test, "BinaryExpression");

    const { left, right } = test;

    is(left, "IdentifierExpression");
    const stateName = left.name;
    //assert.equal(left.name, stateName);

    is(right, "LiteralNumericExpression");

		forLoop=candidateLoop;

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

		const prevStatement=statements[forIdx-1];
		if(prevStatement&&prevStatement.type==="ExpressionStatement"){
			const {expression}=prevStatement;
			if(expression.type==="LiteralStringExpression"&&expression.value.startsWith("Invalidated -- ")){
				return;
			}
		}

    const stateDeclSt = statements.slice(0, forIdx).find((stmt) => {
      if (stmt.type === "ExpressionStatement") {
        const { expression } = stmt;
        if (expression.type === "AssignmentExpression") {
          const { binding } = expression;
          if (
            binding.type === "AssignmentTargetIdentifier" &&
            binding.name === stateName
          ) {
            const startNode = expression.expression;
            if (startNode.type === "LiteralNumericExpression") {
							return true;
            }
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
                const startNode = declarator.init;
                if (startNode.type === "LiteralNumericExpression") {
									return true;
                }
              }
            }
          }
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

    const startVal = init.value;

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

    const allCases = [...foundCases, builtInCase];

    if (justFindCases) {
      return {
        cases: allCases,
        startVal,
      };
    }

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

      numOps++;

      const newEdits = replacement.editedNodes.map((node) => {
        const code = render(stringify(node.statements));

        return {
          id: node.id,
          code,
        };
      });

      console.log("\t" + replacement.type);

      const newReplacement = {
        nodesDeleted: replacement.nodesDeleted,
        edgesAdded: replacement.edgesAdded,
        editedNodes: newEdits,
        type: replacement.type,
      };

      allReplacements.push(newReplacement);

      save(false);
    }

		/*
    if (allCases.length > 1) {
      const caseViz = Object.fromEntries(
        allCases.map(({ id, children, code }) => [id, children])
      );
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
			...preForLoop.filter(stmt=>stmt!==stateDeclSt),
      new Shift.ExpressionStatement({
        expression: new Shift.LiteralStringExpression({
          value: "Unpacked from graph",
        }),
      }),
      ...finalCase.statements,
      ...containingBlock.statements.slice(forIdx+1),
    ]; // Remove the variable declaration and switch statement.

    sess(forLoop).delete();
    sess(stateDeclSt).delete();
  } catch (err) {
    console.error(err);

    // Now, invalidate the loop so we don't get caught on it later.

    if (!forLoop) {
      console.log("Control flow program didn't even find a loop.");
    } else {
			const forBlock=forLoop.body.block;
			forBlock.statements=[
        new Shift.ExpressionStatement({
          expression: new Shift.LiteralStringExpression({
            value: "Invalidated -- " + err.message,
          }),
        }),
				...forBlock.statements
			]
    }
  }

  return true;
};

export default (sess, customSave) => {
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
};
