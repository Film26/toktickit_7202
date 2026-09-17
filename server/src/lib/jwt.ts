import jwt from 'jsonwebtoken'

// Fail fast rather than silently signing tokens with a public default: a
// misconfigured deployment (JWT_SECRET missing from the environment) must
// refuse to start, not run insecurely. NODE_ENV=test is exempted so the
// test suite doesn't need its own dance to bring the server up if a
// particular test run's env loading order ever leaves it unset. Exposed as
// a standalone function (rather than inline top-level code) so it can be
// unit tested directly without mutating real process.env / reloading
// modules, which would risk interfering with other tests sharing this
// worker's environment.
export function assertJwtSecretConfigured(secret: string | undefined, nodeEnv: string | undefined): void {
  if (!secret && nodeEnv !== 'test') {
    throw new Error('JWT_SECRET must be set (see server/.env.example) - refusing to start without it')
  }
}

assertJwtSecretConfigured(process.env.JWT_SECRET, process.env.NODE_ENV)

const JWT_SECRET = process.env.JWT_SECRET ?? 'test-only-fallback-secret-not-for-production'
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN ?? '8h') as jwt.SignOptions['expiresIn']

export type JwtPayload = {
  userId: number
}

export function signToken(userId: number): string {
  return jwt.sign({ userId } satisfies JwtPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload
}
