import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const required = [
  'backend/package.json',
  'frontend/package.json',
  'backend/package-lock.json',
  'frontend/package-lock.json',
  'docs/RELEASE-ACCEPTANCE-PHASE-15.md',
  'docs/SECURITY.md',
  'docs/TENANCY.md',
  'docs/PRODUCTION-DEPLOYMENT.md',
  'scripts/backup-mongodb.sh',
  'scripts/restore-mongodb.sh',
];
const missing = required.filter((file) => !existsSync(resolve(root, file)));
if (missing.length) {
  console.error('Release asset check failed. Missing required files:');
  for (const file of missing) console.error(` - ${file}`);
  process.exit(1);
}

const apiDocs = readFileSync(resolve(root, 'docs/API.md'), 'utf8');
const acceptance = readFileSync(resolve(root, 'docs/RELEASE-ACCEPTANCE-PHASE-15.md'), 'utf8');
const billingWebhookMounted = readFileSync(resolve(root, 'backend/src/app.ts'), 'utf8').includes('createBillingWebhookRouter');
const requiredTerms = ['tenant isolation', 'Paystack', 'backup', 'no-go'];
const missingTerms = requiredTerms.filter((term) => !acceptance.toLowerCase().includes(term.toLowerCase()));
if (!apiDocs.includes('/api/v1/billing/webhook') || !billingWebhookMounted || missingTerms.length) {
  console.error('Release asset check failed: webhook wiring or acceptance controls are missing.');
  if (!apiDocs.includes('/api/v1/billing/webhook')) console.error(' - API documentation does not mention the subscription webhook');
  if (!billingWebhookMounted) console.error(' - Subscription webhook is not mounted in the application');
  for (const term of missingTerms) console.error(` - Acceptance checklist is missing: ${term}`);
  process.exit(1);
}

console.log('Release asset check passed.');
console.log('This checks release documentation and wiring only; it does NOT replace typecheck, tests, build, database checks, staging verification, or release sign-off.');
