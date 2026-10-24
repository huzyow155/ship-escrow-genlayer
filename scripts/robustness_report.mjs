import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const summaryPath = path.join(__dirname, '../docs/evidence_v2/robustness/robustness_summary.json');
const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));

console.log("# REAL ON-CHAIN ROBUSTNESS BATCHES REPORT");
console.log(`Evaluated At: ${summary.evaluated_at}`);
console.log(`Contract:     ${summary.contract_address}`);
console.log(`Total Runs:   ${summary.total_runs} (${summary.elapsed_seconds}s)`);
console.log(`Binding Rule: ${summary.binding_decision}\n`);

console.log("| Fixture | Runs | Label Vector Identical Count | Verdict Matches | Modal Label Vector | Modal Verdict | Decision |");
console.log("|:--------|:-----|:-----------------------------|:----------------|:-------------------|:--------------|:---------|");

for (const [fId, b] of Object.entries(summary.batches)) {
  const passStr = b.identical_labels_count >= 9 ? ">= 9/10" : "< 9/10";
  console.log(`| ${fId} | ${b.runs} | ${b.identical_labels_count} / ${b.runs} (${passStr}) | ${b.verdict_matches_count} / ${b.runs} | \`${JSON.stringify(b.modal_label_vector)}\` | \`${b.modal_verdict}\` | ${b.identical_labels_count >= 9 ? "**PASS**" : "**RELAXED**"} |`);
}
