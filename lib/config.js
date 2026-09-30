// Shared configuration. Everything is overridable via environment variables
// (set them in .env, or inline: BASE_URL=https://... k6run smoke).

export const BASE_URL = (__ENV.BASE_URL || 'https://quickpizza.grafana.com').replace(/\/+$/, '');
export const TARGET_PATH = __ENV.TARGET_PATH || '/';

export const P95_MS = parseFloat(__ENV.P95_MS || '500');
export const MAX_ERROR_RATE = parseFloat(__ENV.MAX_ERROR_RATE || '0.01');
export const THINK_TIME = parseFloat(__ENV.THINK_TIME || '1');

export function num(name, fallback) {
  const v = __ENV[name];
  return v === undefined || v === '' ? fallback : parseFloat(v);
}

export function str(name, fallback) {
  const v = __ENV[name];
  return v === undefined || v === '' ? fallback : v;
}

export function url(path = TARGET_PATH) {
  return `${BASE_URL}${path.startsWith('/') ? path : '/' + path}`;
}

export function headers(extra = {}) {
  const h = { Accept: 'application/json', 'User-Agent': 'k6-codespace' };
  if (__ENV.AUTH_TOKEN) h.Authorization = `Bearer ${__ENV.AUTH_TOKEN}`;
  if (__ENV.API_KEY) h[__ENV.API_KEY_HEADER || 'x-api-key'] = __ENV.API_KEY;
  return Object.assign(h, extra);
}

export function thresholds(overrides = {}) {
  return Object.assign(
    {
      http_req_failed: [`rate<${MAX_ERROR_RATE}`],
      http_req_duration: [`p(95)<${P95_MS}`],
      checks: ['rate>0.99'],
    },
    overrides
  );
}
