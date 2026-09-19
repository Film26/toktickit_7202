// Handout password mockup, reinstated per reviewer decision during Lab 3
// (reverses the "length-only" decision recorded in
// docs/lab-03/specification.md section 11.5): a password must be at least
// 8 characters and include upper case, lower case, a number, and a special
// character. Shared by the server validation and (mirrored) by the client's
// live checklist - see client/src/lib/passwordPolicy.ts.
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

export const PASSWORD_REQUIREMENTS_MESSAGE =
  'Password must be at least 8 characters and include upper and lower case letters, a number, and a special character'
