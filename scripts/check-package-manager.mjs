import fs from 'node:fs';

const forbidden = ['pnpm-lock.yaml', 'yarn.lock'];
const present = forbidden.filter((file) => fs.existsSync(new URL(`../${file}`, import.meta.url)));

if (present.length) {
  console.error(`Unsupported competing lockfile(s): ${present.join(', ')}. Mega Product Radar deploys with npm/package-lock.json.`);
  process.exit(1);
}

if (!fs.existsSync(new URL('../package-lock.json', import.meta.url))) {
  console.error('package-lock.json is required for deterministic npm deploys.');
  process.exit(1);
}

console.log('Package manager invariant: npm/package-lock.json only.');
