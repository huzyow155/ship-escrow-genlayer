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
const creatorKey = process.env.CREATOR_PRIVATE_KEY;
const devKey = process.env.DEV_PRIVATE_KEY;
if (!creatorKey || !devKey) throw new Error("Missing keys in .env");

const creatorAccount = createAccount(creatorKey);
const devAccount = createAccount(devKey);

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
  console.log("EXECUTING DUPLICATE SUBMISSION GUARD ON OPEN BOUNTY");
  console.log(`Active Escrow: ${escrowAddress}`);
  console.log("====================================================");

  const prUrl = "https://github.com/hypercybers99/ship-escrow-fixtures/pull/4";
  const headSha = "aa9a2af9ccb0fa6d13b030a8f176c5235d15a982";

  // Step 1: Creator creates a fresh bounty
  const title = "Duplicate Guard Open Bounty Proof";
  const ownerRepo = "huzyow155/ship-escrow-fixtures";
  const criteriaJson = JSON.stringify([
    { level: "MUST", text: "Implement slugify in src/slug.py" }
  ]);
  const reqPathsJson = "[]";
  const amount = "10";

  console.log("\n1. Creator creating fresh bounty...");
  const createTx = await client.writeContract({
    account: creatorAccount,
    address: escrowAddress,
    functionName: 'create_bounty',
    args: [title, ownerRepo, criteriaJson, reqPathsJson, amount]
  });
  console.log(`Create tx submitted: ${createTx}`);
  const createReceipt = await waitForTx(createTx, "Create Fresh Bounty");

  // Read latest bounty ID
  const recentBounties = await client.readContract({
    address: escrowAddress,
    functionName: 'list_bounties',
    args: [1]
  });
  const bountyId = recentBounties[0];
  console.log(`Created Bounty ID: ${bountyId}`);

  // Snapshot before first submission
  const snap0Raw = await client.readContract({
    address: escrowAddress,
    functionName: 'get_bounty',
    args: [bountyId]
  });
  const snap0 = JSON.parse(snap0Raw);
  console.log("Bounty Snapshot 0 (Fresh):", JSON.stringify(snap0, null, 2));

  // Step 2: First submission of PR #4 (triggering REVIEW verdict)
  console.log(`\n2. Dev submitting PR #4 head ${headSha} (Attempt 1)...`);
  const submit1Tx = await client.writeContract({
    account: devAccount,
    address: escrowAddress,
    functionName: 'submit_work',
    args: [bountyId, prUrl, headSha]
  });
  console.log(`Submit 1 tx submitted: ${submit1Tx}`);
  const submit1Receipt = await waitForTx(submit1Tx, "Submit 1 (Review Verdict)");

  // Snapshot after first submission
  const snap1Raw = await client.readContract({
    address: escrowAddress,
    functionName: 'get_bounty',
    args: [bountyId]
  });
  const snap1 = JSON.parse(snap1Raw);
  console.log("Bounty Snapshot 1 (After Attempt 1):", JSON.stringify(snap1, null, 2));

  const subsList = await client.readContract({
    address: escrowAddress,
    functionName: 'list_submissions',
    args: [bountyId]
  });
  const sub1Id = subsList[0];
  console.log(`Submission 1 ID: ${sub1Id}`);

  const sub1Raw = await client.readContract({
    address: escrowAddress,
    functionName: 'get_submission',
    args: [sub1Id]
  });
  const sub1 = JSON.parse(sub1Raw);
  console.log(`Submission 1 Record: verdict=${sub1.verdict}, gate=${sub1.packet?.gate}`);

  // Step 3: Second submission of the EXACT SAME head SHA (Must trigger duplicate guard)
  console.log(`\n3. Dev submitting EXACT SAME head SHA ${headSha} to OPEN Bounty ${bountyId}...`);
  const submit2Tx = await client.writeContract({
    account: devAccount,
    address: escrowAddress,
    functionName: 'submit_work',
    args: [bountyId, prUrl, headSha]
  });
  console.log(`Submit 2 tx submitted: ${submit2Tx}`);
  const submit2Receipt = await waitForTx(submit2Tx, "Submit 2 (Duplicate Rejection)");

  // Snapshot after second submission (duplicate attempt)
  const snap2Raw = await client.readContract({
    address: escrowAddress,
    functionName: 'get_bounty',
    args: [bountyId]
  });
  const snap2 = JSON.parse(snap2Raw);
  console.log("Bounty Snapshot 2 (After Duplicate Attempt):", JSON.stringify(snap2, null, 2));

  // Extract duplicate error payload from leader receipt
  const leaderRes = submit2Receipt.consensus_data?.leader_receipt?.[0];
  const duplicateError = leaderRes?.result?.payload;
  console.log(`Leader Receipt Result Payload: "${duplicateError}"`);

  // Verify expectations:
  const expectedError = `Duplicate submission for head sha: existing submission ${sub1Id}`;
  const errorMatches = duplicateError === expectedError;
  const statusRemainsOpen = snap2.status === "OPEN";
  const attemptsUnchanged = snap2.attempts === snap1.attempts;

  console.log("\n====================================================");
  console.log("VERIFICATION CRITERIA:");
  console.log(`1. Status remains OPEN: ${statusRemainsOpen} (${snap2.status})`);
  console.log(`2. Attempts unchanged: ${attemptsUnchanged} (${snap1.attempts} -> ${snap2.attempts})`);
  console.log(`3. Error exact match: ${errorMatches} ("${duplicateError}" === "${expectedError}")`);
  console.log("====================================================");

  // Save evidence files
  const outDir = path.join(__dirname, '../docs/evidence_v2/multicommit');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const record = {
    evaluated_at: new Date().toISOString(),
    bounty_id: bountyId,
    head_sha: headSha,
    pr_url: prUrl,
    create_tx: createTx,
    create_receipt: createReceipt,
    submit1_tx: submit1Tx,
    submit1_receipt: submit1Receipt,
    submit2_tx: submit2Tx,
    submit2_receipt: submit2Receipt,
    snapshot_0_fresh: snap0,
    snapshot_1_after_review: snap1,
    snapshot_2_after_duplicate: snap2,
    existing_submission_id: sub1Id,
    duplicate_error: duplicateError,
    expected_error: expectedError,
    error_exact_match: errorMatches,
    status_remains_open: statusRemainsOpen,
    attempts_unchanged: attemptsUnchanged,
    passed: errorMatches && statusRemainsOpen && attemptsUnchanged,
  };

  const outPath = path.join(outDir, 'duplicate_open_bounty_receipt.json');
  fs.writeFileSync(outPath, JSON.stringify(record, null, 2), 'utf8');
  console.log(`Saved duplicate guard evidence to ${outPath}`);
}

main().catch(err => {
  console.error("Duplicate guard execution error:", err);
  process.exit(1);
});
