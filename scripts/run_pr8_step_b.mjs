import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient, createAccount, chains } from 'genlayer-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read .env
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx !== -1) {
      process.env[trimmed.substring(0, idx).trim()] = trimmed.substring(idx + 1).trim();
    }
  }
}

const client = createClient({ chain: chains.studionet });
const devKey = process.env.DEV_PRIVATE_KEY;
if (!devKey) throw new Error("DEV_PRIVATE_KEY missing from .env");
const account = createAccount(devKey);

const deployments = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'deploy/deployments_v2.json'), 'utf8')
);
const escrowAddress = deployments.escrow.contractAddress;

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

async function main() {
  console.log("====================================================");
  console.log("EXECUTING PR #8 STEP B: REAL HEAD SHA SUBMISSION");
  console.log(`Active Escrow: ${escrowAddress}`);
  console.log("====================================================");

  const bountyId = "19";
  const prUrl = "https://github.com/hypercybers99/ship-escrow-fixtures/pull/8";

  // 1. Fetch current real head SHA from GitHub API
  console.log("Fetching authentic PR #8 head SHA from GitHub API...");
  const apiRes = await fetch("https://api.github.com/repos/hypercybers99/ship-escrow-fixtures/pulls/8", {
    headers: { "User-Agent": "curl/7.88.1" }
  });
  const apiJson = await apiRes.json();
  const realHeadSha = apiJson.head.sha.toLowerCase();
  console.log(`Authentic PR #8 Head SHA: ${realHeadSha}`);

  // 2. Snapshot bounty BEFORE
  const beforeBountyRaw = await client.readContract({
    address: escrowAddress,
    functionName: 'get_bounty',
    args: [bountyId]
  });
  const beforeBounty = JSON.parse(beforeBountyRaw);
  console.log("\nBounty #19 BEFORE Snapshot:");
  console.log(JSON.stringify(beforeBounty, null, 2));

  // 3. Submit real head SHA
  console.log("\nSubmitting authentic head SHA to Bounty #19...");
  const submitTx = await client.writeContract({
    account,
    address: escrowAddress,
    functionName: 'submit_work',
    args: [bountyId, prUrl, realHeadSha]
  });
  console.log(`Submit tx submitted: ${submitTx}`);

  const submitReceipt = await waitForTx(submitTx, "PR8 Step b Submit Real Head");

  // 4. Snapshot bounty AFTER
  const afterBountyRaw = await client.readContract({
    address: escrowAddress,
    functionName: 'get_bounty',
    args: [bountyId]
  });
  const afterBounty = JSON.parse(afterBountyRaw);
  console.log("\nBounty #19 AFTER Snapshot:");
  console.log(JSON.stringify(afterBounty, null, 2));

  // 5. Read settlement and submission
  const settlementRaw = await client.readContract({
    address: escrowAddress,
    functionName: 'get_settlement',
    args: [bountyId]
  });
  let settlement = null;
  if (settlementRaw && settlementRaw.trim()) {
    try {
      settlement = JSON.parse(settlementRaw);
      console.log("\nSettlement Record:");
      console.log(JSON.stringify(settlement, null, 2));
    } catch (e) {
      console.warn("Could not parse settlement:", settlementRaw);
    }
  } else {
    console.log("\nNo settlement record found (bounty did not settle).");
  }

  let sub = null;
  if (settlement && settlement.submission_id) {
    const subRaw = await client.readContract({
      address: escrowAddress,
      functionName: 'get_submission',
      args: [settlement.submission_id]
    });
    if (subRaw && subRaw.trim()) {
      sub = JSON.parse(subRaw);
      console.log(`\nSubmission Record #${sub.id}:`);
      console.log(JSON.stringify(sub, null, 2));
    }
  }

  // Save full raw receipt
  const outDir = path.join(__dirname, '../docs/evidence_v2/multicommit');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const receiptOutPath = path.join(outDir, 'pr8_step_b_real_head_receipt.json');
  fs.writeFileSync(receiptOutPath, JSON.stringify(submitReceipt, null, 2), 'utf8');
  console.log(`\nSaved receipt to ${receiptOutPath}`);

  // Update summary file
  const summaryPath = path.join(outDir, 'multicommit_summary.json');
  let summary = {};
  if (fs.existsSync(summaryPath)) {
    summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  }

  summary.pr8_step_b = {
    step: "b",
    description: "Submit current real head sha (advancing PR) to open bounty 19",
    bounty_id: bountyId,
    pr_url: prUrl,
    head_sha: realHeadSha,
    tx_hash: submitTx,
    status_name: submitReceipt.statusName,
    execution_result: submitReceipt.consensus_data?.leader_receipt?.[0]?.execution_result,
    bounty_before: beforeBounty,
    bounty_after: afterBounty,
    settlement: settlement,
    submission_id: sub ? sub.id : null,
    verdict: sub ? sub.verdict : null,
    payout_pct: sub ? sub.payout_pct : null,
  };

  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');
  console.log(`Updated summary in ${summaryPath}`);

  if (submitReceipt.consensus_data?.leader_receipt?.[0]?.execution_result === 'SUCCESS') {
    console.log("====================================================");
    console.log("PR #8 STEP B COMPLETED SUCCESSFULLY");
    console.log("====================================================");
  } else {
    console.warn("====================================================");
    console.warn(`PR #8 STEP B COMPLETED WITH EXEC RESULT: ${submitReceipt.consensus_data?.leader_receipt?.[0]?.execution_result}`);
    console.warn("====================================================");
  }
}

main().catch(err => {
  console.error("PR8 Step b execution error:", err);
  process.exit(1);
});
