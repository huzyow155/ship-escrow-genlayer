import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient, chains } from 'genlayer-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const deployments = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'deploy/deployments_v2.json'), 'utf8')
);
const escrowAddress = deployments.escrow.contractAddress;

const outDir = path.join(__dirname, '../docs/evidence_v2/assessments_raw');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const client = createClient({ chain: chains.studionet });

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function getSubmissionWithRetry(subId) {
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      const raw = await client.readContract({
        address: escrowAddress,
        functionName: 'get_submission',
        args: [String(subId)],
      });
      return raw;
    } catch (err) {
      console.warn(`[Sub ${subId} attempt ${attempt}] error: ${err.message || err}. Backing off...`);
      await sleep(5000);
    }
  }
  throw new Error(`Failed to fetch submission ${subId} after 10 attempts`);
}

async function main() {
  console.log(`Reading stored assessments from ${escrowAddress}...`);
  const allSubmissions = [];

  for (let i = 1; i <= 60; i++) {
    const raw = await getSubmissionWithRetry(i);
    if (!raw || raw.trim() === '') {
      console.log(`Submission ${i} is empty. End of submissions reached (total ${i - 1}).`);
      break;
    }

    const sub = JSON.parse(raw);
    const subFilePath = path.join(outDir, `sub_${i}.json`);
    fs.writeFileSync(subFilePath, JSON.stringify(sub, null, 2), 'utf8');

    console.log(`Saved submission ${i}: bounty=${sub.bounty_id}, verdict=${sub.verdict}, payout=${sub.payout_pct}, criterion_results=${JSON.stringify(sub.criterion_results)}, packet_keys=${Object.keys(sub.packet || {}).length}`);

    allSubmissions.push({
      sub_id: String(i),
      bounty_id: sub.bounty_id,
      verdict: sub.verdict,
      payout_pct: sub.payout_pct,
      criterion_results: sub.criterion_results,
      gate: sub.gate || sub.packet?.gate || "none",
      packet_sha256: sub.packet_sha256,
      packet_keys: Object.keys(sub.packet || {}),
    });

    // Polite rate limit spacing (2100ms)
    await sleep(2100);
  }

  const summaryPath = path.join(outDir, 'all_submissions_summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(allSubmissions, null, 2), 'utf8');
  console.log(`\nFinished reading ${allSubmissions.length} submissions. Summary saved to ${summaryPath}`);
}

main().catch(err => {
  console.error("Failed:", err);
  process.exit(1);
});
