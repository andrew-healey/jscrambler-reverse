import got from "got";
import {refactor} from "shift-refactor";

export default async (sess)=>{
	const code=sess.print();
	const options={
		// Just use defaults.
	};
	const query={
			pretty: options.pretty??"1"?"1":"0",
			rename:options.rename??"1"?"1":"0",
			types:options.types??"1"?"1":"0",
			suggest:options.suggest?"1":"0",
	};

	const reqOptions={
			searchParams:query,
			body:code,
	};

	const body=await got.post("http://jsnice.org/beautify",reqOptions).json();

	return refactor(body.js);
};
