const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const { createClient, chains, createAccount } = require('genlayer-js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

async function main() {
  console.log("====================================================");
  console.log("DEPLOYING PROBE CONTRACT (V2) TO GENLAYER STUDIONET");
  console.log("====================================================");

  const account = createAccount();
  console.log("Deployer address:", account.address);

  const client = createClient({
    chain: chains.studionet,
    account: account,
  });

  const codePath = path.join(__dirname, '../../contracts/Probe.py');
  const code = fs.readFileSync(codePath, 'utf8');
  const sourceSha256 = crypto.createHash('sha256').update(code, 'utf8').digest('hex');
  console.log("Local Probe source sha256:", sourceSha256);

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
  console.log("Deployed Probe Address:", contractAddress);

  if (!contractAddress || leaderReceipt?.execution_result !== 'SUCCESS') {
    throw new Error("Probe deployment failed: " + JSON.stringify(receipt));
  }

  // Save probe deployment info
  const probeInfo = {
    probeAddress: contractAddress,
    deployTxHash: deployTxHash,
    deployStatus: receipt.status_name,
    consensusResult: receipt.result_name,
    sourceSha256: sourceSha256,
    deployedAt: new Date().toISOString(),
  };

  const outPath = path.join(__dirname, 'probe_v2_deployment.json');
  fs.writeFileSync(outPath, JSON.stringify(probeInfo, null, 2));
  console.log("Saved probe deployment info to", outPath);

  // =========================================================================
  // Now run the V2 probes
  // =========================================================================
  console.log("\n====================================================");
  console.log("RUNNING V2 PROBES");
  console.log("====================================================");

  const probeResults = {};

  // Probe (a): GitHub API - single fetch
  console.log("\n--- Probe (a): GitHub API single fetch ---");
  try {
    const txA = await client.writeContract({
      address: contractAddress,
      functionName: 'probe_github_api',
      args: ['huzyow155', 'ship-escrow-fixtures', '2', 'api_single'],
    });
    console.log("probe_github_api tx:", txA);
    const rA = await client.waitForTransactionReceipt({ hash: txA, retries: 120, interval: 3000 });
    console.log("  status_name:", rA.status_name, "result_name:", rA.result_name);
    const lrA = rA.consensus_data?.leader_receipt?.[0];
    console.log("  execution_result:", lrA?.execution_result);
    probeResults.api_single_receipt = rA;
    if (lrA?.execution_result === 'SUCCESS') {
      const val = await client.readContract({ address: contractAddress, functionName: 'get_result', args: ['api_single'] });
      console.log("  Result:", val);
      probeResults.api_single = JSON.parse(val);
    }
  } catch (e) {
    console.log("  ERROR:", e.message);
    probeResults.api_single_error = e.message;
  }

  // Probe (a): GitHub API - batch 10
  console.log("\n--- Probe (a): GitHub API batch 10 ---");
  try {
    const txBatch = await client.writeContract({
      address: contractAddress,
      functionName: 'probe_github_api_batch',
      args: ['huzyow155', 'ship-escrow-fixtures', '2'],
    });
    console.log("probe_github_api_batch tx:", txBatch);
    const rBatch = await client.waitForTransactionReceipt({ hash: txBatch, retries: 120, interval: 3000 });
    console.log("  status_name:", rBatch.status_name, "result_name:", rBatch.result_name);
    const lrBatch = rBatch.consensus_data?.leader_receipt?.[0];
    console.log("  execution_result:", lrBatch?.execution_result);
    probeResults.api_batch_receipt = rBatch;
    if (lrBatch?.execution_result === 'SUCCESS') {
      const val = await client.readContract({ address: contractAddress, functionName: 'get_result', args: ['api_batch_10'] });
      console.log("  Result:", val);
      probeResults.api_batch = JSON.parse(val);
    } else {
      // Capture failure detail
      const failPayload = lrBatch?.result;
      console.log("  Failure payload:", JSON.stringify(failPayload));
      probeResults.api_batch_failure = failPayload;
    }
  } catch (e) {
    console.log("  ERROR:", e.message);
    probeResults.api_batch_error = e.message;
  }

  // Probe (b): compare-by-sha diff
  // We need real base_sha and head_sha for a PR in fixtures repo
  // PR #2 in ship-escrow-fixtures - we need to know the SHAs
  // First let's get the head_sha from the API result
  let headSha = '';
  let baseSha = '';
  if (probeResults.api_single && probeResults.api_single.head_sha) {
    headSha = probeResults.api_single.head_sha;
    baseSha = probeResults.api_single.base_sha;
  }

  if (headSha && baseSha) {
    console.log("\n--- Probe (b): Compare-by-SHA diff ---");
    console.log("  base_sha:", baseSha);
    console.log("  head_sha:", headSha);
    try {
      const txC = await client.writeContract({
        address: contractAddress,
        functionName: 'probe_compare_sha_diff',
        args: ['huzyow155', 'ship-escrow-fixtures', baseSha, headSha],
      });
      console.log("probe_compare_sha_diff tx:", txC);
      const rC = await client.waitForTransactionReceipt({ hash: txC, retries: 120, interval: 3000 });
      console.log("  status_name:", rC.status_name, "result_name:", rC.result_name);
      const lrC = rC.consensus_data?.leader_receipt?.[0];
      console.log("  execution_result:", lrC?.execution_result);
      probeResults.compare_sha_diff_receipt = rC;
      if (lrC?.execution_result === 'SUCCESS') {
        const val = await client.readContract({ address: contractAddress, functionName: 'get_result', args: ['compare_sha_diff'] });
        console.log("  Result:", val);
        probeResults.compare_sha_diff = JSON.parse(val);
      }
    } catch (e) {
      console.log("  ERROR:", e.message);
      probeResults.compare_sha_diff_error = e.message;
    }

    // Probe (b): compare vs PR diff
    console.log("\n--- Probe (b): Compare SHA diff vs PR diff ---");
    try {
      const txD = await client.writeContract({
        address: contractAddress,
        functionName: 'probe_compare_vs_pr_diff',
        args: ['huzyow155', 'ship-escrow-fixtures', '2', baseSha, headSha],
      });
      console.log("probe_compare_vs_pr_diff tx:", txD);
      const rD = await client.waitForTransactionReceipt({ hash: txD, retries: 120, interval: 3000 });
      console.log("  status_name:", rD.status_name, "result_name:", rD.result_name);
      const lrD = rD.consensus_data?.leader_receipt?.[0];
      console.log("  execution_result:", lrD?.execution_result);
      probeResults.compare_vs_pr_diff_receipt = rD;
      if (lrD?.execution_result === 'SUCCESS') {
        const val = await client.readContract({ address: contractAddress, functionName: 'get_result', args: ['compare_vs_pr_diff'] });
        console.log("  Result:", val);
        probeResults.compare_vs_pr_diff = JSON.parse(val);
      }
    } catch (e) {
      console.log("  ERROR:", e.message);
      probeResults.compare_vs_pr_diff_error = e.message;
    }
  } else {
    console.log("\n--- Probe (b): SKIPPED (no head/base SHA from API probe) ---");
    probeResults.compare_skipped = "No head/base SHA available from API probe";
  }

  // Probe (c): timestamp
  console.log("\n--- Probe (c): Timestamp ---");
  try {
    const txT = await client.writeContract({
      address: contractAddress,
      functionName: 'probe_timestamp',
      args: [],
    });
    console.log("probe_timestamp tx:", txT);
    const rT = await client.waitForTransactionReceipt({ hash: txT, retries: 120, interval: 3000 });
    console.log("  status_name:", rT.status_name, "result_name:", rT.result_name);
    const lrT = rT.consensus_data?.leader_receipt?.[0];
    console.log("  execution_result:", lrT?.execution_result);
    probeResults.timestamp_receipt = rT;
    if (lrT?.execution_result === 'SUCCESS') {
      const val = await client.readContract({ address: contractAddress, functionName: 'get_result', args: ['timestamp_probe'] });
      console.log("  Result:", val);
      probeResults.timestamp = JSON.parse(val);
    } else {
      const failPayload = lrT?.result;
      console.log("  Failure payload:", JSON.stringify(failPayload));
      probeResults.timestamp_failure = failPayload;
    }
  } catch (e) {
    console.log("  ERROR:", e.message);
    probeResults.timestamp_error = e.message;
  }

  // Save all probe results
  const outResultsPath = path.join(__dirname, 'probe_v2_results.json');
  fs.writeFileSync(outResultsPath, JSON.stringify(probeResults, null, 2));
  console.log("\n====================================================");
  console.log("All V2 probe results saved to", outResultsPath);
  console.log("====================================================");
}

main().catch(err => {
  console.error("Probe failed:", err);
  process.exit(1);
});
