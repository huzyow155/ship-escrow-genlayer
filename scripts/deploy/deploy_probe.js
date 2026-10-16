const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const { createClient, chains, createAccount } = require('genlayer-js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

async function main() {
  console.log("=================================================");
  console.log("MILESTONE 0: RUNTIME PROBE DEPLOYMENT & EXECUTION");
  console.log("=================================================");

  const account = createAccount();
  console.log("Using throwaway test account:", account.address);

  const client = createClient({
    chain: chains.studionet,
    account: account,
  });

  const probePath = path.join(__dirname, '../../contracts/Probe.py');
  const code = fs.readFileSync(probePath, 'utf8');
  const codeSha = crypto.createHash('sha256').update(code, 'utf8').digest('hex');
  console.log("Probe source sha256:", codeSha);

  console.log("\n1. Deploying Probe contract to Studionet...");
  const tDeploy0 = Date.now();
  const deployTxHash = await client.deployContract({
    code: code,
    args: [],
  });
  console.log("Deploy tx hash:", deployTxHash);

  const deployReceipt = await client.waitForTransactionReceipt({
    hash: deployTxHash,
    retries: 120,
    interval: 3000,
  });
  const deployElapsed = ((Date.now() - tDeploy0) / 1000).toFixed(2);
  console.log(`Deployment receipt received in ${deployElapsed}s:`);
  console.log("  status_name:", deployReceipt.status_name);
  console.log("  result_name:", deployReceipt.result_name);
  const leaderRes = deployReceipt.consensus_data?.leader_receipt?.[0]?.execution_result;
  console.log("  leader execution_result:", leaderRes);

  const contractAddress = deployReceipt.recipient;
  console.log("Probe contract address:", contractAddress);

  if (!contractAddress || leaderRes !== 'SUCCESS') {
    throw new Error("Probe contract deployment failed: " + JSON.stringify(deployReceipt));
  }

  const results = {
    contractAddress,
    deployTxHash,
    deployElapsed,
    sender: account.address,
    views: {},
    writes: {},
    latencies: {},
  };

  // 2. Test view calls: bool, str, list[str], sender
  console.log("\n2. Testing public view calls...");
  try {
    const vBool = await client.readContract({
      address: contractAddress,
      functionName: 'probe_bool',
      args: [],
    });
    console.log("  probe_bool returned:", vBool, `(type: ${typeof vBool})`);
    results.views.probe_bool = vBool;
  } catch (e) {
    console.error("  probe_bool error:", e.message);
    results.views.probe_bool_err = e.message;
  }

  try {
    const vStr = await client.readContract({
      address: contractAddress,
      functionName: 'probe_str',
      args: [],
    });
    console.log("  probe_str returned:", vStr, `(type: ${typeof vStr})`);
    results.views.probe_str = vStr;
  } catch (e) {
    console.error("  probe_str error:", e.message);
    results.views.probe_str_err = e.message;
  }

  try {
    const vList = await client.readContract({
      address: contractAddress,
      functionName: 'probe_list',
      args: [],
    });
    console.log("  probe_list returned:", vList, `(isArray: ${Array.isArray(vList)})`);
    results.views.probe_list = vList;
  } catch (e) {
    console.error("  probe_list error:", e.message);
    results.views.probe_list_err = e.message;
  }

  // 3. Test imports and sender inside write
  console.log("\n3. Testing stdlib imports and sender in write...");
  const tW0 = Date.now();
  const txImports = await client.writeContract({
    address: contractAddress,
    functionName: 'probe_imports_and_sender',
    args: [],
  });
  console.log("  tx hash:", txImports);
  const recImports = await client.waitForTransactionReceipt({
    hash: txImports,
    retries: 120,
    interval: 3000,
  });
  const elImports = ((Date.now() - tW0) / 1000).toFixed(2);
  console.log(`  Imports write completed in ${elImports}s (status: ${recImports.status_name}, execution_result: ${recImports.consensus_data?.leader_receipt?.[0]?.execution_result})`);
  results.latencies.imports = elImports;

  const resImports = await client.readContract({
    address: contractAddress,
    functionName: 'get_result',
    args: ['imports_and_sender'],
  });
  console.log("  get_result('imports_and_sender'):", resImports);
  results.writes.imports_and_sender = resImports;

  // 4. Test diff stability (fetch twice and compare sha256)
  console.log("\n4. Testing diff stability (2 fetches inside nondet)...");
  const diffUrl = "https://github.com/huzyow155/ship-escrow-fixtures/pull/2.diff";
  const tD0 = Date.now();
  const txDiffStab = await client.writeContract({
    address: contractAddress,
    functionName: 'probe_diff_stability',
    args: [diffUrl],
  });
  console.log("  tx hash:", txDiffStab);
  const recDiffStab = await client.waitForTransactionReceipt({
    hash: txDiffStab,
    retries: 120,
    interval: 3000,
  });
  const elDiffStab = ((Date.now() - tD0) / 1000).toFixed(2);
  console.log(`  Diff stability completed in ${elDiffStab}s`);
  results.latencies.diff_stability = elDiffStab;

  const resDiffStab = await client.readContract({
    address: contractAddress,
    functionName: 'get_result',
    args: ['diff_stability'],
  });
  console.log("  get_result('diff_stability'):", resDiffStab);
  results.writes.diff_stability = resDiffStab;

  // 5. Test web fetch targets: raw github, patch, api, 404
  const webTargets = [
    { key: "github_diff", url: "https://github.com/huzyow155/ship-escrow-fixtures/pull/2.diff" },
    { key: "github_patch", url: "https://github.com/huzyow155/ship-escrow-fixtures/pull/2.patch" },
    { key: "github_api", url: "https://api.github.com/repos/huzyow155/ship-escrow-fixtures/pulls/2" },
    { key: "raw_github", url: "https://raw.githubusercontent.com/huzyow155/ship-escrow-fixtures/main/README.md" },
    { key: "wikipedia", url: "https://en.wikipedia.org/wiki/Main_Page" },
    { key: "not_found_404", url: "https://github.com/huzyow155/ship-escrow-fixtures/pull/99999.diff" },
  ];

  for (const t of webTargets) {
    console.log(`\nTesting web fetch for ${t.key} (${t.url})...`);
    const tStart = Date.now();
    try {
      const tx = await client.writeContract({
        address: contractAddress,
        functionName: 'probe_web_fetch',
        args: [t.url, t.key],
      });
      const rec = await client.waitForTransactionReceipt({
        hash: tx,
        retries: 120,
        interval: 3000,
      });
      const elapsed = ((Date.now() - tStart) / 1000).toFixed(2);
      console.log(`  ${t.key} finished in ${elapsed}s (status: ${rec.status_name})`);
      results.latencies[t.key] = elapsed;

      const out = await client.readContract({
        address: contractAddress,
        functionName: 'get_result',
        args: [t.key],
      });
      console.log(`  result:`, out);
      results.writes[t.key] = out;
    } catch (err) {
      console.error(`  ${t.key} failed:`, err.message);
      results.writes[t.key] = `ERROR: ${err.message}`;
    }
  }

  // 6. Test exec_prompt with 0 bytes vs 3000 bytes
  console.log("\n6. Testing exec_prompt latency and format...");
  for (const sz of [0, 1000, 3000]) {
    console.log(`  Testing exec_prompt with diff size ${sz}...`);
    const tL0 = Date.now();
    const txL = await client.writeContract({
      address: contractAddress,
      functionName: 'probe_exec_prompt',
      args: [sz],
    });
    const recL = await client.waitForTransactionReceipt({
      hash: txL,
      retries: 120,
      interval: 3000,
    });
    const elL = ((Date.now() - tL0) / 1000).toFixed(2);
    console.log(`  exec_prompt(${sz}) finished in ${elL}s (status: ${recL.status_name})`);
    results.latencies[`prompt_${sz}`] = elL;

    const outL = await client.readContract({
      address: contractAddress,
      functionName: 'get_result',
      args: [`prompt_${sz}`],
    });
    console.log(`  result:`, outL);
    results.writes[`prompt_${sz}`] = outL;
  }

  fs.writeFileSync(
    path.join(__dirname, 'probe_results.json'),
    JSON.stringify(results, null, 2)
  );
  console.log("\nProbe results saved to scripts/deploy/probe_results.json");
}

main().catch(err => {
  console.error("Probe script error:", err);
  process.exit(1);
});
