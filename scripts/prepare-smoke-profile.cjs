// Only writes the explicitly isolated development smoke profile, never userData.
const fs = require('node:fs');
const path = require('node:path');
const directory = path.resolve(__dirname, '../.artifacts/smoke-profile');
fs.mkdirSync(directory, {recursive:true});
fs.writeFileSync(path.join(directory,'settings.json'), JSON.stringify({
  provider:'compatible',baseURL:'http://127.0.0.1:1/v1',model:'synthetic-vision',
  sendImage:false,webEnabled:false,onboardingComplete:true,mode:'general'
}));
// The smoke test supplies its own loopback inference server before asking anything.
console.log('Isolated smoke profile prepared; no local model or cloud account needed.');
