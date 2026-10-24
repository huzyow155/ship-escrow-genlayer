const { createClient, chains, createAccount } = require('genlayer-js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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
const section4Dir = path.join(__dirname, '../docs/evidence_v2/section4');
if (!fs.existsSync(section4Dir)) {
  fs.mkdirSync(section4Dir, { recursive: true });
}

const creatorAccount = createAccount(env.CREATOR_PRIVATE_KEY);
const devAccount = createAccount(env.DEV_PRIVATE_KEY);
const attackerAccount = createAccount(env.ATTACKER_PRIVATE_KEY);

const creatorClient = createClient({ chain: chains.studionet, account: creatorAccount });
const devClient = createClient({ chain: chains.studionet, account: devAccount });
const attackerClient = createClient({ chain: chains.studionet, account: attackerAccount });

const fixtures = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../fixtures/fixtures_v2.json'), 'utf8')
);

const OWNER_REPO = "huzyow155/ship-escrow-fixtures";
const getPrUrl = (f) => f.pr_url;

const f1 = fixtures.find(f => f.fixture_id === 'F1');
const f2 = fixtures.find(f => f.fixture_id === 'F2');
const f3 = fixtures.find(f => f.fixture_id === 'F3');
const f9 = fixtures.find(f => f.fixture_id === 'F9'); // unbound PR #10

const critClean = JSON.stringify([
  { level: "MUST", text: "Implement slugify in src/slug.py" },
  { level: "MUST", text: "Add unit tests in tests/test_slug.py" }
]);
const critTrap = JSON.stringify([
  { level: "MUST", text: "Implement slugify in src/slug.py" }
]);
const pathsTrap = JSON.stringify(["src/", "tests/"]);

function generateWallet() {
  const priv = '0x' + crypto.randomBytes(32).toString('hex');
  const acc = createAccount(priv);
  const client = createClient({ chain: chains.studionet, account: acc });
  return { privateKey: priv, address: acc.address, client };
}

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
  const raw = await creatorClient.readContract({
    address: escrowAddress,
    functionName: 'get_bounty',
    args: [bountyId]
  });
  return JSON.parse(raw);
}

async function getBalanceSnapshot(addr) {
  const bal = await creatorClient.readContract({
    address: escrowAddress,
    functionName: 'get_balance',
    args: [addr]
  });
  return bal;
}

async function getInvariantSnapshot() {
  const inv = await creatorClient.readContract({
    address: escrowAddress,
    functionName: 'get_ledger_invariant',
    args: []
  });
  return JSON.parse(inv);
}

const proofLog = {
  executed_at: new Date().toISOString(),
  contract: escrowAddress,
  cases: {},
};

async function main() {
  console.log("====================================================");
  console.log("EXECUTING ON-CHAIN SECTION 4 PROOF CASES");
  console.log(`Contract: ${escrowAddress}`);
  console.log("====================================================");

  // -------------------------------------------------------------------------
  // Case S4-1: SHA Poisoning Defense
  // -------------------------------------------------------------------------
  console.log("\n====================================================");
  console.log("CASE S4-1: SHA POISONING DEFENSE");
  console.log("====================================================");
  const c1Create = await sendTx(
    creatorClient,
    escrowAddress,
    'create_bounty',
    ["S4-1 Poisoning Target", OWNER_REPO, critClean, "[]", "10"],
    "s4_1_create"
  );
  const b1Recents = await creatorClient.readContract({ address: escrowAddress, functionName: 'list_bounties', args: [1] });
  const b1Id = b1Recents[0];
  console.log(`Created Bounty S4-1 ID: ${b1Id}`);

  const b1Before = await getBountySnapshot(b1Id);
  console.log("  Snapshot before attack:", b1Before);

  // Attacker submits wrong sha
  const fakeSha = "0000000000000000000000000000000000000000";
  const c1Attack = await sendTx(
    attackerClient,
    escrowAddress,
    'submit_work',
    [b1Id, getPrUrl(f1), fakeSha],
    "s4_1_attacker_fake_sha"
  );
  fs.writeFileSync(path.join(section4Dir, 's4_1_attacker_receipt.json'), JSON.stringify(c1Attack.receipt, null, 2));

  const b1AfterAttack = await getBountySnapshot(b1Id);
  console.log("  Snapshot after attack:", b1AfterAttack);

  // Genuine Dev submits real sha
  const c1Genuine = await sendTx(
    devClient,
    escrowAddress,
    'submit_work',
    [b1Id, getPrUrl(f1), f1.head_sha],
    "s4_1_genuine_dev_submit"
  );
  fs.writeFileSync(path.join(section4Dir, 's4_1_genuine_dev_receipt.json'), JSON.stringify(c1Genuine.receipt, null, 2));

  const b1Final = await getBountySnapshot(b1Id);
  console.log("  Snapshot final:", b1Final);

  proofLog.cases.S4_1 = {
    title: "SHA Poisoning Defense",
    bounty_id: b1Id,
    bounty_snapshot_before: b1Before,
    attack_tx: c1Attack.txHash,
    attack_status: c1Attack.receipt.status_name,
    attack_exec: c1Attack.receipt.consensus_data?.leader_receipt?.[0]?.execution_result,
    bounty_snapshot_after_attack: b1AfterAttack,
    genuine_tx: c1Genuine.txHash,
    genuine_status: c1Genuine.receipt.status_name,
    genuine_exec: c1Genuine.receipt.consensus_data?.leader_receipt?.[0]?.execution_result,
    bounty_snapshot_final: b1Final,
    passed: (
      b1AfterAttack.attempts === "0" &&
      b1Final.status === "SETTLED" &&
      b1Final.attempts === "1"
    ),
  };

  // -------------------------------------------------------------------------
  // Case S4-2: Legitimate Recovery Flow (REVIEW -> RELEASE_100)
  // -------------------------------------------------------------------------
  console.log("\n====================================================");
  console.log("CASE S4-2: LEGITIMATE RECOVERY FLOW");
  console.log("====================================================");
  const c2Create = await sendTx(
    creatorClient,
    escrowAddress,
    'create_bounty',
    ["S4-2 Recovery Target", OWNER_REPO, critClean, "[]", "10"],
    "s4_2_create"
  );
  const b2Recents = await creatorClient.readContract({ address: escrowAddress, functionName: 'list_bounties', args: [1] });
  const b2Id = b2Recents[0];
  console.log(`Created Bounty S4-2 ID: ${b2Id}`);

  const devBalBefore2 = await getBalanceSnapshot(devAccount.address);
  const b2Before = await getBountySnapshot(b2Id);
  console.log(`  Dev balance before: ${devBalBefore2}, Bounty attempts: ${b2Before.attempts}`);

  // Attempt 1: Dev submits PR #4 (Trap Deleted Test Files) -> REVIEW
  const c2Attempt1 = await sendTx(
    devClient,
    escrowAddress,
    'submit_work',
    [b2Id, getPrUrl(f3), f3.head_sha],
    "s4_2_attempt1_review"
  );
  fs.writeFileSync(path.join(section4Dir, 's4_2_attempt1_receipt.json'), JSON.stringify(c2Attempt1.receipt, null, 2));

  const devBalAfterReview = await getBalanceSnapshot(devAccount.address);
  const b2AfterReview = await getBountySnapshot(b2Id);
  console.log(`  Dev balance after REVIEW: ${devBalAfterReview} (Bond returned!), Bounty attempts: ${b2AfterReview.attempts}`);

  // Attempt 2: Dev submits PR #2 (Clean) -> RELEASE_100
  const c2Attempt2 = await sendTx(
    devClient,
    escrowAddress,
    'submit_work',
    [b2Id, getPrUrl(f1), f1.head_sha],
    "s4_2_attempt2_release"
  );
  fs.writeFileSync(path.join(section4Dir, 's4_2_attempt2_receipt.json'), JSON.stringify(c2Attempt2.receipt, null, 2));

  const devBalAfterRelease = await getBalanceSnapshot(devAccount.address);
  const b2Final = await getBountySnapshot(b2Id);
  console.log(`  Dev balance after RELEASE: ${devBalAfterRelease}, Bounty attempts: ${b2Final.attempts}, Status: ${b2Final.status}`);

  proofLog.cases.S4_2 = {
    title: "Legitimate Recovery Flow",
    bounty_id: b2Id,
    dev_balance_before: devBalBefore2,
    attempt1_tx: c2Attempt1.txHash,
    attempt1_exec: c2Attempt1.receipt.consensus_data?.leader_receipt?.[0]?.execution_result,
    dev_balance_after_review: devBalAfterReview,
    bounty_after_review: b2AfterReview,
    attempt2_tx: c2Attempt2.txHash,
    attempt2_exec: c2Attempt2.receipt.consensus_data?.leader_receipt?.[0]?.execution_result,
    dev_balance_after_release: devBalAfterRelease,
    bounty_final: b2Final,
    passed: (
      devBalAfterReview === devBalBefore2 && // 50 bond returned on REVIEW
      b2AfterReview.attempts === "1" &&
      b2Final.attempts === "2" &&
      b2Final.status === "SETTLED"
    ),
  };

  // -------------------------------------------------------------------------
  // Case S4-3: Exhaustion Flow & Escrow Refund
  // -------------------------------------------------------------------------
  console.log("\n====================================================");
  console.log("CASE S4-3: EXHAUSTION & ESCROW REFUND");
  console.log("====================================================");
  // Creator creates bounty with 20 credits
  const c3Create = await sendTx(
    creatorClient,
    escrowAddress,
    'create_bounty',
    ["S4-3 Exhaustion Target", OWNER_REPO, critTrap, pathsTrap, "20"],
    "s4_3_create"
  );
  const b3Recents = await creatorClient.readContract({ address: escrowAddress, functionName: 'list_bounties', args: [1] });
  const b3Id = b3Recents[0];
  console.log(`Created Bounty S4-3 ID: ${b3Id}`);

  // Setup Dev3 account from .env
  const dev3Account = createAccount(env.DEV3_PRIVATE_KEY);
  const dev3Client = createClient({ chain: chains.studionet, account: dev3Account });

  // Claim demo credits if not claimed
  const dev3Claimed = await creatorClient.readContract({ address: escrowAddress, functionName: 'has_claimed_demo', args: [dev3Account.address] });
  if (!dev3Claimed) {
    await sendTx(dev3Client, escrowAddress, 'claim_demo_credits', [], 'dev3_claim');
  }

  // Dev 1: Attempt 1 -> PR #3 (missing required path) -> REFUND (attempts = 1, dev1_attempts = 1)
  const att1 = await sendTx(devClient, escrowAddress, 'submit_work', [b3Id, getPrUrl(f2), f2.head_sha], "s4_3_dev1_att1");
  // Dev 1: Attempt 2 -> PR #4 (Deleted tests trap) -> REVIEW (attempts = 2, dev1_attempts = 2)
  const att2 = await sendTx(devClient, escrowAddress, 'submit_work', [b3Id, getPrUrl(f3), f3.head_sha], "s4_3_dev1_att2");

  // Dev 1: Attempt 3 -> Developer attempt limit reached!
  console.log("  Testing Dev 1 Attempt 3 refusal (Developer attempt limit reached)...");
  const att3Refused = await sendTx(devClient, escrowAddress, 'submit_work', [b3Id, getPrUrl(f1), f1.head_sha], "s4_3_dev1_att3_refused");
  fs.writeFileSync(path.join(section4Dir, 's4_3_dev1_refused_receipt.json'), JSON.stringify(att3Refused.receipt, null, 2));

  // Dev 2 (Attacker): Attempt 1 -> PR #9 -> REFUND (attempts = 3, dev2_attempts = 1)
  const f8 = fixtures.find(f => f.fixture_id === 'F8');
  const d2Att1 = await sendTx(attackerClient, escrowAddress, 'submit_work', [b3Id, getPrUrl(f8), f8.head_sha], "s4_3_dev2_att1");

  // Dev 2 (Attacker): Attempt 2 -> PR #14 -> REFUND (attempts = 4, dev2_attempts = 2)
  const pr14Url = "https://github.com/huzyow155/ship-escrow-fixtures/pull/14";
  const pr14Sha = "1c5a18f3bfd67ebfad84ce89baa3a39fa912b300";
  const d2Att2 = await sendTx(attackerClient, escrowAddress, 'submit_work', [b3Id, pr14Url, pr14Sha], "s4_3_dev2_att2");

  // Dev 3: Attempt 1 -> PR #15 -> REFUND (attempts = 5, dev3_attempts = 1)
  const pr15Url = "https://github.com/huzyow155/ship-escrow-fixtures/pull/15";
  const pr15Sha = "11ebccb1cc58c391d4071e94c431538e2636f525";
  const d3Att1 = await sendTx(dev3Client, escrowAddress, 'submit_work', [b3Id, pr15Url, pr15Sha], "s4_3_dev3_att1");

  // Dev 3: Attempt 2 -> PR #16 -> REFUND (attempts = 6 -> EXHAUSTED!)
  const pr16Url = "https://github.com/huzyow155/ship-escrow-fixtures/pull/16";
  const pr16Sha = "b72cca47464dad7f47a7430e811a37e0a1ba329d";
  const d3Att2 = await sendTx(dev3Client, escrowAddress, 'submit_work', [b3Id, pr16Url, pr16Sha], "s4_3_dev3_att2");
  fs.writeFileSync(path.join(section4Dir, 's4_3_exhausted_receipt.json'), JSON.stringify(d3Att2.receipt, null, 2));

  const b3Exhausted = await getBountySnapshot(b3Id);
  console.log(`  Bounty attempts: ${b3Exhausted.attempts}, Status: ${b3Exhausted.status}`);

  // Creator calls refund_exhausted
  const creatorBalBeforeRefund = await getBalanceSnapshot(creatorAccount.address);
  const refundTx = await sendTx(creatorClient, escrowAddress, 'refund_exhausted', [b3Id], "s4_3_refund_exhausted");
  fs.writeFileSync(path.join(section4Dir, 's4_3_refund_receipt.json'), JSON.stringify(refundTx.receipt, null, 2));

  const creatorBalAfterRefund = await getBalanceSnapshot(creatorAccount.address);
  const b3Refunded = await getBountySnapshot(b3Id);
  const inv3 = await getInvariantSnapshot();

  console.log(`  Creator bal before refund: ${creatorBalBeforeRefund}, after: ${creatorBalAfterRefund} (+20 recovered!)`);
  console.log(`  Final Bounty Status: ${b3Refunded.status}`);
  console.log("  Ledger invariant after refund:", inv3);

  proofLog.cases.S4_3 = {
    title: "Exhaustion & Escrow Refund Flow",
    bounty_id: b3Id,
    dev1_attempt1_tx: att1.txHash,
    dev1_refused_tx: att3Refused.txHash,
    dev1_refused_exec: att3Refused.receipt.consensus_data?.leader_receipt?.[0]?.execution_result,
    dev2_attempt1_tx: d2Att1.txHash,
    dev2_attempt2_tx: d2Att2.txHash,
    dev3_attempt1_tx: d3Att1.txHash,
    dev3_attempt2_tx: d3Att2.txHash,
    bounty_exhausted_snapshot: b3Exhausted,
    refund_tx: refundTx.txHash,
    creator_bal_before_refund: creatorBalBeforeRefund,
    creator_bal_after_refund: creatorBalAfterRefund,
    bounty_refunded_snapshot: b3Refunded,
    invariant_after: inv3,
    passed: (
      att3Refused.receipt.consensus_data?.leader_receipt?.[0]?.execution_result === "ERROR" &&
      b3Exhausted.status === "EXHAUSTED" &&
      b3Exhausted.attempts === "6" &&
      b3Refunded.status === "REFUNDED" &&
      Number(creatorBalAfterRefund) === Number(creatorBalBeforeRefund) + 20 &&
      inv3.invariant_holds
    ),
  };

  // -------------------------------------------------------------------------
  // Case S4-4: Copied Submission Defense
  // -------------------------------------------------------------------------
  console.log("\n====================================================");
  console.log("CASE S4-4: COPIED SUBMISSION DEFENSE");
  console.log("====================================================");
  const c4Create = await sendTx(
    creatorClient,
    escrowAddress,
    'create_bounty',
    ["S4-4 Copied Target", OWNER_REPO, critClean, "[]", "10"],
    "s4_4_create"
  );
  const b4Recents = await creatorClient.readContract({ address: escrowAddress, functionName: 'list_bounties', args: [1] });
  const b4Id = b4Recents[0];
  console.log(`Created Bounty S4-4 ID: ${b4Id}`);

  // Attacker tries to submit Dev's PR #2
  const c4Theft = await sendTx(
    attackerClient,
    escrowAddress,
    'submit_work',
    [b4Id, getPrUrl(f1), f1.head_sha],
    "s4_4_attacker_theft"
  );
  fs.writeFileSync(path.join(section4Dir, 's4_4_theft_receipt.json'), JSON.stringify(c4Theft.receipt, null, 2));

  const b4AfterTheft = await getBountySnapshot(b4Id);
  console.log("  Snapshot after theft attempt:", b4AfterTheft);

  // Dev submits genuine
  const c4Genuine = await sendTx(
    devClient,
    escrowAddress,
    'submit_work',
    [b4Id, getPrUrl(f1), f1.head_sha],
    "s4_4_dev_genuine"
  );
  fs.writeFileSync(path.join(section4Dir, 's4_4_genuine_receipt.json'), JSON.stringify(c4Genuine.receipt, null, 2));

  const b4Final = await getBountySnapshot(b4Id);
  console.log("  Snapshot final:", b4Final);

  proofLog.cases.S4_4 = {
    title: "Copied Submission Defense",
    bounty_id: b4Id,
    theft_tx: c4Theft.txHash,
    theft_exec: c4Theft.receipt.consensus_data?.leader_receipt?.[0]?.execution_result,
    bounty_after_theft: b4AfterTheft,
    genuine_tx: c4Genuine.txHash,
    genuine_exec: c4Genuine.receipt.consensus_data?.leader_receipt?.[0]?.execution_result,
    bounty_final: b4Final,
    passed: (
      c4Theft.receipt.consensus_data?.leader_receipt?.[0]?.execution_result === "ERROR" &&
      b4AfterTheft.attempts === "0" &&
      b4Final.status === "SETTLED"
    ),
  };

  // -------------------------------------------------------------------------
  // Case S4-5: Sybil Exhaustion Resistance
  // -------------------------------------------------------------------------
  console.log("\n====================================================");
  console.log("CASE S4-5: SYBIL EXHAUSTION RESISTANCE");
  console.log("====================================================");
  const c5Create = await sendTx(
    creatorClient,
    escrowAddress,
    'create_bounty',
    ["S4-5 Sybil Target", OWNER_REPO, critClean, "[]", "10"],
    "s5_create"
  );
  const b5Recents = await creatorClient.readContract({ address: escrowAddress, functionName: 'list_bounties', args: [1] });
  const b5Id = b5Recents[0];
  console.log(`Created Bounty S4-5 ID: ${b5Id}`);

  const b5Initial = await getBountySnapshot(b5Id);

  // 3 Attacker submissions with unbound PR #10
  const syb1 = await sendTx(attackerClient, escrowAddress, 'submit_work', [b5Id, getPrUrl(f9), f9.head_sha], "s4_5_sybil1");
  const syb2 = await sendTx(attackerClient, escrowAddress, 'submit_work', [b5Id, getPrUrl(f9), f9.head_sha], "s4_5_sybil2");
  const syb3 = await sendTx(attackerClient, escrowAddress, 'submit_work', [b5Id, getPrUrl(f9), f9.head_sha], "s4_5_sybil3");

  const b5AfterSybil = await getBountySnapshot(b5Id);
  console.log(`  Bounty attempts after 3 sybil attacks: ${b5AfterSybil.attempts}`);

  // Legitimate Dev submits
  const c5Dev = await sendTx(devClient, escrowAddress, 'submit_work', [b5Id, getPrUrl(f1), f1.head_sha], "s4_5_dev_settle");
  const b5Final = await getBountySnapshot(b5Id);

  proofLog.cases.S4_5 = {
    title: "Sybil Exhaustion Resistance",
    bounty_id: b5Id,
    bounty_initial: b5Initial,
    sybil_txs: [syb1.txHash, syb2.txHash, syb3.txHash],
    bounty_after_sybil: b5AfterSybil,
    dev_tx: c5Dev.txHash,
    bounty_final: b5Final,
    passed: (
      b5AfterSybil.attempts === "0" &&
      b5Final.attempts === "1" &&
      b5Final.status === "SETTLED"
    ),
  };

  // -------------------------------------------------------------------------
  // Case S4-6: Submission Bond Accounting Invariants
  // -------------------------------------------------------------------------
  console.log("\n====================================================");
  console.log("CASE S4-6: SUBMISSION BOND INVARIANTS");
  console.log("====================================================");
  // Trace 1: Forfeited on REFUND
  const c6ACreate = await sendTx(creatorClient, escrowAddress, 'create_bounty', ["S4-6A Bond Forfeit", OWNER_REPO, critTrap, pathsTrap, "10"], "s4_6a_create");
  const b6ARecents = await creatorClient.readContract({ address: escrowAddress, functionName: 'list_bounties', args: [1] });
  const b6AId = b6ARecents[0];

  const creatorBal0 = await getBalanceSnapshot(creatorAccount.address);
  const devBal0 = await getBalanceSnapshot(devAccount.address);
  const invBefore6A = await getInvariantSnapshot();

  const c6ASubmit = await sendTx(devClient, escrowAddress, 'submit_work', [b6AId, getPrUrl(f2), f2.head_sha], "s4_6a_submit_refund");
  fs.writeFileSync(path.join(section4Dir, 's4_6a_refund_receipt.json'), JSON.stringify(c6ASubmit.receipt, null, 2));

  const creatorBal1 = await getBalanceSnapshot(creatorAccount.address);
  const devBal1 = await getBalanceSnapshot(devAccount.address);
  const invAfter6A = await getInvariantSnapshot();

  console.log(`  Trace 1 (REFUND): Creator bal ${creatorBal0} -> ${creatorBal1} (+50 bond received!)`);
  console.log(`  Trace 1 (REFUND): Dev bal ${devBal0} -> ${devBal1} (-50 bond forfeited!)`);
  console.log("  Trace 1 Invariant holds:", invAfter6A.invariant_holds);

  // Trace 2: Returned on RELEASE
  const c6BCreate = await sendTx(creatorClient, escrowAddress, 'create_bounty', ["S4-6B Bond Return", OWNER_REPO, critClean, "[]", "10"], "s4_6b_create");
  const b6BRecents = await creatorClient.readContract({ address: escrowAddress, functionName: 'list_bounties', args: [1] });
  const b6BId = b6BRecents[0];

  const creatorBal2 = await getBalanceSnapshot(creatorAccount.address);
  const devBal2 = await getBalanceSnapshot(devAccount.address);

  const c6BSubmit = await sendTx(devClient, escrowAddress, 'submit_work', [b6BId, getPrUrl(f1), f1.head_sha], "s4_6b_submit_release");
  fs.writeFileSync(path.join(section4Dir, 's4_6b_release_receipt.json'), JSON.stringify(c6BSubmit.receipt, null, 2));

  const creatorBal3 = await getBalanceSnapshot(creatorAccount.address);
  const devBal3 = await getBalanceSnapshot(devAccount.address);
  const invAfter6B = await getInvariantSnapshot();

  console.log(`  Trace 2 (RELEASE): Creator bal ${creatorBal2} -> ${creatorBal3}`);
  console.log(`  Trace 2 (RELEASE): Dev bal ${devBal2} -> ${devBal3} (+10 payout earned, bond fully returned!)`);
  console.log("  Trace 2 Invariant holds:", invAfter6B.invariant_holds);

  proofLog.cases.S4_6 = {
    title: "Submission Bond Accounting Invariants",
    trace1_refund: {
      bounty_id: b6AId,
      creator_bal_before: creatorBal0,
      creator_bal_after: creatorBal1,
      dev_bal_before: devBal0,
      dev_bal_after: devBal1,
      invariant_holds: invAfter6A.invariant_holds,
    },
    trace2_release: {
      bounty_id: b6BId,
      creator_bal_before: creatorBal2,
      creator_bal_after: creatorBal3,
      dev_bal_before: devBal2,
      dev_bal_after: devBal3,
      invariant_holds: invAfter6B.invariant_holds,
    },
    passed: (
      Number(creatorBal1) === Number(creatorBal0) + 50 &&
      Number(devBal1) === Number(devBal0) - 50 &&
      Number(devBal3) === Number(devBal2) + 10 &&
      invAfter6A.invariant_holds &&
      invAfter6B.invariant_holds
    ),
  };

  const finalSummaryPath = path.join(section4Dir, 'section4_proofs_summary.json');
  fs.writeFileSync(finalSummaryPath, JSON.stringify(proofLog, null, 2));
  console.log(`\n====================================================`);
  console.log(`SECTION 4 PROOFS FINISHED. Saved to: ${finalSummaryPath}`);
  console.log("====================================================");
}

main().catch(err => {
  console.error("Section 4 proofs failed:", err);
  process.exit(1);
});
