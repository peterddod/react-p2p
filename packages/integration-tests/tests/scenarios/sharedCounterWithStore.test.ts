import { expect, test } from '@playwright/test';
import { createRoom } from '../helpers/createRoom';

test.describe('shared counter with shared-store label', () => {
  test('counter updates locally and remotely while label store is mounted', async ({ browser }) => {
    const [a, b] = await createRoom(browser, 2);

    try {
      await Promise.all([
        a.registerSharedState('counter', 'lamport'),
        b.registerSharedState('counter', 'lamport'),
      ]);
      await Promise.all([a.enableLabelProbe(), b.enableLabelProbe()]);

      await a.setSharedState('counter', 0);
      await a.waitForSharedState('counter', (v) => v === 0);
      await b.waitForSharedState('counter', (v) => v === 0);

      // Simulate example "+" button semantics: setCount(prev => prev + 1).
      await a.incrementSharedState('counter', 1);
      await a.waitForSharedState('counter', (v) => v === 1);
      await b.waitForSharedState('counter', (v) => v === 1);

      await b.incrementSharedState('counter', 1);
      await a.waitForSharedState('counter', (v) => v === 2);
      await b.waitForSharedState('counter', (v) => v === 2);

      // Exercise label typing in-between to ensure no cross-feature regression.
      await a.typeLabelChar('x');
      await a.waitForLabelText('x');
      await b.waitForLabelText('x');

      await a.incrementSharedState('counter', 1);
      await a.waitForSharedState('counter', (v) => v === 3);
      await b.waitForSharedState('counter', (v) => v === 3);

      expect(await a.getSharedState('counter')).toBe(3);
      expect(await b.getSharedState('counter')).toBe(3);
    } finally {
      await Promise.all([a.close(), b.close()]);
    }
  });
});
