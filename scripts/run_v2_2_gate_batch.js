const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

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
  fs.readFileSync(path.join(__dirname, 'deploy/deployments_v2_2.json'), 'utf8')
);
const escrowAddress = deployments.escrow.contractAddress;
console.log("Candidate ShipEscrowV2 address:", escrowAddress);

const robustnessDir = path.join(__dirname, '../docs/evidence_v2/robustness_v2_2');
const failuresDir = path.join(robustnessDir, 'failures');
if (!fs.existsSync(robustnessDir)) {
  fs.mkdirSync(robustnessDir, { recursive: true });
}
if (!fs.existsSync(failuresDir)) {
  fs.mkdirSync(failuresDir, { recursive: true });
}

const creatorAccount = createAccount(env.CREATOR_PRIVATE_KEY);
const devAccount = createAccount(env.DEV_PRIVATE_KEY);
console.log("Creator:", creatorAccount.address);
console.log("Dev:    ", devAccount.address);

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
  F5: {
    prNumber: 6,
    critJson: crit1,
    pathsJson: "[]",
    headSha: "b9e099153ea3dd002fc3584a8078d68e974fa427",
    prUrl: "https://github.com/hypercybers99/ship-escrow-fixtures/pull/6",
  },
  F4: {
    prNumber: 5,
    critJson: crit3,
    pathsJson: "[]",
    headSha: "73fbd168b09e75873472a9a2b186d17d30916b17",
    prUrl: "https://github.com/hypercybers99/ship-escrow-fixtures/pull/5",
  },
  F1: {
    prNumber: 2,
    critJson: crit3,
    pathsJson: "[]",
    headSha: "5db0441e76af93606fd82feebbe49c5a2f145326",
    prUrl: "https://github.com/hypercybers99/ship-escrow-fixtures/pull/2",
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
  console.log(`GATE BATCH: ${fixtureId} RUN ${runIndex}/10`);
  console.log(`====================================================`);

  // Spacing before operation: 7 seconds
  await sleep(7000);

  // 1. Creator creates a fresh bounty
  const bTitle = `Gate V2.2 ${fixtureId} Run ${runIndex}`;
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

  // Spacing between create and submit: 7 seconds
  await sleep(7000);

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
    const failPath = path.join(failuresDir, `${fixtureId.toLowerCase()}_run_${runNum}_raw.json`);
    fs.writeFileSync(failPath, JSON.stringify(submitReceipt, null, 2));
    return {
      success: false,
      fixtureId,
      runIndex,
      execResult,
      submitReceipt,
    };
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
    created_at: submitReceipt.created_at || null,
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

  return {
    success: true,
    fixtureId,
    runIndex,
    labels: subRecord.criterion_results,
    verdict: subRecord.verdict,
    payout_pct: subRecord.payout_pct,
    record,
  };
}

async function main() {
  console.log("====================================================");
  console.log("STARTING ADDENDUM 3 GATE BATCH (V2.2 CANDIDATE)");
  console.log("Fixtures order: F5 (10 runs) -> F4 (10 runs) -> F1 (10 runs)");
  console.log("Spacing: 7s per call to conserve GitHub API rate limits");
  console.log("====================================================");

  const results = { F5: [], F4: [], F1: [] };

  for (const fId of ['F5', 'F4', 'F1']) {
    for (let i = 1; i <= 10; i++) {
      try {
        const res = await runSingle(fId, i);
        results[fId].push(res);
      } catch (err) {
        console.error(`Exception in ${fId} Run ${i}:`, err);
        results[fId].push({ success: false, fixtureId: fId, runIndex: i, error: err.message });
      }
    }
  }

  // Summary and Evaluation
  console.log("\n====================================================");
  console.log("GATE BATCH EVALUATION SUMMARY");
  console.log("====================================================");

  let allPass = true;
  const evaluationReport = {};

  for (const fId of ['F5', 'F4', 'F1']) {
    const runs = results[fId];
    const successes = runs.filter(r => r.success);
    const successCount = successes.length;

    // Vector frequency
    const vecCounts = {};
    for (const s of successes) {
      const k = JSON.stringify(s.labels);
      vecCounts[k] = (vecCounts[k] || 0) + 1;
    }
    let modalVec = null;
    let modalCount = 0;
    for (const [vec, cnt] of Object.entries(vecCounts)) {
      if (cnt > modalCount) {
        modalCount = cnt;
        modalVec = vec;
      }
    }

    const successPass = successCount >= 9;
    const labelPass = modalCount >= 9;
    const fixturePass = successPass && labelPass;

    if (!fixturePass) {
      allPass = false;
    }

    evaluationReport[fId] = {
      attempts: 10,
      successes: successCount,
      failures: 10 - successCount,
      modalVector: modalVec,
      modalVectorCount: modalCount,
      successGate: successPass ? "PASS" : "FAIL",
      labelGate: labelPass ? "PASS" : "FAIL",
      overall: fixturePass ? "PASS" : "FAIL",
    };

    console.log(`Fixture ${fId}:`);
    console.log(`  Successes: ${successCount}/10 (${successPass ? "PASS" : "FAIL"})`);
    console.log(`  Modal Vector: ${modalVec} (${modalCount}/10 identical, ${labelPass ? "PASS" : "FAIL"})`);
    console.log(`  Fixture Result: ${fixturePass ? "PASS" : "FAIL"}`);
  }

  const gateOutcome = allPass ? "ADOPT_V2_2" : "REJECT_V2_2_KEEP_V2_1";
  console.log("\n====================================================");
  console.log(`FINAL GATE DECISION: ${gateOutcome}`);
  console.log("====================================================");

  const summary = {
    executedAt: new Date().toISOString(),
    escrowAddress,
    evaluation: evaluationReport,
    gateOutcome,
    adopted: allPass,
  };

  fs.writeFileSync(
    path.join(robustnessDir, 'gate_evaluation_summary.json'),
    JSON.stringify(summary, null, 2)
  );
  console.log("Saved docs/evidence_v2/robustness_v2_2/gate_evaluation_summary.json");
}

main().catch(err => {
  console.error("Gate batch failed:", err);
  process.exit(1);
});
