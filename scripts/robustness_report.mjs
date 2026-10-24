import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const robustnessDir = path.join(__dirname, '../docs/evidence_v2/robustness');
const failuresPath = path.join(__dirname, '../docs/evidence_v2/robustness_failures/failures_summary.json');

const files = fs.readdirSync(robustnessDir).filter(f => f.endsWith('.json') && f !== 'robustness_summary.json');
files.sort();

let failuresData = [];
if (fs.existsSync(failuresPath)) {
  failuresData = JSON.parse(fs.readFileSync(failuresPath, 'utf8'));
}

const fixtureStats = {
  F1: { attempts: 0, successes: 0, failures: 0, label_vectors: [], verdicts: [], error_classes: {} },
  F4: { attempts: 0, successes: 0, failures: 0, label_vectors: [], verdicts: [], error_classes: {} },
  F5: { attempts: 0, successes: 0, failures: 0, label_vectors: [], verdicts: [], error_classes: {} },
};

for (const file of files) {
  const filePath = path.join(robustnessDir, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const fId = data.fixture_id;

  if (!fixtureStats[fId]) continue;

  fixtureStats[fId].attempts++;

  if (data.submit_receipt?.execution_result === 'SUCCESS') {
    fixtureStats[fId].successes++;
    const labels = data.on_chain_submission?.criterion_results || [];
    fixtureStats[fId].label_vectors.push(JSON.stringify(labels));
    fixtureStats[fId].verdicts.push(data.on_chain_submission?.verdict || "NONE");
  } else {
    fixtureStats[fId].failures++;
  }
}

// Map failure classifications from failure summary
for (const fail of failuresData) {
  const fId = fail.fixture;
  if (fixtureStats[fId]) {
    const cls = fail.classification || "other";
    fixtureStats[fId].error_classes[cls] = (fixtureStats[fId].error_classes[cls] || 0) + 1;
  }
}

console.log("====================================================================================================");
console.log("ROBUSTNESS EVALUATION REPORT (STRICT CRITERIA)");
console.log("====================================================================================================");
console.log("| Fixture | Attempts | Successes | Failures | Modal Label Vector | Label Vector Identity | Verdict Matches | Decision |");
console.log("|:--------|:---------|:----------|:---------|:-------------------|:----------------------|:----------------|:---------|");

let allPass = true;

for (const [fId, s] of Object.entries(fixtureStats)) {
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

  // Decision rule:
  // PASS: exactly 10 of 10 successful runs AND identical in at least 9 of 10
  // NOT_EVALUABLE: otherwise
  const isPass = (s.successes === 10 && maxVectorCount >= 9);
  const decision = isPass ? "PASS" : "NOT_EVALUABLE";

  if (!isPass) {
    allPass = false;
  }

  const identityStr = s.successes > 0 ? `${maxVectorCount} / ${s.successes} successful runs` : "0 / 0";
  const verdictStr = s.successes > 0 ? `${maxVerdictCount} / ${s.successes} successful runs` : "0 / 0";

  console.log(`| ${fId} | ${s.attempts} | ${s.successes} | ${s.failures} | \`${modalVector}\` | ${identityStr} | ${verdictStr} | **${decision}** |`);
}

console.log("====================================================================================================");
console.log("\nERROR CLASSIFICATIONS BREAKDOWN:");
for (const [fId, s] of Object.entries(fixtureStats)) {
  console.log(`- ${fId} (Failures: ${s.failures}):`);
  if (Object.keys(s.error_classes).length === 0) {
    console.log("    None (all successful)");
  } else {
    for (const [cls, count] of Object.entries(s.error_classes)) {
      console.log(`    * ${cls}: ${count}`);
    }
  }
}
console.log(`\nOverall Decision: ${allPass ? "PASS" : "NOT_EVALUABLE"}`);
