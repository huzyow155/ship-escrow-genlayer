const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const { createClient, chains, createAccount } = require('genlayer-js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load environment variables from .env
const envPath = path.join(__dirname, '../../.env');
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
  fs.readFileSync(path.join(__dirname, 'deployments_v2.json'), 'utf8')
);

const escrowAddress = deployments.escrow.contractAddress;
const repAddress = deployments.reputation.contractAddress;
const evidenceDir = path.join(__dirname, '../../docs/evidence_v2');
if (!fs.existsSync(evidenceDir)) {
  fs.mkdirSync(evidenceDir, { recursive: true });
}

// Clients for Creator, Dev, Attacker
const creatorAccount = createAccount(env.CREATOR_PRIVATE_KEY);
const devAccount = createAccount(env.DEV_PRIVATE_KEY);
const attackerAccount = createAccount(env.ATTACKER_PRIVATE_KEY);

const creatorClient = createClient({ chain: chains.studionet, account: creatorAccount });
const devClient = createClient({ chain: chains.studionet, account: devAccount });
const attackerClient = createClient({ chain: chains.studionet, account: attackerAccount });

const evidenceIndex = {
  deployedAt: new Date().toISOString(),
  escrowAddress,
  repAddress,
  creatorAddress: creatorAccount.address,
  devAddress: devAccount.address,
  attackerAddress: attackerAccount.address,
  transactions: {},
};

function saveReceipt(name, receipt) {
  const filePath = path.join(evidenceDir, `${name}.json`);
  fs.writeFileSync(filePath, JSON.stringify(receipt, null, 2));
  evidenceIndex.transactions[name] = {
    txHash: receipt.hash || receipt.transaction_hash,
    status_name: receipt.status_name,
    result_name: receipt.result_name,
    execution_result: receipt.consensus_data?.leader_receipt?.[0]?.execution_result,
    savedTo: `docs/evidence_v2/${name}.json`,
  };
  console.log(`  [Receipt] Saved docs/evidence_v2/${name}.json (tx: ${receipt.hash || receipt.transaction_hash})`);
}

async function sendTx(client, address, functionName, args, label) {
  console.log(`\n>>> Executing: ${label} (${functionName})`);
  const t0 = Date.now();
  const txHash = await client.writeContract({
    address: address,
    functionName: functionName,
    args: args,
    value: 0n,
  });
  console.log(`    Tx Hash: ${txHash}`);
  const receipt = await client.waitForTransactionReceipt({
    hash: txHash,
    retries: 120,
    interval: 3000,
  });
  const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
  const lr = receipt.consensus_data?.leader_receipt?.[0];
  console.log(`    Completed in ${elapsed}s: status=${receipt.status_name}, result=${receipt.result_name}, exec=${lr?.execution_result}`);
  return { txHash, receipt, elapsed };
}

async function main() {
  console.log("====================================================");
  console.log("RUNNING LIVE ON-CHAIN EVIDENCE SUITE (STUDIONET)");
  console.log(`Escrow:     ${escrowAddress}`);
  console.log(`Reputation: ${repAddress}`);
  console.log(`Creator:    ${creatorAccount.address}`);
  console.log(`Dev:        ${devAccount.address}`);
  console.log(`Attacker:   ${attackerAccount.address}`);
  console.log("====================================================");

  // -------------------------------------------------------------------------
  // 1. Initial Claims & Balances
  // -------------------------------------------------------------------------
  console.log("\n--- Step 1: Claim Demo Credits ---");
  const claimCreator = await sendTx(creatorClient, escrowAddress, 'claim_demo_credits', [], 'creator_claim');
  saveReceipt('case_ledger_claim_creator', claimCreator.receipt);

  const claimDev = await sendTx(devClient, escrowAddress, 'claim_demo_credits', [], 'dev_claim');
  saveReceipt('case_ledger_claim_dev', claimDev.receipt);

  const claimAttacker = await sendTx(attackerClient, escrowAddress, 'claim_demo_credits', [], 'attacker_claim');
  saveReceipt('case_ledger_claim_attacker', claimAttacker.receipt);

  // Read invariant
  const inv1 = await creatorClient.readContract({ address: escrowAddress, functionName: 'get_ledger_invariant', args: [] });
  console.log("    Ledger Invariant after claims:", inv1);

  // -------------------------------------------------------------------------
  // 2. Fixture Runs: F1 to F12
  // -------------------------------------------------------------------------
  const fixtures = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../../fixtures/fixtures_v2.json'), 'utf8')
  );

  const critDefault = JSON.stringify([
    { level: "MUST", text: "Implement slugify in src/slug.py" },
    { level: "MUST", text: "Add unit tests in tests/test_slug.py" },
    { level: "SHOULD", text: "Update README with usage example" }
  ]);
  const critPartialReq = JSON.stringify([
    { level: "MUST", text: "Implement slugify in src/slug.py" }
  ]);
  const pathsReq = JSON.stringify(["src/", "tests/"]);
  const pathsDual = JSON.stringify(["src/", "docs/"]);

  // --- F1: PR #2 (RELEASE_100) ---
  console.log("\n--- Case F1: Clean Full Release ---");
  const f1Create = await sendTx(creatorClient, escrowAddress, 'create_bounty', ["Bounty F1 Clean", "huzyow155/ship-escrow-fixtures", critDefault, "[]", "50"], "create_bounty_f1");
  saveReceipt('f1_create_receipt', f1Create.receipt);
  const f1Data = fixtures.find(f => f.fixture_id === 'F1');
  const f1Submit = await sendTx(devClient, escrowAddress, 'submit_work', ["1", f1Data.pr_url, f1Data.head_sha], "submit_f1");
  saveReceipt('f1_submit_receipt', f1Submit.receipt);

  // --- F2: PR #3 (Missing required path -> REFUND) ---
  console.log("\n--- Case F2: Trap Missing Required Path (REFUND) ---");
  const f2Create = await sendTx(creatorClient, escrowAddress, 'create_bounty', ["Bounty F2 Trap", "huzyow155/ship-escrow-fixtures", critPartialReq, pathsReq, "50"], "create_bounty_f2");
  saveReceipt('f2_create_receipt', f2Create.receipt);
  const f2Data = fixtures.find(f => f.fixture_id === 'F2');
  const f2Submit = await sendTx(devClient, escrowAddress, 'submit_work', ["2", f2Data.pr_url, f2Data.head_sha], "submit_f2");
  saveReceipt('f2_submit_receipt', f2Submit.receipt);

  // --- F3: PR #4 (Deleted test files -> REVIEW) ---
  console.log("\n--- Case F3: Trap Deleted Test File (REVIEW) ---");
  const f3Create = await sendTx(creatorClient, escrowAddress, 'create_bounty', ["Bounty F3 Trap Test Deleted", "huzyow155/ship-escrow-fixtures", critPartialReq, "[]", "50"], "create_bounty_f3");
  saveReceipt('f3_create_receipt', f3Create.receipt);
  const f3Data = fixtures.find(f => f.fixture_id === 'F3');
  const f3Submit = await sendTx(devClient, escrowAddress, 'submit_work', ["3", f3Data.pr_url, f3Data.head_sha], "submit_f3");
  saveReceipt('f3_submit_receipt', f3Submit.receipt);

  // --- F4: PR #5 (Partial Release -> RELEASE_75/50) ---
  console.log("\n--- Case F4: Partial Release ---");
  const f4Create = await sendTx(creatorClient, escrowAddress, 'create_bounty', ["Bounty F4 Partial", "huzyow155/ship-escrow-fixtures", critDefault, "[]", "50"], "create_bounty_f4");
  saveReceipt('f4_create_receipt', f4Create.receipt);
  const f4Data = fixtures.find(f => f.fixture_id === 'F4');
  const f4Submit = await sendTx(devClient, escrowAddress, 'submit_work', ["4", f4Data.pr_url, f4Data.head_sha], "submit_f4");
  saveReceipt('f4_submit_receipt', f4Submit.receipt);

  // --- F5: PR #6 (Prompt Injection -> REFUND) ---
  console.log("\n--- Case F5: Prompt Injection Defense ---");
  const f5Create = await sendTx(creatorClient, escrowAddress, 'create_bounty', ["Bounty F5 Injection", "huzyow155/ship-escrow-fixtures", critPartialReq, "[]", "50"], "create_bounty_f5");
  saveReceipt('f5_create_receipt', f5Create.receipt);
  const f5Data = fixtures.find(f => f.fixture_id === 'F5');
  const f5Submit = await sendTx(devClient, escrowAddress, 'submit_work', ["5", f5Data.pr_url, f5Data.head_sha], "submit_f5");
  saveReceipt('f5_submit_receipt', f5Submit.receipt);

  // --- F6: PR #7 (Multi-commit PR -> RELEASE_100) ---
  console.log("\n--- Case F6: Multi-Commit PR ---");
  const f6Create = await sendTx(creatorClient, escrowAddress, 'create_bounty', ["Bounty F6 MultiCommit", "huzyow155/ship-escrow-fixtures", critPartialReq, "[]", "50"], "create_bounty_f6");
  saveReceipt('f6_create_receipt', f6Create.receipt);
  const f6Data = fixtures.find(f => f.fixture_id === 'F6');
  const f6Submit = await sendTx(devClient, escrowAddress, 'submit_work', ["6", f6Data.pr_url, f6Data.head_sha], "submit_f6");
  saveReceipt('f6_submit_receipt', f6Submit.receipt);

  // --- F7: PR #8 (Stale Head Rejection) ---
  console.log("\n--- Case F7: Advancing Head Stale SHA Rejection ---");
  const f7Create = await sendTx(creatorClient, escrowAddress, 'create_bounty', ["Bounty F7 Stale", "huzyow155/ship-escrow-fixtures", critPartialReq, "[]", "50"], "create_bounty_f7");
  saveReceipt('f7_create_receipt', f7Create.receipt);
  const f7Data = fixtures.find(f => f.fixture_id === 'F7');
  const f7Submit = await sendTx(devClient, escrowAddress, 'submit_work', ["7", f7Data.pr_url, f7Data.old_head_sha], "submit_f7_stale");
  saveReceipt('f7_submit_receipt', f7Submit.receipt);

  // --- F8: PR #9 (Wrong-Wallet Marker Rejection) ---
  console.log("\n--- Case F8: Wrong-Wallet Marker Rejection ---");
  const f8Create = await sendTx(creatorClient, escrowAddress, 'create_bounty', ["Bounty F8 Wrong Wallet", "huzyow155/ship-escrow-fixtures", critPartialReq, "[]", "50"], "create_bounty_f8");
  saveReceipt('f8_create_receipt', f8Create.receipt);
  const f8Data = fixtures.find(f => f.fixture_id === 'F8');
  const f8Submit = await sendTx(devClient, escrowAddress, 'submit_work', ["8", f8Data.pr_url, f8Data.head_sha], "submit_f8_wrong_wallet");
  saveReceipt('f8_submit_receipt', f8Submit.receipt);

  // --- F9: PR #10 (Missing Marker Rejection) ---
  console.log("\n--- Case F9: No Wallet Marker Rejection ---");
  const f9Create = await sendTx(creatorClient, escrowAddress, 'create_bounty', ["Bounty F9 No Marker", "huzyow155/ship-escrow-fixtures", critPartialReq, "[]", "50"], "create_bounty_f9");
  saveReceipt('f9_create_receipt', f9Create.receipt);
  const f9Data = fixtures.find(f => f.fixture_id === 'F9');
  const f9Submit = await sendTx(devClient, escrowAddress, 'submit_work', ["9", f9Data.pr_url, f9Data.head_sha], "submit_f9_no_marker");
  saveReceipt('f9_submit_receipt', f9Submit.receipt);

  // --- F10: PR #11 (Partial Required Prefix -> REFUND) ---
  console.log("\n--- Case F10: Partial Required Prefix (REFUND) ---");
  const f10Create = await sendTx(creatorClient, escrowAddress, 'create_bounty', ["Bounty F10 Prefix", "huzyow155/ship-escrow-fixtures", critPartialReq, pathsDual, "50"], "create_bounty_f10");
  saveReceipt('f10_create_receipt', f10Create.receipt);
  const f10Data = fixtures.find(f => f.fixture_id === 'F10');
  const f10Submit = await sendTx(devClient, escrowAddress, 'submit_work', ["10", f10Data.pr_url, f10Data.head_sha], "submit_f10");
  saveReceipt('f10_submit_receipt', f10Submit.receipt);

  // --- F11: PR #12 (Non-test Deleted File -> RELEASE_100) ---
  console.log("\n--- Case F11: Non-test Deleted File (RELEASE_100) ---");
  const f11Create = await sendTx(creatorClient, escrowAddress, 'create_bounty', ["Bounty F11 Clean Delete", "huzyow155/ship-escrow-fixtures", critPartialReq, "[]", "50"], "create_bounty_f11");
  saveReceipt('f11_create_receipt', f11Create.receipt);
  const f11Data = fixtures.find(f => f.fixture_id === 'F11');
  const f11Submit = await sendTx(devClient, escrowAddress, 'submit_work', ["11", f11Data.pr_url, f11Data.head_sha], "submit_f11");
  saveReceipt('f11_submit_receipt', f11Submit.receipt);

  // --- F12: PR #13 (Oversize Diff > 14k -> REVIEW) ---
  console.log("\n--- Case F12: Oversize Diff (REVIEW) ---");
  const f12Create = await sendTx(creatorClient, escrowAddress, 'create_bounty', ["Bounty F12 Truncated", "huzyow155/ship-escrow-fixtures", critPartialReq, "[]", "50"], "create_bounty_f12");
  saveReceipt('f12_create_receipt', f12Create.receipt);
  const f12Data = fixtures.find(f => f.fixture_id === 'F12');
  const f12Submit = await sendTx(devClient, escrowAddress, 'submit_work', ["12", f12Data.pr_url, f12Data.head_sha], "submit_f12");
  saveReceipt('f12_submit_receipt', f12Submit.receipt);

  // -------------------------------------------------------------------------
  // 3. Ledger Lifecycle: Cancel & Exhaustion
  // -------------------------------------------------------------------------
  console.log("\n--- Step 3: Ledger Lifecycle Flows ---");
  // Refusal: Creator tries to cancel Bounty 3 (attempts > 0)
  const cancelRefused = await sendTx(creatorClient, escrowAddress, 'cancel_bounty', ["3"], "cancel_bounty_3_refused");
  saveReceipt('case_ledger_cancel_refused', cancelRefused.receipt);

  // Legitimate Cancel: Create Bounty 13 and cancel while attempts == 0
  const b13Create = await sendTx(creatorClient, escrowAddress, 'create_bounty', ["Bounty 13 Cancellable", "huzyow155/ship-escrow-fixtures", critPartialReq, "[]", "50"], "create_bounty_13");
  saveReceipt('case_ledger_create_13', b13Create.receipt);

  const b13Cancel = await sendTx(creatorClient, escrowAddress, 'cancel_bounty', ["13"], "cancel_bounty_13");
  saveReceipt('case_ledger_cancel_13', b13Cancel.receipt);

  // Invariant check
  const inv2 = await creatorClient.readContract({ address: escrowAddress, functionName: 'get_ledger_invariant', args: [] });
  console.log("    Ledger Invariant after cancel:", inv2);

  // -------------------------------------------------------------------------
  // 4. Reputation Sync V2
  // -------------------------------------------------------------------------
  console.log("\n--- Step 4: ShipReputationV2 Synchronizations ---");
  // Sync Bounty 1 (100% payout) with min_payout_pct = 100
  const sync1 = await sendTx(devClient, repAddress, 'sync', ["1", 100], "reputation_sync_bounty_1");
  saveReceipt('reputation_sync_b1_receipt', sync1.receipt);

  // Duplicate sync on Bounty 1 -> Reverts
  const sync1Dup = await sendTx(devClient, repAddress, 'sync', ["1", 100], "reputation_sync_b1_dup");
  saveReceipt('reputation_sync_b1_dup_receipt', sync1Dup.receipt);

  // Refusal: Sync Bounty 4 (partial payout) with min_payout_pct = 100 -> Reverts
  const sync4Refused = await sendTx(devClient, repAddress, 'sync', ["4", 100], "reputation_sync_b4_refused");
  saveReceipt('reputation_sync_b4_refused_receipt', sync4Refused.receipt);

  // Accepted: Sync Bounty 4 with min_payout_pct = 50 -> Success
  const sync4Accepted = await sendTx(devClient, repAddress, 'sync', ["4", 50], "reputation_sync_b4_accepted");
  saveReceipt('reputation_sync_b4_accepted_receipt', sync4Accepted.receipt);

  // Read reputation scores
  const devScore = await devClient.readContract({ address: repAddress, functionName: 'get_dev_score', args: [devAccount.address] });
  console.log("    Dev Reputation Score:", devScore);
  const creatorScore = await creatorClient.readContract({ address: repAddress, functionName: 'get_creator_score', args: [creatorAccount.address] });
  console.log("    Creator Reputation Score:", creatorScore);

  // -------------------------------------------------------------------------
  // 5. Final Invariant & Stats
  // -------------------------------------------------------------------------
  const finalInvariant = await creatorClient.readContract({ address: escrowAddress, functionName: 'get_ledger_invariant', args: [] });
  console.log("\n====================================================");
  console.log("FINAL LEDGER INVARIANT:", finalInvariant);
  fs.writeFileSync(path.join(evidenceDir, 'ledger_invariant_final.json'), finalInvariant);

  const finalStats = await creatorClient.readContract({ address: escrowAddress, functionName: 'get_stats', args: [] });
  console.log("FINAL STATS:", finalStats);
  fs.writeFileSync(path.join(evidenceDir, 'stats_final_v2.json'), finalStats);

  // Save full transaction catalog
  fs.writeFileSync(path.join(evidenceDir, 'live_evidence_v2.json'), JSON.stringify(evidenceIndex, null, 2));
  console.log("\n====================================================");
  console.log(`Studionet on-chain evidence run complete. Saved to ${evidenceDir}`);
  console.log("====================================================");
}

main().catch(err => {
  console.error("Evidence run failed:", err);
  process.exit(1);
});
