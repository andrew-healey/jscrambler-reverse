import { safetyLevels, unminifyTree } from "unminify";
import {refactor} from "shift-refactor";

 export default (session)=>{
	 const root=session.nodes[0];
	 const modified=unminifyTree(root,{
		 safety:safetyLevels.WILDLY_UNSAFE
	 });

	 return refactor(modified);
 };