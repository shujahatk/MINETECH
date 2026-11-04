/**
 * Offline tests for the Resend sender/domain diagnostics (no network, no database, no email sent).
 * Run: npm run test:email-diagnostics
 */
import assert from 'node:assert/strict';
import {
  resolveSenderSource,
  getEmailEnvironmentReport,
  getSendLogContext,
  logResendFailure,
  checkResendDomains,
  domainOf,
  fingerprintSecret,
} from '../lib/services/emailDiagnostics.js';
import { getEmailConfig, dispatchViaResend } from '../lib/services/emailService.js';

let passed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`  FAIL ${name}\n       ${err.message}`);
    process.exitCode = 1;
  }
}

const SECRET = 're_SuperSecretKey1234567890abcdefXYZ';
const ENV_KEYS = ['EMAIL_FROM', 'RESEND_FROM_EMAIL', 'DEFAULT_FROM_EMAIL', 'REPLY_TO', 'RESEND_API_KEY', 'RESEND_SMTP_PASSWORD', 'EMAIL_FROM_NAME', 'VERCEL_ENV', 'NODE_ENV'];
const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
function setEnv(vars = {}) {
  ENV_KEYS.forEach((k) => delete process.env[k]);
  Object.entries(vars).forEach(([k, v]) => { process.env[k] = v; });
}
function restoreEnv() {
  ENV_KEYS.forEach((k) => { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; });
}

console.log('sender resolution');
await test('precedence matches getEmailConfig() for every combination', () => {
  const combos = [
    {},
    { EMAIL_FROM: 'a@one.com' },
    { RESEND_FROM_EMAIL: 'b@two.com' },
    { DEFAULT_FROM_EMAIL: 'c@three.com' },
    { EMAIL_FROM: 'a@one.com', RESEND_FROM_EMAIL: 'b@two.com', DEFAULT_FROM_EMAIL: 'c@three.com' },
    { RESEND_FROM_EMAIL: 'b@two.com', DEFAULT_FROM_EMAIL: 'c@three.com' },
  ];
  combos.forEach((vars) => {
    setEnv(vars);
    assert.equal(resolveSenderSource(process.env).value, getEmailConfig().from, JSON.stringify(vars));
  });
  restoreEnv();
});
await test('reports which env var supplies the sender and that no env falls back to the hard-coded default', () => {
  assert.equal(resolveSenderSource({ EMAIL_FROM: 'x@y.com' }).source, 'EMAIL_FROM');
  assert.equal(resolveSenderSource({ RESEND_FROM_EMAIL: 'x@y.com' }).source, 'RESEND_FROM_EMAIL');
  assert.equal(resolveSenderSource({}).source, 'hard-coded default');
  assert.equal(resolveSenderSource({}).value, 'rauf@mine-tech.be');
});
await test('domainOf handles display names and case', () => {
  assert.equal(domainOf('Rauf <Rauf@Mine-Tech.BE>'), 'mine-tech.be');
  assert.equal(domainOf('nope'), '');
});

console.log('report is non-secret and flags misconfiguration');
await test('report never contains the API key', () => {
  const report = getEmailEnvironmentReport({ EMAIL_FROM: 'rauf@mine-tech.be', RESEND_API_KEY: SECRET, NODE_ENV: 'production', VERCEL_ENV: 'production' });
  const text = JSON.stringify(report);
  assert.ok(!text.includes(SECRET));
  assert.ok(!text.includes(SECRET.slice(3, 20)));
  assert.equal(report.apiKey.present, true);
  assert.equal(report.apiKey.length, SECRET.length);
  assert.equal(report.apiKey.fingerprint, fingerprintSecret(SECRET));
  assert.equal(report.sender.domain, 'mine-tech.be');
  assert.equal(report.sender.source, 'EMAIL_FROM');
});
await test('warns when a shadowed sender var points to another domain', () => {
  const r = getEmailEnvironmentReport({ EMAIL_FROM: 'rauf@mine-tech.be', RESEND_FROM_EMAIL: 'rauf@other.com' });
  assert.ok(r.warnings.some((w) => /RESEND_FROM_EMAIL.*IGNORED/.test(w)));
});
await test('warns on quotes, display-name format, preview env and missing key', () => {
  assert.ok(getEmailEnvironmentReport({ EMAIL_FROM: '"rauf@mine-tech.be"' }).warnings.some((w) => /quote/.test(w)));
  assert.ok(getEmailEnvironmentReport({ EMAIL_FROM: 'Rauf <rauf@mine-tech.be>' }).warnings.some((w) => /angle brackets/.test(w)));
  assert.ok(getEmailEnvironmentReport({ NODE_ENV: 'production', VERCEL_ENV: 'preview' }).warnings.some((w) => /Preview/.test(w)));
  assert.ok(getEmailEnvironmentReport({}).warnings.some((w) => /RESEND_API_KEY is not set/.test(w)));
});

console.log('failure logging');
await test('logResendFailure logs domain/env/error and no secrets', () => {
  const lines = [];
  const env = { EMAIL_FROM: 'rauf@mine-tech.be', RESEND_API_KEY: SECRET, NODE_ENV: 'production', VERCEL_ENV: 'production' };
  const entry = logResendFailure(
    { httpStatus: 403, errJson: { name: 'validation_error', message: 'The mine-tech.be domain is not verified.' }, senderEmail: 'rauf@mine-tech.be', attempt: 0 },
    env,
    { error: (l) => lines.push(l) }
  );
  const out = lines.join('\n');
  assert.match(out, /\[EmailService\]\[ResendError\]/);
  assert.equal(entry.senderDomain, 'mine-tech.be');
  assert.equal(entry.vercelEnv, 'production');
  assert.equal(entry.resendErrorName, 'validation_error');
  assert.equal(entry.httpStatus, 403);
  assert.ok(!out.includes(SECRET));
  assert.ok(!/Bearer/i.test(out));
});

console.log('dispatchViaResend (mocked Resend)');
function mockFetchOnce(status, json, capture) {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    capture.url = url;
    capture.init = init;
    return { ok: status >= 200 && status < 300, status, json: async () => json };
  };
  return () => { globalThis.fetch = original; };
}
const baseSend = {
  senderEmail: 'rauf@mine-tech.be',
  senderName: 'Rauf',
  replyToEmail: 'rauf@mine-tech.be',
  recipientEmail: 'lead@example.com',
  subject: 'Hello',
  html: '<p>Hi</p>',
  text: 'Hi',
  generatedMessageId: '<abc@mine-tech.be>',
  inReplyTo: '<prev@mine-tech.be>',
  references: ['<root@mine-tech.be>', '<prev@mine-tech.be>'],
};
await test('403 domain error keeps Resend message, code, and logs safely; threading headers unchanged', async () => {
  setEnv({ EMAIL_FROM: 'rauf@mine-tech.be', RESEND_API_KEY: SECRET, NODE_ENV: 'production', VERCEL_ENV: 'production' });
  const capture = {};
  const restoreFetch = mockFetchOnce(403, { statusCode: 403, name: 'validation_error', message: 'The mine-tech.be domain is not verified. Please add and verify your domain on https://resend.com/domains.' }, capture);
  const logged = [];
  const origError = console.error;
  console.error = (...a) => logged.push(a.join(' '));
  try {
    await assert.rejects(() => dispatchViaResend(baseSend), (err) => {
      assert.equal(err.code, 'UNAUTHORIZED_SENDER_DOMAIN');
      assert.equal(err.statusCode, 403);
      assert.match(err.message, /The mine-tech\.be domain is not verified/);
      assert.match(err.message, /RESEND_API_KEY/);
      assert.ok(!err.message.includes(SECRET));
      return true;
    });
  } finally {
    console.error = origError;
    restoreFetch();
  }
  const log = logged.find((l) => l.includes('[EmailService][ResendError]'));
  assert.ok(log, 'expected a structured ResendError log line');
  assert.match(log, /"senderDomain":"mine-tech\.be"/);
  assert.match(log, /"senderEnvSource":"EMAIL_FROM"/);
  assert.match(log, /"vercelEnv":"production"/);
  assert.ok(!logged.join('\n').includes(SECRET));

  // Threading headers and payload shape are exactly what was passed in
  const body = JSON.parse(capture.init.body);
  assert.equal(body.from, 'Rauf <rauf@mine-tech.be>');
  assert.equal(body.headers['Message-ID'], '<abc@mine-tech.be>');
  assert.equal(body.headers['In-Reply-To'], '<prev@mine-tech.be>');
  assert.equal(body.headers['References'], '<root@mine-tech.be> <prev@mine-tech.be>');
  assert.equal(capture.init.headers.Authorization, `Bearer ${SECRET}`); // sent to Resend only, never logged
  restoreEnv();
});
await test('successful send returns provider id', async () => {
  setEnv({ RESEND_API_KEY: SECRET, NODE_ENV: 'production' });
  const capture = {};
  const restoreFetch = mockFetchOnce(200, { id: 'abc-123' }, capture);
  try {
    const res = await dispatchViaResend(baseSend);
    assert.equal(res.providerMessageId, 'abc-123');
  } finally {
    restoreFetch();
    restoreEnv();
  }
});

console.log('domain check against Resend');
const fakeFetch = (status, body) => async () => ({ ok: status >= 200 && status < 300, status, json: async () => body });
await test('verified domain: tells you to look at the key/deploy, not DNS', async () => {
  const r = await checkResendDomains({ apiKey: SECRET, senderDomain: 'mine-tech.be', fetchImpl: fakeFetch(200, { data: [{ name: 'mine-tech.be', status: 'verified', region: 'eu-west-1' }] }) });
  assert.equal(r.senderDomainFound, true);
  assert.equal(r.senderDomainStatus, 'verified');
  assert.match(r.diagnosis.join(' '), /fingerprint/);
});
await test('domain absent for this key: points at wrong Resend team and lists visible domains', async () => {
  const r = await checkResendDomains({ apiKey: SECRET, senderDomain: 'mine-tech.be', fetchImpl: fakeFetch(200, { data: [{ name: '8020aquisition.com', status: 'verified' }] }) });
  assert.equal(r.senderDomainFound, false);
  assert.match(r.diagnosis.join(' '), /NO domain named "mine-tech\.be"/);
  assert.match(r.diagnosis.join(' '), /8020aquisition\.com/);
  assert.match(r.diagnosis.join(' '), /different Resend account/);
});
await test('domain present but pending', async () => {
  const r = await checkResendDomains({ apiKey: SECRET, senderDomain: 'mine-tech.be', fetchImpl: fakeFetch(200, { data: [{ name: 'mine-tech.be', status: 'pending' }] }) });
  assert.equal(r.senderDomainStatus, 'pending');
  assert.match(r.diagnosis.join(' '), /not "verified"/);
});
await test('related subdomain is reported', async () => {
  const r = await checkResendDomains({ apiKey: SECRET, senderDomain: 'mine-tech.be', fetchImpl: fakeFetch(200, { data: [{ name: 'send.mine-tech.be', status: 'verified' }] }) });
  assert.match(r.diagnosis.join(' '), /Related domain/);
});
await test('restricted key, invalid key, network error, missing key', async () => {
  const restricted = await checkResendDomains({ apiKey: SECRET, senderDomain: 'x.com', fetchImpl: fakeFetch(401, { name: 'restricted_api_key', message: 'This API key is restricted to only send emails' }) });
  assert.match(restricted.diagnosis.join(' '), /Sending access/);
  const invalid = await checkResendDomains({ apiKey: SECRET, senderDomain: 'x.com', fetchImpl: fakeFetch(401, { name: 'validation_error', message: 'API key is invalid' }) });
  assert.match(invalid.diagnosis.join(' '), /rejected this API key/);
  const net = await checkResendDomains({ apiKey: SECRET, senderDomain: 'x.com', fetchImpl: async () => { throw new Error('ENOTFOUND'); } });
  assert.equal(net.error.name, 'network_error');
  const none = await checkResendDomains({ apiKey: '', senderDomain: 'x.com' });
  assert.match(none.diagnosis.join(' '), /No RESEND_API_KEY/);
  [restricted, invalid, net, none].forEach((r) => assert.ok(!JSON.stringify(r).includes(SECRET)));
});

restoreEnv();
console.log(`\n${passed} checks passed${process.exitCode ? ' (with failures)' : ''}`);
