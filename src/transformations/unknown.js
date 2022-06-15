import { unminifyTree } from "unminify";

export default (session)=>{
	/*
	      const realConfig=(session("CallExpression[callee.name=\"decodeURI\"] > .arguments").get(0)).value;
        const decodeString=(session("ReturnStatement > ObjectExpression > DataProperty > CallExpression > LiteralStringExpression").get(0));
        const decodeKey=decodeString.value;
        const dec=decodeURI(realConfig)
        let ret=''
        for(let i=0;i<dec.length;i++)
                    ret+=String.fromCharCode(dec.charCodeAt(i)^decodeKey.charCodeAt(i%decodeKey.length))
        const arr=ret.split("^")

        const bindings=session(`VariableDeclaration[declarators.length=3][declarators.0.init.type="StaticMemberExpression"][declarators.1.init.type="CallExpression"][declarators.2.init.type="ComputedMemberExpression"] > VariableDeclarator > .binding`);
        const vars=bindings.lookupVariable();

        vars.map((variable)=>{
            const refs=variable.references;
            session.$(refs.filter(ref=>!ref.accessibility.isWrite).map(ref=>ref.node)).parents().replace((expr)=>{
                if(expr.type==="CallExpression"&& expr.arguments[0].type==="LiteralNumericExpression"){
                    const idx=expr.arguments[0].value;
                    return new Shift.LiteralStringExpression({
                        value:arr[idx]
                    });
                }
                return expr;
            });
        });
        const totalFunc=bindings.parents().parents().parents().parents();
        totalFunc.forEach((func)=>{
            session.$(func.statements.slice(0,3)).delete();
        });
				*/

        // Next obfuscation function
        const otherFunc=session.$("Script > ExpressionStatement > CallExpression > FunctionExpression > FunctionBody > ExpressionStatement:nth-child(4) StaticMemberAssignmentTarget").get(0);
        const objName=(otherFunc.object).name;
        const propName=otherFunc.property;

        const obfParams=session.$(`Script > ExpressionStatement > CallExpression > FunctionExpression > FunctionBody > ExpressionStatement:nth-child(2) CallExpression[arguments.length=2]`).get(0);
        const [arrLength,multiple]=obfParams.arguments.map((arg)=>arg.value);

        session(`ComputedMemberExpression[object.object.type="CallExpression"][object.object.callee.property="${propName}"][object.object.callee.object.name="${objName}"]`).replace((el)=>{
            const idx2=(el.expression).value;
            const idx1=((el.object).expression).value;
            const totalId=(idx2+multiple*idx1)%arrLength;
            return new Shift.LiteralNumericExpression({
                value:totalId
            });
        });

        session.convertComputedToStatic();

        session(`CallExpression[callee.type=StaticMemberExpression][callee.object.type=ArrayExpression][callee.property=join]`).replace((call)=>{
            const els=((call.callee).object).elements;
            if(els.reduce((onlyStrings,el)=>onlyStrings&&el.type=="LiteralStringExpression",true)){
                const replaceVal=call.arguments[0];
                if(replaceVal.type==="LiteralStringExpression"){
                    return new Shift.LiteralStringExpression({
                        value:els.map((el)=>el.value).join(replaceVal.value)
                    });
                }
            }
            return call;
        });

        //removeSwitching(session);

        session.normalizeIdentifiers();

}