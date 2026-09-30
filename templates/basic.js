// __NAME__: describe what this test does.
// Run with: k6run __NAME__
import { group } from 'k6';
import { hit, postJson, think } from '../lib/helpers.js';
import { thresholds, num, str } from '../lib/config.js';

export const options = {
  vus: num('VUS', 5),
  duration: str('DURATION', '1m'),
  thresholds: thresholds(),
};

export default function () {
  group('main flow', () => {
    hit('/');
    // postJson('/api/things', { name: 'example' });
  });
  think();
}
