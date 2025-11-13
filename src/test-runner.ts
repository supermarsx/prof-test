import * as fs from 'fs';
import * as path from 'path';

async function run() {
  // run tests using node + ts-node isn't configured here; instead run a very small ad-hoc test runner
  const tfile = path.join(__dirname, '__tests__', 'seededShuffle.test.ts');
  const content = fs.readFileSync(tfile, 'utf8');
  if (!content.includes('seededShuffle')) {
    console.error('test file not found or invalid');
    process.exit(2);
  }
  console.log('Tests present (please run using a test runner like vitest/jest).');
}

run().catch((e) => { console.error(e); process.exit(1); });
