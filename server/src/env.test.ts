import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { loadEnv, resetEnvCache } from './env';

describe('loadEnv', () => {
  beforeEach(() => {
    resetEnvCache();
  });

  it('defaults: stakes and claim are false', () => {
    const env = loadEnv({ NODE_ENV: 'development' });
    assert.equal(env.SOL_STAKES_ENABLED, false);
    assert.equal(env.DOFFA_CLAIM_ENABLED, false);
    assert.ok(env.AUTH_SECRET.length > 0);
  });

  it('accepts explicit false for stake flags', () => {
    const env = loadEnv({
      NODE_ENV: 'development',
      SOL_STAKES_ENABLED: 'false',
      DOFFA_CLAIM_ENABLED: '0',
    });
    assert.equal(env.SOL_STAKES_ENABLED, false);
    assert.equal(env.DOFFA_CLAIM_ENABLED, false);
  });

  it('production without AUTH_SECRET throws', () => {
    assert.throws(
      () => loadEnv({ NODE_ENV: 'production', SOLANA_NETWORK: 'devnet' }),
      /AUTH_SECRET/,
    );
  });

  it('production without SOLANA_NETWORK throws', () => {
    assert.throws(
      () =>
        loadEnv({
          NODE_ENV: 'production',
          AUTH_SECRET: 'production-secret-value-32',
        }),
      /SOLANA_NETWORK/,
    );
  });

  it('production mainnet without SOLANA_PRIVATE_KEY throws', () => {
    assert.throws(
      () =>
        loadEnv({
          NODE_ENV: 'production',
          AUTH_SECRET: 'production-secret-value-32',
          SOLANA_NETWORK: 'mainnet-beta',
        }),
      /SOLANA_PRIVATE_KEY/,
    );
  });

  it('production mainnet with private key loads (stakes still off)', () => {
    const env = loadEnv({
      NODE_ENV: 'production',
      AUTH_SECRET: 'production-secret-value-32',
      SOLANA_NETWORK: 'mainnet-beta',
      SOLANA_PRIVATE_KEY: 'dGVzdA==',
      SOL_STAKES_ENABLED: 'false',
      DOFFA_CLAIM_ENABLED: 'false',
    });
    assert.equal(env.SOLANA_NETWORK, 'mainnet-beta');
    assert.equal(env.SOL_STAKES_ENABLED, false);
    assert.equal(env.DOFFA_CLAIM_ENABLED, false);
  });

  it('DATABASE_URL / POSTGRES_URL are optional', () => {
    const env = loadEnv({ NODE_ENV: 'development' });
    assert.equal(env.DATABASE_URL, '');
    assert.equal(env.POSTGRES_URL, '');
  });

  it('POSTGRES_URL falls back to DATABASE_URL', () => {
    const env = loadEnv({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgres://example/db',
    });
    assert.equal(env.POSTGRES_URL, 'postgres://example/db');
  });

  it('resetEnvCache allows re-parse', () => {
    const a = loadEnv({
      NODE_ENV: 'development',
      SOLANA_NETWORK: 'devnet',
      SOL_STAKES_ENABLED: 'true',
    });
    assert.equal(a.SOL_STAKES_ENABLED, true);
    resetEnvCache();
    const b = loadEnv({
      NODE_ENV: 'development',
      SOLANA_NETWORK: 'devnet',
      SOL_STAKES_ENABLED: 'false',
    });
    assert.equal(b.SOL_STAKES_ENABLED, false);
  });
});
