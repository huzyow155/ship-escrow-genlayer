const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const { createClient, chains, createAccount } = require('genlayer-js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

async function main() {
  console.log("====================================================");
  console.log("DEPLOYING SHIP ESCROW V2.2 CANDIDATE CONTRACTS");
  console.log("====================================================");

  const account = createAccount();
  console.log("Deployer address:", account.address);

  const client = createClient({
    chain: chains.studionet,
    account: account,
  });

  const evidenceDir = path.join(__dirname, '../../docs/evidence_v2');
  if (!fs.existsSync(evidenceDir)) {
    fs.mkdirSync(evidenceDir, { recursive: true });
  }

  // 1. Deploy ShipEscrowV2 (Candidate V2.2)
  console.log("\n--- Deploying ShipEscrowV2 (V2.2 Candidate) ---");
  const escrowPath = path.join(__dirname, '../../contracts/ShipEscrowV2.py');
  const escrowCode = fs.readFileSync(escrowPath, 'utf8');
  const escrowLocalSha256 = crypto.createHash('sha256').update(escrowCode, 'utf8').digest('hex');
  console.log("Local ShipEscrowV2 sha256:", escrowLocalSha256);

  const t0 = Date.now();
  const escrowDeployTx = await client.deployContract({
    code: escrowCode,
    args: [],
  });
  console.log("ShipEscrowV2 Deploy Tx Hash:", escrowDeployTx);

  const escrowReceipt = await client.waitForTransactionReceipt({
    hash: escrowDeployTx,
    retries: 120,
    interval: 3000,
  });
  const escrowElapsed = ((Date.now() - t0) / 1000).toFixed(2);
  console.log(`Deploy completed in ${escrowElapsed}s`);
  console.log("  status_name:", escrowReceipt.status_name);
  console.log("  result_name:", escrowReceipt.result_name);
  const escrowLeaderReceipt = escrowReceipt.consensus_data?.leader_receipt?.[0];
  console.log("  leader execution_result:", escrowLeaderReceipt?.execution_result);
  const escrowAddress = escrowReceipt.recipient;
  console.log("Deployed ShipEscrowV2 Candidate Address:", escrowAddress);

  if (!escrowAddress || escrowLeaderReceipt?.execution_result !== 'SUCCESS') {
    throw new Error("ShipEscrowV2 deployment failed: " + JSON.stringify(escrowReceipt));
  }

  fs.writeFileSync(
    path.join(evidenceDir, 'deploy_ship_escrow_v2_2_receipt.json'),
    JSON.stringify(escrowReceipt, null, 2)
  );
  console.log("Saved docs/evidence_v2/deploy_ship_escrow_v2_2_receipt.json");

  // 2. Deploy ShipReputationV2 (Candidate V2.2 bound to new escrow)
  console.log("\n--- Deploying ShipReputationV2 (V2.2 Candidate) ---");
  const repPath = path.join(__dirname, '../../contracts/ShipReputationV2.py');
  const repCode = fs.readFileSync(repPath, 'utf8');
  const repLocalSha256 = crypto.createHash('sha256').update(repCode, 'utf8').digest('hex');
  console.log("Local ShipReputationV2 sha256:", repLocalSha256);

  const t1 = Date.now();
  const repDeployTx = await client.deployContract({
    code: repCode,
    args: [escrowAddress],
  });
  console.log("ShipReputationV2 Deploy Tx Hash:", repDeployTx);

  const repReceipt = await client.waitForTransactionReceipt({
    hash: repDeployTx,
    retries: 120,
    interval: 3000,
  });
  const repElapsed = ((Date.now() - t1) / 1000).toFixed(2);
  console.log(`Deploy completed in ${repElapsed}s`);
  console.log("  status_name:", repReceipt.status_name);
  console.log("  result_name:", repReceipt.result_name);
  const repLeaderReceipt = repReceipt.consensus_data?.leader_receipt?.[0];
  console.log("  leader execution_result:", repLeaderReceipt?.execution_result);
  const repAddress = repReceipt.recipient;
  console.log("Deployed ShipReputationV2 Candidate Address:", repAddress);

  if (!repAddress || repLeaderReceipt?.execution_result !== 'SUCCESS') {
    throw new Error("ShipReputationV2 deployment failed: " + JSON.stringify(repReceipt));
  }

  fs.writeFileSync(
    path.join(evidenceDir, 'deploy_ship_reputation_v2_2_receipt.json'),
    JSON.stringify(repReceipt, null, 2)
  );
  console.log("Saved docs/evidence_v2/deploy_ship_reputation_v2_2_receipt.json");

  // Save deployment records
  const deploymentsV2_2 = {
    network: "GenLayer Studionet",
    chainId: 61999,
    rpc: "https://studio.genlayer.com/api",
    explorerBase: "https://explorer-studio.genlayer.com",
    deployedAt: new Date().toISOString(),
    escrow: {
      contractAddress: escrowAddress,
      deployTxHash: escrowDeployTx,
      deployStatus: escrowReceipt.status_name,
      consensusResult: escrowReceipt.result_name,
      executionResult: escrowLeaderReceipt.execution_result,
      sourceFile: "contracts/ShipEscrowV2.py",
      sourceSha256: escrowLocalSha256,
      explorerUrl: `https://explorer-studio.genlayer.com/address/${escrowAddress}`,
    },
    reputation: {
      contractAddress: repAddress,
      deployTxHash: repDeployTx,
      deployStatus: repReceipt.status_name,
      consensusResult: repReceipt.result_name,
      executionResult: repLeaderReceipt.execution_result,
      sourceFile: "contracts/ShipReputationV2.py",
      sourceSha256: repLocalSha256,
      explorerUrl: `https://explorer-studio.genlayer.com/address/${repAddress}`,
      escrowAddress: escrowAddress,
    },
  };

  const depOutPath = path.join(__dirname, 'deployments_v2_2.json');
  fs.writeFileSync(depOutPath, JSON.stringify(deploymentsV2_2, null, 2));
  console.log("Saved scripts/deploy/deployments_v2_2.json");

  // 3. Source Verification (decode deploy tx payload from studionet)
  console.log("\n====================================================");
  console.log("VERIFYING DEPLOYED SOURCE CODE BYTE-FOR-BYTE");
  console.log("====================================================");

  async function verifyTx(name, txHash, localCode, expectedSha) {
    console.log(`\nVerifying ${name}...`);
    const rpcRes = await fetch("https://studio.genlayer.com/api", {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getTransactionByHash',
        params: [txHash],
      }),
    });
    const rpcJson = await rpcRes.json();
    const b64 = rpcJson.result?.data?.contract_code;
    if (!b64) {
      throw new Error(`No data.contract_code in tx ${txHash}`);
    }
    const decoded = Buffer.from(b64, 'base64').toString('utf8');
    const onchainSha = crypto.createHash('sha256').update(decoded, 'utf8').digest('hex');
    const isMatch = (onchainSha === expectedSha && decoded === localCode);
    console.log(`  Deploy tx hash: ${txHash}`);
    console.log(`  Local sha256:   ${expectedSha}`);
    console.log(`  On-chain sha256:${onchainSha}`);
    console.log(`  Byte-for-byte exact match: ${isMatch}`);

    return {
      txData: rpcJson.result,
      decodedSource: decoded,
      verification: {
        contract: name,
        deployTxHash: txHash,
        localSha256: expectedSha,
        onchainSha256: onchainSha,
        byteIdentical: isMatch,
        diffEmpty: (decoded === localCode),
      }
    };
  }

  const verEscrow = await verifyTx('ShipEscrowV2', escrowDeployTx, escrowCode, escrowLocalSha256);
  const verRep = await verifyTx('ShipReputationV2', repDeployTx, repCode, repLocalSha256);

  fs.writeFileSync(
    path.join(__dirname, 'verification_v2_2_result.json'),
    JSON.stringify({ escrow: verEscrow.verification, reputation: verRep.verification }, null, 2)
  );
  console.log("Saved scripts/deploy/verification_v2_2_result.json");

  // Save candidate source artifacts
  const candidateSourceDir = path.join(evidenceDir, 'source_v2_2');
  if (!fs.existsSync(candidateSourceDir)) {
    fs.mkdirSync(candidateSourceDir, { recursive: true });
  }
  fs.writeFileSync(path.join(candidateSourceDir, 'shipescrowv2_deploy_tx.json'), JSON.stringify(verEscrow.txData, null, 2));
  fs.writeFileSync(path.join(candidateSourceDir, 'shipescrowv2_onchain.py'), verEscrow.decodedSource);
  fs.writeFileSync(path.join(candidateSourceDir, 'shipreputationv2_deploy_tx.json'), JSON.stringify(verRep.txData, null, 2));
  fs.writeFileSync(path.join(candidateSourceDir, 'shipreputationv2_onchain.py'), verRep.decodedSource);
  fs.writeFileSync(path.join(candidateSourceDir, 'source_verification_summary.json'), JSON.stringify({
    escrow: verEscrow.verification,
    reputation: verRep.verification,
  }, null, 2));
  console.log("Saved candidate source artifacts in docs/evidence_v2/source_v2_2/");
}

main().catch(err => {
  console.error("Deploy/Verify failed:", err);
  process.exit(1);
});
