import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createClient, createAccount, chains } from 'genlayer-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx !== -1) {
      const k = trimmed.substring(0, idx).trim();
      const v = trimmed.substring(idx + 1).trim();
      process.env[k] = v;
    }
  }
}

const client = createClient({ chain: chains.studionet });
const devKey = process.env.DEV_PRIVATE_KEY;
if (!devKey) throw new Error("DEV_PRIVATE_KEY missing from .env");
const account = createAccount(devKey);

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function waitForTx(txHash, label) {
  console.log(`Waiting for ${label} tx ${txHash}...`);
  for (let attempt = 1; attempt <= 60; attempt++) {
    await sleep(3000);
    try {
      const tx = await client.getTransaction({ hash: txHash });
      const statusName = tx.statusName || String(tx.status);
      const execRes = tx.consensus_data?.leader_receipt?.[0]?.execution_result;
      const resultName = tx.result_name || String(tx.result);
      if (statusName === 'ACCEPTED' || statusName === 'FINALIZED') {
        console.log(`[${label}] Completed: status=${statusName}, result=${resultName}, exec=${execRes}`);
        return tx;
      }
    } catch (err) {
      console.warn(`[${label}] poll attempt ${attempt} warning:`, err.message || err);
    }
  }
  throw new Error(`Timeout waiting for tx ${txHash}`);
}

async function main() {
  console.log("====================================================");
  console.log("DEPLOYING & RUNNING BURST PROBE ON STUDIONET");
  console.log("====================================================");

  const probePath = path.join(__dirname, '../../contracts/Probe.py');
  const code = fs.readFileSync(probePath, 'utf8');
  const codeSha = crypto.createHash('sha256').update(code, 'utf8').digest('hex');
  console.log("Probe source sha256:", codeSha);

  const deployTx = await client.deployContract({
    account,
    code,
    args: []
  });
  console.log("Deploy tx submitted:", deployTx);

  const deployReceipt = await waitForTx(deployTx, "Deploy Probe");
  const contractAddress = deployReceipt.data?.contract_address;
  if (!contractAddress) throw new Error("Missing contract_address in deploy receipt");
  console.log("Deployed Probe Address:", contractAddress);

  // Call probe_burst_endpoints
  console.log("\nCalling probe_burst_endpoints with burst count 5...");
  const burstTx = await client.writeContract({
    account,
    address: contractAddress,
    functionName: 'probe_burst_endpoints',
    args: [
      "hypercybers99",
      "ship-escrow-fixtures",
      "2",
      "9d3e8ada2d4c7ed38e6a7843e971df38f6ab4207",
      "5db0441e76af93606fd82feebbe49c5a2f145326",
      5
    ]
  });
  console.log("Burst tx submitted:", burstTx);

  const burstReceipt = await waitForTx(burstTx, "probe_burst_endpoints");

  // Read back result
  console.log("\nReading back probe result...");
  const rawResult = await client.readContract({
    address: contractAddress,
    functionName: 'get_result',
    args: ['burst_endpoints']
  });
  console.log("Stored burst probe result:", rawResult);

  const parsedResult = JSON.parse(rawResult);

  const outData = {
    evaluated_at: new Date().toISOString(),
    probe_address: contractAddress,
    deploy_tx_hash: deployTx,
    burst_tx_hash: burstTx,
    deploy_receipt_status: deployReceipt.statusName,
    burst_receipt_status: burstReceipt.statusName,
    burst_receipt_result: burstReceipt.result_name,
    probe_output: parsedResult,
    full_burst_tx: burstReceipt,
  };

  const outPath = path.join(__dirname, '../../docs/evidence_v2/probe_burst_result.json');
  fs.writeFileSync(outPath, JSON.stringify(outData, null, 2), 'utf8');
  console.log(`Saved probe results to ${outPath}`);

  console.log("\n====================================================");
  console.log("BURST PROBE MEASUREMENT RESULTS:");
  console.log("====================================================");
  console.log("API Statuses (5 calls):     ", parsedResult.api_statuses);
  console.log("Diff Statuses (5 calls):    ", parsedResult.diff_statuses);
  console.log("Git Refs Statuses (5 calls):", parsedResult.git_statuses);
  console.log("Git Authenticated Head SHA: ", parsedResult.git_found_sha);
  console.log("Expected Head SHA:          ", parsedResult.expected_head_sha);
  console.log("Head Authenticated:         ", parsedResult.head_sha_authenticated);
  console.log("====================================================");
}

main().catch(err => {
  console.error("Probe execution error:", err);
  process.exit(1);
});
