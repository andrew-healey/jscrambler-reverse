import {readFileSync,writeFileSync} from "fs";
import {format} from "prettier";

import {refactor} from "shift-refactor"
import assert from "node:assert";

// Util.
import launderConsts from "./launder-consts.js";

import controlFlow from "./transformations/control-flow.js";
import unminify from "./transformations/unminify.js";
import arrayVars from "./transformations/array-vars.js";
import createDeclarations from "./transformations/create-declarations.js";
import objectSplit from "./transformations/object-split.js";
import whileToFor from "./transformations/while-to-for.js";
import removeDuplicates from "./transformations/remove-duplicates.js";
import numberModulo from "./transformations/number-modulo.js";
import evalConsts from "./transformations/eval-consts.js";
import compressMultisets from "./transformations/compress-multisets.js";
import stringSplit from "./transformations/string-split.js";
import varToConst from "./transformations/var-to-const.js";
import integrityChecker from "./transformations/integrity-checker.js";
import stringArray from "./transformations/string-array.js";
import ifToSwitch from "./transformations/if-to-switch.js";
import jsNice from "./transformations/jsnice.js"
import removeGlobalObj from "./transformations/remove-global-obj.js";
import removeIife from "./transformations/remove-iife.js";
import nestedAssignments from "./transformations/nested-assignments.js";
import concatRecycling from "./transformations/concat-recycling.js";
import statementify from "./transformations/statementify.js";
import timeSpoof from "./transformations/time-spoof.js";
import noStrict from "./transformations/no-strict.js";

const dir=process.argv[2]??"demos/geetest/";

let skip=process.argv[3]??"";

const file=skip===""?"obf":"obf-"+skip;

const gameScript=readFileSync(dir+file+".js","utf8");

let sess=refactor(gameScript);

const runTransform=async (transform,name)=>{
	if(skip!=="") {
		if(skip===name) skip="";
    console.log(`Skipping ${name}`);
    return;
	}
	sess=(await transform(sess))??sess;
	launderConsts(sess);
	assert.equal(sess.nodes.length,1);
	const filename=`${dir}obf-${name}.js`;
	const stringified=sess.print();
	writeFileSync(filename,stringified);
	sess=refactor(stringified);
	console.log(`${name} done`);
}

await runTransform(timeSpoof,"timeSpoof");

await runTransform(concatRecycling,"concatRecycling");

await runTransform(removeIife,"removeIife");

await runTransform(controlFlow,"controlFlow");

await runTransform(arrayVars,"arrayVars");

await runTransform(createDeclarations,"createDeclarations");

await runTransform(objectSplit,"objectSplit");

await runTransform(controlFlow,"controlFlow_2");

await runTransform(varToConst,"varToConst");

await runTransform(evalConsts,"evalConsts");

await runTransform(removeDuplicates,"removeDuplicates");

await runTransform(numberModulo,"numberModulo");

await runTransform(controlFlow,"controlFlow_3");

await runTransform(createDeclarations,"createDeclarations_2");

await runTransform(nestedAssignments,"nestedAssignments");

await runTransform(compressMultisets,"compressMultisets");

await runTransform(varToConst,"varToConst_2");

await runTransform(evalConsts,"evalConsts_2");

await runTransform(stringSplit,"stringSplit");

await runTransform(evalConsts,"evalConsts_3");

await runTransform(integrityChecker,"integrityChecker");

await runTransform(stringArray,"stringArray");

await runTransform(ifToSwitch,"ifToSwitch");

await runTransform(controlFlow,"controlFlow_4");

//await runTransform(removeGlobalObj,"removeGlobalObj");

await runTransform(unminify,"unminify");

await runTransform(unminify,"unminify_2");

await runTransform(whileToFor,"whileToFor");

await runTransform(objectSplit,"objectSplit_2");

//await runTransform(statementify,"statementify");

await runTransform(jsNice,"jsNice");

await runTransform(noStrict,"noStrict");

writeFileSync(dir+"beautified.js",format(sess.print(),{parser:"babel"}));

// TODO: recover Game.run() line that got lost somewhere.