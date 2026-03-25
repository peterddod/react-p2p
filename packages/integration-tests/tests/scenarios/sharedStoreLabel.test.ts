import { expect, test } from '@playwright/test';
import { createRoom } from '../helpers/createRoom';

test.describe('createSharedStore label probe', () => {
  test('local writer sees its own label update immediately', async ({ browser }) => {
    const [a, b] = await createRoom(browser, 2);

    try {
      await Promise.all([a.enableLabelProbe(), b.enableLabelProbe()]);

      await a.setLabelText('hello');

      await a.waitForLabelText('hello');
      await b.waitForLabelText('hello');

      expect(await a.getLabelText()).toBe('hello');
      expect(await b.getLabelText()).toBe('hello');
    } finally {
      await Promise.all([a.close(), b.close()]);
    }
  });

  test('typing multiple chars on one peer accumulates text on both peers', async ({ browser }) => {
    const [a, b] = await createRoom(browser, 2);

    try {
      await Promise.all([a.enableLabelProbe(), b.enableLabelProbe()]);

      await a.typeLabelChar('a');
      await a.waitForLabelText('a');
      await b.waitForLabelText('a');

      await a.typeLabelChar('b');
      await a.waitForLabelText('ab');
      await b.waitForLabelText('ab');

      await a.typeLabelChar('c');
      await a.waitForLabelText('abc');
      await b.waitForLabelText('abc');

      expect(await a.getLabelText()).toBe('abc');
      expect(await b.getLabelText()).toBe('abc');
    } finally {
      await Promise.all([a.close(), b.close()]);
    }
  });

  test('typing from second peer continues from current shared label', async ({ browser }) => {
    const [a, b] = await createRoom(browser, 2);

    try {
      await Promise.all([a.enableLabelProbe(), b.enableLabelProbe()]);

      await a.setLabelText('ab');
      await a.waitForLabelText('ab');
      await b.waitForLabelText('ab');

      await b.typeLabelChar('c');
      await a.waitForLabelText('abc');
      await b.waitForLabelText('abc');

      expect(await a.getLabelText()).toBe('abc');
      expect(await b.getLabelText()).toBe('abc');
    } finally {
      await Promise.all([a.close(), b.close()]);
    }
  });
});
