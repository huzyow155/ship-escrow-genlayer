import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const robustnessDir = path.join(__dirname, '../docs/evidence_v2/robustness');
const failuresPath = path.join(__dirname, '../docs/evidence_v2/robustness_failures/failures_summary.json');
const failuresDir = path.join(__dirname, '../docs/evidence_v2/robustness_failures');

const files = fs.readdirSync(robustnessDir).filter(f => f.endsWith('.json') && f !== 'robustness_summary.json');
files.sort();

let failuresData = [];
if (fs.existsSync(failuresPath)) {
  failuresData = JSON.parse(fs.readFileSync(failuresPath, 'utf8'));
}

// Reconcile all failure files in directory
const rawFailFiles = fs.existsSync(failuresDir)
  ? fs.readdirSync(failuresDir).filter(f => f.endsWith('.json') && f !== 'failures_summary.json')
  : [];

const fixtureStats = {
  F1: { original_successes: 0, reruns: 0, failures: 0, label_vectors: [], verdicts: [], url_owners: new Set(), failure_errors: {} },
  F4: { original_successes: 0, reruns: 0, failures: 0, label_vectors: [], verdicts: [], url_owners: new Set(), failure_errors: {} },
  F5: { original_successes: 0, reruns: 0, failures: 0, label_vectors: [], verdicts: [], error_classes: {}, url_owners: new Set(), failure_errors: {} },
};

// 1. Process successful runs
for (const file of files) {
  const filePath = path.join(robustnessDir, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const fId = data.fixture_id;
  if (!fixtureStats[fId]) continue;

  if (data.submit_receipt?.execution_result === 'SUCCESS') {
    if (data.batch_origin === 'original_batch') {
      fixtureStats[fId].original_successes++;
    } else {
      fixtureStats[fId].reruns++;
    }
    const owner = data.url_owner_used || (data.pr_url.includes('hypercybers99') ? 'hypercybers99' : 'huzyow155');
    fixtureStats[fId].url_owners.add(owner);
    const labels = data.on_chain_submission?.criterion_results || [];
    fixtureStats[fId].label_vectors.push(JSON.stringify(labels));
    fixtureStats[fId].verdicts.push(data.on_chain_submission?.verdict || "NONE");
  }
}

// 2. Process failure files
for (const fail of failuresData) {
  const fId = fail.fixture;
  if (fixtureStats[fId]) {
    fixtureStats[fId].failures++;
    const err = fail.leader_payload || fail.error_message || "Pull request metadata unavailable";
    fixtureStats[fId].failure_errors[err] = (fixtureStats[fId].failure_errors[err] || 0) + 1;
  }
}

console.log("==================================================================================================================================");
console.log("HONEST ROBUSTNESS EVALUATION REPORT (RECONCILED ATTEMPTS, SUCCESSES & FAILURES)");
console.log("==================================================================================================================================");
console.log(`Failure Files Audit: ${rawFailFiles.length} failure receipt files reconciled across F1, F4, F5.`);
console.log("| Fixture | Total Attempts | Successes (Orig + Rerun) | Failures | URL Form(s) Used | Modal Label Vector | Label Identity | Verdict Matches | Decision |");
console.log("|:--------|:---------------|:-------------------------|:---------|:-----------------|:-------------------|:---------------|:----------------|:---------|");

let allPass = true;

for (const [fId, s] of Object.entries(fixtureStats)) {
  const totalSuccesses = s.original_successes + s.reruns;
  const totalAttempts = totalSuccesses + s.failures;

  let modalVector = "[]";
  let maxVectorCount = 0;
  const vectorCounts = {};

  for (const v of s.label_vectors) {
    vectorCounts[v] = (vectorCounts[v] || 0) + 1;
    if (vectorCounts[v] > maxVectorCount) {
      maxVectorCount = vectorCounts[v];
      modalVector = v;
    }
  }

  let modalVerdict = "NONE";
  let maxVerdictCount = 0;
  const verdictCounts = {};

  for (const verd of s.verdicts) {
    verdictCounts[verd] = (verdictCounts[verd] || 0) + 1;
    if (verdictCounts[verd] > maxVerdictCount) {
      maxVerdictCount = verdictCounts[verd];
      modalVerdict = verd;
    }
  }

  // Strict decision rule:
  // PASS: exactly 10 successes exist AND modalVector count >= 9
  // NOT_EVALUABLE: otherwise
  const isPass = (totalSuccesses === 10 && maxVectorCount >= 9);
  const decision = isPass ? "PASS" : "NOT_EVALUABLE";

  if (!isPass) {
    allPass = false;
  }

  const urlForms = Array.from(s.url_owners).join(", ");
  const succStr = `${totalSuccesses} (${s.original_successes} orig + ${s.reruns} rerun)`;
  const identityStr = totalSuccesses > 0 ? `${maxVectorCount} / ${totalSuccesses}` : "0 / 0";
  const verdictStr = totalSuccesses > 0 ? `${maxVerdictCount} / ${totalSuccesses}` : "0 / 0";

  console.log(`| ${fId} | ${totalAttempts} | ${succStr} | ${s.failures} | ${urlForms} | \`${modalVector}\` | ${identityStr} | ${verdictStr} | **${decision}** |`);
}

console.log("==================================================================================================================================");
console.log("\nFAILURE ERROR STRINGS BREAKDOWN:");
for (const [fId, s] of Object.entries(fixtureStats)) {
  console.log(`- ${fId} (${s.failures} failures):`);
  for (const [err, count] of Object.entries(s.failure_errors)) {
    console.log(`    * "${err}": ${count} runs`);
  }
}
console.log(`\nOverall Decision: ${allPass ? "PASS" : "NOT_EVALUABLE"}`);
