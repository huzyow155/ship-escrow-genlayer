const { createClient, chains } = require('genlayer-js');
const fs = require('fs');
const path = require('path');

const evidenceDir = path.join(__dirname, '../docs/evidence_v2');
const client = createClient({ chain: chains.studionet });

async function main() {
  console.log("Checking finalization status for all write receipts...");

  const files = fs.readdirSync(evidenceDir).filter(f => f.endsWith('.json') && !f.includes('invariant') && !f.includes('stats') && !f.includes('live_evidence') && !f.includes('finalization'));

  const finalizationLog = {
    checked_at: new Date().toISOString(),
    receipts_checked: 0,
    accepted_count: 0,
    finalized_count: 0,
    entries: [],
  };

  for (const file of files) {
    const filePath = path.join(evidenceDir, file);
    try {
      const receipt = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const txHash = receipt.hash || receipt.transaction_hash;
      if (!txHash) continue;

      const initialStatus = receipt.status_name || (receipt.status === 5 ? 'ACCEPTED' : (receipt.status === 2 ? 'FINALIZED' : String(receipt.status)));

      // Re-fetch current status from Studionet
      let currentStatus = initialStatus;
      let refetched = null;
      try {
        refetched = await client.getTransactionReceipt({ hash: txHash });
        currentStatus = refetched.status_name || (refetched.status === 5 ? 'ACCEPTED' : (refetched.status === 2 ? 'FINALIZED' : String(refetched.status)));
      } catch (err) {
        // If query fails or returns same, use known
      }

      finalizationLog.receipts_checked++;
      if (currentStatus === 'FINALIZED') {
        finalizationLog.finalized_count++;
      } else {
        finalizationLog.accepted_count++;
      }

      finalizationLog.entries.push({
        file,
        tx_hash: txHash,
        initial_status_name: initialStatus,
        current_status_name: currentStatus,
        result_name: receipt.result_name || refetched?.result_name,
        leader_execution_result: receipt.consensus_data?.leader_receipt?.[0]?.execution_result || refetched?.consensus_data?.leader_receipt?.[0]?.execution_result,
        timestamp_initial: receipt.timestamp || null,
        timestamp_checked: new Date().toISOString(),
      });

      console.log(`  ${file}: initial=${initialStatus} -> current=${currentStatus}`);
    } catch (e) {
      console.warn(`  Could not process ${file}: ${e.message}`);
    }
  }

  const logPath = path.join(evidenceDir, 'finalization_log.json');
  fs.writeFileSync(logPath, JSON.stringify(finalizationLog, null, 2));
  console.log(`\nFinalization log saved to ${logPath}`);
  console.log(`Total: ${finalizationLog.receipts_checked}, ACCEPTED: ${finalizationLog.accepted_count}, FINALIZED: ${finalizationLog.finalized_count}`);
}

main().catch(err => {
  console.error("Finalization check failed:", err);
  process.exit(1);
});
