import { createClient, chains, createAccount } from 'genlayer-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

const multicommitDir = path.join(__dirname, '../docs/evidence_v2/multicommit');
if (!fs.existsSync(multicommitDir)) {
  fs.mkdirSync(multicommitDir, { recursive: true });
}

const creatorAccount = createAccount(env.CREATOR_PRIVATE_KEY);
const devAccount = createAccount(env.DEV_PRIVATE_KEY);

const creatorClient = createClient({ chain: chains.studionet, account: creatorAccount });
const devClient = createClient({ chain: chains.studionet, account: devAccount });
const readClient = createClient({ chain: chains.studionet });

const critSlug = JSON.stringify([
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

async function getBountySnapshot(bountyId) {
  const raw = await readClient.readContract({
    address: escrowAddress,
    functionName: 'get_bounty',
    args: [bountyId]
  });
  return JSON.parse(raw);
}

async function getBalanceSnapshot(addr) {
  return await readClient.readContract({
    address: escrowAddress,
    functionName: 'get_balance',
    args: [addr]
  });
}

async function main() {
  console.log("==================================================================");
  console.log("ON-CHAIN MULTI-COMMIT HEAD PROOFS (SECTION 0)");
  console.log(`Target Contract: ${escrowAddress}`);
  console.log("==================================================================\n");

  const summary = {
    evaluated_at: new Date().toISOString(),
    contract_address: escrowAddress,
    creator_address: creatorAccount.address,
    dev_address: devAccount.address,
    case_pr7_multicommit: {},
    case_pr8_advancing_head: {},
  };

  // -------------------------------------------------------------------------
  // Case 1: Fixture PR #7 (3 Commits on a single pull request)
  // -------------------------------------------------------------------------
  console.log("------------------------------------------------------------------");
  console.log("CASE 1: FIXTURE PR #7 (MULTI-COMMIT: 3 ITERATIVE COMMITS)");
  console.log("PR URL: https://github.com/huzyow155/ship-escrow-fixtures/pull/7");
  console.log("------------------------------------------------------------------");

  const pr7Url = "https://github.com/huzyow155/ship-escrow-fixtures/pull/7";
  const pr7_first_sha = "21c20625d3b919b2acce25f82339b7b54bdfba01";
  const pr7_middle_sha = "b3b260f22889ea443bcdebd81cdc4c2a94688708";
  const pr7_random_sha = "0123456789abcdef0123456789abcdef01234567";
  const pr7_real_head = "960fbf1ac0e73a099f4251512b5c2d569252ac39";

  // 1. Creator creates a fresh bounty
  const c1Create = await sendTx(
    creatorClient,
    escrowAddress,
    'create_bounty',
    ["Multi-Commit PR#7 Head Test", "huzyow155/ship-escrow-fixtures", critSlug, "[]", "10"],
    "pr7_create_bounty"
  );
  const bList = await readClient.readContract({
    address: escrowAddress,
    functionName: 'list_bounties',
    args: [1]
  });
  const bounty7Id = bList[0];
  console.log(`Created Bounty ID for PR#7: ${bounty7Id}`);

  let bSnap = await getBountySnapshot(bounty7Id);
  let devBal = await getBalanceSnapshot(devAccount.address);
  let creatorBal = await getBalanceSnapshot(creatorAccount.address);
  console.log(`Initial Snapshot: attempts=${bSnap.attempts}, status=${bSnap.status}, devBal=${devBal}, creatorBal=${creatorBal}`);

  // Step a: Submit with FIRST commit sha (what V1 accepted)
  console.log("\n>>> Step a: Submitting with FIRST commit sha (V1 legacy accepted sha)...");
  const stepA = await sendTx(
    devClient,
    escrowAddress,
    'submit_work',
    [bounty7Id, pr7Url, pr7_first_sha],
    "pr7_step_a_first_commit"
  );
  fs.writeFileSync(path.join(multicommitDir, 'pr7_step_a_first_commit_receipt.json'), JSON.stringify(stepA.receipt, null, 2));

  bSnap = await getBountySnapshot(bounty7Id);
  devBal = await getBalanceSnapshot(devAccount.address);
  creatorBal = await getBalanceSnapshot(creatorAccount.address);
  console.log(`Step a Post Snapshot: attempts=${bSnap.attempts}, status=${bSnap.status}, devBal=${devBal}, creatorBal=${creatorBal}`);

  // Step b: Submit with MIDDLE commit sha
  console.log("\n>>> Step b: Submitting with MIDDLE commit sha...");
  const stepB = await sendTx(
    devClient,
    escrowAddress,
    'submit_work',
    [bounty7Id, pr7Url, pr7_middle_sha],
    "pr7_step_b_middle_commit"
  );
  fs.writeFileSync(path.join(multicommitDir, 'pr7_step_b_middle_commit_receipt.json'), JSON.stringify(stepB.receipt, null, 2));

  bSnap = await getBountySnapshot(bounty7Id);
  devBal = await getBalanceSnapshot(devAccount.address);
  creatorBal = await getBalanceSnapshot(creatorAccount.address);
  console.log(`Step b Post Snapshot: attempts=${bSnap.attempts}, status=${bSnap.status}, devBal=${devBal}, creatorBal=${creatorBal}`);

  // Step c: Submit with RANDOM 40-hex sha
  console.log("\n>>> Step c: Submitting with RANDOM 40-hex sha...");
  const stepC = await sendTx(
    devClient,
    escrowAddress,
    'submit_work',
    [bounty7Id, pr7Url, pr7_random_sha],
    "pr7_step_c_random_sha"
  );
  fs.writeFileSync(path.join(multicommitDir, 'pr7_step_c_random_sha_receipt.json'), JSON.stringify(stepC.receipt, null, 2));

  bSnap = await getBountySnapshot(bounty7Id);
  devBal = await getBalanceSnapshot(devAccount.address);
  creatorBal = await getBalanceSnapshot(creatorAccount.address);
  console.log(`Step c Post Snapshot: attempts=${bSnap.attempts}, status=${bSnap.status}, devBal=${devBal}, creatorBal=${creatorBal}`);

  // Step d: Submit with REAL CURRENT HEAD
  console.log("\n>>> Step d: Submitting with REAL CURRENT HEAD sha...");
  const stepD = await sendTx(
    devClient,
    escrowAddress,
    'submit_work',
    [bounty7Id, pr7Url, pr7_real_head],
    "pr7_step_d_real_head"
  );
  fs.writeFileSync(path.join(multicommitDir, 'pr7_step_d_real_head_receipt.json'), JSON.stringify(stepD.receipt, null, 2));

  bSnap = await getBountySnapshot(bounty7Id);
  devBal = await getBalanceSnapshot(devAccount.address);
  creatorBal = await getBalanceSnapshot(creatorAccount.address);
  console.log(`Step d Post Snapshot: attempts=${bSnap.attempts}, status=${bSnap.status}, devBal=${devBal}, creatorBal=${creatorBal}`);

  // 3. Post Step d verifications: get_settlement, get_submission, is_settled_for, duplicate submit
  console.log("\n>>> Verifying Post-Settlement Views and Duplicate Prevention...");

  const settlementRaw = await readClient.readContract({
    address: escrowAddress,
    functionName: 'get_settlement',
    args: [bounty7Id]
  });
  let settlement = {};
  if (settlementRaw) {
    try { settlement = JSON.parse(settlementRaw); } catch (e) {}
  }
  console.log(`Settlement Record: head_sha=${settlement.head_sha || 'N/A'}, verdict=${settlement.verdict || 'N/A'}, payout=${settlement.payout_pct || 'N/A'}`);

  const subsList = await readClient.readContract({
    address: escrowAddress,
    functionName: 'list_submissions',
    args: [bounty7Id]
  });
  const subId = subsList[0];
  let submission = {};
  if (subId) {
    const submissionRaw = await readClient.readContract({
      address: escrowAddress,
      functionName: 'get_submission',
      args: [subId]
    });
    try { submission = JSON.parse(submissionRaw); } catch (e) {}
  }
  console.log(`Submission Record: head_sha=${submission.head_sha || 'N/A'}, verdict=${submission.verdict || 'N/A'}, payout=${submission.payout_pct || 'N/A'}`);

  const criteriaHash = bSnap.criteria_hash;
  const isSettledRealHead = await readClient.readContract({
    address: escrowAddress,
    functionName: 'is_settled_for',
    args: [bounty7Id, criteriaHash, pr7_real_head, devAccount.address, 25]
  });
  const isSettledFirstCommit = await readClient.readContract({
    address: escrowAddress,
    functionName: 'is_settled_for',
    args: [bounty7Id, criteriaHash, pr7_first_sha, devAccount.address, 25]
  });
  console.log(`is_settled_for(real_head, 25):     ${isSettledRealHead} (MUST BE TRUE)`);
  console.log(`is_settled_for(first_commit, 25): ${isSettledFirstCommit} (MUST BE FALSE)`);

  // Duplicate submit test
  console.log("\n>>> Testing duplicate submission of real head (Must be rejected)...");
  const dupStep = await sendTx(
    devClient,
    escrowAddress,
    'submit_work',
    [bounty7Id, pr7Url, pr7_real_head],
    "pr7_duplicate_submit"
  );
  fs.writeFileSync(path.join(multicommitDir, 'pr7_duplicate_receipt.json'), JSON.stringify(dupStep.receipt, null, 2));

  summary.case_pr7_multicommit = {
    bounty_id: bounty7Id,
    pr_url: pr7Url,
    first_commit_sha: pr7_first_sha,
    middle_commit_sha: pr7_middle_sha,
    random_sha: pr7_random_sha,
    real_head_sha: pr7_real_head,
    step_a_first_commit: {
      txHash: stepA.txHash,
      execution_result: stepA.receipt.consensus_data?.leader_receipt?.[0]?.execution_result,
      status_name: stepA.receipt.status_name,
    },
    step_b_middle_commit: {
      txHash: stepB.txHash,
      execution_result: stepB.receipt.consensus_data?.leader_receipt?.[0]?.execution_result,
      status_name: stepB.receipt.status_name,
    },
    step_c_random_sha: {
      txHash: stepC.txHash,
      execution_result: stepC.receipt.consensus_data?.leader_receipt?.[0]?.execution_result,
      status_name: stepC.receipt.status_name,
    },
    step_d_real_head: {
      txHash: stepD.txHash,
      execution_result: stepD.receipt.consensus_data?.leader_receipt?.[0]?.execution_result,
      status_name: stepD.receipt.status_name,
      verdict: settlement.verdict,
      payout_pct: settlement.payout_pct,
    },
    views: {
      is_settled_for_real_head: isSettledRealHead,
      is_settled_for_first_commit: isSettledFirstCommit,
      stored_settlement_head: settlement.head_sha,
      stored_submission_head: submission.head_sha,
      head_equality_verified: (
        settlement.head_sha?.toLowerCase() === pr7_real_head.toLowerCase() &&
        submission.head_sha?.toLowerCase() === pr7_real_head.toLowerCase()
      ),
    },
    duplicate_submit: {
      txHash: dupStep.txHash,
      execution_result: dupStep.receipt.consensus_data?.leader_receipt?.[0]?.execution_result,
    },
    passed: (
      stepA.receipt.consensus_data?.leader_receipt?.[0]?.execution_result === 'ERROR' &&
      stepB.receipt.consensus_data?.leader_receipt?.[0]?.execution_result === 'ERROR' &&
      stepC.receipt.consensus_data?.leader_receipt?.[0]?.execution_result === 'ERROR' &&
      stepD.receipt.consensus_data?.leader_receipt?.[0]?.execution_result === 'SUCCESS' &&
      isSettledRealHead === true &&
      isSettledFirstCommit === false &&
      dupStep.receipt.consensus_data?.leader_receipt?.[0]?.execution_result === 'ERROR'
    )
  };

  // -------------------------------------------------------------------------
  // Case 2: Fixture PR #8 (Advancing Head)
  // -------------------------------------------------------------------------
  console.log("\n------------------------------------------------------------------");
  console.log("CASE 2: FIXTURE PR #8 (ADVANCING HEAD: STALE SHA vs REAL HEAD)");
  console.log("PR URL: https://github.com/huzyow155/ship-escrow-fixtures/pull/8");
  console.log("------------------------------------------------------------------");

  const pr8Url = "https://github.com/huzyow155/ship-escrow-fixtures/pull/8";
  const pr8_stale_sha = "c4eb7b2a842c306b159e1c5d66d61575b67f1ef6";
  const pr8_real_head = "2332a887996496eed2f20ed63e2c3b51fefde204";

  // Creator creates a fresh bounty
  const c2Create = await sendTx(
    creatorClient,
    escrowAddress,
    'create_bounty',
    ["Advancing Head PR#8 Test", "huzyow155/ship-escrow-fixtures", critSlug, "[]", "10"],
    "pr8_create_bounty"
  );
  const b8List = await readClient.readContract({
    address: escrowAddress,
    functionName: 'list_bounties',
    args: [1]
  });
  const bounty8Id = b8List[0];
  console.log(`Created Bounty ID for PR#8: ${bounty8Id}`);

  // Step a: Submit with STALE SHA
  console.log("\n>>> Step a: Submitting with STALE SHA (old branch head before push)...");
  const step8A = await sendTx(
    devClient,
    escrowAddress,
    'submit_work',
    [bounty8Id, pr8Url, pr8_stale_sha],
    "pr8_step_a_stale_sha"
  );
  fs.writeFileSync(path.join(multicommitDir, 'pr8_step_a_stale_receipt.json'), JSON.stringify(step8A.receipt, null, 2));

  let b8Snap = await getBountySnapshot(bounty8Id);
  console.log(`PR#8 Step a Post Snapshot: attempts=${b8Snap.attempts}, status=${b8Snap.status} (MUST BE OPEN, 0 attempts)`);

  // Step b: Submit with CURRENT REAL HEAD
  console.log("\n>>> Step b: Submitting with CURRENT REAL HEAD SHA...");
  const step8B = await sendTx(
    devClient,
    escrowAddress,
    'submit_work',
    [bounty8Id, pr8Url, pr8_real_head],
    "pr8_step_b_real_head"
  );
  fs.writeFileSync(path.join(multicommitDir, 'pr8_step_b_real_head_receipt.json'), JSON.stringify(step8B.receipt, null, 2));

  b8Snap = await getBountySnapshot(bounty8Id);
  console.log(`PR#8 Step b Post Snapshot: attempts=${b8Snap.attempts}, status=${b8Snap.status}`);

  summary.case_pr8_advancing_head = {
    bounty_id: bounty8Id,
    pr_url: pr8Url,
    stale_head_sha: pr8_stale_sha,
    real_head_sha: pr8_real_head,
    step_a_stale_sha: {
      txHash: step8A.txHash,
      execution_result: step8A.receipt.consensus_data?.leader_receipt?.[0]?.execution_result,
      status_name: step8A.receipt.status_name,
    },
    step_b_real_head: {
      txHash: step8B.txHash,
      execution_result: step8B.receipt.consensus_data?.leader_receipt?.[0]?.execution_result,
      status_name: step8B.receipt.status_name,
      final_attempts: b8Snap.attempts,
      final_status: b8Snap.status,
    },
    passed: (
      step8A.receipt.consensus_data?.leader_receipt?.[0]?.execution_result === 'ERROR' &&
      step8B.receipt.consensus_data?.leader_receipt?.[0]?.execution_result === 'SUCCESS' &&
      b8Snap.attempts === "1"
    )
  };

  const finalPath = path.join(multicommitDir, 'multicommit_summary.json');
  fs.writeFileSync(finalPath, JSON.stringify(summary, null, 2), 'utf8');

  console.log("\n==================================================================");
  console.log("MULTI-COMMIT ON-CHAIN PROOFS COMPLETED SUCCESSFULLY");
  console.log(`Summary saved to: ${finalPath}`);
  console.log("==================================================================");
}

main().catch(err => {
  console.error("Multi-commit proof execution failed:", err);
  process.exit(1);
});
