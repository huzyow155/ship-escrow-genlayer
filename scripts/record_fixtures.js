const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const opts = {
      headers: {
        'User-Agent': 'ShipEscrow-Fixture-Recorder/2.0',
        'Accept': 'application/vnd.github.v3+json',
      },
    };
    https.get(url, opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`JSON parse error from ${url}: ${e.message}`));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode} from ${url}: ${data.substring(0, 200)}`));
        }
      });
    }).on('error', reject);
  });
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const opts = {
      headers: {
        'User-Agent': 'ShipEscrow-Fixture-Recorder/2.0',
      },
    };
    https.get(url, opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode} from ${url}: ${data.substring(0, 200)}`));
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  const prs = [
    { name: 'F1', num: 2, desc: 'Full release clean implementation' },
    { name: 'F2', num: 3, desc: 'Trap: readme only, missing required path' },
    { name: 'F3', num: 4, desc: 'Trap: deleted test files CI gaming' },
    { name: 'F4', num: 5, desc: 'Partial release: helper implemented, missing docs' },
    { name: 'F5', num: 6, desc: 'Prompt injection attempt in PR body/diff' },
    { name: 'F6', num: 7, desc: 'Multi-commit PR (3 commits, head != first From)' },
    { name: 'F7', num: 8, desc: 'Advancing head PR (submit with old sha)' },
    { name: 'F8', num: 9, desc: 'Wrong-wallet marker in PR body' },
    { name: 'F9', num: 10, desc: 'No wallet marker in PR body' },
    { name: 'F10', num: 11, desc: 'Partial required prefix (touches 1 of 2 required)' },
    { name: 'F11', num: 12, desc: 'Mixed add/delete with deleted non-test file named contest_rules' },
    { name: 'F12', num: 13, desc: 'Oversize diff (> 14k) with required file after cap' },
  ];

  const fixturesDir = path.join(__dirname, '../fixtures/diffs_v2');
  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true });
  }

  const results = [];

  for (const pr of prs) {
    const apiUrl = `https://api.github.com/repos/huzyow155/ship-escrow-fixtures/pulls/${pr.num}`;
    console.log(`Fetching metadata for PR #${pr.num} (${pr.name})...`);
    const meta = await fetchJson(apiUrl);

    const headSha = meta.head.sha;
    const baseSha = meta.base.sha;
    const compareUrl = `https://github.com/huzyow155/ship-escrow-fixtures/compare/${baseSha}...${headSha}.diff`;
    const prUrl = `https://github.com/huzyow155/ship-escrow-fixtures/pull/${pr.num}`;

    console.log(`  head: ${headSha}, base: ${baseSha}`);
    console.log(`  fetching compare diff: ${compareUrl}...`);
    const diffText = await fetchText(compareUrl);
    const diffSha256 = crypto.createHash('sha256').update(diffText, 'utf8').digest('hex');

    // Save diff
    const diffFile = path.join(fixturesDir, `${pr.name.toLowerCase()}.diff`);
    fs.writeFileSync(diffFile, diffText, 'utf8');

    results.push({
      fixture_id: pr.name,
      pr_number: pr.num,
      description: pr.desc,
      pr_url: prUrl,
      head_sha: headSha,
      base_sha: baseSha,
      compare_url: compareUrl,
      diff_length: diffText.length,
      diff_sha256: diffSha256,
      body: meta.body,
      commits: meta.commits,
      state: meta.state,
      draft: meta.draft,
      user_login: meta.user.login,
    });
  }

  // For F7, also record the initial (old) head sha
  const f7 = results.find(r => r.fixture_id === 'F7');
  if (f7) {
    f7.old_head_sha = 'c4eb7b2a842c306b159e1c5d66d61575b67f1ef6';
    console.log(`F7 recorded with old_head_sha: ${f7.old_head_sha}`);
  }

  const outPath = path.join(__dirname, '../fixtures/fixtures_v2.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\nSuccessfully recorded ${results.length} fixtures to ${outPath}`);
}

main().catch(err => {
  console.error("Failed:", err);
  process.exit(1);
});
