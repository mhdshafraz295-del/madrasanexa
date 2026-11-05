import { S3Client } from '@aws-sdk/client-s3';
import { env } from './env.js';

let s3ClientInstance = null;
let r2ConfigWarningLogged = false;

export const isR2Configured = () => {
  const isKeyValid = Boolean(env.R2_ACCESS_KEY_ID && env.R2_ACCESS_KEY_ID.length === 32);
  const isSecretValid = Boolean(env.R2_SECRET_ACCESS_KEY && env.R2_SECRET_ACCESS_KEY.length === 64);
  return Boolean(
    env.R2_ACCOUNT_ID &&
    isKeyValid &&
    isSecretValid &&
    env.R2_BUCKET_NAME
  );
};

export const getR2Client = () => {
  if (!isR2Configured()) {
    if (!r2ConfigWarningLogged && env.NODE_ENV !== 'production') {
      if (env.R2_ACCESS_KEY_ID && env.R2_ACCESS_KEY_ID.length !== 32) {
        console.warn(`⚠️ Cloudflare R2 is misconfigured: R2_ACCESS_KEY_ID has length ${env.R2_ACCESS_KEY_ID.length} (expected 32-character Access Key ID).`);
      } else {
        console.warn('⚠️ Cloudflare R2 is not configured. Storage operations will be unavailable until credentials are provided.');
      }
      r2ConfigWarningLogged = true;
    }
    return null;
  }

  if (!s3ClientInstance) {
    s3ClientInstance = new S3Client({
      region: 'auto',
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    });
  }

  return s3ClientInstance;
};

let receiptsClientInstance = null;

export const getReceiptsBucketName = () => {
  return env.R2_RECEIPTS_BUCKET || env.R2_BUCKET_NAME;
};

export const isReceiptsR2Configured = () => {
  if (env.R2_RECEIPTS_BUCKET && env.R2_RECEIPTS_ACCESS_KEY_ID && env.R2_RECEIPTS_SECRET_ACCESS_KEY) {
    const isKeyValid = Boolean(env.R2_RECEIPTS_ACCESS_KEY_ID.length === 32);
    const isSecretValid = Boolean(env.R2_RECEIPTS_SECRET_ACCESS_KEY.length === 64);
    const accountId = env.R2_RECEIPTS_ACCOUNT_ID || env.R2_ACCOUNT_ID;
    return Boolean(accountId && isKeyValid && isSecretValid);
  }
  return isR2Configured();
};

export const getReceiptsR2Client = () => {
  if (env.R2_RECEIPTS_BUCKET && env.R2_RECEIPTS_ACCESS_KEY_ID && env.R2_RECEIPTS_SECRET_ACCESS_KEY) {
    if (!receiptsClientInstance) {
      const accountId = env.R2_RECEIPTS_ACCOUNT_ID || env.R2_ACCOUNT_ID;
      receiptsClientInstance = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: env.R2_RECEIPTS_ACCESS_KEY_ID,
          secretAccessKey: env.R2_RECEIPTS_SECRET_ACCESS_KEY,
        },
      });
    }
    return receiptsClientInstance;
  }
  return getR2Client();
};
