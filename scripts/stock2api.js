// stock2api: load test for the Fusion stock2api quote and watchlist endpoints.
//
// Traffic is paced with a fixed request rate (constant-arrival-rate), so you
// can stay under the API's rate limit, or deliberately step past it.
//
// Run:
//   k6run stock2api                                  (1 req/s for 1m)
//   RATE=5 k6run stock2api                           (5 req/s)
//   RATE=30 TIME_UNIT=1m DURATION=5m k6run stock2api (30 req/min for 5m)
//   QUOTE_WEIGHT=0.5 k6run stock2api                 (50/50 quote vs watchlist)
//
// Env (set in .env or inline):
//   STOCK_API_URL         required; base URL ending in /stock2api
//   STOCK_API_KEY         required; the stock2api key
//   STOCK_API_KEY_HEADER  header to send it in (default x-api-key)
//   RATE / TIME_UNIT      requests per time unit (default 1 per 1s)
//   DURATION              default 1m
//   VUS / MAX_VUS         VUs pre-allocated / allowed to keep up with RATE
//                         (default 5 / 20)
//   SYMBOLS               comma list for quotes and the watchlist
//                         (default AAPL,MSFT,GOOGL,VZ,INTC,T,AMZN)
//   QUOTE_WEIGHT          share of requests that call /quote (default 0.7)
//   QUOTE_P95_MS / WATCHLIST_P95_MS   p95 thresholds (default 800 / 1500)
//   MAX_RATE_LIMITED      allowed share of 429 responses (default 0.01)

import http from 'k6/http';
import { check, group, fail } from 'k6';
import { Rate, Counter } from 'k6/metrics';
import { headers, thresholds, num, str } from '../lib/config.js';

const BASE = (__ENV.STOCK_API_URL || '').replace(/\/+$/, '');

const STOCK_API_KEY = __ENV.STOCK_API_KEY || '';
const STOCK_API_KEY_HEADER = str('STOCK_API_KEY_HEADER', 'x-api-key');

const SYMBOLS = str('SYMBOLS', 'AAPL,MSFT,GOOGL,VZ,INTC,T,AMZN')
  .split(',')
  .map((s) => s.trim().toUpperCase())
  .filter(Boolean);

const QUOTE_WEIGHT = num('QUOTE_WEIGHT', 0.7);

// Custom metrics so rate limiting is visible separately from other failures
const rateLimited = new Rate('rate_limited');
const rateLimitedCount = new Counter('rate_limited_count');

function stockHeaders() {
  return headers({ [STOCK_API_KEY_HEADER]: STOCK_API_KEY });
}

export const options = {
  scenarios: {
    stock2api: {
      executor: 'constant-arrival-rate',
      rate: num('RATE', 1),
      timeUnit: str('TIME_UNIT', '1s'),
      duration: str('DURATION', '1m'),
      preAllocatedVUs: num('VUS', 5),
      maxVUs: num('MAX_VUS', 20),
    },
  },
  thresholds: thresholds({
    'http_req_duration{endpoint:quote}': [`p(95)<${num('QUOTE_P95_MS', 800)}`],
    'http_req_duration{endpoint:watchlist}': [`p(95)<${num('WATCHLIST_P95_MS', 1500)}`],
    'http_req_failed{endpoint:quote}': ['rate<0.01'],
    'http_req_failed{endpoint:watchlist}': ['rate<0.01'],
    rate_limited: [`rate<${num('MAX_RATE_LIMITED', 0.01)}`],
    // Remove the default overall p95 so the per-endpoint thresholds govern
    http_req_duration: [],
  }),
};

export function setup() {
  if (!BASE) fail('STOCK_API_URL is not set. Add it to .env.');
  if (!STOCK_API_KEY) fail('STOCK_API_KEY is not set. Add it to .env.');

  // Fail fast if the key or URL is wrong, or you're already rate limited
  const res = http.get(`${BASE}/quote?symbol=${SYMBOLS[0]}`, {
    headers: stockHeaders(),
    tags: { endpoint: 'setup' },
  });
  if (res.status === 429) {
    const retry = res.headers['Retry-After'];
    fail(`Already rate limited before the test started (429${retry ? `, Retry-After: ${retry}s` : ''}). Wait for the limit to reset, then lower RATE.`);
  }
  if (res.status !== 200) {
    fail(`Pre-flight /quote returned ${res.status}: ${String(res.body).slice(0, 200)}`);
  }
}

function isJson(r) {
  try {
    r.json();
    return true;
  } catch (e) {
    return false;
  }
}

function track(res) {
  const limited = res.status === 429;
  rateLimited.add(limited);
  if (limited) rateLimitedCount.add(1);
  return limited;
}

function quote() {
  const symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
  const res = http.get(`${BASE}/quote?symbol=${encodeURIComponent(symbol)}`, {
    headers: stockHeaders(),
    tags: { endpoint: 'quote', name: 'GET /quote' },
  });
  if (track(res)) {
    check(res, { 'quote: not rate limited (429)': () => false });
    return;
  }
  check(res, {
    'quote: not rate limited (429)': () => true,
    'quote: status 200': (r) => r.status === 200,
    'quote: JSON body': (r) => isJson(r),
    'quote: mentions symbol': (r) => String(r.body).toUpperCase().includes(symbol),
  });
}

function watchlist() {
  const res = http.get(`${BASE}/watchlist?symbols=${encodeURIComponent(SYMBOLS.join(','))}`, {
    headers: stockHeaders(),
    tags: { endpoint: 'watchlist', name: 'GET /watchlist' },
  });
  if (track(res)) {
    check(res, { 'watchlist: not rate limited (429)': () => false });
    return;
  }
  check(res, {
    'watchlist: not rate limited (429)': () => true,
    'watchlist: status 200': (r) => r.status === 200,
    'watchlist: JSON body': (r) => isJson(r),
    'watchlist: has every symbol': (r) => {
      const body = String(r.body).toUpperCase();
      return SYMBOLS.every((s) => body.includes(`"${s}"`));
    },
  });
}

export default function () {
  // No think time: the arrival-rate executor controls pacing
  if (Math.random() < QUOTE_WEIGHT) {
    group('quote', quote);
  } else {
    group('watchlist', watchlist);
  }
}
