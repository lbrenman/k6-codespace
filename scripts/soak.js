// Soak test: moderate load for a long time to surface leaks and slow degradation.
// Env: VUS (default 10), DURATION (default 1h)
// NOTE: Codespaces suspend after your idle timeout (default 30 min) based on
// *your* activity, not running processes. Raise the timeout in GitHub
// settings (up to 240 min) or run long soaks elsewhere (see README).
import { hit, think } from '../lib/helpers.js';
import { thresholds, num, str, TARGET_PATH } from '../lib/config.js';

const VUS = num('VUS', 10);

export const options = {
  stages: [
    { duration: '2m', target: VUS },
    { duration: str('DURATION', '1h'), target: VUS },
    { duration: '2m', target: 0 },
  ],
  thresholds: thresholds(),
};

export default function () {
  hit(TARGET_PATH);
  think();
}
