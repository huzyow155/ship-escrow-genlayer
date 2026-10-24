import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient, chains } from 'genlayer-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const robustnessDir = path.join(__dirname, '../docs/evidence_v2/robustness');
const failuresDir = path.join(__dirname, '../docs/evidence_v2/robustness_failures');

if (!fs.existsSync(failuresDir)) {
  fs.mkdirSync(failuresDir, { recursive: true });
}

function decodeBase64(str) {
  try {
    return Buffer.from(str, 'base64').toString('utf8');
  } catch (e) {
    return str;
  }
}

async function main() {
  const files = fs.readdirSync(robustnessDir).filter(f => f.endsWith('.json') && f !== 'robustness_summary.json');
  files.sort();

  const failedRuns = [];
  const successRuns = [];

  for (const file of files) {
    const filePath = path.join(robustnessDir, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    const runName = file.replace('.json', '');
    const submitHash = data.submit_tx_hash;
    const execRes = data.submit_receipt?.execution_result;

    if (execRes === 'SUCCESS') {
      successRuns.push({ runName, file, submitHash, verdict: data.on_chain_submission?.verdict });
    } else {
      failedRuns.push({ runName, file, submitHash, status: data.submit_receipt?.status_name, result: data.submit_receipt?.result_name, execRes });
    }
  }

  const failureDetails = [];

  for (const f of failedRuns) {
    const rawOutPath = path.join(failuresDir, `${f.runName}_raw.json`);
    let tx;
    if (fs.existsSync(rawOutPath)) {
      tx = JSON.parse(fs.readFileSync(rawOutPath, 'utf8'));
    } else {
      console.error(`Missing raw file for ${f.runName}`);
      continue;
    }

    let agreedError = "Unknown";
    const vals = tx.consensus_data?.validators || [];
    for (const v of vals) {
      if (v.vote === 'agree' && v.result) {
        const decoded = decodeBase64(v.result);
        // Strip leading status byte (\x01 for user error)
        agreedError = decoded.replace(/^[\x00-\x1f]/, '');
        break;
      }
    }

    if (agreedError === "Unknown" && vals.length > 0) {
      for (const v of vals) {
        if (v.result) {
          const decoded = decodeBase64(v.result);
          if (decoded.includes("Pull request metadata unavailable")) {
            agreedError = "Pull request metadata unavailable";
            break;
          }
        }
      }
    }

    let classification = "other";
    if (agreedError.includes("Pull request metadata unavailable")) {
      classification = "GitHub API/diff fetch problem (status codes, rate limit)";
    }

    failureDetails.push({
      runName: f.runName,
      fixture: f.runName.split('_')[0].toUpperCase(),
      txHash: f.submitHash,
      statusName: tx.statusName || String(tx.status),
      resultName: tx.result_name || String(tx.result),
      errorString: agreedError,
      classification: classification,
      votes: tx.consensus_data?.votes || {}
    });
  }

  const summaryOutPath = path.join(failuresDir, 'failures_summary.json');
  fs.writeFileSync(summaryOutPath, JSON.stringify(failureDetails, null, 2), 'utf8');

  console.log("====================================================================================================");
  console.log(`FAILURES AUDIT TABLE (${failureDetails.length} FAILED RUNS)`);
  console.log("====================================================================================================");
  console.log("| Run | Tx Hash | Error String | Classification |");
  console.log("|:---|:---|:---|:---|");
  for (const item of failureDetails) {
    console.log(`| ${item.runName} | \`${item.txHash}\` | ${item.errorString} | ${item.classification} |`);
  }
  console.log("====================================================================================================");
}

main().catch(err => {
  console.error("Diagnosis error:", err);
  process.exit(1);
});
