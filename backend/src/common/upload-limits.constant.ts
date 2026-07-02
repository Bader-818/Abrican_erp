/**
 * Multer parse-time caps (pentest P-02): abusive multipart bodies are rejected
 * while being parsed, before they are buffered in memory. The services still
 * enforce their own size/MIME validation after parsing.
 */
export const UPLOAD_LIMITS = {
  fileSize: 10 * 1024 * 1024, // keep in step with MAX_FILE_BYTES in the upload services
  files: 1,
  fields: 30,
  fieldNameSize: 200,
} as const;
