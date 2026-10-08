/**
 * Offline unit checks for the leads performance work (no database or network required).
 * Run: npm run test:leads
 */
import assert from 'node:assert/strict';
import { deriveTemperature, TEMPERATURE_FILTERS } from '../lib/leads/temperature.js';
import { dayDiff, formatShortDate, timeAgo, initials, rowPatchFromDetail, STATUS_OPTIONS } from '../lib/leads/format.js';
import {
  sanitizeSearch,
  normalizeLeadListParams,
  applyLeadFilters,
  mapLeadListRow,
  SORT_COLUMNS,
} from '../lib/services/leadListService.js';

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`  FAIL ${name}\n       ${err.message}`);
    process.exitCode = 1;
  }
}

/** Minimal chainable stand-in for a Supabase query builder that records calls. */
function recorder() {
  const calls = [];
  const proxy = new Proxy(
    {},
    {
      get: (_t, method) => (...args) => {
        calls.push([method, ...args]);
        return proxy;
      },
    }
  );
  return { proxy, calls };
}

console.log('temperature');
test('explicit priority wins over score', () => {
  assert.equal(deriveTemperature({ priority: 'hot', score: 5 }), 'HOT');
  assert.equal(deriveTemperature({ priority: 'STRATEGIC', score: 5 }), 'HOT');
  assert.equal(deriveTemperature({ priority: 'cold', score: 99 }), 'COLD');
  assert.equal(deriveTemperature({ priority: 'WARM', score: 99 }), 'WARM');
});
test('score thresholds 80 / 50', () => {
  assert.equal(deriveTemperature({ score: 80 }), 'HOT');
  assert.equal(deriveTemperature({ score: 79 }), 'WARM');
  assert.equal(deriveTemperature({ score: 50 }), 'WARM');
  assert.equal(deriveTemperature({ score: 49 }), 'COLD');
  assert.equal(deriveTemperature({}), 'COLD');
  assert.equal(deriveTemperature({ score: null }), 'COLD');
});
test('server filter expressions exist for every bucket', () => {
  ['HOT', 'WARM', 'COLD'].forEach((t) => assert.ok(TEMPERATURE_FILTERS[t].includes('score')));
});

console.log('search sanitising');
test('strips PostgREST-breaking characters', () => {
  const s = sanitizeSearch('a,b(c)%d*e"f\'g;h:i\\j');
  assert.ok(!/[,()%*"';:\\]/.test(s), s);
});
test('collapses whitespace and caps length', () => {
  assert.equal(sanitizeSearch('  foo    bar  '), 'foo bar');
  assert.equal(sanitizeSearch('x'.repeat(500)).length, 100);
  assert.equal(sanitizeSearch(null), '');
});

console.log('param normalisation');
test('defaults', () => {
  const p = normalizeLeadListParams({});
  assert.equal(p.page, 1);
  assert.equal(p.limit, 25);
  assert.equal(p.sortBy, 'createdAt');
  assert.equal(p.sortDir, 'desc');
  assert.equal(p.status, '');
});
test('limit is clamped to 100 and page to >= 1', () => {
  assert.equal(normalizeLeadListParams({ limit: '100000' }).limit, 100);
  assert.equal(normalizeLeadListParams({ limit: '-5' }).limit, 1);
  assert.equal(normalizeLeadListParams({ page: '0' }).page, 1);
  assert.equal(normalizeLeadListParams({ page: 'abc' }).page, 1);
});
test('rejects unsafe sort columns, statuses and ids', () => {
  const p = normalizeLeadListParams({
    sortBy: 'password; drop table leads',
    status: 'x; drop',
    owner: 'not-a-uuid',
    campaign: '1 or 1=1',
    temperature: 'LAVA',
    followUp: 'someday',
  });
  assert.equal(p.sortBy, 'createdAt');
  assert.equal(p.status, '');
  assert.equal(p.owner, '');
  assert.equal(p.campaign, '');
  assert.equal(p.temperature, '');
  assert.equal(p.followUp, '');
});
test('accepts valid values and URLSearchParams', () => {
  const sp = new URLSearchParams({
    status: 'engaged',
    temperature: 'hot',
    owner: '123e4567-e89b-12d3-a456-426614174000',
    sortBy: 'company',
    sortDir: 'asc',
    followUp: 'overdue',
  });
  const p = normalizeLeadListParams(sp);
  assert.equal(p.status, 'ENGAGED');
  assert.equal(p.temperature, 'HOT');
  assert.equal(p.owner, '123e4567-e89b-12d3-a456-426614174000');
  assert.equal(p.sortBy, 'company');
  assert.equal(p.sortDir, 'asc');
  assert.equal(p.followUp, 'overdue');
});
test('every whitelisted sort key maps to a real column name', () => {
  Object.values(SORT_COLUMNS).forEach((c) => assert.match(c, /^[a-z_]+$/));
});

console.log('filter building');
test('no filters adds no clauses', () => {
  const { proxy, calls } = recorder();
  applyLeadFilters(proxy, normalizeLeadListParams({}));
  assert.equal(calls.length, 0);
});
test('status / owner / search become server-side filters', () => {
  const { proxy, calls } = recorder();
  applyLeadFilters(
    proxy,
    normalizeLeadListParams({ status: 'NEW', owner: '123e4567-e89b-12d3-a456-426614174000', search: 'acme' })
  );
  const methods = calls.map((c) => c[0]);
  assert.ok(methods.includes('eq'));
  assert.ok(methods.includes('or'));
  const searchCall = calls.find((c) => c[0] === 'or' && String(c[1]).includes('ilike'));
  assert.match(searchCall[1], /full_name\.ilike\.%acme%/);
});
test('campaign filter targets the inner-joined table', () => {
  const { proxy, calls } = recorder();
  applyLeadFilters(proxy, normalizeLeadListParams({ campaign: '123e4567-e89b-12d3-a456-426614174000' }));
  assert.ok(calls.some((c) => c[0] === 'eq' && c[1] === 'email_recipients.campaign_id'));
});

console.log('row mapping');
test('maps a narrow row without touching heavy JSON', () => {
  const row = {
    id: 'abc',
    first_name: 'Ada',
    last_name: 'Lovelace',
    full_name: 'Ada Lovelace',
    email: 'ada@example.com',
    company: 'Analytical Engines',
    status: 'NEW',
    score: 85,
    tags: ['vip'],
    is_dnc: false,
    cf_priority: null,
    cf_next_action: 'Send follow-up',
    cf_next_action_date: '2026-10-10',
  };
  const out = mapLeadListRow(row, { lastContact: '2026-10-01T10:00:00Z' });
  assert.equal(out.id, 'abc');
  assert.equal(out.temperature, 'HOT');
  assert.equal(out.company, 'Analytical Engines');
  assert.ok(!('custom_fields' in out) || !out.custom_fields?.ai_intelligence);
});

console.log('formatting');
test('dayDiff is whole-day and sign-correct', () => {
  assert.equal(dayDiff('2026-10-10', '2026-10-08'), 2);
  assert.equal(dayDiff('2026-10-07', '2026-10-08'), -1);
  assert.equal(dayDiff('', '2026-10-08'), null);
  assert.equal(dayDiff('garbage', '2026-10-08'), null);
});
test('short date / timeAgo / initials', () => {
  assert.equal(formatShortDate('nope'), '');
  assert.equal(timeAgo(null), '');
  assert.equal(timeAgo(new Date(Date.now() - 5 * 60_000).toISOString()), '5m ago');
  assert.equal(initials('Ada Lovelace'), 'AL');
  assert.equal(initials(''), '?');
});
test('rowPatchFromDetail returns only defined values', () => {
  const patch = rowPatchFromDetail({ status: 'ENGAGED', fullName: 'Ada L', customFields: { priority: 'hot' } });
  assert.equal(patch.status, 'ENGAGED');
  assert.equal(patch.priority, 'HOT');
  assert.equal(patch.name, 'Ada L');
  assert.ok(!('company' in patch));
  Object.values(patch).forEach((v) => assert.notEqual(v, undefined));
});
test('status options exclude retired telephony statuses', () => {
  assert.ok(STATUS_OPTIONS.includes('NEW'));
  assert.ok(!STATUS_OPTIONS.some((s) => /CALL|SMS|VOICEMAIL/.test(s)));
});

console.log(`\n${passed} checks passed${process.exitCode ? ' (with failures)' : ''}`);
