const fs = require('node:fs/promises');
const path = require('node:path');
const {createReadStream} = require('node:fs');
const {createHash} = require('node:crypto');
const {execFileSync} = require('node:child_process');
(async () => {
  const root = path.resolve(__dirname, '..'), dist = path.join(root, 'dist');
  const version = require('../package.json').version;
  const files = [`Float Dot-${version}-x64-Setup.exe`, `Float Dot-${version}-x64-Portable.exe`];
  for (const file of files) await fs.access(path.join(dist,file));
  const artifacts = [];
  for (const name of files) {
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(path.join(dist, name))) hash.update(chunk);
    artifacts.push({name, sha256:hash.digest('hex'), bytes:(await fs.stat(path.join(dist,name))).size});
  }
  const commit = execFileSync('git', ['rev-parse','HEAD'], {cwd:root,encoding:'utf8'}).trim();
  const dirty = !!execFileSync('git', ['status','--porcelain'], {cwd:root,encoding:'utf8'}).trim();
  const manifest = {version:require('../package.json').version,commit,dirty,channel:'unsigned-private-beta',createdAt:new Date().toISOString(),artifacts};
  await fs.writeFile(path.join(dist,'SHA256SUMS.txt'), artifacts.map(a=>`${a.sha256}  ${a.name}`).join('\n')+'\n');
  await fs.writeFile(path.join(dist,'release-manifest.json'), JSON.stringify(manifest,null,2));
  console.log(`Checksums generated for ${artifacts.length} artifacts. Source dirty: ${dirty}. Not a signed public release.`);
})().catch(error=>{console.error(error.message);process.exitCode=1;});
