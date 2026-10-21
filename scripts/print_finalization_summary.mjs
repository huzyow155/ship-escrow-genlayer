import fs from 'fs';
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
  console.log(`| ${data.checked_at} | ${data.receipts_checked} | ${finalized} | ${accepted} | ${other} |`);
}
