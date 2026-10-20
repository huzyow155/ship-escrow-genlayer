const crypto = require('crypto');
const { createAccount } = require('genlayer-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env');

function generateWallet() {
  const privKey = '0x' + crypto.randomBytes(32).toString('hex');
  const acc = createAccount(privKey);
  return { privateKey: privKey, address: acc.address };
}

const creator = generateWallet();
const dev = generateWallet();
const attacker = generateWallet();

const envContent = [
  '# Local throwaway testing wallets for GenLayer Studionet (Git-ignored)',
  `CREATOR_PRIVATE_KEY=${creator.privateKey}`,
  `CREATOR_ADDRESS=${creator.address}`,
  `DEV_PRIVATE_KEY=${dev.privateKey}`,
  `DEV_ADDRESS=${dev.address}`,
  `ATTACKER_PRIVATE_KEY=${attacker.privateKey}`,
  `ATTACKER_ADDRESS=${attacker.address}`,
  '',
].join('\n');

fs.writeFileSync(envPath, envContent);

console.log(JSON.stringify({
  creator: creator.address,
  dev: dev.address,
  attacker: attacker.address,
}, null, 2));
