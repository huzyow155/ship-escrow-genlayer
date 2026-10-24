import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const deploymentsPath = path.join(__dirname, 'deploy/deployments_v2.json');
const sourceVerifPath = path.join(__dirname, '../docs/evidence_v2/source/source_verification_summary.json');

const deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'));
const sourceVerif = JSON.parse(fs.readFileSync(sourceVerifPath, 'utf8'));

const contractPath = 'contracts/ShipEscrowV2.py';
const contractFile = path.join(__dirname, '../', contractPath);
const contractBytes = fs.readFileSync(contractFile);
const contractSha256 = crypto.createHash('sha256').update(contractBytes).digest('hex');

const onchainFile = path.join(__dirname, '../docs/evidence_v2/source/shipescrowv2_onchain.py');
const onchainBytes = fs.readFileSync(onchainFile);
const onchainSha256 = crypto.createHash('sha256').update(onchainBytes).digest('hex');

const repPath = 'contracts/ShipReputationV2.py';
const repFile = path.join(__dirname, '../', repPath);
const repBytes = fs.readFileSync(repFile);
const repSha256 = crypto.createHash('sha256').update(repBytes).digest('hex');

const repOnchainFile = path.join(__dirname, '../docs/evidence_v2/source/shipreputationv2_onchain.py');
const repOnchainBytes = fs.readFileSync(repOnchainFile);
const repOnchainSha256 = crypto.createHash('sha256').update(repOnchainBytes).digest('hex');

let diffOutput = '';
try {
  diffOutput = execSync(`git diff --no-index contracts/ShipEscrowV2.py docs/evidence_v2/source/shipescrowv2_onchain.py`, {
    encoding: 'utf8',
    cwd: path.join(__dirname, '..')
  });
} catch (e) {
  diffOutput = e.stdout || e.message;
}

const escrowAddr = deployments.escrow.contractAddress;
const deployTx = deployments.escrow.deployTxHash;
const repAddr = deployments.reputation.contractAddress;
const repDeployTx = deployments.reputation.deployTxHash;

const tag = 'se-v2-4';
const owner = 'hypercybers99';

const content = `# Ship Escrow V2 - Contract Submission Reference

> Status: **Preview**  
> Target Network: **GenLayer Studionet** (Chain ID: 61999)  
> Tag Reference: \`${tag}\`

---

## 1. Active Contract Coordinates

- **Contract Name**: \`ShipEscrowV2\`
- **Contract Address**: [\`${escrowAddr}\`](https://explorer-studio.genlayer.com/address/${escrowAddr})
- **Deployment Transaction**: [\`${deployTx}\`](https://explorer-studio.genlayer.com/tx/${deployTx})
- **Repository URL (at final tag)**: [https://github.com/${owner}/ship-escrow-genlayer/tree/${tag}](https://github.com/${owner}/ship-escrow-genlayer/tree/${tag})
- **Contract Source Path in Repo**: [\`${contractPath}\`](https://github.com/${owner}/ship-escrow-genlayer/blob/${tag}/${contractPath})
- **Explorer URL**: [https://explorer-studio.genlayer.com/address/${escrowAddr}](https://explorer-studio.genlayer.com/address/${escrowAddr})

---

## 2. Source Verification

- **Local Source SHA256**: \`${contractSha256}\`
- **On-Chain Deployed Source SHA256**: \`${onchainSha256}\`
- **Byte-for-Byte Exact Match**: \`${contractSha256 === onchainSha256}\`
- **Source Artifact Extracted From Deploy Tx**: \`docs/evidence_v2/source/shipescrowv2_onchain.py\`
- **Diff Output Against Local Source**:
  \`\`\`
  git diff --no-index contracts/ShipEscrowV2.py docs/evidence_v2/source/shipescrowv2_onchain.py
  ${diffOutput.trim() || '(empty diff - 100% byte-for-byte identical)'}
  \`\`\`

---

## 3. Companion Reputation Registry

- **Contract Name**: \`ShipReputationV2\`
- **Contract Address**: [\`${repAddr}\`](https://explorer-studio.genlayer.com/address/${repAddr})
- **Deployment Transaction**: [\`${repDeployTx}\`](https://explorer-studio.genlayer.com/tx/${repDeployTx})
- **Local Source SHA256**: \`${repSha256}\`
- **On-Chain Deployed Source SHA256**: \`${repOnchainSha256}\`
- **Byte-for-Byte Exact Match**: \`${repSha256 === repOnchainSha256}\`
- **Source Artifact Extracted From Deploy Tx**: \`docs/evidence_v2/source/shipreputationv2_onchain.py\`
`;

const outPath = path.join(__dirname, '../docs/CONTRACT_SUBMISSION.md');
fs.writeFileSync(outPath, content, 'utf8');
console.log(`Generated CONTRACT_SUBMISSION.md at ${outPath}`);
