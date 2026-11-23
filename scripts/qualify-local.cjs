const fs=require('node:fs/promises');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {streamAnswer,listModels,ENDPOINT}=require('../src/services/model');
const {buildMessages}=require('../src/services/prompts');
const {assessAnswer}=require('../src/services/answer-quality');
const {evaluateCode,imageID}=require('./sandbox-eval.cjs');
const args=process.argv.slice(2);
const option=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
(async()=>{
  const model=option('--model','qwen3:4b'),split=option('--split','development');
  if(!['development','held-out'].includes(split))throw Error('Unknown split');
  if(!(await listModels()).some(m=>m.name===model))throw Error('Requested model is not installed');
  const details=await (await fetch(`${ENDPOINT}/api/show`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model}),signal:AbortSignal.timeout(5000)})).json();
  if(details.remote_model||details.remote_host||/cloud|embed/i.test(model))throw Error('Qualification must use a local chat model');
  const directory=path.resolve(__dirname,'../tests/fixtures');
  const manifest=JSON.parse(await fs.readFile(path.join(directory,'eval-manifest.json'),'utf8'));
  const name=`eval-${split}.json`,bytes=await fs.readFile(path.join(directory,name));
  if(createHash('sha256').update(bytes).digest('hex')!==manifest.files[name].sha256)throw Error('Frozen suite checksum mismatch');
  let cases=JSON.parse(bytes);
  const ids=option('--ids','').split(',').filter(Boolean);
  if(ids.length)cases=cases.filter(c=>ids.includes(c.id));
  let image=null;try{image=imageID();}catch{}
  const report={model,promptHash:createHash('sha256').update(await fs.readFile(path.resolve(__dirname,'../src/services/prompts.js'))).digest('hex'),split,suiteVersion:manifest.version,suiteHash:manifest.files[name].sha256,date:new Date().toISOString(),image,results:[],qualification:'PENDING_HUMAN_REVIEW',humanAccepted:0,required:17};
  const output=path.resolve(option('--output',`.artifacts/qualification-${model.replace(/[^a-z0-9.-]/gi,'-')}-${split}.json`));
  await fs.mkdir(path.dirname(output),{recursive:true});
  for(const c of cases){
    const start=Date.now();let first=null, partial='';
    const row={id:c.id,question:c.spokenQuestion,expectedBehavior:c.expectedBehavior,humanReview:{status:'pending',reviewer:null,notes:''}};
    console.log(`Running ${c.id} with ${model}`);
    try{
      row.answer=await streamAnswer({model,reasoning:false,signal:AbortSignal.timeout(120000),messages:buildMessages({mode:c.mode,question:c.spokenQuestion,context:c.screenText?{name:'Evaluation fixture',capturedAt:report.date,text:c.screenText,quality:{confidence:100,truncated:false}}:null,history:[]}),onDelta:delta=>{partial+=delta;if(first===null)first=Date.now()-start;}});
      row.format=assessAnswer({answer:row.answer,mode:c.mode,question:c.spokenQuestion,hasScreen:!!c.screenText});
      if(c.tests){
        const code=row.answer.match(/```(?:python|py)\s*\n([\s\S]*?)\n```/i)?.[1];
        if(!code)row.codeTest={passed:false,error:'Missing Python code'};
        else if(!image)row.codeTest={passed:false,blocked:'Docker evaluation image unavailable; code was not executed'};
        else row.codeTest=await evaluateCode({code,entry:c.entry,tests:c.tests,image});
      }
    }catch(error){row.error=error.message;row.partialResponse=partial;}
    row.firstAnswerMs=first;row.durationMs=Date.now()-start;report.results.push(row);
    await fs.writeFile(output,JSON.stringify(report,null,2));
    console.log(`${c.id}: ${row.error?'ERROR':row.codeTest?row.codeTest.passed?'CODE_PASS':'CODE_FAIL':'REVIEW_REQUIRED'} (${row.durationMs} ms)`);
  }
  console.log(`Saved ${output}. Human acceptance remains pending; automated checks cannot certify the release.`);
})().catch(error=>{console.error(error.message);process.exitCode=1;});
