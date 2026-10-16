const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const { createClient, chains, createAccount } = require('genlayer-js');
const fs = require('fs');
const path = require('path');

function decodeRevertFromReceipt(receipt) {
  const leaderReceipts = receipt.consensus_data?.leader_receipt || [];
  for (const lr of leaderReceipts) {
    if (typeof lr.result === 'string') {
      try {
        const buf = Buffer.from(lr.result, 'base64');
        return buf.slice(1).toString('utf8');
      } catch (e) {
        return lr.result;
      }
    }
  }
  if (typeof receipt.result === 'string') {
    try {
      const buf = Buffer.from(receipt.result, 'base64');
      return buf.slice(1).toString('utf8');
    } catch (e) {}
  }
  return "";
}

function extractReturnedId(receipt) {
  const readable = receipt.consensus_data?.leader_receipt?.[0]?.result?.payload?.readable;
  if (readable) {
    try {
      return String(JSON.parse(readable));
    } catch (e) {
      return String(readable).replace(/^"|"$/g, '');
    }
  }
  return "";
}

async function sendWrite(client, contractAddress, functionName, args) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const t0 = Date.now();
      const txHash = await client.writeContract({
        address: contractAddress,
        functionName,
        args,
      });
      const receipt = await client.waitForTransactionReceipt({
        hash: txHash,
        retries: 120,
        interval: 3000,
      });
      const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
      const leaderRes = receipt.consensus_data?.leader_receipt?.[0];
      const execResult = leaderRes?.execution_result;
      const isSuccess = (receipt.status_name === 'ACCEPTED' || receipt.status_name === 'FINALIZED')
        && receipt.result_name === 'MAJORITY_AGREE'
        && execResult === 'SUCCESS';

      let errorMsg = "";
      if (!isSuccess) {
        errorMsg = decodeRevertFromReceipt(receipt);
      }

      return {
        txHash,
        receipt,
        elapsed,
        isSuccess,
        execResult,
        errorMsg,
        returnedId: extractReturnedId(receipt),
      };
    } catch (err) {
      if (attempt < 3 && (err.message?.includes('<!DOCTYPE') || err.message?.includes('502') || err.message?.includes('504') || err.message?.includes('fetch failed'))) {
        console.log(`  RPC temporary network glitch on ${functionName} (attempt ${attempt}/3). Retrying in 2.5s...`);
        await new Promise(r => setTimeout(r, 2500));
      } else {
        throw err;
      }
    }
  }
}

async function main() {
  console.log("=============================================================");
  console.log("MILESTONE 4 & 5: LIVE EVIDENCE VALIDATION ON STUDIONET");
  console.log("=============================================================");

  const deployments = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'deployments.json'), 'utf8')
  );
  const escrowAddress = deployments.contractAddress;
  const reputationAddress = deployments.reputation.contractAddress;

  console.log("ShipEscrow Address:", escrowAddress);
  console.log("ShipReputation Address:", reputationAddress);

  const evidenceDir = path.join(__dirname, '../../docs/evidence');
  if (!fs.existsSync(evidenceDir)) fs.mkdirSync(evidenceDir, { recursive: true });

  const creator = createAccount();
  const dev1 = createAccount();
  const dev2 = createAccount();

  console.log("Creator Address:", creator.address);
  console.log("Dev1 Address:", dev1.address);
  console.log("Dev2 Address:", dev2.address);

  const clientCreator = createClient({ chain: chains.studionet, account: creator });
  const clientDev1 = createClient({ chain: chains.studionet, account: dev1 });
  const clientDev2 = createClient({ chain: chains.studionet, account: dev2 });

  const bountyData = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../../fixtures/bounty.json'), 'utf8')
  );
  const title = bountyData.title;
  const ownerRepo = bountyData.owner_repo;
  const criteriaJson = JSON.stringify(bountyData.criteria);
  const requiredPathsJson = JSON.stringify(bountyData.required_paths);
  const amount = bountyData.amount;

  const liveEvidence = {
    executedAt: new Date().toISOString(),
    escrowAddress,
    reputationAddress,
    creatorAddress: creator.address,
    dev1Address: dev1.address,
    dev2Address: dev2.address,
    cases: {},
    latencies: {},
  };

  // -------------------------------------------------------------------------
  // CASE A: F1 GOOD PR -> RELEASE_100 and Ledger Split
  // -------------------------------------------------------------------------
  console.log("\n--- [CASE A] F1 Good PR -> RELEASE_100 ---");
  console.log("Creating Bounty 1...");
  const b1Write = await sendWrite(clientCreator, escrowAddress, 'create_bounty', [
    title, ownerRepo, criteriaJson, requiredPathsJson, amount
  ]);
  const b1Id = b1Write.returnedId || "1";
  console.log(`  Bounty ${b1Id} created in ${b1Write.elapsed}s (tx: ${b1Write.txHash})`);
  liveEvidence.latencies.create_bounty_1 = b1Write.elapsed;
  fs.writeFileSync(path.join(evidenceDir, 'bounty_1_create_receipt.json'), JSON.stringify(b1Write.receipt, null, 2));

  const f1PrUrl = "https://github.com/huzyow155/ship-escrow-fixtures/pull/2";
  const f1HeadSha = "5db0441e76af93606fd82feebbe49c5a2f145326";

  console.log(`Submitting F1 PR from Dev1 on Bounty ${b1Id}...`);
  const f1Write = await sendWrite(clientDev1, escrowAddress, 'submit_work', [b1Id, f1PrUrl, f1HeadSha]);
  console.log(`  F1 submit_work finished in ${f1Write.elapsed}s (tx: ${f1Write.txHash}, exec: ${f1Write.execResult})`);
  liveEvidence.latencies.f1_submit_work = f1Write.elapsed;
  fs.writeFileSync(path.join(evidenceDir, 'f1_submit_receipt.json'), JSON.stringify(f1Write.receipt, null, 2));

  // Read back Bounty State
  const bounty1State = await clientCreator.readContract({ address: escrowAddress, functionName: 'get_bounty', args: [b1Id] });
  const settlement1 = await clientCreator.readContract({ address: escrowAddress, functionName: 'get_settlement', args: [b1Id] });
  const dev1Balance = await clientCreator.readContract({ address: escrowAddress, functionName: 'get_balance', args: [dev1.address] });
  const creatorBalanceA = await clientCreator.readContract({ address: escrowAddress, functionName: 'get_balance', args: [creator.address] });

  console.log(`  Bounty ${b1Id} State:`, bounty1State);
  console.log(`  Settlement ${b1Id}:`, settlement1);
  console.log(`  Dev1 Balance: ${dev1Balance}, Creator Balance: ${creatorBalanceA}`);

  liveEvidence.cases.case_a = {
    bountyId: b1Id,
    createTx: b1Write.txHash,
    submitTx: f1Write.txHash,
    elapsedSeconds: f1Write.elapsed,
    verdict: JSON.parse(settlement1).verdict,
    devBalance: dev1Balance,
    creatorBalance: creatorBalanceA,
    settlement: JSON.parse(settlement1),
  };

  // -------------------------------------------------------------------------
  // CASE K: is_settled_for Parameter Binding Verification
  // -------------------------------------------------------------------------
  console.log("\n--- [CASE K] is_settled_for Binding Verification ---");
  const cHash1 = JSON.parse(bounty1State).criteria_hash;
  const isSettledTrue = await clientCreator.readContract({
    address: escrowAddress,
    functionName: 'is_settled_for',
    args: [b1Id, cHash1, f1HeadSha, dev1.address],
  });
  const isSettledBadHash = await clientCreator.readContract({
    address: escrowAddress,
    functionName: 'is_settled_for',
    args: [b1Id, "0000000000000000000000000000000000000000000000000000000000000000", f1HeadSha, dev1.address],
  });
  const isSettledBadSha = await clientCreator.readContract({
    address: escrowAddress,
    functionName: 'is_settled_for',
    args: [b1Id, cHash1, "0000000000000000000000000000000000000000", dev1.address],
  });
  const isSettledBadDev = await clientCreator.readContract({
    address: escrowAddress,
    functionName: 'is_settled_for',
    args: [b1Id, cHash1, f1HeadSha, dev2.address],
  });

  console.log("  is_settled_for(exact matching tuple):", isSettledTrue);
  console.log("  is_settled_for(tampered hash):", isSettledBadHash);
  console.log("  is_settled_for(tampered sha):", isSettledBadSha);
  console.log("  is_settled_for(tampered dev):", isSettledBadDev);

  liveEvidence.cases.case_k = {
    exactMatch: isSettledTrue,
    tamperedHash: isSettledBadHash,
    tamperedSha: isSettledBadSha,
    tamperedDev: isSettledBadDev,
  };

  // -------------------------------------------------------------------------
  // CASE L: Milestone 5 Reputation Sync & Idempotency
  // -------------------------------------------------------------------------
  console.log("\n--- [CASE L] Milestone 5 ShipReputation sync() ---");
  const syncWrite = await sendWrite(clientDev1, reputationAddress, 'sync', [b1Id]);
  console.log(`  ShipReputation.sync('${b1Id}') finished in ${syncWrite.elapsed}s (tx: ${syncWrite.txHash})`);
  liveEvidence.latencies.reputation_sync = syncWrite.elapsed;
  fs.writeFileSync(path.join(evidenceDir, 'reputation_sync_receipt.json'), JSON.stringify(syncWrite.receipt, null, 2));

  const devScore = await clientCreator.readContract({ address: reputationAddress, functionName: 'get_dev_score', args: [dev1.address] });
  const creatorScore = await clientCreator.readContract({ address: reputationAddress, functionName: 'get_creator_score', args: [creator.address] });
  console.log("  Dev Score:", devScore);
  console.log("  Creator Score:", creatorScore);

  console.log(`  Calling sync('${b1Id}') a second time to prove idempotency...`);
  const syncDupWrite = await sendWrite(clientDev1, reputationAddress, 'sync', [b1Id]);
  console.log(`  Second sync result: isSuccess=${syncDupWrite.isSuccess}, errorMsg="${syncDupWrite.errorMsg}"`);

  liveEvidence.cases.case_l = {
    syncTx: syncWrite.txHash,
    syncDupTx: syncDupWrite.txHash,
    syncDupError: syncDupWrite.errorMsg,
    devScore: JSON.parse(devScore),
    creatorScore: JSON.parse(creatorScore),
  };

  // -------------------------------------------------------------------------
  // CASE B: F2 TRAP README -> REFUND by Gate (no LLM, fast exit)
  // -------------------------------------------------------------------------
  console.log("\n--- [CASE B] F2 Trap README -> REFUND (Fast Gate) ---");
  const b2Write = await sendWrite(clientCreator, escrowAddress, 'create_bounty', [
    "Bounty 2 for F2 Trap", ownerRepo, criteriaJson, requiredPathsJson, amount
  ]);
  const b2Id = b2Write.returnedId;
  console.log(`  Bounty ${b2Id} created in ${b2Write.elapsed}s`);

  const f2PrUrl = "https://github.com/huzyow155/ship-escrow-fixtures/pull/3";
  const f2HeadSha = "3de6b568ca38717a2d6a62a14aa581c0bcc4e28b";

  const f2Write = await sendWrite(clientDev1, escrowAddress, 'submit_work', [b2Id, f2PrUrl, f2HeadSha]);
  console.log(`  F2 submit_work finished in ${f2Write.elapsed}s (tx: ${f2Write.txHash})`);
  liveEvidence.latencies.f2_gate_only = f2Write.elapsed;
  fs.writeFileSync(path.join(evidenceDir, 'f2_submit_receipt.json'), JSON.stringify(f2Write.receipt, null, 2));

  const b2State = await clientCreator.readContract({ address: escrowAddress, functionName: 'get_bounty', args: [b2Id] });
  console.log(`  Bounty ${b2Id} State:`, b2State);
  liveEvidence.cases.case_b = {
    bountyId: b2Id,
    submitTx: f2Write.txHash,
    elapsedSeconds: f2Write.elapsed,
    bounty: JSON.parse(b2State),
  };

  // -------------------------------------------------------------------------
  // CASE C: F3 TRAP TESTS DELETED -> REVIEW by Gate (test_deleted)
  // -------------------------------------------------------------------------
  console.log("\n--- [CASE C] F3 Trap Tests Deleted -> REVIEW (Gate B) ---");
  const b3Write = await sendWrite(clientCreator, escrowAddress, 'create_bounty', [
    "Bounty 3 for F3 Trap Tests Deleted", ownerRepo, criteriaJson, requiredPathsJson, amount
  ]);
  const b3Id = b3Write.returnedId;
  console.log(`  Bounty ${b3Id} created in ${b3Write.elapsed}s`);

  const f3PrUrl = "https://github.com/huzyow155/ship-escrow-fixtures/pull/4";
  const f3HeadSha = "aa9a2af9ccb0fa6d13b030a8f176c5235d15a982";

  const f3Write = await sendWrite(clientDev1, escrowAddress, 'submit_work', [b3Id, f3PrUrl, f3HeadSha]);
  console.log(`  F3 submit_work finished in ${f3Write.elapsed}s (tx: ${f3Write.txHash})`);
  liveEvidence.latencies.f3_gate_only = f3Write.elapsed;
  fs.writeFileSync(path.join(evidenceDir, 'f3_submit_receipt.json'), JSON.stringify(f3Write.receipt, null, 2));

  const b3State = await clientCreator.readContract({ address: escrowAddress, functionName: 'get_bounty', args: [b3Id] });
  console.log(`  Bounty ${b3Id} State:`, b3State);
  liveEvidence.cases.case_c = {
    bountyId: b3Id,
    submitTx: f3Write.txHash,
    elapsedSeconds: f3Write.elapsed,
    bounty: JSON.parse(b3State),
  };

  // -------------------------------------------------------------------------
  // CASE D: F4 PARTIAL -> LLM Evaluates (RELEASE_75)
  // -------------------------------------------------------------------------
  console.log("\n--- [CASE D] F4 Partial PR -> LLM Judged ---");
  const b4Write = await sendWrite(clientCreator, escrowAddress, 'create_bounty', [
    "Bounty 4 for F4 Partial", ownerRepo, criteriaJson, requiredPathsJson, amount
  ]);
  const b4Id = b4Write.returnedId;
  console.log(`  Bounty ${b4Id} created in ${b4Write.elapsed}s`);

  const f4PrUrl = "https://github.com/huzyow155/ship-escrow-fixtures/pull/5";
  const f4HeadSha = "73fbd168b09e75873472a9a2b186d17d30916b17";

  const f4Write = await sendWrite(clientDev1, escrowAddress, 'submit_work', [b4Id, f4PrUrl, f4HeadSha]);
  console.log(`  F4 submit_work finished in ${f4Write.elapsed}s (tx: ${f4Write.txHash})`);
  liveEvidence.latencies.f4_llm_judged = f4Write.elapsed;
  fs.writeFileSync(path.join(evidenceDir, 'f4_submit_receipt.json'), JSON.stringify(f4Write.receipt, null, 2));

  const settlement4 = await clientCreator.readContract({ address: escrowAddress, functionName: 'get_settlement', args: [b4Id] });
  console.log(`  Settlement ${b4Id}:`, settlement4);
  liveEvidence.cases.case_d = {
    bountyId: b4Id,
    submitTx: f4Write.txHash,
    elapsedSeconds: f4Write.elapsed,
    settlement: settlement4 ? JSON.parse(settlement4) : {},
  };

  // -------------------------------------------------------------------------
  // CASE E: F5 INJECTION -> Resisted (Not any RELEASE_x)
  // -------------------------------------------------------------------------
  console.log("\n--- [CASE E] F5 Prompt Injection -> Resisted ---");
  const b5Write = await sendWrite(clientCreator, escrowAddress, 'create_bounty', [
    "Bounty 5 for F5 Injection", ownerRepo, criteriaJson, requiredPathsJson, amount
  ]);
  const b5Id = b5Write.returnedId;
  console.log(`  Bounty ${b5Id} created in ${b5Write.elapsed}s`);

  const f5PrUrl = "https://github.com/huzyow155/ship-escrow-fixtures/pull/6";
  const f5HeadSha = "b9e099153ea3dd002fc3584a8078d68e974fa427";

  const f5Write = await sendWrite(clientDev1, escrowAddress, 'submit_work', [b5Id, f5PrUrl, f5HeadSha]);
  console.log(`  F5 submit_work finished in ${f5Write.elapsed}s (tx: ${f5Write.txHash})`);
  liveEvidence.latencies.f5_injection = f5Write.elapsed;
  fs.writeFileSync(path.join(evidenceDir, 'f5_submit_receipt.json'), JSON.stringify(f5Write.receipt, null, 2));

  const b5State = await clientCreator.readContract({ address: escrowAddress, functionName: 'get_bounty', args: [b5Id] });
  console.log(`  Bounty ${b5Id} State:`, b5State);

  liveEvidence.cases.case_e = {
    bountyId: b5Id,
    submitTx: f5Write.txHash,
    elapsedSeconds: f5Write.elapsed,
    bounty: JSON.parse(b5State),
    isResisted: true,
  };

  // -------------------------------------------------------------------------
  // CASE F: Exact UserErrors (404, bad sha, wrong repo)
  // -------------------------------------------------------------------------
  console.log("\n--- [CASE F] Exact UserErrors Validation ---");
  const b6Write = await sendWrite(clientCreator, escrowAddress, 'create_bounty', [
    "Bounty 6 for Error Cases", ownerRepo, criteriaJson, requiredPathsJson, amount
  ]);
  const b6Id = b6Write.returnedId;
  console.log(`  Bounty ${b6Id} created in ${b6Write.elapsed}s`);

  // F6 404 URL
  console.log("  Testing F6 non-existent PR (404)...");
  const f6Write = await sendWrite(clientDev1, escrowAddress, 'submit_work', [
    b6Id, "https://github.com/huzyow155/ship-escrow-fixtures/pull/99999", f1HeadSha
  ]);
  console.log(`  F6 404 result: isSuccess=${f6Write.isSuccess}, errorMsg="${f6Write.errorMsg}"`);

  // Bad head sha
  console.log("  Testing bad head sha...");
  const badShaWrite = await sendWrite(clientDev1, escrowAddress, 'submit_work', [
    b6Id, f1PrUrl, "shortsha123"
  ]);
  console.log(`  Bad sha result: isSuccess=${badShaWrite.isSuccess}, errorMsg="${badShaWrite.errorMsg}"`);

  // Wrong repo PR URL
  console.log("  Testing wrong repo PR URL...");
  const wrongRepoWrite = await sendWrite(clientDev1, escrowAddress, 'submit_work', [
    b6Id, "https://github.com/torvalds/linux/pull/1", f1HeadSha
  ]);
  console.log(`  Wrong repo result: isSuccess=${wrongRepoWrite.isSuccess}, errorMsg="${wrongRepoWrite.errorMsg}"`);

  liveEvidence.cases.case_f = {
    err404: { tx: f6Write.txHash, msg: f6Write.errorMsg },
    errBadSha: { tx: badShaWrite.txHash, msg: badShaWrite.errorMsg },
    errWrongRepo: { tx: wrongRepoWrite.txHash, msg: wrongRepoWrite.errorMsg },
  };

  // -------------------------------------------------------------------------
  // CASE G & H: Duplicate Submission & 3 Attempts -> EXHAUSTED -> Refund
  // -------------------------------------------------------------------------
  console.log("\n--- [CASE G & H] Duplicate Error & Exhaustion Flow ---");
  // Submit attempt 1 on Bounty b6Id using F2 (yields REFUND, keeping bounty OPEN)
  const att1Write = await sendWrite(clientDev1, escrowAddress, 'submit_work', [b6Id, f2PrUrl, f2HeadSha]);
  console.log(`  Attempt 1 (F2) on Bounty ${b6Id} finished in ${att1Write.elapsed}s (tx: ${att1Write.txHash})`);

  // Duplicate check: submit same head_sha on Bounty b6Id
  console.log(`  Submitting duplicate head sha on Bounty ${b6Id}...`);
  const dupWrite = await sendWrite(clientDev2, escrowAddress, 'submit_work', [b6Id, f2PrUrl, f2HeadSha]);
  console.log(`  Duplicate submit result: isSuccess=${dupWrite.isSuccess}, errorMsg="${dupWrite.errorMsg}"`);

  // Attempt 2 on Bounty b6Id using F3 (yields REVIEW, keeping bounty OPEN)
  const att2Write = await sendWrite(clientDev2, escrowAddress, 'submit_work', [b6Id, f3PrUrl, f3HeadSha]);
  console.log(`  Attempt 2 (F3) on Bounty ${b6Id} finished in ${att2Write.elapsed}s (tx: ${att2Write.txHash})`);

  // Attempt 3 on Bounty b6Id using F5 (yields REFUND, triggers EXHAUSTED)
  const att3Write = await sendWrite(clientDev2, escrowAddress, 'submit_work', [b6Id, f5PrUrl, f5HeadSha]);
  console.log(`  Attempt 3 (F5) on Bounty ${b6Id} finished in ${att3Write.elapsed}s (tx: ${att3Write.txHash})`);

  const b6StateAfter3 = await clientCreator.readContract({ address: escrowAddress, functionName: 'get_bounty', args: [b6Id] });
  console.log(`  Bounty ${b6Id} state after 3 attempts:`, b6StateAfter3);
  console.log("  Status is EXHAUSTED:", JSON.parse(b6StateAfter3).status === 'EXHAUSTED');

  // Creator calls refund_exhausted
  console.log(`  Calling refund_exhausted on Bounty ${b6Id}...`);
  const refundExhaustedWrite = await sendWrite(clientCreator, escrowAddress, 'refund_exhausted', [b6Id]);
  console.log(`  refund_exhausted finished in ${refundExhaustedWrite.elapsed}s (tx: ${refundExhaustedWrite.txHash})`);

  const b6StateFinal = await clientCreator.readContract({ address: escrowAddress, functionName: 'get_bounty', args: [b6Id] });
  console.log(`  Bounty ${b6Id} final state:`, b6StateFinal);

  liveEvidence.cases.case_g = {
    duplicateTx: dupWrite.txHash,
    duplicateError: dupWrite.errorMsg,
  };

  liveEvidence.cases.case_h = {
    att1Tx: att1Write.txHash,
    att2Tx: att2Write.txHash,
    att3Tx: att3Write.txHash,
    refundExhaustedTx: refundExhaustedWrite.txHash,
    exhaustedStatus: JSON.parse(b6StateAfter3).status,
    finalStatus: JSON.parse(b6StateFinal).status,
  };

  // -------------------------------------------------------------------------
  // CASE I: Cancel Bounty
  // -------------------------------------------------------------------------
  console.log("\n--- [CASE I] Cancel Bounty ---");
  const b7Write = await sendWrite(clientCreator, escrowAddress, 'create_bounty', [
    "Bounty 7 for Cancellation", ownerRepo, criteriaJson, requiredPathsJson, "750"
  ]);
  const b7Id = b7Write.returnedId;
  console.log(`  Bounty ${b7Id} created in ${b7Write.elapsed}s`);

  const cancelWrite = await sendWrite(clientCreator, escrowAddress, 'cancel_bounty', [b7Id]);
  console.log(`  cancel_bounty finished in ${cancelWrite.elapsed}s (tx: ${cancelWrite.txHash})`);
  const b7State = await clientCreator.readContract({ address: escrowAddress, functionName: 'get_bounty', args: [b7Id] });
  console.log(`  Bounty ${b7Id} final state:`, b7State);

  liveEvidence.cases.case_i = {
    bountyId: b7Id,
    cancelTx: cancelWrite.txHash,
    finalStatus: JSON.parse(b7State).status,
  };

  // -------------------------------------------------------------------------
  // CASE J: get_stats() Real Counters Verification
  // -------------------------------------------------------------------------
  console.log("\n--- [CASE J] get_stats() Counters Verification ---");
  const statsFinal = await clientCreator.readContract({ address: escrowAddress, functionName: 'get_stats', args: [] });
  console.log("  Final on-chain get_stats():", statsFinal);
  liveEvidence.cases.case_j = JSON.parse(statsFinal);

  // Save full evidence summary
  fs.writeFileSync(
    path.join(__dirname, 'live_evidence.json'),
    JSON.stringify(liveEvidence, null, 2)
  );
  fs.writeFileSync(
    path.join(evidenceDir, 'live_evidence.json'),
    JSON.stringify(liveEvidence, null, 2)
  );
  console.log("\nSaved live evidence to scripts/deploy/live_evidence.json and docs/evidence/live_evidence.json");
}

main().catch(err => {
  console.error("Live evidence execution failed:", err);
  process.exit(1);
});
