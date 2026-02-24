import { readFileSync, writeFileSync } from 'node:fs';

const version = process.argv[2];

if (!version) {
  console.error('Usage: node scripts/bump-version.mjs <version>');
  process.exit(1);
}

const path = 'packages/signalling-server/package.json';
const pkg = JSON.parse(readFileSync(path, 'utf8'));
pkg.version = version;
writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`);
console.log(`Bumped signalling-server to ${version}`);
