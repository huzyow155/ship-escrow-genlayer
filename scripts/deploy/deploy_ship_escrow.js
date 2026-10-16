const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const { createClient, chains, createAccount } = require('genlayer-js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

async function main() {
  console.log("====================================================");
  console.log("DEPLOYING SHIPESCROW CONTRACT TO GENLAYER STUDIONET");
  console.log("====================================================");

  const account = createAccount();
  console.log("Deployer address:", account.address);

  const client = createClient({
    chain: chains.studionet,
    account: account,
  });

  const codePath = path.join(__dirname, '../../contracts/ShipEscrow.py');
  const code = fs.readFileSync(codePath, 'utf8');
  const sourceSha256 = crypto.createHash('sha256').update(code, 'utf8').digest('hex');
  console.log("Local ShipEscrow source sha256:", sourceSha256);

  const t0 = Date.now();
  const deployTxHash = await client.deployContract({
    code: code,
    args: [],
  });
  console.log("Deploy Tx Hash:", deployTxHash);

  const receipt = await client.waitForTransactionReceipt({
    hash: deployTxHash,
    retries: 120,
    interval: 3000,
  });
  const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
  console.log(`Deploy completed in ${elapsed}s`);
  console.log("  status_name:", receipt.status_name);
  console.log("  result_name:", receipt.result_name);
  const leaderReceipt = receipt.consensus_data?.leader_receipt?.[0];
  console.log("  leader execution_result:", leaderReceipt?.execution_result);
  const contractAddress = receipt.recipient;
  console.log("Deployed ShipEscrow Address:", contractAddress);

  if (!contractAddress || leaderReceipt?.execution_result !== 'SUCCESS') {
    throw new Error("ShipEscrow deployment failed: " + JSON.stringify(receipt));
  }

  const deployments = {
    network: "GenLayer Studionet",
    chainId: 61999,
    rpc: "https://studio.genlayer.com/api",
    explorerBase: "https://explorer-studio.genlayer.com",
    contractAddress: contractAddress,
    deployTxHash: deployTxHash,
    deployStatus: receipt.status_name,
    consensusResult: receipt.result_name,
    executionResult: leaderReceipt.execution_result,
    sourceFile: "contracts/ShipEscrow.py",
    sourceSha256: sourceSha256,
    explorerUrl: `https://explorer-studio.genlayer.com/address/${contractAddress}`,
    deployedAt: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.join(__dirname, 'deployments.json'),
    JSON.stringify(deployments, null, 2)
  );
  console.log("Updated scripts/deploy/deployments.json");

  // Save raw deploy receipt
  osMkdir('docs/evidence');
  fs.writeFileSync(
    path.join(__dirname, '../../docs/evidence/deploy_receipt.json'),
    JSON.stringify(receipt, null, 2)
  );
  console.log("Saved docs/evidence/deploy_receipt.json");
}

function osMkdir(dirPath) {
  const full = path.join(__dirname, '../../', dirPath);
  if (!fs.existsSync(full)) {
    fs.mkdirSync(full, { recursive: true });
  }
}

main().catch(err => {
  console.error("Deploy failed:", err);
  process.exit(1);
});
