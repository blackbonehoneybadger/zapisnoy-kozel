// Конфигурация — деньги/токены считаются от этих значений, поэтому парсинг
// переменных окружения проверяется отдельно. Модуль читает process.env один
// раз при импорте, поэтому сценарии, зависящие от значения переменных,
// сбрасывают кэш модулей и переимпортируют после правки process.env.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toInt } from './config';

describe('toInt', () => {
  it('falls back to the default for an unset (undefined) variable', () => {
    expect(toInt(undefined, 100)).toBe(100);
  });

  it('regression: an empty string falls back to the default, NOT to 0', () => {
    // Number('') === 0, а не NaN — этот баг тихо обнулял BEANS_ENTRY_FEE и
    // DOFFA_REWARD_PER_WIN, когда переменная окружения была просто не задана
    // (пустая строка на некоторых платформах деплоя). См. историю проекта.
    expect(toInt('', 100)).toBe(100);
  });

  it('falls back to the default for a non-numeric string', () => {
    expect(toInt('not-a-number', 42)).toBe(42);
  });

  it('falls back to the default for a negative number (fees/rewards cannot be negative)', () => {
    expect(toInt('-5', 42)).toBe(42);
  });

  it('parses a valid non-negative integer string', () => {
    expect(toInt('250', 100)).toBe(250);
  });

  it('floors a fractional numeric string', () => {
    expect(toInt('9.7', 0)).toBe(9);
  });

  it('trims surrounding whitespace before parsing', () => {
    expect(toInt('  42  ', 0)).toBe(42);
  });

  it('accepts 0 as an explicit, valid value (not a fallback trigger)', () => {
    expect(toInt('0', 999)).toBe(0);
  });
});

describe('validateRewardSplit', () => {
  beforeEach(() => {
    delete process.env.PLAYER_REWARD_PERCENT;
    delete process.env.BURN_PERCENT;
    vi.resetModules();
  });
  afterEach(() => {
    delete process.env.PLAYER_REWARD_PERCENT;
    delete process.env.BURN_PERCENT;
    vi.resetModules();
  });

  it('does not throw for the default 80/20 split', async () => {
    const { validateRewardSplit } = await import('./config');
    expect(() => validateRewardSplit()).not.toThrow();
  });

  it('does not throw for a custom split that still sums to 100', async () => {
    process.env.PLAYER_REWARD_PERCENT = '70';
    process.env.BURN_PERCENT = '30';
    vi.resetModules();
    const mod = await import('./config');
    expect(() => mod.validateRewardSplit()).not.toThrow();
  });

  it('throws when PLAYER_REWARD_PERCENT + BURN_PERCENT does not equal 100', async () => {
    process.env.PLAYER_REWARD_PERCENT = '80';
    process.env.BURN_PERCENT = '30'; // 110, invalid
    vi.resetModules();
    const mod = await import('./config');
    expect(() => mod.validateRewardSplit()).toThrow(/должны давать 100/);
  });
});
