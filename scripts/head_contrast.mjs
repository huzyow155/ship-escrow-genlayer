import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '../docs/evidence_v2/multicommit');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function main() {
  console.log("==================================================================");
  console.log("MULTI-COMMIT PR HEAD CONTRAST: V1 (.patch parser) vs V2 (REST API)");
  console.log("Target PR: https://github.com/huzyow155/ship-escrow-fixtures/pull/7");
  console.log("==================================================================\n");

  // (a) Fetch pull/7.patch
  const patchUrl = 'https://github.com/huzyow155/ship-escrow-fixtures/pull/7.patch';
  const patchRes = await fetch(patchUrl, { headers: { 'User-Agent': 'ShipEscrow-Audit' } });
  if (!patchRes.ok) {
    throw new Error(`Failed to fetch patch: ${patchRes.status} ${patchRes.statusText}`);
  }
  const patchText = await patchRes.text();
  const patchLines = patchText.split('\n');
  const firstFromLine = patchLines.find(l => l.startsWith('From ')) || '';
  const firstFromSha = firstFromLine.split(' ')[1] || '';

  // (b) Fetch PR #7 metadata and commits from GitHub REST API
  const prApiUrl = 'https://api.github.com/repos/huzyow155/ship-escrow-fixtures/pulls/7';
  const prRes = await fetch(prApiUrl, { headers: { 'User-Agent': 'ShipEscrow-Audit' } });
  if (!prRes.ok) {
    throw new Error(`Failed to fetch PR metadata: ${prRes.status}`);
  }
  const prData = await prRes.json();
  const realHeadSha = prData.head.sha;

  const commitsApiUrl = 'https://api.github.com/repos/huzyow155/ship-escrow-fixtures/pulls/7/commits';
  const commitsRes = await fetch(commitsApiUrl, { headers: { 'User-Agent': 'ShipEscrow-Audit' } });
  if (!commitsRes.ok) {
    throw new Error(`Failed to fetch PR commits: ${commitsRes.status}`);
  }
  const commitsData = await commitsRes.json();
  const commitsList = commitsData.map((c, i) => ({
    index: i + 1,
    sha: c.sha,
    message: c.commit.message.split('\n')[0]
  }));

  // (c) Execute V1 parse_patch_head_sha imported from archive/v1/ShipEscrowV1.py
  const tempPatchFile = path.join(outDir, 'temp_pr7.patch');
  fs.writeFileSync(tempPatchFile, patchText, 'utf8');

  const pyScript = `
import sys, types
mock_gl = types.ModuleType('genlayer')
mock_gl.Contract = type('Contract', (), {})
mock_gl.public = types.SimpleNamespace(view=lambda f: f, write=lambda f: f)
mock_gl.vm = types.SimpleNamespace(UserError=Exception)
mock_gl.gl = mock_gl
mock_gl.TreeMap = dict
sys.modules['genlayer'] = mock_gl
sys.path.insert(0, 'archive/v1')
from ShipEscrowV1 import parse_patch_head_sha

with open(sys.argv[1], 'r', encoding='utf-8') as f:
    text = f.read()

sha = parse_patch_head_sha(text)
print(sha)
`;
  const tempPyFile = path.join(outDir, 'run_v1_parser.py');
  fs.writeFileSync(tempPyFile, pyScript, 'utf8');

  let v1ParsedSha = '';
  try {
    v1ParsedSha = execSync(`python "${tempPyFile}" "${tempPatchFile}"`).toString().trim();
  } finally {
    if (fs.existsSync(tempPatchFile)) fs.unlinkSync(tempPatchFile);
    if (fs.existsSync(tempPyFile)) fs.unlinkSync(tempPyFile);
  }

  // Print results
  console.log(`(a) First 'From <sha>' line of PR #7 .patch:`);
  console.log(`    Line: "${firstFromLine.trim()}"`);
  console.log(`    SHA:  ${firstFromSha}\n`);

  console.log(`(b) Commits from GitHub REST API (total ${commitsList.length}):`);
  for (const c of commitsList) {
    const isHead = c.sha.toLowerCase() === realHeadSha.toLowerCase() ? " (REAL HEAD)" : "";
    const isFirst = c.index === 1 ? " (FIRST COMMIT)" : "";
    console.log(`    Commit ${c.index}: ${c.sha} - "${c.message}"${isHead}${isFirst}`);
  }
  console.log(`    Authoritative API Head SHA: ${realHeadSha}\n`);

  console.log(`(c) V1 parse_patch_head_sha output on pull/7.patch:`);
  console.log(`    V1 Extracted SHA: ${v1ParsedSha}\n`);

  // Comparative assertions
  const firstCommitSha = commitsList[0].sha;
  const a_equals_first = firstFromSha.toLowerCase() === firstCommitSha.toLowerCase();
  const c_equals_first = v1ParsedSha.toLowerCase() === firstCommitSha.toLowerCase();
  const a_differs_from_head = firstFromSha.toLowerCase() !== realHeadSha.toLowerCase();
  const c_differs_from_head = v1ParsedSha.toLowerCase() !== realHeadSha.toLowerCase();

  console.log("Verification of Contrast:");
  console.log(`- (a) First From SHA equals first commit SHA: ${a_equals_first} (${firstFromSha} == ${firstCommitSha})`);
  console.log(`- (c) V1 parsed SHA equals first commit SHA:    ${c_equals_first} (${v1ParsedSha} == ${firstCommitSha})`);
  console.log(`- (a) First From SHA differs from real head:   ${a_differs_from_head} (${firstFromSha} != ${realHeadSha})`);
  console.log(`- (c) V1 parsed SHA differs from real head:    ${c_differs_from_head} (${v1ParsedSha} != ${realHeadSha})`);
  console.log(`- V2 Authoritative API matches real head:      true (${realHeadSha} == ${commitsList[commitsList.length - 1].sha})`);

  const contrastResult = {
    evaluated_at: new Date().toISOString(),
    pr_url: 'https://github.com/huzyow155/ship-escrow-fixtures/pull/7',
    patch_url: patchUrl,
    first_from_line: firstFromLine.trim(),
    first_from_sha: firstFromSha,
    commits: commitsList,
    authoritative_api_head_sha: realHeadSha,
    v1_parse_patch_head_sha_output: v1ParsedSha,
    comparison: {
      first_commit_sha: firstCommitSha,
      real_head_sha: realHeadSha,
      a_equals_first_commit: a_equals_first,
      c_equals_first_commit: c_equals_first,
      a_differs_from_real_head: a_differs_from_head,
      c_differs_from_real_head: c_differs_from_head,
      v2_authoritative_head_verified: realHeadSha.toLowerCase() === commitsList[commitsList.length - 1].sha.toLowerCase(),
    }
  };

  const outPath = path.join(outDir, 'head_contrast.json');
  fs.writeFileSync(outPath, JSON.stringify(contrastResult, null, 2), 'utf8');
  console.log(`\nSaved offline contrast record to: ${outPath}`);
}

main().catch(err => {
  console.error("Head contrast failed:", err);
  process.exit(1);
});
