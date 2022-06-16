import {readFileSync,write,writeFileSync} from 'fs';

import {refactor} from "shift-refactor";

import controlFlow from "./transformations/control-flow.js";

const json=readFileSync("debug/in.json","utf8");
const graph=JSON.parse(json);

const code=graph.code.code;

const funcified=`
function tester(){
${code}
}`

writeFileSync("debug/in.js",funcified);

let sess=refactor(funcified);

controlFlow(sess,"debug/out.json");

writeFileSync("debug/out.js",sess.print())