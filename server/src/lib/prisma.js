import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

// Global variable to prevent multiple instances during hot-reload in development
const globalForPrisma = globalThis;

export function getPrismaDatasourceUrl(testMode = (process.env.NODE_ENV === 'test' || env.NODE_ENV === 'test')) {
  if (testMode) {
    const testUrl = process.env.DATABASE_TEST_URL || env.DATABASE_TEST_URL;
    if (!testUrl || typeof testUrl !== 'string' || testUrl.trim() === '') {
      throw new Error('FATAL SAFETY VIOLATION: DATABASE_TEST_URL is missing in test mode. Fallback to DATABASE_URL is strictly prohibited.');
    }

    try {
      const urlObj = new URL(testUrl);
      const dbName = urlObj.pathname.replace(/^\//, '').split('?')[0];
      if (dbName !== 'madrasanexa_test') {
        throw new Error(`FATAL SAFETY VIOLATION: Target test database is "${dbName}". Must strictly be "madrasanexa_test".`);
      }
    } catch (err) {
      if (err.message.startsWith('FATAL SAFETY VIOLATION')) throw err;
      throw new Error('FATAL SAFETY VIOLATION: DATABASE_TEST_URL has an invalid URI format.');
    }

    return testUrl;
  }

  return env.DATABASE_URL;
}

const isTest = process.env.NODE_ENV === 'test' || env.NODE_ENV === 'test';
const datasourceUrl = getPrismaDatasourceUrl(isTest);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: datasourceUrl,
      },
    },
    log: (!isTest && env.NODE_ENV === 'development') ? ['query', 'error', 'warn'] : ['error'],
  });

if (env.NODE_ENV !== 'production' && !isTest) {
  globalForPrisma.prisma = prisma;
}

export default prisma;
