import {uncompress} from "google-reverse";
import {refactor} from "shift-refactor"
import {writeFileSync} from "node:fs"

export default (sess)=>{
	const newSrc=uncompress(sess.print());
	writeFileSync("statementify-raw.js",newSrc)
	return refactor(newSrc)
}