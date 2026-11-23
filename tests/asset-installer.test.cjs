const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {AssetInstaller} = require('../src/services/asset-installer');
const data = 'synthetic model';
const hash = createHash('sha256').update(data).digest('hex');
async function fixture(t, fetcher, expected = hash) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(),'float-dot-assets-'));
  t.after(()=>fs.rm(directory,{recursive:true,force:true}));
  return new AssetInstaller(directory, {fetcher,manifest:{ocr:[['eng.traineddata','https://example.com/model',expected]]}});
}
test('assets install verified bytes and persist location across restart', async t=>{
  const installer = await fixture(t, async()=>new Response(data));
  const progress=[];
  const target=await installer.install('ocr',p=>progress.push(p));
  assert.equal(await fs.readFile(path.join(target,'eng.traineddata'),'utf8'),data);
  assert.equal(await new AssetInstaller(installer.directory).installed('ocr'),target);
  assert.ok(progress.length);
});
test('tampered downloads never replace working assets and staging is removed', async t=>{
  const installer=await fixture(t,async()=>new Response(data));
  const target=await installer.install('ocr');
  installer.fetcher=async()=>new Response('tampered');
  await assert.rejects(installer.install('ocr'),/Integrity/);
  assert.equal(await installer.installed('ocr'),target);
  assert.equal((await fs.readdir(installer.directory)).filter(n=>n.startsWith('.install')).length,0);
});
test('cancel aborts transfer, excludes concurrent installs, and cleans partial files', async t=>{
  let began;
  const started=new Promise(r=>began=r);
  const installer=await fixture(t,async(_url,{signal})=>{began();return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('canceled')),{once:true}));});
  const pending=installer.install('ocr');await started;
  await assert.rejects(installer.install('ocr'),/already running/);
  installer.cancel();await assert.rejects(pending,/canceled/);
  assert.equal(await installer.installed('ocr'),null);
  assert.deepEqual(await fs.readdir(installer.directory),[]);
  await assert.rejects(installer.install('../invalid'),/Choose/);
});
