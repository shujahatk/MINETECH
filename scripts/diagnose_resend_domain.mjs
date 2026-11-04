/**
 * Read-only Resend sender-domain diagnostic. Sends NO email and writes NOTHING.
 *
 *   node scripts/diagnose_resend_domain.mjs                       # uses .env.local then .env
 *   node scripts/diagnose_resend_domain.mjs --env-file .env.vercel  # e.g. from `vercel env pull`
 *
 * Prints the sender domain, which env var supplied it, and the domains the configured
 * RESEND_API_KEY can see in Resend. The API key is never printed (only a short fingerprint).
 */
import fs from 'node:fs';
import dotenv from 'dotenv';
import { getEmailEnvironmentReport, checkResendDomains } from '../lib/services/emailDiagnostics.js';

const idx = process.argv.indexOf('--env-file');
if (idx !== -1 && process.argv[idx + 1]) {
  const file = process.argv[idx + 1];
  if (!fs.existsSync(file)) {
    console.error(`Env file not found: ${file}`);
    process.exit(2);
  }
  // Explicit file wins over anything already in the shell.
  Object.assign(process.env, dotenv.parse(fs.readFileSync(file)));
  console.log(`Using env file: ${file}`);
} else {
  dotenv.config({ path: '.env.local' });
  dotenv.config();
  console.log('Using .env.local / .env (this is your LOCAL config, not necessarily what Vercel production uses)');
}

const report = getEmailEnvironmentReport();
console.log('\n== Sender / environment ==');
console.log(JSON.stringify({ environment: report.environment, sender: report.sender, apiKey: report.apiKey }, null, 2));

if (report.warnings.length) {
  console.log('\n== Config warnings ==');
  report.warnings.forEach((w) => console.log(` - ${w}`));
}

console.log('\n== Domains visible to this API key (Resend GET /domains) ==');
const domains = await checkResendDomains({
  apiKey: (process.env.RESEND_API_KEY || '').trim(),
  senderDomain: report.sender.domain,
});
console.log(
  JSON.stringify(
    {
      ok: domains.ok,
      httpStatus: domains.httpStatus,
      senderDomain: domains.senderDomain,
      senderDomainFound: domains.senderDomainFound,
      senderDomainStatus: domains.senderDomainStatus,
      domains: domains.domains,
      error: domains.error,
    },
    null,
    2
  )
);

console.log('\n== Diagnosis ==');
domains.diagnosis.forEach((d) => console.log(` - ${d}`));

process.exitCode = domains.ok && domains.senderDomainFound && domains.senderDomainStatus === 'verified' ? 0 : 1;
