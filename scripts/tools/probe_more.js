const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const { createClient, chains, createAccount } = require('genlayer-js');
const fs = require('fs');
const path = require('path');

async function main() {
  const probeData = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../deploy/probe_results.json'), 'utf8')
  );
  const contractAddress = probeData.contractAddress;
  console.log("Using Probe address:", contractAddress);

  const account = createAccount();
  const client = createClient({
    chain: chains.studionet,
    account: account,
  });

  // 5 fetches in a row to observe rate-limiting
  console.log("Running 5 fetches in a row for GitHub diff to test rate-limiting...");
  const diffUrl = "https://github.com/huzyow155/ship-escrow-fixtures/pull/2.diff";
  const rateLimitResults = [];
  for (let i = 1; i <= 5; i++) {
    const t0 = Date.now();
    const tx = await client.writeContract({
      address: contractAddress,
      functionName: 'probe_web_fetch',
      args: [diffUrl, `rate_test_${i}`],
    });
    const rec = await client.waitForTransactionReceipt({
      hash: tx,
      retries: 120,
      interval: 3000,
    });
    const el = ((Date.now() - t0) / 1000).toFixed(2);
    const res = await client.readContract({
      address: contractAddress,
      functionName: 'get_result',
      args: [`rate_test_${i}`],
    });
    console.log(`  Fetch #${i}: ${el}s -> ${res}`);
    rateLimitResults.push({ attempt: i, elapsed: el, result: JSON.parse(res) });
  }

  probeData.rateLimitResults = rateLimitResults;
  fs.writeFileSync(
    path.join(__dirname, '../deploy/probe_results.json'),
    JSON.stringify(probeData, null, 2)
  );
  console.log("Updated probe_results.json with rate limit results.");
}

main().catch(err => {
  console.error("Additional probe error:", err);
  process.exit(1);
});
