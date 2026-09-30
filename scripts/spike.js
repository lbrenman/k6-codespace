// Spike test: sudden surge of traffic, then recovery.
// Env: BASE_VUS (default 5), SPIKE_VUS (default 200), SPIKE_HOLD (default 1m)
import { hit, think } from '../lib/helpers.js';
import { thresholds, num, str, TARGET_PATH } from '../lib/config.js';

const BASE = num('BASE_VUS', 5);
const SPIKE = num('SPIKE_VUS', 200);

export const options = {
  stages: [
    { duration: '30s', target: BASE },
    { duration: '10s', target: SPIKE },
    { duration: str('SPIKE_HOLD', '1m'), target: SPIKE },
    { duration: '10s', target: BASE },
    { duration: '1m', target: BASE },
    { duration: '10s', target: 0 },
  ],
  thresholds: thresholds({ http_req_failed: ['rate<0.05'] }),
};

export default function () {
  hit(TARGET_PATH);
  think();
}
