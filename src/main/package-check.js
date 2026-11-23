const fs=require('node:fs/promises');const path=require('node:path');const os=require('node:os');
module.exports=async({app,panel,windowManager,ocr,speech,screen})=>{
  if(panel.webContents.isLoading()) await new Promise(r=>panel.webContents.once('did-finish-load',r));
  await new Promise(r=>setTimeout(r,1000));
  const ui=await panel.webContents.executeJavaScript(`({bridge:typeof window.floatDot,secure:window.isSecureContext,question:!!document.querySelector('#question'),downloads:!!document.querySelector('#install-ocr')})`);
  await panel.webContents.executeJavaScript(`document.querySelector('#settings-close').click(); document.querySelector('#onboarding-close').click();`);
  const reveal=[];
  for(let i=0;i<100;i++){
    windowManager.collapse();const start=performance.now();windowManager.show();
    await panel.webContents.executeJavaScript('new Promise(resolve=>requestAnimationFrame(()=>resolve(true)))');
    reveal.push(performance.now()-start);
  }
  const samples=[];app.getAppMetrics();
  for(let i=0;i<10;i++){
    await new Promise(r=>setTimeout(r,1000));const metrics=app.getAppMetrics();
    samples.push({cpu:metrics.reduce((s,m)=>s+m.cpu.percentCPUUsage,0),workingSetMB:metrics.reduce((s,m)=>s+m.memory.workingSetSize,0)/1024});
  }
  let ocrResult=null;
  if(ocr.ready()){
    const png=await panel.webContents.executeJavaScript(`(()=>{const c=document.createElement('canvas');c.width=600;c.height=150;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,600,150);x.fillStyle='black';x.font='40px Arial';x.fillText('Float Dot package test',20,80);return c.toDataURL().split(',')[1];})()`);
    ocrResult=await ocr.read(Buffer.from(png,'base64'),AbortSignal.timeout(30000));
  }
  const cpu=samples.reduce((s,x)=>s+x.cpu,0)/samples.length, memory=Math.max(...samples.map(x=>x.workingSetMB));
  const p95=reveal.slice().sort((a,b)=>a-b)[94];
  const report={date:new Date().toISOString(),packaged:app.isPackaged,platform:os.platform(),release:os.release(),cpuModel:os.cpus()[0].model,ramGB:os.totalmem()/1073741824,displays:screen.getAllDisplays().map(d=>({size:d.size,scale:d.scaleFactor})),ui,ocrReady:ocr.ready(),ocrMatched:!!ocrResult?.text.includes('Float Dot'),speechReady:await speech.ready(),revealCycles:100,revealP95Ms:p95,idleAppCpuAverage:cpu,idleAppWorkingSetPeakMB:memory,samples,budgets:{reveal:p95<=200,cpu:cpu<1,memory:memory<=250},limits:'Local packaged smoke, not clean-VM installation. Separate Ollama/Whisper inference processes excluded. No real microphone test.'};
  const file=path.join(app.getPath('userData'),'report.json');await fs.writeFile(file,JSON.stringify(report,null,2));
  console.log(`PACKAGE_VERIFY_REPORT ${file}`);
  app.exit(ui.bridge==='object'&&ui.secure&&ui.question&&report.ocrMatched&&report.speechReady?0:1);
};
