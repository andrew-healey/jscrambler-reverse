import controlFlow from "./transformations/control-flow.js";

import {readFileSync,writeFileSync} from "fs";

import {refactor} from "shift-refactor"

const gameScript=readFileSync("demos/game/obf.js","utf8");

const sess=refactor(gameScript);

controlFlow(sess);
