const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const { createClient, chains } = require('genlayer-js');
const fs = require('fs');
const path = require('path');

const client = createClient({ chain: chains.studionet });
const escrowAddress = '0x8DC94110Ed3E111Fb74Dce849CdBA8f567E6024F';
const evidenceDir = path.join(__dirname, '../docs/evidence');

const txs = [
  { name: 'case_f_404_receipt.json', hash: '0xc8ece3c59413fcb9b77f70b6192641184f2ff5373cc0f530be72f6eba47f0180' },
  { name: 'case_f_bad_sha_receipt.json', hash: '0xc6305c9cb6a001d4d95da9eefe9e9a25577ff2483dfc168e00ac46712fb7210d' },
  { name: 'case_f_wrong_repo_receipt.json', hash: '0x361fb598445ee04e9219ab3829219a19419ab70e551e2ab319561a03cb977678' },
  { name: 'case_g_receipt.json', hash: '0x4b3ba968f059e5cd8cbd6b9f2cbab3317e50310d019be10924d0184fe2b0e359' },
  { name: 'case_h_att1_receipt.json', hash: '0x4505c25d920e613f3a8359e66a083f344263ab5b071749c88b8300ec71ad7202' },
  { name: 'case_h_att2_receipt.json', hash: '0xa754c4f0ef27c096a04caa47f8c5b4c154e66d02b0ba4e6e43b7ed1da29c6a43' },
  { name: 'case_h_att3_receipt.json', hash: '0x9488be35cfffd234bc6864e104a3f38102b45adba29203c50e3f40c9628fedc5' },
  { name: 'case_h_refund_exhausted_receipt.json', hash: '0x001501cb9ea23d16623290f59d502718794c9f05decaf9a6d01b54188c47a921' },
];

async function main() {
  console.log('--- FETCHING TX RECEIPTS ---');
  for (const item of txs) {
    console.log(`Fetching ${item.name} (${item.hash})...`);
    const tx = await client.getTransaction({ hash: item.hash });
    const filePath = path.join(evidenceDir, item.name);
    fs.writeFileSync(filePath, JSON.stringify(tx, null, 2), 'utf8');
    const leaderRes = tx.consensus_data?.leader_receipt?.[0]?.result;
    const readablePayload = leaderRes?.payload;
    console.log(`  Saved to ${item.name} | Status: ${tx.statusName} | Result: ${tx.result_name} | Payload: ${JSON.stringify(readablePayload)}`);
  }

  console.log('\n--- FETCHING LATEST GET_STATS() ---');
  const statsRaw = await client.readContract({
    address: escrowAddress,
    functionName: 'get_stats',
    args: [],
  });
  console.log('Raw stats returned:');
  console.log(statsRaw);
  const statsParsed = typeof statsRaw === 'string' ? JSON.parse(statsRaw) : statsRaw;
  const statsFinalPath = path.join(evidenceDir, 'stats_final.json');
  fs.writeFileSync(statsFinalPath, JSON.stringify(statsParsed, null, 2), 'utf8');
  console.log(`Saved stats to ${statsFinalPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
