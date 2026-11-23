const fs = require('node:fs');
const {withWeb}=require('../src/services/web-tools');
const {streamProvider}=require('../src/services/providers');
const {buildMessages}=require('../src/services/prompts');
(async()=>{
 const question='Using MDN documentation, explain JavaScript Map versus Object in three sentences and cite sources.';
 const config={webEnabled:true,searxURL:'http://127.0.0.1:8888',provider:'ollama',model:'qwen3:1.7b'};
 const report={checkedAt:new Date().toISOString(),model:config.model,toolCalled:false,sources:[],statuses:[]};
 const fetcher=async(...args)=>{const response=await fetch(...args);if(String(args[0]).endsWith('/api/chat')){const data=await response.clone().json();report.toolCalled=!!data.message?.tool_calls?.some(c=>c.function?.name==='search_web');}return response;};
 try {
 report.answer=await withWeb({question,model:config.model,messages:buildMessages({question,mode:'general',context:null,history:[],hintLevel:0}),signal:AbortSignal.timeout(180000),onDelta:()=>{},onTool:s=>report.statuses.push(s),onSources:s=>report.sources=s},config,input=>streamProvider({...input,provider:'ollama'}),{fetcher});
 report.citationsPresent=/\[\d+\]/.test(report.answer);
 report.passed=report.toolCalled && report.sources.length>0 && report.answer.length>0;
 report.scope='Integration only; does not certify answer correctness or instruction following';
 }catch(error){report.error=error.message;report.passed=false;}
 fs.writeFileSync('.artifacts/live-web-verification.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
})();
