import assert from "node:assert";

export const is = (shiftObj,type)=>{
    assert.equal(shiftObj.type,type);
};
