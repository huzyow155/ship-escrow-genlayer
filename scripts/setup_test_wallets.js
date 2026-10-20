const { createAccount } = require('genlayer-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../../.env');

let env = {};
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      env[trimmed.substring(0, idx).trim()] = trimmed.substring(idx + 1).trim();
    }
  }
}

let modified = false;

function ensureWallet(prefix) {
  if (!env[`${prefix}_PRIVATE_KEY`] || !env[`${prefix}_ADDRESS`]) {
    const acc = createAccount();
    env[`${prefix}_PRIVATE_KEY`] = acc.privateKey;
    env[`${prefix}_ADDRESS`] = acc.address;
    modified = true;
  }
}

ensureWallet('CREATOR');
ensureWallet('DEV');
ensureWallet('ATTACKER');

if (modified) {
  const content = [
    '# Local throwaway testing wallets for GenLayer Studionet (Git-ignored)',
    `CREATOR_ADDRESS=${env.CREATOR_ADDRESS}`,
    `CREATOR_PRIVATE_KEY=${env.CREATOR_PRIVATE_KEY}`,
    `DEV_ADDRESS=${env.DEV_ADDRESS}`,
    `DEV_PRIVATE_KEY=${env.DEV_PRIVATE_KEY}`,
    `ATTACKER_ADDRESS=${env.ATTACKER_ADDRESS}`,
    `ATTACKER_PRIVATE_KEY=${env.ATTACKER_PRIVATE_KEY}`,
    '',
  ].join('\n');
  fs.writeFileSync(envPath, content);
}

console.log(JSON.stringify({
  creator: env.CREATOR_ADDRESS,
  dev: env.DEV_ADDRESS,
  attacker: env.ATTACKER_ADDRESS,
}, null, 2));
