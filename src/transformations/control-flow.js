import assert from "node:assert";
import {is} from "../assert-utils.js";

const checkCase = (aCase)=>{
    assert(aCase.children.length<3);
    assert.equal(!!aCase.conditional,aCase.children.length==2);
};

/**
 * makeCase
 * Converts a Shift node of a case into my own Case type.
 * Return type: Case
 **/
const makeCase = (shiftCase,stateName)=>{
    const {test,consequent} = shiftCase;

    is(test,"LiteralNumericExpression");

    const id=test.value;

    assert.notEqual(consequent.length,0);

    is(consequent[consequent.length-1],"BreakStatement");

    const statements = consequent.slice(0,consequent.length-1);

    assert.notEqual(statements.length,0);

    const lastStatement = statements[statements.length-1];
    if(statements.length==1&&lastStatement.type==="ReturnStatement"){
        return {
            id,
            statements:[lastStatement],
            children:[],
            condition:undefined,
        };
    }

    is(lastStatement,"ExpressionStatement");
    const assignExp = lastStatement.expression;
    is(assignExp,"AssignmentExpression");
    
    const {binding,expression} = assignExp;

    is(binding,"AssignmentTargetIdentifier");
    assert.equal(binding.name,stateName);

    const prevStatements = statements.slice(statements.length-1);

    if(expression.type==="LiteralNumericExpression"){
        // Simple linear step.
        return {
            id,
            statements:prevStatements,
            children:[expression.value],
            condition:undefined
        };
    }

    if(expression.type==="ConditionalExpression"){
        const condition = expression.test;

        const {consequent,alternate} = expression;
        is(consequent,"LiteralNumericExpression");
        is(alternate,"LiteralNumericExpression");

        return {
            id,
            statements:prevStatements,
            children:[consequent.value,alternate.value],
            condition
        };
    }

    assert.fail("Case doesn't match any known pattern.");

};

/*
 * type Reduction {
 *   nodesDeleted:number[]
 *   edgesAdded:[number,number][]
 * }
 */

/**
 * reduceCases
 * Iterates through all cases in the object. If it finds a pair of nodes it can reduce, it reduces them and returns info about the reduction. Otherwise, returns undefined.
 * Return type: Reduction?
 **/
const reduceCases = (cases,stateName,startVal)=>{

};

const deepenFlow = (sess)=>{
    const switcher=sess(`VariableDeclarationStatement:first-child + ForStatement > BlockStatement > Block > SwitchStatement`).get(0);
    is(switcher,"SwitchStatement");

    if(!switcher) return false;

    const forLoop = sess(switcher).parents().parents().parents().get(0);
    is(forLoop,"ForStatement");

    const containingBlock = sess(forLoop).parents().get(0); // Block-like object.
    assert(containingBlock.statements,"Containing block has no statements. Not blocky. Type: "+containingBlock?.type);

    const stateDeclSt = sess(containingBlock).statements().get(0);
    is(stateDeclSt,"VariableDeclarationStatement");

    const decl = stateDeclSt.declaration;
    assert.equal(decl.declarators.length,1);

    const stateVar=decl.declarators[0];

    const {binding,init} = stateVar;

    assert(binding);
    assert(init);

    const stateName = binding.name;
    const startVal = init.value;

    assert(stateName);
    assert(startVal);

    const {test} = forLoop;

    is(test,"BinaryExpression");

    const {left,right}=test;

    is(left,"IdentifierExpression");
    assert.equal(left.name,stateName);

    is(right,"LiteralNumericExpression");

    const endVal = right.value;

    const {discriminant,cases} = switcher;
    is(discriminant,"IdentifierExpression");
    assert.equal(discriminant.name,stateName);

    /*
     * type Case {
     *   id:number;
     *   statements:Shift.____Statement[];
     *   conditional:Shift.____Expression;
     *   children:number[];
     * }
     */

    const builtInCase = {
        number:endVal,
        statements:[],
        children:[],
    };

    const foundCases = cases.map(foundCase=> makeCase(foundCase,stateName,startVal));

    let allCases = [...foundCases,builtInCase];
    let newCases;

    do {
        allCases = newCases;
        newCases = reduceCases(allCases,stateName,startVal);
    } while (newCases.length < allCases.length)

    assert.equal(newCases.length,1,"The graph didn't fully reduce.");

    const [finalCase] = newCases;
    assert.equal(finalCase.children.length,0);

    containingBlock.statements = [...finalCase.statements,...containingBlock.statements.slice(2)]; // Remove the variable declaration and switch statement.

    $(forLoop).delete();
    $(stateDeclSt).delete();

};

export default (sess)=>{
    while(true){
        const deepenedFlow = deepenFlow(sess);

        if(!deepenedFlow) {
            break;
        }
        session.isDirty(true);
    }

    // Cleanup.
    const {session} = sess;
    session.globalState.conditionalCleanup();
};
