import multer from 'multer'
import type { RequestHandler } from 'express'
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  UPLOAD_DIR,
  ensureUploadDir,
  generateStoredFilename,
  isAllowedMimeType,
} from '../lib/attachmentStorage'

ensureUploadDir()

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => cb(null, generateStoredFilename(file.mimetype)),
})

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!isAllowedMimeType(file.mimetype)) {
      cb(new Error(`Unsupported file type. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`))
      return
    }
    cb(null, true)
  },
})

const uploadSingleAttachment: RequestHandler = (req, res, next) => {
  upload.single('file')(req, res, (err: unknown) => {
    if (!err) {
      next()
      return
    }
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ error: `File exceeds the ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB limit` })
      return
    }
    const message = err instanceof Error ? err.message : 'Unable to process the uploaded file'
    res.status(400).json({ error: message })
  })
}

export default uploadSingleAttachment
