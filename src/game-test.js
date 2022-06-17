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

import {readFileSync,writeFileSync} from "fs";

import {refactor} from "shift-refactor"
import assert from "node:assert";

const dir="demos/game/";

let skip="integrityChecker";

const file=skip===""?"obf":"obf-"+skip;

const gameScript=readFileSync(dir+file+".js","utf8");

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
	writeFileSync(`${dir}obf-${name}.js`,sess.print());
}

runTransform(controlFlow,"controlFlow");

runTransform(arrayVars,"arrayVars");

runTransform(createDeclarations,"createDeclarations");

runTransform(objectSplit,"objectSplit");

runTransform(controlFlow,"controlFlow_2");

runTransform(removeDuplicates,"removeDuplicates");

runTransform(numberModulo,"numberModulo");

runTransform(controlFlow,"controlFlow_3");

runTransform(createDeclarations,"createDeclarations_2");

runTransform(compressMultisets,"compressMultisets");

runTransform(varToConst,"varToConst");

runTransform(evalConsts,"evalConsts");

runTransform(stringSplit,"stringSplit");

runTransform(evalConsts,"evalConsts_2");

runTransform(integrityChecker,"integrityChecker");

runTransform(stringArray,"stringArray");

runTransform(controlFlow,"controlFlow_4");

runTransform(unminify,"unminify");

runTransform(whileToFor,"whileToFor");

writeFileSync(dir+"beautified.js",sess.print());
