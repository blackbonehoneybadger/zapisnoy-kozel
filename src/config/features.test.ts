// Фиче-флаги — их дефолт в production критичен для безопасности продукта:
// Crazy 8 и SOL-ставки не должны быть доступны, если владелец явно не
// включил флаг. Модуль читает import.meta.env один раз при импорте, поэтому
// каждый сценарий сбрасывает модульный кэш и переимпортирует после стаба.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function loadFeatures() {
  vi.resetModules();
  return import('./features');
}

describe('feature flags', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('ENABLE_CRAZY8_CLASSIC defaults to false when unset', async () => {
    const { ENABLE_CRAZY8_CLASSIC } = await loadFeatures();
    expect(ENABLE_CRAZY8_CLASSIC).toBe(false);
  });

  it('ENABLE_CRAZY8_CLASSIC is false for anything other than the (whitespace-tolerant) string "true"', async () => {
    for (const v of ['TRUE', '1', 'yes', 'false', '']) {
      vi.stubEnv('VITE_ENABLE_CRAZY8_CLASSIC', v);
      const { ENABLE_CRAZY8_CLASSIC } = await loadFeatures();
      expect(ENABLE_CRAZY8_CLASSIC, `value ${JSON.stringify(v)} should not enable the flag`).toBe(false);
    }
  });

  it('ENABLE_CRAZY8_CLASSIC turns on for "true", tolerating surrounding whitespace', async () => {
    for (const v of ['true', ' true ', '\ttrue\n']) {
      vi.stubEnv('VITE_ENABLE_CRAZY8_CLASSIC', v);
      const { ENABLE_CRAZY8_CLASSIC } = await loadFeatures();
      expect(ENABLE_CRAZY8_CLASSIC, `value ${JSON.stringify(v)} should enable the flag`).toBe(true);
    }
  });

  it('SOL_BETTING_ENABLED defaults to false when unset', async () => {
    const { SOL_BETTING_ENABLED } = await loadFeatures();
    expect(SOL_BETTING_ENABLED).toBe(false);
  });

  it('SOL_BETTING_ENABLED responds to VITE_ENABLE_SOL_BETS (the spec-named var)', async () => {
    vi.stubEnv('VITE_ENABLE_SOL_BETS', 'true');
    const { SOL_BETTING_ENABLED } = await loadFeatures();
    expect(SOL_BETTING_ENABLED).toBe(true);
  });

  it('SOL_BETTING_ENABLED still responds to the legacy VITE_SOL_BETTING_ENABLED alias', async () => {
    vi.stubEnv('VITE_SOL_BETTING_ENABLED', 'true');
    const { SOL_BETTING_ENABLED } = await loadFeatures();
    expect(SOL_BETTING_ENABLED).toBe(true);
  });

  it('VITE_ENABLE_SOL_BETS takes precedence over the legacy alias when both are set', async () => {
    vi.stubEnv('VITE_ENABLE_SOL_BETS', 'false');
    vi.stubEnv('VITE_SOL_BETTING_ENABLED', 'true');
    const { SOL_BETTING_ENABLED } = await loadFeatures();
    expect(SOL_BETTING_ENABLED).toBe(false);
  });
});
