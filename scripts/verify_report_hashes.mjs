import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const reportPath = process.argv[2] || path.join(__dirname, '../docs/FINAL_REPORT.md');

if (!fs.existsSync(reportPath)) {
  console.error(`Report file not found: ${reportPath}`);
  process.exit(1);
}

const reportContent = fs.readFileSync(reportPath, 'utf8');

// Collect known hashes from evidence base
const knownHashes = new Set();

function addHashesFromText(text) {
  if (!text) return;
  // Match 64-hex (tx hashes, sha256)
  const matches64 = text.match(/\b(?:0x)?[0-9a-fA-F]{64}\b/g) || [];
  for (const m of matches64) {
    knownHashes.add(m.toLowerCase());
    knownHashes.add(m.toLowerCase().replace(/^0x/, ''));
    knownHashes.add('0x' + m.toLowerCase().replace(/^0x/, ''));
  }
  // Match 40-hex (addresses, commit shas)
  const matches40 = text.match(/\b(?:0x)?[0-9a-fA-F]{40}\b/g) || [];
  for (const m of matches40) {
    knownHashes.add(m.toLowerCase());
    knownHashes.add(m.toLowerCase().replace(/^0x/, ''));
    knownHashes.add('0x' + m.toLowerCase().replace(/^0x/, ''));
  }
}

function scanDir(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith('.json') || entry.name.endsWith('.py') || entry.name.endsWith('.md') || entry.name.endsWith('.txt'))) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        addHashesFromText(content);
      } catch (e) {}
    }
  }
}

console.log("Indexing known evidence hashes from repository...");
scanDir(path.join(__dirname, '../docs/evidence_v2'));
scanDir(path.join(__dirname, '../scripts/deploy'));
scanDir(path.join(__dirname, '../fixtures'));
scanDir(path.join(__dirname, '../contracts'));

// Add known git commit shas from local git repository
try {
  const gitLog = execSync('git log --format="%H"', { encoding: 'utf8' });
  for (const line of gitLog.split('\n')) {
    const h = line.trim().toLowerCase();
    if (h.length === 40) {
      knownHashes.add(h);
      knownHashes.add('0x' + h);
    }
  }
} catch (e) {}

console.log(`Total known unique hash variants indexed: ${knownHashes.size}`);

// Extract all 40-hex and 64-hex tokens from the report
const reportLines = reportContent.split('\n');
const foundTokens = [];

for (let lineNum = 1; lineNum <= reportLines.length; lineNum++) {
  const line = reportLines[lineNum - 1];
  // Match 64-hex
  const m64 = line.match(/\b(?:0x)?[0-9a-fA-F]{64}\b/g) || [];
  for (const token of m64) {
    foundTokens.push({ lineNum, token, line });
  }
  // Match 40-hex
  const m40 = line.match(/\b(?:0x)?[0-9a-fA-F]{40}\b/g) || [];
  for (const token of m40) {
    foundTokens.push({ lineNum, token, line });
  }
}

console.log(`Extracted ${foundTokens.length} hash/address tokens from ${reportPath}...`);

const unknownTokens = [];
const verifiedTokens = new Set();

for (const item of foundTokens) {
  const tLower = item.token.toLowerCase();
  const raw = tLower.replace(/^0x/, '');

  let isKnown = knownHashes.has(tLower) || knownHashes.has(raw) || knownHashes.has('0x' + raw);

  // If 40-hex commit sha, verify with git cat-file if not already in known set
  if (!isKnown && raw.length === 40) {
    try {
      execSync(`git cat-file -e ${raw}`, { stdio: 'ignore' });
      isKnown = true;
      knownHashes.add(raw);
    } catch (e) {}
  }

  // Known benign dummy test shas (e.g. 0000000000000000000000000000000000000000 or 0123456789abcdef0123456789abcdef01234567)
  if (!isKnown) {
    if (/^0+$/.test(raw) || raw === '0123456789abcdef0123456789abcdef01234567') {
      isKnown = true;
    }
  }

  if (isKnown) {
    verifiedTokens.add(tLower);
  } else {
    unknownTokens.push(item);
  }
}

console.log("====================================================================================================");
console.log("REPORT HASH INTEGRITY VERIFICATION RESULT");
console.log("====================================================================================================");
console.log(`Verified unique tokens: ${verifiedTokens.size}`);
console.log(`Unknown tokens:         ${unknownTokens.length}`);

if (unknownTokens.length > 0) {
  console.error("\nFAILED: Unknown or unverified hashes detected in report:");
  for (const unk of unknownTokens) {
    console.error(`  Line ${unk.lineNum}: [${unk.token}] in: ${unk.line.trim()}`);
  }
  console.log("====================================================================================================");
  process.exit(1);
} else {
  console.log("SUCCESS: 100% of all hashes, commit SHAs, addresses, and digest strings in report are verified.");
  console.log("====================================================================================================");
  process.exit(0);
}
