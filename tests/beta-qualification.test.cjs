const test=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const {createHash}=require('node:crypto');
const {assessCitations}=require('../src/services/citations');
const {validateSources,validateDownloadEvent}=require('../src/shared/contracts');
test('citations distinguish retrieved IDs, missing citations and code indices',()=>{
 const sources=[{id:1,title:'Reference',url:'https://example.com'}];
 assert.deepEqual(assessCitations('Claim [1].',sources),[]);
 assert.match(assessCitations('Claim [9].',sources).join(' '),/Unrecognized/);
 assert.equal(assessCitations('```python\na[1]\n```',sources).length,1);
 assert.throws(()=>validateSources([{id:1,title:'unsafe',url:'javascript:alert(1)'}]));
 assert.throws(()=>validateSources([...sources,...sources]));
 assert.throws(()=>validateDownloadEvent({message:'Downloading',bytes:2}));
 assert.equal(validateDownloadEvent({requestId:'job1',message:'Downloading',bytes:2}).requestId,'job1');
});
test('development and held-out corpus counts, IDs and frozen hashes match',()=>{
 const directory=path.join(__dirname,'fixtures');const manifest=require('./fixtures/eval-manifest.json');
 const ids=new Set();
 for(const [file,record] of Object.entries(manifest.files)){
  const data=fs.readFileSync(path.join(directory,file));
  assert.equal(createHash('sha256').update(data).digest('hex'),record.sha256);
  const rows=JSON.parse(data);assert.equal(rows.length,file.includes('held-out')?20:40);
  for(const row of rows){assert.ok(!ids.has(row.id));ids.add(row.id);assert.ok(row.expectedBehavior);}
 }
});
