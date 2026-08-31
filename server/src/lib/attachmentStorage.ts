import crypto from 'node:crypto'
import path from 'node:path'
import fs from 'node:fs'

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024
export const MAX_ACTIVE_ATTACHMENTS_PER_TICKET = 5

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
}

export const ALLOWED_MIME_TYPES = Object.keys(EXTENSION_BY_MIME_TYPE)

export function isAllowedMimeType(mimeType: string): boolean {
  return mimeType in EXTENSION_BY_MIME_TYPE
}

export const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'attachments')

export function ensureUploadDir(): void {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

// A random name on disk, independent of the client-supplied filename, so a
// crafted name (path traversal, double extensions, etc.) can never reach the
// filesystem. The original filename is kept only as display metadata in the DB.
export function generateStoredFilename(mimeType: string): string {
  const extension = EXTENSION_BY_MIME_TYPE[mimeType] ?? ''
  return `${crypto.randomUUID()}${extension}`
}

export function sanitizeOriginalFilename(rawName: string): string {
  const base = path.basename(rawName).trim()
  return base.length > 0 ? base.slice(0, 255) : 'attachment'
}

export function storedFilePath(storedFilename: string): string {
  return path.join(UPLOAD_DIR, storedFilename)
}
