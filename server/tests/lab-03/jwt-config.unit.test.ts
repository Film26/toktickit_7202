import { describe, expect, it } from 'vitest'
import { assertJwtSecretConfigured } from '../../src/lib/jwt'

// Issue #47: the server must fail fast if JWT_SECRET is unset outside
// NODE_ENV=test, rather than silently signing tokens with a public
// default (server/src/lib/jwt.ts previously fell back to
// 'dev-secret-change-me'). Tested as a pure function rather than by
// mutating real process.env and reloading the module, to avoid any risk
// of leaking NODE_ENV changes into other tests sharing this worker.

describe('assertJwtSecretConfigured (Issue #47)', () => {
  it('throws when the secret is missing outside NODE_ENV=test', () => {
    expect(() => assertJwtSecretConfigured(undefined, 'production')).toThrow(/JWT_SECRET must be set/)
    expect(() => assertJwtSecretConfigured('', 'production')).toThrow(/JWT_SECRET must be set/)
    expect(() => assertJwtSecretConfigured(undefined, undefined)).toThrow(/JWT_SECRET must be set/)
  })

  it('does not throw when the secret is missing but NODE_ENV is test', () => {
    expect(() => assertJwtSecretConfigured(undefined, 'test')).not.toThrow()
  })

  it('does not throw when a secret is present, regardless of NODE_ENV', () => {
    expect(() => assertJwtSecretConfigured('a-real-secret', 'production')).not.toThrow()
    expect(() => assertJwtSecretConfigured('a-real-secret', undefined)).not.toThrow()
  })
})
