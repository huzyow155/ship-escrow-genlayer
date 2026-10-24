const { createClient, chains, createAccount } = require('genlayer-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env');
const env = {};
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

const deployments = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'deploy/deployments_v2.json'), 'utf8')
);
const escrowAddress = deployments.escrow.contractAddress;
const robustnessDir = path.join(__dirname, '../docs/evidence_v2/robustness');
const failuresDir = path.join(__dirname, '../docs/evidence_v2/robustness_failures');

const creatorAccount = createAccount(env.CREATOR_PRIVATE_KEY);
const devAccount = createAccount(env.DEV_PRIVATE_KEY);

const client = createClient({ chain: chains.studionet });

const crit3 = JSON.stringify([
  { level: "MUST", text: "Implement slugify in src/slug.py" },
  { level: "MUST", text: "Add unit tests in tests/test_slug.py" },
  { level: "SHOULD", text: "Update README with usage example" }
]);
const crit1 = JSON.stringify([
  { level: "MUST", text: "Implement slugify in src/slug.py" }
]);

const fixtureConfigs = {
  F1: {
    prNumber: 2,
    critJson: crit3,
    pathsJson: "[]",
    headSha: "5db0441e76af93606fd82feebbe49c5a2f145326",
    prUrl: "https://github.com/hypercybers99/ship-escrow-fixtures/pull/2",
  },
  F4: {
    prNumber: 5,
    critJson: crit3,
    pathsJson: "[]",
    headSha: "73fbd168b09e75873472a9a2b186d17d30916b17",
    prUrl: "https://github.com/hypercybers99/ship-escrow-fixtures/pull/5",
  },
  F5: {
    prNumber: 6,
    critJson: crit1,
    pathsJson: "[]",
    headSha: "b9e099153ea3dd002fc3584a8078d68e974fa427",
    prUrl: "https://github.com/hypercybers99/ship-escrow-fixtures/pull/6",
  },
};

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function waitForTx(txHash, label) {
  console.log(`Waiting for ${label} tx ${txHash}...`);
  for (let attempt = 1; attempt <= 60; attempt++) {
    await sleep(3000);
    try {
      const tx = await client.getTransaction({ hash: txHash });
      const statusName = tx.statusName || String(tx.status);
      const execRes = tx.consensus_data?.leader_receipt?.[0]?.execution_result;
      const resultName = tx.result_name || String(tx.result);
      if (statusName === 'ACCEPTED' || statusName === 'FINALIZED') {
        console.log(`[${label}] Completed: status=${statusName}, result=${resultName}, exec=${execRes}`);
        return tx;
      }
    } catch (err) {
      console.warn(`[${label}] poll attempt ${attempt} warning:`, err.message || err);
    }
  }
  throw new Error(`Timeout waiting for tx ${txHash}`);
}

async function runSingle(fixtureId, runIndex) {
  const cfg = fixtureConfigs[fixtureId];
  const runNum = String(runIndex).padStart(2, '0');
  console.log(`\n====================================================`);
  console.log(`EXECUTING ${fixtureId} RUN ${runIndex}/10`);
  console.log(`====================================================`);

  // 1. Creator creates a fresh bounty
  const bTitle = `Robustness ${fixtureId} Run ${runIndex}`;
  console.log(`1. Creating bounty "${bTitle}"...`);
  const createTx = await client.writeContract({
    account: creatorAccount,
    address: escrowAddress,
    functionName: 'create_bounty',
    args: [bTitle, "hypercybers99/ship-escrow-fixtures", cfg.critJson, cfg.pathsJson, "10"]
  });
  const createReceipt = await waitForTx(createTx, `${fixtureId} Create Run ${runNum}`);

  const recentsRaw = await client.readContract({
    address: escrowAddress,
    functionName: 'list_bounties',
    args: [1]
  });
  const bountyId = recentsRaw[0];
  console.log(`   Created Bounty ID: ${bountyId}`);

  await sleep(4000);

  // 2. Dev submits work
  console.log(`2. Dev submitting work to Bounty ${bountyId}...`);
  const submitTx = await client.writeContract({
    account: devAccount,
    address: escrowAddress,
    functionName: 'submit_work',
    args: [bountyId, cfg.prUrl, cfg.headSha]
  });
  const submitReceipt = await waitForTx(submitTx, `${fixtureId} Submit Run ${runNum}`);
  const execResult = submitReceipt.consensus_data?.leader_receipt?.[0]?.execution_result;

  if (execResult !== 'SUCCESS') {
    console.error(`[FAIL] ${fixtureId} Run ${runIndex} failed with execResult=${execResult}`);
    // Save to failure dir
    const failPath = path.join(failuresDir, `addendum2_${fixtureId.toLowerCase()}_run_${runNum}_raw.json`);
    fs.writeFileSync(failPath, JSON.stringify(submitReceipt, null, 2));
    return false;
  }

  await sleep(3000);

  // 3. Read back on-chain submission
  const subsList = await client.readContract({
    address: escrowAddress,
    functionName: 'list_submissions',
    args: [bountyId]
  });
  const subId = subsList[0];
  let subRecord = {};
  if (subId) {
    const rawSub = await client.readContract({
      address: escrowAddress,
      functionName: 'get_submission',
      args: [subId]
    });
    subRecord = JSON.parse(rawSub);
  }

  const record = {
    fixture_id: fixtureId,
    run_index: runIndex,
    bounty_id: bountyId,
    submission_id: subId || null,
    pr_url: cfg.prUrl,
    head_sha: cfg.headSha,
    create_tx_hash: createTx,
    create_receipt_status: createReceipt.statusName,
    submit_tx_hash: submitTx,
    submit_receipt: {
      status_name: submitReceipt.statusName,
      result_name: submitReceipt.result_name,
      execution_result: execResult,
      votes: submitReceipt.consensus_data?.votes,
    },
    on_chain_submission: subRecord,
    packet_sha256: subRecord.packet_sha256,
  };

  const outPath = path.join(robustnessDir, `${fixtureId.toLowerCase()}_run_${runNum}.json`);
  fs.writeFileSync(outPath, JSON.stringify(record, null, 2), 'utf8');
  console.log(`[SUCCESS] Saved ${fixtureId} Run ${runIndex} to ${outPath}`);
  console.log(`   Verdict: ${subRecord.verdict}, Payout: ${subRecord.payout_pct}%, Labels: ${JSON.stringify(subRecord.criterion_results)}`);
  return true;
}

async function main() {
  console.log("====================================================");
  console.log("ROBUSTNESS V2 ADDENDUM 2: 10 SUCCESSFUL RUNS BATCH");
  console.log(`Active Escrow: ${escrowAddress}`);
  console.log("====================================================");

  for (const fId of ['F5', 'F4', 'F1']) {
    for (let i = 1; i <= 10; i++) {
      const runNum = String(i).padStart(2, '0');
      const outPath = path.join(robustnessDir, `${fId.toLowerCase()}_run_${runNum}.json`);
      if (fs.existsSync(outPath)) {
        const existing = JSON.parse(fs.readFileSync(outPath, 'utf8'));
        if (existing.submit_receipt?.execution_result === 'SUCCESS') {
          console.log(`[SKIP] ${fId} Run ${i} already SUCCESS in ${outPath}`);
          continue;
        }
      }

      let success = false;
      for (let retry = 1; retry <= 3; retry++) {
        try {
          success = await runSingle(fId, i);
          if (success) break;
        } catch (err) {
          console.error(`Error on ${fId} Run ${i} attempt ${retry}:`, err.message || err);
        }
        console.log(`Backing off 10s before retry...`);
        await sleep(10000);
      }

      if (!success) {
        console.error(`Failed to achieve success for ${fId} Run ${i} after retries.`);
      }

      // Space out runs by 6 seconds to respect validator and external limits
      await sleep(6000);
    }
  }

  console.log("\n====================================================");
  console.log("ALL BATCHES FINISHED");
  console.log("====================================================");
}

main().catch(err => {
  console.error("Batch failure:", err);
  process.exit(1);
});
