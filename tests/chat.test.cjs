const test=require('node:test');
const assert=require('node:assert/strict');
const {Coordinator}=require('../src/services/coordinator');
const {buildMessages,answerPolicy}=require('../src/services/prompts');
const answer='### Answer\nTwo Sum finds two indices whose values add to a target.\n### Example\n[2,7], target 9 gives [0,1].\n### Next step\nUse a map to find complements.';
test('Two Sum without a screenshot gets explanation policy and no captured evidence',()=>{
  const policy=answerPolicy('dsa','two sum',0,false);
  assert.equal(policy.hintOnly,undefined);assert.deepEqual(policy.headings,['Answer','Example','Next step']);
  const messages=buildMessages({mode:'dsa',question:'two sum',context:null});
  assert.equal(messages.length,2);assert.ok(!messages.some(m=>m.content.includes('<screen_excerpt>')));assert.match(messages[0].content,/no screen is attached/);
  assert.equal(answerPolicy('dsa','one hint for Two Sum',0,false).hintOnly,true);
});
test('chat answers and follow-ups work without images; screen history cannot cross into chat',async()=>{
  const requests=[],events=[];const c=new Coordinator({infer:async input=>{requests.push(input);input.onDelta(answer);return answer;},emit:e=>events.push(e)});
  await c.ask({mode:'general',question:'Explain the captured secret',context:{id:'screen',text:'private capture',capturedAt:'now'}});
  await c.ask({mode:'general',question:'two sum',context:null});
  assert.equal(requests[1].image,undefined);assert.ok(!JSON.stringify(requests[1].messages).includes('private capture'));
  await c.ask({mode:'general',question:'What is the complexity?',context:null});
  assert.ok(requests[2].messages.some(m=>m.role==='assistant'&&m.content===answer));assert.equal(events.at(-1).type,'done');
});
test('empty model output produces a visible error event instead of blank completion',async()=>{
  const events=[];const c=new Coordinator({infer:async()=>'',emit:e=>events.push(e)});
  await c.ask({mode:'general',question:'two sum',context:null});
  assert.equal(events.at(-1).type,'error');assert.match(events.at(-1).message,/empty answer/);assert.equal(c.history.length,0);
});
