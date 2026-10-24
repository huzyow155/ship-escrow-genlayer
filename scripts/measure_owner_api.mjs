import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function measureEndpoint(url, label, count = 20) {
  console.log(`\nMeasuring ${label} (${url}) ${count} times (spaced 1s)...`);
  const samples = [];
  const statusCounts = {};

  for (let i = 1; i <= count; i++) {
    const t0 = Date.now();
    try {
      // Manual redirect mode: 'manual' to see raw status before client follows redirects
      const rawRes = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'ShipEscrow-Audit-Measurement/2.0'
        },
        redirect: 'manual'
      });
      const elapsed = Date.now() - t0;
      const status = rawRes.status;
      statusCounts[status] = (statusCounts[status] || 0) + 1;

      samples.push({
        sample_index: i,
        status,
        status_text: rawRes.statusText,
        elapsed_ms: elapsed,
        location_header: rawRes.headers.get('location') || null,
        rate_limit_remaining: rawRes.headers.get('x-ratelimit-remaining') || null,
        rate_limit_reset: rawRes.headers.get('x-ratelimit-reset') || null,
      });

      console.log(`  [${i}/${count}] Status: ${status} (${rawRes.statusText}) in ${elapsed}ms`);
    } catch (err) {
      statusCounts['ERROR'] = (statusCounts['ERROR'] || 0) + 1;
      samples.push({
        sample_index: i,
        status: 'ERROR',
        error: err.message,
        elapsed_ms: Date.now() - t0,
      });
      console.log(`  [${i}/${count}] ERROR: ${err.message}`);
    }

    if (i < count) await sleep(1000);
  }

  return {
    url,
    label,
    total_samples: count,
    status_distribution: statusCounts,
    samples,
  };
}

async function main() {
  console.log("====================================================");
  console.log("MEASURING GITHUB API PULLS: OLD OWNER VS CANONICAL");
  console.log("====================================================");

  const oldUrl = "https://api.github.com/repos/huzyow155/ship-escrow-fixtures/pulls/2";
  const canonUrl = "https://api.github.com/repos/hypercybers99/ship-escrow-fixtures/pulls/2";

  const oldResults = await measureEndpoint(oldUrl, "Old Owner (huzyow155)", 20);
  await sleep(3000);
  const canonResults = await measureEndpoint(canonUrl, "Canonical Owner (hypercybers99)", 20);

  const measurementOutput = {
    measured_at: new Date().toISOString(),
    rationale: "Empirical comparison of GitHub REST API response distribution for renamed repository vs canonical repository owner",
    summary: {
      old_owner: {
        url: oldUrl,
        samples: 20,
        distribution: oldResults.status_distribution,
        redirect_location_observed: oldResults.samples[0]?.location_header || null,
      },
      canonical_owner: {
        url: canonUrl,
        samples: 20,
        distribution: canonResults.status_distribution,
      },
    },
    details: {
      old_owner_runs: oldResults.samples,
      canonical_owner_runs: canonResults.samples,
    },
    on_chain_validator_comparison: {
      note: "GenVM gl.nondet.web.get HTTP client behavior differs from browser/cURL: unhandled 301/302 redirects or unauthenticated IP rate limits present as status 404 or 403 on validator nodes.",
      raw_receipts: {
        rate_limit_403: "docs/evidence_v2/probe_rate_limit_403_receipt.json",
        old_owner_404: "docs/evidence_v2/probe_old_owner_receipt.json",
      }
    }
  };

  const outPath = path.join(__dirname, '../docs/evidence_v2/probe_owner_measurement.json');
  fs.writeFileSync(outPath, JSON.stringify(measurementOutput, null, 2));
  console.log(`\nSaved measurement results to ${outPath}`);
  console.log("Old owner distribution:      ", JSON.stringify(oldResults.status_distribution));
  console.log("Canonical owner distribution:", JSON.stringify(canonResults.status_distribution));
}

main().catch(err => {
  console.error("Measurement failed:", err);
  process.exit(1);
});
