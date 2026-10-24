import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient, chains } from 'genlayer-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const txs = JSON.parse(fs.readFileSync(path.join(__dirname, '../task_4348_txs.json'), 'utf8'));
const evidenceDir = path.join(__dirname, '../docs/evidence_v2');

const client = createClient({ chain: chains.studionet });

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log(`Restoring ${Object.keys(txs).length} receipts for 0x8a9c079a7E1F756e07e8FbE392a5E93106DE28bF...`);

  for (const [name, txHash] of Object.entries(txs)) {
    let success = false;
    for (let attempt = 1; attempt <= 10; attempt++) {
      try {
        const tx = await client.getTransaction({ hash: txHash });
        const filePath = path.join(evidenceDir, `${name}.json`);
        fs.writeFileSync(filePath, JSON.stringify(tx, null, 2), 'utf8');
        console.log(`Saved ${name}.json (tx: ${txHash})`);
        success = true;
        break;
      } catch (err) {
        console.warn(`[${name} attempt ${attempt}] fetch error: ${err.message}. Retrying in 3000ms...`);
        await sleep(3000);
      }
    }
    if (!success) {
      throw new Error(`Failed to fetch ${name} (${txHash})`);
    }
    await sleep(2100);
  }

  console.log("All 34 receipts restored successfully.");
  fs.unlinkSync(path.join(__dirname, '../task_4348_txs.json'));
}

main().catch(err => {
  console.error("Fetch failed:", err);
  process.exit(1);
});
