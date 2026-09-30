import http from 'k6/http';
import { check, sleep } from 'k6';
import { url, headers, THINK_TIME } from './config.js';

// GET a path and verify it returns a 2xx.
export function hit(path, name) {
  const res = http.get(url(path), {
    headers: headers(),
    tags: { name: name || path || 'target' },
  });
  check(res, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
  });
  return res;
}

// POST JSON to a path and verify it returns a 2xx.
export function postJson(path, body, name) {
  const res = http.post(url(path), JSON.stringify(body), {
    headers: headers({ 'Content-Type': 'application/json' }),
    tags: { name: name || path },
  });
  check(res, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
  });
  return res;
}

// Randomized think time between iterations (50%-150% of THINK_TIME).
export function think() {
  if (THINK_TIME > 0) sleep(THINK_TIME * (0.5 + Math.random()));
}
