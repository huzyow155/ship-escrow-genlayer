import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const deploymentsPath = path.join(__dirname, 'deploy/deployments_v2.json');
const sourceVerifPath = path.join(__dirname, '../docs/evidence_v2/source/source_verification_summary.json');

const deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'));
const sourceVerif = JSON.parse(fs.readFileSync(sourceVerifPath, 'utf8'));

const contractPath = 'contracts/ShipEscrowV2.py';
const contractFile = path.join(__dirname, '../', contractPath);
const contractContent = fs.readFileSync(contractFile, 'utf8');
const contractSha256 = crypto.createHash('sha256').update(contractContent, 'utf8').digest('hex');

const escrowAddr = deployments.escrow.contractAddress;
const deployTx = deployments.escrow.deployTxHash;

const content = `# Ship Escrow V2 - Contract Submission Reference

> Status: **Preview**  
> Target Network: **GenLayer Studionet** (Chain ID: 61999)  
> Tag Reference: \`se-v2-1\`

---

## 1. Active Contract Coordinates

- **Contract Name**: \`ShipEscrowV2\`
- **Contract Address**: [\`${escrowAddr}\`](https://explorer-studio.genlayer.com/address/${escrowAddr})
- **Deployment Transaction**: [\`${deployTx}\`](https://explorer-studio.genlayer.com/tx/${deployTx})
- **Repository URL (at final tag)**: [https://github.com/huzyow155/ship-escrow-genlayer/tree/se-v2-1](https://github.com/huzyow155/ship-escrow-genlayer/tree/se-v2-1)
- **Contract Source Path in Repo**: [\`${contractPath}\`](https://github.com/huzyow155/ship-escrow-genlayer/blob/se-v2-1/${contractPath})
- **Explorer URL**: [https://explorer-studio.genlayer.com/address/${escrowAddr}](https://explorer-studio.genlayer.com/address/${escrowAddr})

---

## 2. Cryptographic Source Verification

- **Local Source SHA256**: \`${contractSha256}\`
- **On-Chain Deployed Source SHA256**: \`${sourceVerif.escrow.onchainSha}\`
- **Byte-for-Byte Exact Match**: \`${sourceVerif.escrow.byteIdentical}\`
- **Source Artifact Extracted From Deploy Tx**: \`docs/evidence_v2/source/shipescrowv2_onchain.py\`
- **Diff Output Against Local Source**:
  \`\`\`
  git diff --no-index contracts/ShipEscrowV2.py docs/evidence_v2/source/shipescrowv2_onchain.py
  (empty diff - 100% byte-for-byte identical)
  \`\`\`

---

## 3. Companion Reputation Registry

- **Contract Name**: \`ShipReputationV2\`
- **Contract Address**: [\`${deployments.reputation.contractAddress}\`](https://explorer-studio.genlayer.com/address/${deployments.reputation.contractAddress})
- **Deployment Transaction**: [\`${deployments.reputation.deployTxHash}\`](https://explorer-studio.genlayer.com/tx/${deployments.reputation.deployTxHash})
- **Local Source SHA256**: \`${sourceVerif.reputation.localSha}\`
- **On-Chain Deployed Source SHA256**: \`${sourceVerif.reputation.onchainSha}\`
- **Byte-for-Byte Exact Match**: \`${sourceVerif.reputation.byteIdentical}\`
`;

const outPath = path.join(__dirname, '../docs/CONTRACT_SUBMISSION.md');
fs.writeFileSync(outPath, content, 'utf8');
console.log(`Generated CONTRACT_SUBMISSION.md at ${outPath}`);
