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
if (!fs.existsSync(robustnessDir)) {
  fs.mkdirSync(robustnessDir, { recursive: true });
}

const creatorAccount = createAccount(env.CREATOR_PRIVATE_KEY);
const devAccount = createAccount(env.DEV_PRIVATE_KEY);

const creatorClient = createClient({ chain: chains.studionet, account: creatorAccount });
const devClient = createClient({ chain: chains.studionet, account: devAccount });

const fixtures = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../fixtures/fixtures_v2.json'), 'utf8')
);

const crit3 = JSON.stringify([
  { level: "MUST", text: "Implement slugify in src/slug.py" },
  { level: "MUST", text: "Add unit tests in tests/test_slug.py" },
  { level: "SHOULD", text: "Update README with usage example" }
]);
const crit1 = JSON.stringify([
  { level: "MUST", text: "Implement slugify in src/slug.py" }
]);

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function sendTx(client, address, functionName, args, label) {
  console.log(`\n>>> [${label}] Calling ${functionName}...`);
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const t0 = Date.now();
      const txHash = await client.writeContract({
        address: address,
        functionName: functionName,
        args: args,
        value: 0n,
      });
      console.log(`    Tx submitted: ${txHash}`);
      const receipt = await client.waitForTransactionReceipt({
        hash: txHash,
        retries: 120,
        interval: 3000,
      });
      const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
      const exec = receipt.consensus_data?.leader_receipt?.[0]?.execution_result;
      console.log(`    Completed in ${elapsed}s: status=${receipt.status_name}, result=${receipt.result_name}, exec=${exec}`);
      return { txHash, receipt, elapsed };
    } catch (err) {
      console.warn(`    [Attempt ${attempt}/4 failed: ${err.message || err}]. Backing off 4000ms...`);
      if (attempt === 4) throw err;
      await sleep(4000);
    }
  }
}

async function runFixtureBatch(fixtureId, targetPrNum, critJson, pathsJson, runsCount) {
  console.log(`\n====================================================`);
  console.log(`STARTING LIVE ROBUSTNESS BATCH FOR ${fixtureId} (${runsCount} RUNS)`);
  console.log(`====================================================`);

  const fx = fixtures.find(f => f.fixture_id === fixtureId);
  const results = [];

  for (let i = 1; i <= runsCount; i++) {
    const runNum = String(i).padStart(2, '0');
    const runFilePath = path.join(robustnessDir, `${fixtureId.toLowerCase()}_run_${runNum}.json`);

    if (fs.existsSync(runFilePath)) {
      console.log(`--- ${fixtureId} Run ${i}/${runsCount} (Already completed, loading cached receipt) ---`);
      const existing = JSON.parse(fs.readFileSync(runFilePath, 'utf8'));
      results.push(existing);
      continue;
    }

    console.log(`\n--- ${fixtureId} Run ${i}/${runsCount} ---`);

    // 1. Creator creates a fresh bounty
    const bTitle = `Robustness ${fixtureId} Run ${i}`;
    const createRes = await sendTx(
      creatorClient,
      escrowAddress,
      'create_bounty',
      [bTitle, "huzyow155/ship-escrow-fixtures", critJson, pathsJson, "10"],
      `${fixtureId}_create_${runNum}`
    );

    // Read latest bounty id from stats or receipt
    const statsRaw = await creatorClient.readContract({
      address: escrowAddress,
      functionName: 'get_stats',
      args: []
    });
    // Or we can get recent bounties
    const recentsRaw = await creatorClient.readContract({
      address: escrowAddress,
      functionName: 'list_bounties',
      args: [1]
    });
    const bountyId = recentsRaw[0];
    console.log(`    Created Bounty ID: ${bountyId}`);

    await sleep(1500);

    // 2. Dev submits work to this fresh bounty
    const submitRes = await sendTx(
      devClient,
      escrowAddress,
      'submit_work',
      [bountyId, fx.pr_url, fx.head_sha],
      `${fixtureId}_submit_${runNum}`
    );

    await sleep(1500);

    // 3. Read back submission record from chain
    const subsList = await creatorClient.readContract({
      address: escrowAddress,
      functionName: 'list_submissions',
      args: [bountyId]
    });
    const subId = subsList[0];

    let subRecord = {};
    if (subId) {
      const rawSub = await creatorClient.readContract({
        address: escrowAddress,
        functionName: 'get_submission',
        args: [subId]
      });
      try {
        subRecord = JSON.parse(rawSub);
      } catch (e) {}
    }

    const runRecord = {
      fixture_id: fixtureId,
      run_index: i,
      bounty_id: bountyId,
      submission_id: subId || null,
      pr_url: fx.pr_url,
      head_sha: fx.head_sha,
      create_tx_hash: createRes.txHash,
      create_receipt_status: createRes.receipt.status_name,
      submit_tx_hash: submitRes.txHash,
      submit_receipt: {
        status_name: submitRes.receipt.status_name,
        result_name: submitRes.receipt.result_name,
        execution_result: submitRes.receipt.consensus_data?.leader_receipt?.[0]?.execution_result,
        votes: submitRes.receipt.consensus_data?.votes,
      },
      on_chain_submission: {
        verdict: subRecord.verdict || null,
        payout_pct: subRecord.payout_pct || null,
        packet_sha256: subRecord.packet_sha256 || null,
        criterion_results: subRecord.criterion_results || [],
      },
      timestamp: new Date().toISOString(),
    };

    fs.writeFileSync(runFilePath, JSON.stringify(runRecord, null, 2));
    console.log(`    Saved receipt record: ${runFilePath}`);

    results.push(runRecord);

    await sleep(2000);
  }

  return results;
}

async function main() {
  const tStart = Date.now();

  const f1Results = await runFixtureBatch('F1', 2, crit3, "[]", 10);
  const f4Results = await runFixtureBatch('F4', 5, crit3, "[]", 10);
  const f5Results = await runFixtureBatch('F5', 6, crit1, "[]", 10);

  // Compute stability statistics
  function analyzeBatch(batch) {
    const total = batch.length;
    const labelVectors = batch.map(r => JSON.stringify(r.on_chain_submission.criterion_results));
    const verdicts = batch.map(r => r.on_chain_submission.verdict);
    const payouts = batch.map(r => r.on_chain_submission.payout_pct);

    // Count modal label vector
    const labelCounts = {};
    for (const lv of labelVectors) {
      labelCounts[lv] = (labelCounts[lv] || 0) + 1;
    }
    const maxLabelCount = Math.max(...Object.values(labelCounts));
    const modalLabelVector = Object.keys(labelCounts).find(k => labelCounts[k] === maxLabelCount);

    const modalVerdict = verdicts[0];
    const verdictMatches = verdicts.filter(v => v === modalVerdict).length;

    return {
      runs: total,
      modal_label_vector: JSON.parse(modalLabelVector),
      identical_labels_count: maxLabelCount,
      modal_verdict: modalVerdict,
      verdict_matches_count: verdictMatches,
      label_counts_distribution: labelCounts,
    };
  }

  const summary = {
    evaluated_at: new Date().toISOString(),
    contract_address: escrowAddress,
    total_runs: 30,
    elapsed_seconds: ((Date.now() - tStart) / 1000).toFixed(1),
    batches: {
      F1: analyzeBatch(f1Results),
      F4: analyzeBatch(f4Results),
      F5: analyzeBatch(f5Results),
    },
  };

  const allMeetThreshold = (
    summary.batches.F1.identical_labels_count >= 9 &&
    summary.batches.F4.identical_labels_count >= 9 &&
    summary.batches.F5.identical_labels_count >= 9
  );

  summary.binding_decision = allMeetThreshold
    ? "BIND_LABELS_IN_CONSENSUS"
    : "DO_NOT_BIND_LABELS_KEEP_LEADER_ATTESTED";

  const summaryPath = path.join(robustnessDir, 'robustness_summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

  console.log("\n====================================================");
  console.log("ROBUSTNESS BATCHES COMPLETED");
  console.log(JSON.stringify(summary, null, 2));
  console.log("====================================================");

  // Write scripts/robustness_report.mjs
  const reportScript = `import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const summaryPath = path.join(__dirname, '../docs/evidence_v2/robustness/robustness_summary.json');
const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));

console.log("# REAL ON-CHAIN ROBUSTNESS BATCHES REPORT");
console.log(\`Evaluated At: \${summary.evaluated_at}\`);
console.log(\`Contract:     \${summary.contract_address}\`);
console.log(\`Total Runs:   \${summary.total_runs} (\${summary.elapsed_seconds}s)\`);
console.log(\`Binding Rule: \${summary.binding_decision}\\\\n\`);

console.log("| Fixture | Runs | Label Vector Identical Count | Verdict Matches | Modal Label Vector | Modal Verdict | Decision |");
console.log("|:--------|:-----|:-----------------------------|:----------------|:-------------------|:--------------|:---------|");

for (const [fId, b] of Object.entries(summary.batches)) {
  const passStr = b.identical_labels_count >= 9 ? ">= 9/10" : "< 9/10";
  console.log(\`| \${fId} | \${b.runs} | \${b.identical_labels_count} / \${b.runs} (\${passStr}) | \${b.verdict_matches_count} / \${b.runs} | \`\${JSON.stringify(b.modal_label_vector)}\` | \`\${b.modal_verdict}\` | \${b.identical_labels_count >= 9 ? "**PASS**" : "**RELAXED**"} |\`);
}
`;
  fs.writeFileSync(path.join(__dirname, 'robustness_report.mjs'), reportScript);
  console.log("Saved scripts/robustness_report.mjs");
}

main().catch(err => {
  console.error("Robustness run failed:", err);
  process.exit(1);
});
