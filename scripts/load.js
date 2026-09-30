// Load test: ramp to expected normal traffic, hold, ramp down.
// Env: VUS (default 20), RAMP (default 1m), HOLD (default 5m)
import { hit, think } from '../lib/helpers.js';
import { thresholds, num, str, TARGET_PATH } from '../lib/config.js';

const VUS = num('VUS', 20);
const RAMP = str('RAMP', '1m');

export const options = {
  stages: [
    { duration: RAMP, target: VUS },
    { duration: str('HOLD', '5m'), target: VUS },
    { duration: RAMP, target: 0 },
  ],
  thresholds: thresholds(),
};

export default function () {
  hit(TARGET_PATH);
  think();
}
