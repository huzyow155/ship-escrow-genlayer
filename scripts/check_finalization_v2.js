const { createClient, chains } = require('genlayer-js');
const fs = require('fs');
const path = require('path');

const evidenceDir = path.join(__dirname, '../docs/evidence_v2');
const finalizationDir = path.join(evidenceDir, 'finalization');
if (!fs.existsSync(finalizationDir)) {
  fs.mkdirSync(finalizationDir, { recursive: true });
}

const client = createClient({ chain: chains.studionet });

async function main() {
  const now = new Date();
  const utcIso = now.toISOString();
  const utcSafe = utcIso.replace(/[:.]/g, '-');
  console.log(`====================================================`);
  console.log(`CHECKING FINALIZATION STATUS ON STUDIONET`);
  console.log(`Timestamp: ${utcIso}`);
  console.log(`====================================================`);

  
  function getAllReceiptFiles(dir) {
    let results = [];
    const list = fs.readdirSync(dir, { withFileTypes: true });
    for (const dirent of list) {
      const fullPath = path.join(dir, dirent.name);
      if (dirent.isDirectory()) {
        if (dirent.name !== 'finalization' && dirent.name !== 'assessments_raw') {
          results = results.concat(getAllReceiptFiles(fullPath));
        }
      } else if (dirent.isFile() && dirent.name.endsWith('.json')) {
        if (
          !dirent.name.includes('invariant') &&
          !dirent.name.includes('stats') &&
          !dirent.name.includes('live_evidence') &&
          !dirent.name.includes('summary') &&
          !dirent.name.includes('packet_recomputation') &&
          !dirent.name.includes('finalization_log') &&
          !dirent.name.includes('all_submissions')
        ) {
          results.push(fullPath);
        }
      }
    }
    return results;
  }

  const files = getAllReceiptFiles(evidenceDir);

  const entries = [];
  const countsByStatus = {};

  for (const filePath of files) {
    const file = path.relative(evidenceDir, filePath);
    try {
      const receipt = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const txHash = receipt.hash || receipt.transaction_hash || receipt.submit_tx_hash;
      if (!txHash) continue;

      const fileStat = fs.statSync(filePath);
      const initialStatusName = receipt.status_name || receipt.submit_receipt?.status_name || (receipt.status === 5 ? 'ACCEPTED' : (receipt.status === 7 ? 'FINALIZED' : String(receipt.status)));
      const initialTime = receipt.created_at || receipt.timestamp || fileStat.mtime.toISOString();

      // Fetch transaction from RPC
      const tx = await client.getTransaction({ hash: txHash });
      const currentStatusName = tx.statusName || tx.status_name || (tx.status === 7 ? 'FINALIZED' : (tx.status === 5 ? 'ACCEPTED' : String(tx.status)));
      const currentResultName = tx.result_name || receipt.result_name;
      const leaderExec = tx.consensus_data?.leader_receipt?.[0]?.execution_result || receipt.consensus_data?.leader_receipt?.[0]?.execution_result;

      countsByStatus[currentStatusName] = (countsByStatus[currentStatusName] || 0) + 1;

      entries.push({
        file,
        tx_hash: txHash,
        initial_status_name: initialStatusName,
        initial_timestamp: initialTime,
        current_status: tx.status,
        current_status_name: currentStatusName,
        current_result_name: currentResultName,
        leader_execution_result: leaderExec,
        fetched_at: utcIso,
      });

      console.log(`  ${file}: initial=${initialStatusName} (${initialTime}) -> current=${currentStatusName} (status: ${tx.status})`);
    } catch (err) {
      console.warn(`  Error checking ${file}: ${err.message}`);
    }
  }

  const runResult = {
    checked_at: utcIso,
    receipts_checked: entries.length,
    counts_by_status_name: countsByStatus,
    entries,
  };

  const runFilePath = path.join(finalizationDir, `finalization_check_${utcSafe}.json`);
  fs.writeFileSync(runFilePath, JSON.stringify(runResult, null, 2));
  console.log(`\nRun recorded to: ${runFilePath}`);
  console.log("Summary counts:", countsByStatus);

  // Write summary script helper
  updateSummaryScript();
}

function updateSummaryScript() {
  const summaryFile = path.join(__dirname, 'print_finalization_summary.mjs');
  const code = `import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const finalDir = path.join(__dirname, '../docs/evidence_v2/finalization');

if (!fs.existsSync(finalDir)) {
  console.log("No finalization directory found.");
  process.exit(0);
}

const files = fs.readdirSync(finalDir).filter(f => f.startsWith('finalization_check_') && f.endsWith('.json')).sort();

console.log("# FINALIZATION LOG RUNS SUMMARY");
console.log("| Run UTC Timestamp | Total Checked | FINALIZED Count | ACCEPTED Count | Other |");
console.log("|:------------------|:--------------|:----------------|:---------------|:------|");

for (const f of files) {
  const data = JSON.parse(fs.readFileSync(path.join(finalDir, f), 'utf8'));
  const finalized = data.counts_by_status_name['FINALIZED'] || 0;
  const accepted = data.counts_by_status_name['ACCEPTED'] || 0;
  const other = data.receipts_checked - finalized - accepted;
  console.log(\`| \${data.checked_at} | \${data.receipts_checked} | \${finalized} | \${accepted} | \${other} |\`);
}
`;
  fs.writeFileSync(summaryFile, code);
}

main().catch(err => {
  console.error("Finalization check failed:", err);
  process.exit(1);
});
