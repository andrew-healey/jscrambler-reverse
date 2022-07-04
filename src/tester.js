import transform,{demo} from "./transformations/var-to-const.js"
import {refactor} from "shift-refactor";

console.log(demo);
console.log("-".repeat(50))
const sess=refactor(demo);
transform(sess);
console.log(sess.print())