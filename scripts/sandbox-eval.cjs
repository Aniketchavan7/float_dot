const {spawn, execFileSync} = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const {randomUUID} = require('node:crypto');
const fallback = path.join(process.env.LOCALAPPDATA || '', 'Programs/DockerDesktop/resources/bin/docker.exe');
const docker = fs.existsSync(fallback) ? fallback : 'docker';
const harness = `import sys,json,contextlib,io
payload=json.load(sys.stdin)
namespace={}
with contextlib.redirect_stdout(io.StringIO()):
 exec(compile(payload['code'],'candidate.py','exec'),namespace)
 solution=namespace['Solution']()
 results=[]
 for t in payload['tests']:
  try:
   actual=getattr(solution,payload['entry'])(*t['args'])
   results.append({'pass':actual==t['expected'],'actual':actual,'expected':t['expected']})
  except Exception as e: results.append({'pass':False,'error':str(e)[:300]})
print(json.dumps(results))`;
function imageID() {
  return execFileSync(docker,['image','inspect','searxng/searxng:latest','--format','{{.Id}}'],{encoding:'utf8',windowsHide:true}).trim();
}
async function evaluateCode({code, entry, tests, image = imageID()}) {
  if (!/^sha256:[a-f0-9]{64}$/.test(image)) throw new Error('Evaluation requires a locally installed image digest.');
  const name = `float-dot-eval-${randomUUID()}`;
  const args=['run','--rm','--pull','never','--name',name,'-i','--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--pids-limit','32','--memory','256m','--cpus','1','--user','65534:65534','--entrypoint','python',image,'-I','-c',harness];
  try {
    const output=await new Promise((resolve,reject)=>{
      const child=spawn(docker,args,{windowsHide:true,stdio:['pipe','pipe','pipe']});
      let stdout='',stderr='';
      const timer=setTimeout(()=>{child.kill();reject(new Error('Isolated code test timed out'));},10000);
      child.stdout.on('data',chunk=>{stdout+=chunk;if(stdout.length>100000){child.kill();reject(new Error('Code output exceeded limit'));}});
      child.stderr.on('data',chunk=>{stderr=(stderr+chunk).slice(-2000);});
      child.on('error',error=>{clearTimeout(timer);reject(error);});
      child.on('close',code=>{clearTimeout(timer);code===0?resolve(stdout):reject(new Error(`Isolated code test failed: ${stderr}`));});
      child.stdin.on('error',()=>{});
      child.stdin.end(JSON.stringify({code,entry,tests}));
    });
    const results=JSON.parse(output);
    if (!Array.isArray(results) || results.length!==tests.length) throw new Error('Invalid test result');
    return {image,network:'none',readOnly:true,user:'65534:65534',hostMounts:[],results,passed:results.every(r=>r.pass===true)};
  } finally {try {execFileSync(docker,['rm','-f',name],{stdio:'ignore',windowsHide:true,timeout:10000});}catch{}}
}
module.exports={evaluateCode,imageID};
