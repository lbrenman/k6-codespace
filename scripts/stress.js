// Stress test: step load up past normal levels to find the breaking point.
// Env: MAX_VUS (default 100), STEP (default 2m)
// Thresholds are looser here; the goal is to observe where things degrade.
import { hit, think } from '../lib/helpers.js';
import { thresholds, num, str, TARGET_PATH } from '../lib/config.js';

const MAX = num('MAX_VUS', 100);
const STEP = str('STEP', '2m');

export const options = {
  stages: [
    { duration: STEP, target: Math.ceil(MAX * 0.25) },
    { duration: STEP, target: Math.ceil(MAX * 0.5) },
    { duration: STEP, target: Math.ceil(MAX * 0.75) },
    { duration: STEP, target: MAX },
    { duration: STEP, target: MAX },
    { duration: '1m', target: 0 },
  ],
  thresholds: thresholds({
    http_req_failed: [{ threshold: 'rate<0.10', abortOnFail: true, delayAbortEval: '30s' }],
  }),
};

export default function () {
  hit(TARGET_PATH);
  think();
}
