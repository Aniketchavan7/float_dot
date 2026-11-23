const test=require('node:test');
const assert=require('node:assert/strict');
const {answerPolicy,buildMessages}=require('../src/services/prompts');
const {Coordinator}=require('../src/services/coordinator');
const context={id:'parentheses',sourceId:'screenshot:fixture',name:'LeetCode',capturedAt:'2026-10-09',text:'Remove Outermost Parentheses. A valid parentheses string decomposes into primitive balanced strings. Remove the outermost pair of each primitive. Input: "(()())(())". Output: "()()()". JavaScript starter: var removeOuterParentheses = function(s) { };'};
test('explicit brevity, code-only and hint requests override the default layout',()=>{
  const code=answerPolicy('general','Just code in JavaScript');
  assert.equal(code.requiresCode,true);assert.deepEqual(code.headings,[]);
  const messages=buildMessages({mode:'general',question:'Explain Map in three sentences',context:null});
  assert.ok(!messages.at(-1).content.includes('### Next step'));
  assert.match(messages.at(-1).content,/sentence count/);
  assert.equal(answerPolicy('general','One hint without the solution').hintOnly,true);
});
test('explicit code requests work across general, DSA and debug while explanations stay explanations',()=>{
  for(const mode of ['general','dsa','debug'])for(const question of ['give code','code','write code in JavaScript','I need code for this'])assert.equal(answerPolicy(mode,question).requiresCode,true,`${mode}: ${question}`);
  assert.ok(!answerPolicy('general','Explain this code').requiresCode);
  assert.equal(answerPolicy('general','Give full solution without code').requiresCode,false);
  assert.ok(!answerPolicy('dsa','One hint without the solution').requiresCode);
  const messages=buildMessages({mode:'general',question:'give code',context});
  assert.match(messages[0].content,/MUST contain complete runnable code/);assert.match(messages[0].content,/visible editor\/starter signature/);
  assert.match(messages.at(-2).content,/\(\(\)\(\)\)\(\(\)\)/);assert.match(messages.at(-1).content,/### Solution/);
});
test('an explanation-only response to a code request is not marked completed or retained',async()=>{
  const events=[];const c=new Coordinator({emit:e=>events.push(e),infer:async({onDelta})=>{const text='### Answer\nRemove the outermost parentheses.';onDelta(text);return text;}});
  await c.ask({question:'give code',mode:'general',context,model:'test'});
  assert.equal(events.at(-1).type,'error');assert.match(events.at(-1).message,/instead of the requested code/);assert.equal(c.history.length,0);
});
test('parentheses regression oracle covers primitive boundaries and every balanced input through six pairs',()=>{
  const removeOuterParentheses=s=>{let depth=0;const result=[];for(const c of s){if(c==='('){if(depth>0)result.push(c);depth++;}else{depth--;if(depth>0)result.push(c);}}return result.join('');};
  const oracle=s=>{let start=0,depth=0,out='';for(let i=0;i<s.length;i++){depth+=s[i]==='('?1:-1;if(depth===0){out+=s.slice(start+1,i);start=i+1;}}return out;};
  const visit=(prefix,open,close,n)=>{if(close===n){assert.equal(removeOuterParentheses(prefix),oracle(prefix),prefix);return;}if(open<n)visit(prefix+'(',open+1,close,n);if(close<open)visit(prefix+')',open,close+1,n);};
  for(let n=1;n<=6;n++)visit('',0,0,n);
  assert.equal(removeOuterParentheses('(()())(())'),'()()()');assert.equal(removeOuterParentheses('()()'),'');assert.equal(removeOuterParentheses('(()())(())(()(()))'),'()()()()(())');
});
