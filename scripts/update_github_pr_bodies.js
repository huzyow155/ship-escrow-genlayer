const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const devAddress = '0x6325B360Db455435BF5e81D0aE18DC3b249f226C';
const attackerAddress = '0xd033Dd543890C4eB2952B796037a11481497da9a';

const fixtures = JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures/fixtures_v2.json'), 'utf8'));

for (const fix of fixtures) {
  let newBody = fix.body;
  if (fix.fixture_id === 'F8') {
    newBody = `Clean slugify implementation bound to unauthorized wallet.\n\nship-escrow-wallet: ${attackerAddress}`;
  } else if (fix.fixture_id === 'F9') {
    newBody = `Clean slugify implementation without wallet marker.`;
  } else {
    newBody = newBody.replace(/0x[0-9a-fA-F]{40}/g, devAddress);
    if (!newBody.includes('ship-escrow-wallet:')) {
      newBody = `${newBody.trim()}\n\nship-escrow-wallet: ${devAddress}`;
    }
  }

  fix.body = newBody;
  console.log(`Updating PR #${fix.pr_number} (${fix.fixture_id})...`);
  
  // Use gh api -X PATCH repos/:owner/:repo/pulls/:number
  const tempFile = path.join(__dirname, `temp_body_${fix.pr_number}.txt`);
  fs.writeFileSync(tempFile, newBody, 'utf8');
  try {
    execSync(`gh api -X PATCH repos/huzyow155/ship-escrow-fixtures/pulls/${fix.pr_number} -F body=@"${tempFile}" --silent`, { stdio: 'inherit' });
    console.log(`  PR #${fix.pr_number} successfully updated via REST API.`);
  } catch (err) {
    console.error(`  Failed to update PR #${fix.pr_number}:`, err.message);
  } finally {
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
  }
}

fs.writeFileSync(path.join(__dirname, '../fixtures/fixtures_v2.json'), JSON.stringify(fixtures, null, 2));
console.log('All fixtures and GitHub PRs updated successfully!');
