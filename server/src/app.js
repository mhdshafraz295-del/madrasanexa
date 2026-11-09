import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { env } from './config/env.js';
import { apiRateLimiter } from './middleware/rateLimiter.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';
import { errorHandler } from './middleware/errorHandler.js';
import { sanitizeLogUrl } from './utils/log-sanitizer.js';
import apiRoutes from './routes/index.js';

const app = express();

// Configurable Trust Proxy: strictly validated, trust-all strictly forbidden
const trustProxyVal = env.TRUST_PROXY || process.env.TRUST_PROXY || 'false';
if (trustProxyVal === 'true') {
  throw new Error('Fatal Configuration Error: TRUST_PROXY=true (trust-all) is strictly prohibited. Specify an explicit positive integer hop count or approved subnet list.');
} else if (trustProxyVal === 'false' || !trustProxyVal) {
  app.set('trust proxy', false);
} else if (/^[1-9]\d*$/.test(trustProxyVal)) {
  app.set('trust proxy', parseInt(trustProxyVal, 10));
} else {
  // Validate approved subnet keywords or CIDRs before accepting
  const allowedSubnets = new Set(['loopback', 'linklocal', 'uniquelocal']);
  const parts = trustProxyVal.split(',').map((s) => s.trim().toLowerCase());
  const isValidSubnet = parts.length > 0 && parts.every((p) => allowedSubnets.has(p) || /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(p));
  if (!isValidSubnet) {
    throw new Error(`Fatal Configuration Error: Invalid TRUST_PROXY value "${trustProxyVal}". Must be "false", a positive integer, or approved subnets.`);
  }
  app.set('trust proxy', trustProxyVal);
}

// Disable x-powered-by header for security
app.disable('x-powered-by');

// Security HTTP headers
app.use(helmet());

// Secure CORS configuration
const allowedOrigins = [
  env.FRONTEND_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS policy does not allow access from origin: ${origin}`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Register custom Morgan tokens to redact sensitive query parameters (token, setup tokens, secrets)
morgan.token('url', (req) => {
  const original = req.originalUrl || req.url || '';
  return sanitizeLogUrl(original);
});

morgan.token('referrer', (req) => {
  const ref = req.headers['referer'] || req.headers['referrer'] || '';
  return sanitizeLogUrl(ref);
});

// HTTP request logger
app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));

// Body parsers with limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting for API routes
app.use('/api', apiRateLimiter);

// API routes
app.use('/api', apiRoutes);

// Centralized 404 handler
app.use(notFoundHandler);

// Centralized error handler
app.use(errorHandler);

export default app;
