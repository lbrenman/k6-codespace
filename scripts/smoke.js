// Smoke test: minimal load to verify the target works and the script is sane.
// Env: VUS (default 1), DURATION (default 30s)
import { hit, think } from '../lib/helpers.js';
import { thresholds, num, str, TARGET_PATH } from '../lib/config.js';

export const options = {
  vus: num('VUS', 1),
  duration: str('DURATION', '30s'),
  thresholds: thresholds(),
};

export default function () {
  hit(TARGET_PATH);
  think();
}
