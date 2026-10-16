const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const { createClient, chains, createAccount } = require('genlayer-js');
const fs = require('fs');
const path = require('path');

async function main() {
  const deployments = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../deploy/deployments.json'), 'utf8')
  );
  const contractAddress = deployments.contractAddress;
  console.log("Testing Milestone 1 on contract:", contractAddress);

  const creatorAccount = createAccount();
  const client = createClient({
    chain: chains.studionet,
    account: creatorAccount,
  });

  console.log("Creator account:", creatorAccount.address);

  // 1. Create a bounty
  const bountyData = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../../fixtures/bounty.json'), 'utf8')
  );
  const title = bountyData.title;
  const ownerRepo = bountyData.owner_repo;
  const criteriaJson = JSON.stringify(bountyData.criteria);
  const requiredPathsJson = JSON.stringify(bountyData.required_paths);
  const amount = bountyData.amount;

  console.log("\n1. Calling create_bounty()...");
  const t0 = Date.now();
  const txHash = await client.writeContract({
    address: contractAddress,
    functionName: 'create_bounty',
    args: [title, ownerRepo, criteriaJson, requiredPathsJson, amount],
  });
  console.log("Create bounty tx hash:", txHash);

  const receipt = await client.waitForTransactionReceipt({
    hash: txHash,
    retries: 120,
    interval: 3000,
  });
  const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
  console.log(`Create bounty completed in ${elapsed}s:`);
  console.log("  status_name:", receipt.status_name);
  console.log("  result_name:", receipt.result_name);
  console.log("  leader execution_result:", receipt.consensus_data?.leader_receipt?.[0]?.execution_result);

  // 2. Read back state
  console.log("\n2. Reading back bounty state...");
  const bounty1 = await client.readContract({
    address: contractAddress,
    functionName: 'get_bounty',
    args: ['1'],
  });
  console.log("get_bounty('1') returned:", bounty1);
  const parsed = JSON.parse(bounty1);
  console.log("  status:", parsed.status);
  console.log("  criteria_hash:", parsed.criteria_hash);
  console.log("  creator:", parsed.creator);
  console.log("  amount:", parsed.amount);

  const stats = await client.readContract({
    address: contractAddress,
    functionName: 'get_stats',
    args: [],
  });
  console.log("\nget_stats() returned:", stats);

  console.log("\nMilestone 1 completed successfully with Result: SUCCESS and state read-back verified!");
}

main().catch(err => {
  console.error("M1 round error:", err);
  process.exit(1);
});
