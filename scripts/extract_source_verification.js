const { createClient, chains } = require('genlayer-js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const sourceDir = path.join(__dirname, '../docs/evidence_v2/source');
if (!fs.existsSync(sourceDir)) {
  fs.mkdirSync(sourceDir, { recursive: true });
}

const deployments = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'deploy/deployments_v2.json'), 'utf8')
);

const client = createClient({ chain: chains.studionet });

async function verifyContract(name, txHash, localRelPath) {
  console.log(`\n====================================================`);
  console.log(`VERIFYING SOURCE FOR ${name}`);
  console.log(`Tx Hash: ${txHash}`);
  console.log(`====================================================`);

  const tx = await client.getTransaction({ hash: txHash });
  const rawTxPath = path.join(sourceDir, `${name.toLowerCase()}_deploy_tx.json`);
  fs.writeFileSync(rawTxPath, JSON.stringify(tx, null, 2));
  console.log(`Saved raw deploy transaction payload: ${rawTxPath}`);

  const decodedSource = Buffer.from(tx.data.contract_code, 'base64').toString('utf8');
  const extractedPath = path.join(sourceDir, `${name.toLowerCase()}_onchain.py`);
  fs.writeFileSync(extractedPath, decodedSource);
  console.log(`Saved extracted on-chain source: ${extractedPath}`);

  const localPath = path.join(__dirname, '..', localRelPath);
  const localSource = fs.readFileSync(localPath, 'utf8');

  const localSha = crypto.createHash('sha256').update(localSource, 'utf8').digest('hex');
  const onchainSha = crypto.createHash('sha256').update(decodedSource, 'utf8').digest('hex');

  console.log(`Local  SHA256: ${localSha}`);
  console.log(`OnChain SHA256: ${onchainSha}`);

  // Run diff command
  let diffOutput = "";
  try {
    diffOutput = execSync(`git diff --no-index "${localPath}" "${extractedPath}"`, { encoding: 'utf8' });
  } catch (err) {
    diffOutput = err.stdout || err.stderr || err.message;
  }

  const isEmpty = diffOutput.trim() === "";
  console.log(`Diff empty: ${isEmpty}`);
  if (!isEmpty) {
    console.log("Diff output:\n" + diffOutput);
  } else {
    console.log("Raw diff output: (EMPTY - BYTE-FOR-BYTE IDENTICAL)");
  }

  return {
    name,
    txHash,
    localSha,
    onchainSha,
    byteIdentical: isEmpty && localSha === onchainSha,
  };
}

async function main() {
  const escrowRes = await verifyContract('ShipEscrowV2', deployments.escrow.deployTxHash, 'contracts/ShipEscrowV2.py');
  const repRes = await verifyContract('ShipReputationV2', deployments.reputation.deployTxHash, 'contracts/ShipReputationV2.py');

  const resultSummary = {
    verified_at: new Date().toISOString(),
    escrow: escrowRes,
    reputation: repRes,
  };

  const summaryPath = path.join(sourceDir, 'source_verification_summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(resultSummary, null, 2));
  console.log(`\nSummary saved to ${summaryPath}`);
}

main().catch(err => {
  console.error("Verification failed:", err);
  process.exit(1);
});
