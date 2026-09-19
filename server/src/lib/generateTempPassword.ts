import { randomBytes } from 'node:crypto'

const LOWER = 'abcdefghijklmnopqrstuvwxyz'
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const DIGITS = '0123456789'
const SPECIAL = '!@#$%^&*'
const ALL = LOWER + UPPER + DIGITS + SPECIAL

function randomChar(charset: string): string {
  return charset[randomBytes(1)[0] % charset.length]
}

function shuffled(chars: string[]): string[] {
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomBytes(1)[0] % (i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars
}

// Always satisfies the password policy in lib/passwordPolicy.ts (at least
// one lower case, one upper case, one digit, one special character, 8+
// total) - one of each required category first, then random fill, then
// shuffled so the required characters aren't always in the same positions.
export function generateTempPassword(): string {
  const required = [randomChar(LOWER), randomChar(UPPER), randomChar(DIGITS), randomChar(SPECIAL)]
  const rest = Array.from({ length: 8 }, () => randomChar(ALL))
  return shuffled([...required, ...rest]).join('')
}
