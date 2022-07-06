import {refactor} from "shift-refactor";

export default (sess)=>{
	const startTime=1000*60*60*24*30; // Let's tell JScrambler that it's *currently* 30 days after the beginning of the Unix epoch.
	const injection=`
	{
		const now=new Date;
		const shift=now-${startTime};
		const setHook=(obj,prop)=>{
				const og=obj[prop];
				obj[prop]=new Proxy(og,{
					/*
						apply:(self,target,args)=>{
								console.log("Called",obj.prototype.constructor.name,prop);
								return Reflect.apply(self,target,args) - shift
						},
						*/
						construct:(target,args)=>{
								console.log("Constructed",og.prototype.constructor.name);
								return Reflect.construct(target,[Reflect.construct(target,args)-shift])
						},
						/*
						get:(...args)=>{
								console.log("Got",og,prop);
								return Reflect.get(args[0],args[1]);
						}
						*/
				});
		}

		/*
		shiftNum=(obj,prop)=>{
				obj[prop]=obj[prop]-shift;
		}

		setHook(Date,"now");
		setHook(performance,"now");
		*/

		setHook(window,"Date")

		/*
		shiftNum(performance,"timeOrigin");
		otherTimes=["domComplete","domContentLoadedEventEnd","domContentLoadedEventStart","domInteractive","domLoading","loadEventEnd","loadEventStart","navigationStart","responseEnd"];
		for(let time of otherTimes) shiftNum(performance.timing,time);

		setHook(window,"performance");
		*/
	}
	`;

	return refactor(`
	${injection}
	${sess.print()}
	`)
}