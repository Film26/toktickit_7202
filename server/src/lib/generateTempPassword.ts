import { randomBytes } from 'node:crypto'

export function generateTempPassword(): string {
  return `${randomBytes(9).toString('base64url')}!1`
}
