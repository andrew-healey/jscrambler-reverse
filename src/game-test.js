import controlFlow from "./transformations/control-flow.js";
import unknown from "./transformations/unknown.js";
import unminify from "./transformations/unminify.js";
import arrayVars from "./transformations/array-vars.js";
import createDeclarations from "./transformations/create-declarations.js";
import objectSplit from "./transformations/object-split.js";
import whileToFor from "./transformations/while-to-for.js";
import removeDuplicates from "./transformations/remove-duplicates.js";
import numberModulo from "./transformations/number-modulo.js";

import {readFileSync,writeFileSync} from "fs";

import {refactor} from "shift-refactor"
import assert from "node:assert";

let skip="controlFlow_2";

const file=skip===""?"obf":"obf-"+skip;

const gameScript=readFileSync("demos/game/"+file+".js","utf8");

let sess=refactor(gameScript);

const runTransform=(transform,name)=>{
	if(skip!=="") {
		if(skip===name) skip="";
    console.log(`Skipping ${name}`);
    return;
	}
	sess=transform(sess)??sess;
	assert.equal(sess.nodes.length,1);
	sess=refactor(sess.print());
	console.log(`${name} done`);
	writeFileSync(`demos/game/obf-${name}.js`,sess.print());
}

runTransform(controlFlow,"controlFlow");

runTransform(arrayVars,"arrayVars");

runTransform(createDeclarations,"createDeclarations");

runTransform(objectSplit,"objectSplit");

runTransform(controlFlow,"controlFlow_2");

runTransform(removeDuplicates,"removeDuplicates");

runTransform(numberModulo,"numberModulo");

runTransform(controlFlow,"controlFlow_3");

runTransform(unminify,"unminify");

runTransform(whileToFor,"whileToFor");

writeFileSync("beautified.js",sess.print());
