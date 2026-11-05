import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  getR2Client,
  isR2Configured,
  getReceiptsR2Client,
  getReceiptsBucketName,
  isReceiptsR2Configured,
} from '../config/r2.js';
import { env } from '../config/env.js';

// Permitted tenant storage categories
const ALLOWED_CATEGORIES = new Set(['logos', 'students', 'reports', 'receipts', 'documents', 'uploads', 'hero', 'posters']);

/**
 * Validates and builds a secure scoped object key for multi-tenant Madrasa data.
 * Pattern: madrasas/{madrasaId}/{category}/{filename}
 *
 * Strict Security Rules:
 * - madrasaId must match alphanumeric/cuid format (no slashes, backslashes, dots, or traversal)
 * - category must be from allowed whitelist
 * - filename is sanitized: no path traversal (..), no leading slashes, no null bytes
 */
export const buildMadrasaKey = (madrasaId, category = 'uploads', filename) => {
  if (!madrasaId || typeof madrasaId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(madrasaId)) {
    throw new Error('Invalid madrasaId: must be a valid non-empty identifier without path separators or traversal characters.');
  }

  const cleanCategory = String(category).toLowerCase().trim();
  if (!ALLOWED_CATEGORIES.has(cleanCategory)) {
    throw new Error(`Invalid category "${category}". Permitted categories: ${Array.from(ALLOWED_CATEGORIES).join(', ')}`);
  }

  if (!filename || typeof filename !== 'string') {
    throw new Error('filename is required and must be a non-empty string.');
  }

  // Security: Check for path traversal, null bytes, or backslashes
  if (filename.includes('..') || filename.includes('\0') || filename.includes('\\')) {
    throw new Error('Security violation: Filename contains prohibited traversal characters or null bytes.');
  }

  // Extract base filename to prevent absolute or nested sub-path injection
  const sanitizedFilename = filename.replace(/^[\/\\]+/, '').replace(/\s+/g, '_');
  if (!sanitizedFilename || sanitizedFilename === '.' || sanitizedFilename.startsWith('.')) {
    throw new Error('Security violation: Invalid filename.');
  }

  return `madrasas/${madrasaId}/${cleanCategory}/${sanitizedFilename}`;
};

/**
 * Generates a presigned URL for direct secure uploads to R2
 */
export const generatePresignedUploadUrl = async (key, contentType = 'application/octet-stream', expiresIn = 3600) => {
  if (!isR2Configured()) {
    throw new Error('File storage is not configured.');
  }

  const client = getR2Client();
  const command = new PutObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  return await getSignedUrl(client, command, { expiresIn });
};

/**
 * Generates a presigned URL for reading private objects from R2
 */
export const generatePresignedDownloadUrl = async (
  key,
  expiresIn = 3600,
  bucketOverride = null,
  clientOverride = null
) => {
  const client = clientOverride || getR2Client();
  const bucket = bucketOverride || env.R2_BUCKET_NAME;

  if (!client || !bucket) {
    throw new Error('File storage is not configured.');
  }

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return await getSignedUrl(client, command, { expiresIn });
};

// Optional test storage adapter active strictly when NODE_ENV === 'test'
let testStorageAdapter = null;

export const setTestStorageAdapter = (adapter) => {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('setTestStorageAdapter can only be called in test environment.');
  }
  testStorageAdapter = adapter;
};

export const getTestStorageAdapter = () => {
  return process.env.NODE_ENV === 'test' ? testStorageAdapter : null;
};

/**
 * Uploads a Buffer directly to R2
 */
export const uploadBufferToR2 = async (key, buffer, contentType = 'application/octet-stream') => {
  const testAdapter = getTestStorageAdapter();
  if (testAdapter) {
    return await testAdapter.uploadBuffer(key, buffer, contentType);
  }

  if (!isR2Configured()) {
    throw new Error('File storage is not configured.');
  }

  const client = getR2Client();
  const command = new PutObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  return await client.send(command);
};

/**
 * Downloads an object from R2 as a Node.js Buffer
 */
export const getObjectBufferFromR2 = async (key) => {
  const testAdapter = getTestStorageAdapter();
  if (testAdapter) {
    return await testAdapter.getObjectBuffer(key);
  }

  if (!isR2Configured()) {
    throw new Error('File storage is not configured.');
  }

  const client = getR2Client();
  const command = new GetObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: key,
  });

  const response = await client.send(command);
  if (response.Body && typeof response.Body.transformToByteArray === 'function') {
    const bytes = await response.Body.transformToByteArray();
    return Buffer.from(bytes);
  }

  // Stream fallback
  return new Promise((resolve, reject) => {
    const chunks = [];
    response.Body.on('data', (chunk) => chunks.push(chunk));
    response.Body.once('end', () => resolve(Buffer.concat(chunks)));
    response.Body.once('error', reject);
  });
};

/**
 * Deletes an object from R2
 */
export const deleteObjectFromR2 = async (key) => {
  const testAdapter = getTestStorageAdapter();
  if (testAdapter) {
    return await testAdapter.deleteObject(key);
  }

  if (!isR2Configured()) {
    throw new Error('Cloudflare R2 is not configured. Missing R2 environment variables.');
  }

  const client = getR2Client();
  const command = new DeleteObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: key,
  });

  return await client.send(command);
};

/**
 * Returns public URL if public access is configured, or null
 */
export const getR2PublicUrl = (key) => {
  if (!env.R2_PUBLIC_URL) {
    return null;
  }
  const baseUrl = env.R2_PUBLIC_URL.replace(/\/+$/, '');
  const cleanKey = key.replace(/^\/+/, '');
  return `${baseUrl}/${cleanKey}`;
};

/**
 * Resolves a safe access URL for a stored object:
 * Returns public URL if configured, otherwise dynamically generates a presigned URL.
 * Never persists expiring signed URLs into the database.
 */
export const resolveObjectAccessUrl = async (key, expiresIn = 86400) => {
  const testAdapter = getTestStorageAdapter();
  if (testAdapter && typeof testAdapter.resolveUrl === 'function') {
    return await testAdapter.resolveUrl(key);
  }

  const publicUrl = getR2PublicUrl(key);
  if (publicUrl) {
    return publicUrl;
  }

  if (isR2Configured()) {
    return await generatePresignedDownloadUrl(key, expiresIn);
  }

  return null;
};

/**
 * Generates an on-demand short-lived presigned download URL for private subscription receipts.
 * Strictly NEVER uses public R2 domain (pub-*.r2.dev).
 * Targets dedicated private receipts bucket when configured.
 * Default expiry: 900 seconds (15 minutes).
 */
export const getSecureReceiptDownloadUrl = async (key, expiresIn = 900) => {
  const testAdapter = getTestStorageAdapter();
  if (testAdapter && typeof testAdapter.resolveUrl === 'function') {
    return await testAdapter.resolveUrl(key);
  }

  if (!isReceiptsR2Configured()) {
    return null;
  }

  const client = getReceiptsR2Client();
  const bucket = getReceiptsBucketName();
  return await generatePresignedDownloadUrl(key, expiresIn, bucket, client);
};

/**
 * Uploads a receipt buffer directly to the private receipts bucket in R2
 */
export const uploadReceiptBufferToR2 = async (key, buffer, contentType = 'application/octet-stream') => {
  const testAdapter = getTestStorageAdapter();
  if (testAdapter) {
    return await testAdapter.uploadBuffer(key, buffer, contentType);
  }

  if (!isReceiptsR2Configured()) {
    throw new Error('Receipts file storage is not configured.');
  }

  const client = getReceiptsR2Client();
  const bucket = getReceiptsBucketName();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  return await client.send(command);
};

/**
 * Deletes a receipt object from the private receipts bucket in R2
 */
export const deleteReceiptFromR2 = async (key) => {
  const testAdapter = getTestStorageAdapter();
  if (testAdapter) {
    return await testAdapter.deleteObject(key);
  }

  if (!isReceiptsR2Configured()) {
    throw new Error('Receipts file storage is not configured.');
  }

  const client = getReceiptsR2Client();
  const bucket = getReceiptsBucketName();
  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return await client.send(command);
};

/**
 * Retrieves a receipt object buffer from the private receipts bucket in R2
 */
export const getReceiptBufferFromR2 = async (key) => {
  const testAdapter = getTestStorageAdapter();
  if (testAdapter) {
    return await testAdapter.getObjectBuffer(key);
  }

  if (!isReceiptsR2Configured()) {
    throw new Error('Receipts file storage is not configured.');
  }

  const client = getReceiptsR2Client();
  const bucket = getReceiptsBucketName();
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  const response = await client.send(command);
  if (response.Body && typeof response.Body.transformToByteArray === 'function') {
    const bytes = await response.Body.transformToByteArray();
    return Buffer.from(bytes);
  }

  return new Promise((resolve, reject) => {
    const chunks = [];
    response.Body.on('data', (chunk) => chunks.push(chunk));
    response.Body.once('end', () => resolve(Buffer.concat(chunks)));
    response.Body.once('error', reject);
  });
};

/**
 * Uploads a private student document (certificate or incident evidence) buffer to the private R2 bucket.
 * Strictly private: never uses public R2 domain.
 */
export const uploadStudentDocumentBufferToR2 = async (key, buffer, contentType = 'application/octet-stream') => {
  const testAdapter = getTestStorageAdapter();
  if (testAdapter) {
    return await testAdapter.uploadBuffer(key, buffer, contentType);
  }

  if (!isReceiptsR2Configured()) {
    throw new Error('Private document file storage is not configured.');
  }

  const client = getReceiptsR2Client();
  const bucket = getReceiptsBucketName();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  return await client.send(command);
};

/**
 * Deletes a private student document object from the private R2 bucket.
 */
export const deleteStudentDocumentFromR2 = async (key) => {
  const testAdapter = getTestStorageAdapter();
  if (testAdapter) {
    return await testAdapter.deleteObject(key);
  }

  if (!isReceiptsR2Configured()) {
    throw new Error('Private document file storage is not configured.');
  }

  const client = getReceiptsR2Client();
  const bucket = getReceiptsBucketName();
  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return await client.send(command);
};

/**
 * Generates an on-demand short-lived presigned URL for a private student document (certificate or evidence).
 * Strictly NEVER uses public R2 domain (pub-*.r2.dev).
 * Default expiry: 120 seconds (2 minutes).
 */
export const getSecureStudentDocumentDownloadUrl = async (
  key,
  expiresIn = 120,
  { mode = 'inline', filename = null, contentType = null } = {}
) => {
  const testAdapter = getTestStorageAdapter();
  if (testAdapter) {
    if (typeof testAdapter.resolveDocumentUrl === 'function') {
      return await testAdapter.resolveDocumentUrl(key, { expiresIn, mode, filename, contentType });
    }
    if (typeof testAdapter.resolveUrl === 'function') {
      return await testAdapter.resolveUrl(key);
    }
    return `https://private-r2.example.test/${key}?expires=${expiresIn}&mode=${mode}`;
  }

  if (!isReceiptsR2Configured()) {
    return null;
  }

  const client = getReceiptsR2Client();
  const bucket = getReceiptsBucketName();
  const safeDispositionType = mode === 'download' ? 'attachment' : 'inline';
  const cleanName = filename ? String(filename).replace(/["\r\n\\]/g, '_') : null;
  const contentDisposition = cleanName
    ? `${safeDispositionType}; filename="${cleanName}"`
    : safeDispositionType;

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ResponseContentDisposition: contentDisposition,
    ...(contentType ? { ResponseContentType: contentType } : {}),
  });

  return await getSignedUrl(client, command, { expiresIn });
};

/**
 * Returns a readable stream for a private document (certificate or evidence)
 * for secure backend proxy streaming.
 */
export const getStudentDocumentStream = async (key) => {
  const testAdapter = getTestStorageAdapter();
  if (testAdapter) {
    if (typeof testAdapter.getObjectBuffer === 'function') {
      const buf = await testAdapter.getObjectBuffer(key);
      const { Readable } = await import('stream');
      return Readable.from(buf || Buffer.from(''));
    }
    if (typeof testAdapter.send === 'function') {
      const { GetObjectCommand } = await import('@aws-sdk/client-s3');
      const res = await testAdapter.send(new GetObjectCommand({ Key: key }));
      return res.Body;
    }
  }

  if (!isReceiptsR2Configured()) {
    // If receipts bucket not configured, fallback to main R2 bucket
    if (!isR2Configured()) {
      throw new Error('File storage is not configured.');
    }
    const client = getR2Client();
    const command = new GetObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
    });
    const response = await client.send(command);
    return response.Body;
  }

  const client = getReceiptsR2Client();
  const bucket = getReceiptsBucketName();
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  const response = await client.send(command);
  return response.Body;
};
