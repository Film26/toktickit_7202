// Mirrors server/src/lib/passwordPolicy.ts - kept in sync by hand since
// client and server don't share a package. Drives the live checklist on
// FirstPasswordChangePage; the server is the actual enforcement boundary.
export const PASSWORD_MIN_LENGTH = 8
const SPECIAL_CHAR_PATTERN = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/

export function hasMinLength(password: string): boolean {
  return password.length >= PASSWORD_MIN_LENGTH
}

export function hasUpperAndLowerCase(password: string): boolean {
  return /[a-z]/.test(password) && /[A-Z]/.test(password)
}

export function hasNumberAndSpecialChar(password: string): boolean {
  return /[0-9]/.test(password) && SPECIAL_CHAR_PATTERN.test(password)
}

export function isPasswordValid(password: string): boolean {
  return hasMinLength(password) && hasUpperAndLowerCase(password) && hasNumberAndSpecialChar(password)
}
