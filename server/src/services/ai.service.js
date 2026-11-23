import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import {
  uploadBufferToR2,
  resolveObjectAccessUrl,
  getSecureReceiptDownloadUrl,
  uploadReceiptBufferToR2,
} from './r2.service.js';
import {
  isR2Configured,
  isReceiptsR2Configured,
} from '../config/r2.js';
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from '../utils/errors.js';

const MAX_RECEIPT_SIZE = 25 * 1024 * 1024; // 25 MB

/**
 * Validates in-memory receipt file buffer strictly.
 * Disallows executable headers, HTML, scripts, SVG.
 */
export async function validateAiReceiptBuffer(fileBuffer, originalName = '') {
  if (!fileBuffer || !Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
    throw new BadRequestError('Receipt file is required.');
  }

  if (fileBuffer.length > MAX_RECEIPT_SIZE) {
    throw new BadRequestError('Receipt file must not exceed 25 MB.');
  }

  const nameLower = originalName.toLowerCase().trim();
  const asciiHeader = fileBuffer.slice(0, 1024).toString('ascii');
  const bufferHeader = fileBuffer.slice(0, 100).toString('utf8').toLowerCase();

  // Prohibit SVGs strictly
  if (
    nameLower.endsWith('.svg') ||
    bufferHeader.includes('<svg') ||
    bufferHeader.includes('<?xml')
  ) {
    throw new BadRequestError('SVG files are prohibited for security reasons. Please upload a JPG, PNG, WebP or PDF file.');
  }

  // Reject HTML / Script injection (only for non-PDF files)
  if (!nameLower.endsWith('.pdf') && !asciiHeader.includes('%PDF')) {
    if (
      bufferHeader.includes('<html') ||
      bufferHeader.includes('<!doctype') ||
      bufferHeader.includes('<script')
    ) {
      throw new BadRequestError('HTML and executable files are prohibited.');
    }
  }

  // Reject Windows / Linux Executable binaries (MZ, ELF)
  if (fileBuffer.length >= 4) {
    const isMZ = fileBuffer[0] === 0x4d && fileBuffer[1] === 0x5a;
    const isELF = fileBuffer[0] === 0x7f && fileBuffer[1] === 0x45 && fileBuffer[2] === 0x4c && fileBuffer[3] === 0x46;
    if (isMZ || isELF) {
      throw new BadRequestError('Executable binary files are strictly prohibited.');
    }
  }

  // Detect mime type
  let ext = 'bin';
  let mimeType = 'application/octet-stream';

  if (asciiHeader.includes('%PDF') || nameLower.endsWith('.pdf')) {
    ext = 'pdf';
    mimeType = 'application/pdf';
  } else if (fileBuffer[0] === 0xff && fileBuffer[1] === 0xd8 && fileBuffer[2] === 0xff) {
    ext = 'jpg';
    mimeType = 'image/jpeg';
  } else if (
    fileBuffer[0] === 0x89 &&
    fileBuffer[1] === 0x50 &&
    fileBuffer[2] === 0x4e &&
    fileBuffer[3] === 0x47
  ) {
    ext = 'png';
    mimeType = 'image/png';
  } else if (
    fileBuffer.length >= 12 &&
    fileBuffer.slice(0, 4).toString('ascii') === 'RIFF' &&
    fileBuffer.slice(8, 12).toString('ascii') === 'WEBP'
  ) {
    ext = 'webp';
    mimeType = 'image/webp';
  } else if (nameLower.endsWith('.jpg') || nameLower.endsWith('.jpeg')) {
    ext = 'jpg';
    mimeType = 'image/jpeg';
  } else if (nameLower.endsWith('.png')) {
    ext = 'png';
    mimeType = 'image/png';
  } else if (nameLower.endsWith('.webp')) {
    ext = 'webp';
    mimeType = 'image/webp';
  } else {
    throw new BadRequestError('Unsupported file format. Please upload a valid JPG, PNG, WebP image or PDF document.');
  }

  return { ext, mimeType };
}

/**
 * Resolves the view/download URL for an AI bank payment receipt.
 * Prefers Cloudflare R2 presigned download URL, falling back to authenticated local streaming endpoint.
 */
export async function resolveAiReceiptUrl(receiptKey, requestId) {
  if (!receiptKey) return null;

  if (isReceiptsR2Configured()) {
    try {
      const url = await getSecureReceiptDownloadUrl(receiptKey, 3600);
      if (url) return url;
    } catch {}
  }

  if (isR2Configured()) {
    try {
      const url = await resolveObjectAccessUrl(receiptKey, 3600);
      if (url) return url;
    } catch {}
  }

  return `/api/ai/subscription/receipt/${requestId}`;
}

/**
 * Streams or redirects to the requested receipt file for authorized users (Super Admin or Tenant Admin)
 */
export async function getAiReceiptFileStream({ requestId, requesterRole, requesterMadrasaId }) {
  const item = await prisma.aiSubscriptionRequest.findUnique({
    where: { id: requestId },
  });

  if (!item) {
    throw new NotFoundError('Subscription receipt not found.');
  }

  if (requesterRole !== 'SUPER_ADMIN' && requesterMadrasaId !== item.madrasaId) {
    throw new ForbiddenError('Unauthorized to access this receipt.');
  }

  const key = item.receiptUrl;
  const ext = (path.extname(key) || '').replace('.', '').toLowerCase();
  const mimeType = ext === 'pdf' ? 'application/pdf' : ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  const filename = path.basename(key);

  // 1. If R2 is configured and returns a presigned URL
  if (isReceiptsR2Configured()) {
    try {
      const signedUrl = await getSecureReceiptDownloadUrl(key, 900);
      if (signedUrl) {
        return { url: signedUrl };
      }
    } catch {}
  }

  // 2. Stream from local storage fallback
  const localFilePath = path.join(process.cwd(), 'uploads', 'ai-receipts', item.madrasaId, filename);
  if (fs.existsSync(localFilePath)) {
    return {
      stream: fs.createReadStream(localFilePath),
      mimeType,
      filename,
    };
  }

  throw new NotFoundError('Receipt file content not found on server or cloud storage.');
}

/**
 * Get or seed platform AI settings (pricing and official bank transfer details)
 */
export async function getPlatformAiSettings() {
  let settings = await prisma.platformAiSetting.findUnique({
    where: { id: 'global' },
  });

  if (!settings) {
    // If platform general bank settings exist, inherit defaults from it
    const platformBank = await prisma.platformBankSetting.findUnique({
      where: { id: 'global' },
    });

    settings = await prisma.platformAiSetting.create({
      data: {
        id: 'global',
        monthlyPrice: 2500.0,
        yearlyPrice: 25000.0,
        currency: 'LKR',
        bankName: platformBank?.bankName || 'Bank of Ceylon (BOC)',
        accountName: platformBank?.accountName || 'MadrasaNexa Platform (Pvt) Ltd',
        accountNumber: platformBank?.accountNumber || '008920192841',
        branch: platformBank?.branch || 'Colombo Corporate Branch',
        instructions:
          platformBank?.instructions ||
          'Please transfer the subscription fee to the platform account. Put your Madrasa Code as payment reference. Upload the transfer slip or bank deposit receipt below.',
        featuresList: [
          'Zero-Storage PDF Exam Paper & Answer Key Generator (Tamil, English, Arabic, Bilingual)',
          'Ustadh 30-Min Structured Lesson Planner & Board Summaries',
          'Madrasa Event Poster & Flyer Maker (One-Click AI Image Generation)',
          '3-Language Islamic Circular & Content Translator',
          'Unlimited usage for Admin and all Ustadh/Teachers',
        ],
      },
    });
  }

  return {
    ...settings,
    monthlyPrice: Number(settings.monthlyPrice),
    yearlyPrice: Number(settings.yearlyPrice),
  };
}

/**
 * Update platform AI settings (Super Admin only)
 */
export async function updatePlatformAiSettings(data) {
  const existing = await getPlatformAiSettings();

  const updated = await prisma.platformAiSetting.update({
    where: { id: 'global' },
    data: {
      monthlyPrice: data.monthlyPrice !== undefined ? Number(data.monthlyPrice) : existing.monthlyPrice,
      yearlyPrice: data.yearlyPrice !== undefined ? Number(data.yearlyPrice) : existing.yearlyPrice,
      currency: data.currency ? String(data.currency).trim().toUpperCase() : existing.currency,
      bankName: data.bankName !== undefined ? data.bankName : existing.bankName,
      accountName: data.accountName !== undefined ? data.accountName : existing.accountName,
      accountNumber: data.accountNumber !== undefined ? data.accountNumber : existing.accountNumber,
      branch: data.branch !== undefined ? data.branch : existing.branch,
      instructions: data.instructions !== undefined ? data.instructions : existing.instructions,
      featuresList: data.featuresList !== undefined ? data.featuresList : existing.featuresList,
    },
  });

  return {
    ...updated,
    monthlyPrice: Number(updated.monthlyPrice),
    yearlyPrice: Number(updated.yearlyPrice),
  };
}

/**
 * Get tenant AI activation status, expiry, and pending requests
 */
export async function getTenantAiStatus(madrasaId) {
  if (!madrasaId) {
    throw new BadRequestError('Madrasa ID is required.');
  }

  const madrasa = await prisma.madrasa.findFirst({
    where: {
      OR: [
        { id: madrasaId },
        { code: madrasaId },
      ],
    },
    select: {
      id: true,
      name: true,
      code: true,
      aiEnabled: true,
      aiExpiresAt: true,
      status: true,
    },
  });

  if (!madrasa) {
    throw new NotFoundError('Madrasa workspace not found.');
  }

  const now = new Date();
  const isExpired = Boolean(madrasa.aiExpiresAt && new Date(madrasa.aiExpiresAt) <= now);
  const isTenantActive = madrasa.status === 'ACTIVE';
  const isActive = Boolean(madrasa.aiEnabled === true && !isExpired && isTenantActive);
  const effectiveAiEnabled = isActive;

  let daysRemaining = null;
  if (madrasa.aiExpiresAt && !isExpired) {
    const diffMs = new Date(madrasa.aiExpiresAt).getTime() - now.getTime();
    daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }

  // Fetch latest subscription request
  const latestRequest = await prisma.aiSubscriptionRequest.findFirst({
    where: { madrasaId },
    orderBy: { createdAt: 'desc' },
    include: {
      submittedByUser: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  // Resolve receipt URL if pending
  let resolvedReceiptUrl = null;
  if (latestRequest?.receiptUrl) {
    resolvedReceiptUrl = await resolveAiReceiptUrl(latestRequest.receiptUrl, latestRequest.id);
  }

  const settings = await getPlatformAiSettings();

  return {
    madrasaId: madrasa.id,
    madrasaName: madrasa.name,
    madrasaCode: madrasa.code,
    isActive,
    aiEnabled: effectiveAiEnabled,
    rawAiEnabled: madrasa.aiEnabled,
    aiExpiresAt: madrasa.aiExpiresAt,
    isExpired,
    daysRemaining,
    settings: {
      monthlyPrice: Number(settings.monthlyPrice),
      yearlyPrice: Number(settings.yearlyPrice),
      currency: settings.currency,
      bankName: settings.bankName,
      accountName: settings.accountName,
      accountNumber: settings.accountNumber,
      branch: settings.branch,
      instructions: settings.instructions,
      featuresList: settings.featuresList,
    },
    latestRequest: latestRequest
      ? {
          id: latestRequest.id,
          planName: latestRequest.planName,
          amount: Number(latestRequest.amount),
          transactionRef: latestRequest.transactionRef,
          receiptUrl: resolvedReceiptUrl,
          status: latestRequest.status,
          adminNote: latestRequest.adminNote,
          createdAt: latestRequest.createdAt,
          updatedAt: latestRequest.updatedAt,
          submittedBy: latestRequest.submittedByUser,
        }
      : null,
  };
}

/**
 * Submit a bank payment receipt for AI subscription activation
 */
export async function submitAiSubscriptionReceipt({
  madrasaId,
  userId,
  planName,
  amount,
  transactionRef,
  file,
}) {
  if (!madrasaId || !userId) {
    throw new BadRequestError('Tenant context and user authentication are required.');
  }

  if (!planName || typeof planName !== 'string') {
    throw new BadRequestError('Plan name is required.');
  }

  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    throw new BadRequestError('Valid payment amount is required.');
  }

  if (!transactionRef || typeof transactionRef !== 'string' || transactionRef.trim().length < 3) {
    throw new BadRequestError('Valid transaction reference number is required (at least 3 characters).');
  }

  if (!file || !file.buffer) {
    throw new BadRequestError('Bank payment receipt file is required.');
  }

  // Check if there is already a PENDING request
  const existingPending = await prisma.aiSubscriptionRequest.findFirst({
    where: {
      madrasaId,
      status: 'PENDING',
    },
  });

  if (existingPending) {
    throw new ConflictError(
      'An AI subscription request is already pending review for your Madrasa. Please wait for Super Admin approval or contact support.'
    );
  }

  const { ext, mimeType } = await validateAiReceiptBuffer(file.buffer, file.originalname);

  // Upload to Cloudflare R2 bucket with local storage fallback
  const fileHash = crypto.randomBytes(8).toString('hex');
  const safeRef = transactionRef.trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 20);
  const r2Key = `ai-receipts/${madrasaId}/${Date.now()}_${safeRef}_${fileHash}.${ext}`;

  // Always write to local storage as fallback so file is NEVER lost
  try {
    const localDir = path.join(process.cwd(), 'uploads', 'ai-receipts', madrasaId);
    await fs.promises.mkdir(localDir, { recursive: true });
    await fs.promises.writeFile(path.join(localDir, path.basename(r2Key)), file.buffer);
  } catch (diskErr) {
    console.warn('[AI Service] Local disk write fallback warning:', diskErr.message);
  }

  // Upload to R2 if configured
  if (isReceiptsR2Configured()) {
    try {
      await uploadReceiptBufferToR2(r2Key, file.buffer, mimeType);
    } catch (r2Err) {
      console.warn('[AI Service] Receipts R2 upload warning:', r2Err.message);
      if (isR2Configured()) {
        try {
          await uploadBufferToR2(r2Key, file.buffer, mimeType);
        } catch (r2Err2) {
          console.warn('[AI Service] Default R2 upload warning:', r2Err2.message);
        }
      }
    }
  } else if (isR2Configured()) {
    try {
      await uploadBufferToR2(r2Key, file.buffer, mimeType);
    } catch (r2Err) {
      console.warn('[AI Service] Default R2 upload warning:', r2Err.message);
    }
  }

  const newRequest = await prisma.aiSubscriptionRequest.create({
    data: {
      madrasaId,
      submittedByUserId: userId,
      planName: planName.trim(),
      amount: numAmount,
      transactionRef: transactionRef.trim(),
      receiptUrl: r2Key,
      status: 'PENDING',
    },
    include: {
      submittedByUser: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  return {
    ...newRequest,
    amount: Number(newRequest.amount),
  };
}

/**
 * Super Admin: List all AI subscription requests
 */
export async function listAllAiSubscriptionRequests({ status, page = 1, limit = 25 }) {
  const pageNum = Math.max(1, Number(page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(limit) || 25));
  const skip = (pageNum - 1) * pageSize;

  const where = {};
  if (status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
    where.status = status;
  }

  const [totalCount, requests] = await Promise.all([
    prisma.aiSubscriptionRequest.count({ where }),
    prisma.aiSubscriptionRequest.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        madrasa: {
          select: {
            id: true,
            name: true,
            code: true,
            slug: true,
            aiEnabled: true,
            aiExpiresAt: true,
          },
        },
        submittedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    }),
  ]);

  // Resolve presigned / access URLs for receipts
  const enrichedRequests = await Promise.all(
    requests.map(async (req) => {
      const resolvedUrl = await resolveAiReceiptUrl(req.receiptUrl, req.id);

      return {
        id: req.id,
        madrasaId: req.madrasaId,
        madrasa: req.madrasa,
        submittedByUser: req.submittedByUser,
        planName: req.planName,
        amount: Number(req.amount),
        transactionRef: req.transactionRef,
        receiptKey: req.receiptUrl,
        receiptUrl: resolvedUrl,
        status: req.status,
        adminNote: req.adminNote,
        createdAt: req.createdAt,
        updatedAt: req.updatedAt,
      };
    })
  );

  return {
    requests: enrichedRequests,
    pagination: {
      page: pageNum,
      limit: pageSize,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
    },
  };
}

/**
 * Super Admin: Approve an AI Subscription Request & activate AI for the tenant
 */
export async function approveAiSubscriptionRequest({ requestId, adminUserId, adminNote, customExpiresAt }) {
  const req = await prisma.aiSubscriptionRequest.findUnique({
    where: { id: requestId },
    include: { madrasa: true },
  });

  if (!req) {
    throw new NotFoundError('Subscription request not found.');
  }

  if (req.status === 'APPROVED') {
    throw new BadRequestError('This request has already been approved.');
  }

  // Calculate new expiry date
  let newExpiresAt;
  if (customExpiresAt) {
    newExpiresAt = new Date(customExpiresAt);
  } else {
    const isYearly = req.planName.toLowerCase().includes('year');
    const daysToAdd = isYearly ? 365 : 30;

    // If madrasa currently has an active future aiExpiresAt, extend from that date
    const baseDate =
      req.madrasa.aiExpiresAt && new Date(req.madrasa.aiExpiresAt) > new Date()
        ? new Date(req.madrasa.aiExpiresAt)
        : new Date();

    newExpiresAt = new Date(baseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
  }

  // Transaction: update request and activate madrasa
  const [updatedRequest, updatedMadrasa] = await prisma.$transaction([
    prisma.aiSubscriptionRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        adminNote: adminNote || 'Approved by Super Admin.',
      },
    }),
    prisma.madrasa.update({
      where: { id: req.madrasaId },
      data: {
        aiEnabled: true,
        aiExpiresAt: newExpiresAt,
      },
      select: {
        id: true,
        name: true,
        code: true,
        aiEnabled: true,
        aiExpiresAt: true,
      },
    }),
    prisma.activityLog.create({
      data: {
        userId: adminUserId,
        action: 'AI_SUBSCRIPTION_APPROVED',
        entityType: 'MADRASA',
        entityId: req.madrasaId,
        metadata: {
          requestId,
          planName: req.planName,
          amount: Number(req.amount),
          expiresAt: newExpiresAt.toISOString(),
          adminNote,
        },
      },
    }),
  ]);

  return {
    request: updatedRequest,
    madrasa: updatedMadrasa,
  };
}

/**
 * Super Admin: Reject an AI Subscription Request
 */
export async function rejectAiSubscriptionRequest({ requestId, adminUserId, adminNote }) {
  const req = await prisma.aiSubscriptionRequest.findUnique({
    where: { id: requestId },
  });

  if (!req) {
    throw new NotFoundError('Subscription request not found.');
  }

  if (req.status === 'APPROVED') {
    throw new BadRequestError('Cannot reject an already approved request.');
  }

  const updatedRequest = await prisma.$transaction([
    prisma.aiSubscriptionRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        adminNote: adminNote || 'Payment receipt could not be verified.',
      },
    }),
    prisma.activityLog.create({
      data: {
        userId: adminUserId,
        action: 'AI_SUBSCRIPTION_REJECTED',
        entityType: 'MADRASA',
        entityId: req.madrasaId,
        metadata: {
          requestId,
          adminNote,
        },
      },
    }),
  ]);

  return updatedRequest[0];
}

/**
 * Super Admin: Manually toggle AI access for any Madrasa
 */
export async function toggleMadrasaAiAccess({ madrasaId, enabled, expiresAt, adminUserId, note }) {
  const madrasa = await prisma.madrasa.findFirst({
    where: {
      OR: [
        { id: madrasaId },
        { code: madrasaId },
      ],
    },
  });

  if (!madrasa) {
    throw new NotFoundError('Madrasa not found.');
  }

  let newExpiry = madrasa.aiExpiresAt;
  if (enabled) {
    if (expiresAt) {
      newExpiry = new Date(expiresAt);
    } else if (!madrasa.aiExpiresAt || new Date(madrasa.aiExpiresAt) <= new Date()) {
      // Default to 30 days if not set or expired
      newExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }
  } else {
    // When disabling AI, cleanly clear expiry
    newExpiry = null;
  }

  const updated = await prisma.madrasa.update({
    where: { id: madrasa.id },
    data: {
      aiEnabled: Boolean(enabled),
      aiExpiresAt: newExpiry,
    },
    select: {
      id: true,
      name: true,
      code: true,
      aiEnabled: true,
      aiExpiresAt: true,
    },
  });

  try {
    await prisma.activityLog.create({
      data: {
        madrasaId: madrasa.id,
        userId: adminUserId || null,
        action: enabled ? 'AI_MANUAL_ENABLED' : 'AI_MANUAL_DISABLED',
        entityType: 'MADRASA',
        entityId: madrasa.id,
        metadata: {
          enabled: Boolean(enabled),
          expiresAt: newExpiry?.toISOString() || null,
          note,
        },
      },
    });
  } catch (logErr) {
    console.error('Activity log error during AI toggle:', logErr);
  }

  return {
    ...updated,
    isActive: Boolean(updated.aiEnabled === true && (!updated.aiExpiresAt || new Date(updated.aiExpiresAt) > new Date())),
  };
}

/**
 * Detect if a user prompt is asking about real-world facts, leadership, or current affairs.
 */
const CURRENT_AFFAIRS_REGEX = /\b(?:who\s+is|who\s+was|who\s+are|current|latest|present|today|now|recently|recent|president|prime\s+minister|chief\s+minister|minister|governor|leader|head\s+of\s+state|election|cabinet|news|score|price|2024|2025|2026|2027)\b/i;

export function isCurrentAffairsQuery(text = '') {
  return CURRENT_AFFAIRS_REGEX.test(String(text));
}

/**
 * Lightweight Live Web Search Context Helper (Zero API Key Required + Optional Tavily / Serper):
 * Fetches real-time web context dynamically so Gemini (without tools) and Cloudflare Llama
 * can answer current-affairs facts accurately without hardcoded names.
 */
export async function fetchLiveWebContext(query) {
  if (!query || typeof query !== 'string') return '';
  const cleanQuery = query
    .replace(/[?!.,;:()[\]{}"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleanQuery || cleanQuery.length < 3) return '';

  // 1. Optional Tavily Search API if configured
  const tavilyKey = process.env.TAVILY_API_KEY || env.TAVILY_API_KEY;
  if (tavilyKey && tavilyKey.trim()) {
    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: tavilyKey.trim(), query: cleanQuery, max_results: 4 }),
        signal: AbortSignal.timeout(3500),
      });
      if (res.ok) {
        const data = await res.json();
        const snippets = (data?.results || []).map((r) => r.content || r.snippet).filter(Boolean);
        if (snippets.length > 0) {
          return snippets.slice(0, 4).join('\n---\n');
        }
      }
    } catch (tavErr) {
      console.warn('[Live Web Search] Tavily search error:', tavErr.message);
    }
  }

  // 2. Optional Serper API if configured
  const serperKey = process.env.SERPER_API_KEY || env.SERPER_API_KEY;
  if (serperKey && serperKey.trim()) {
    try {
      const res = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': serperKey.trim(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q: cleanQuery, num: 4 }),
        signal: AbortSignal.timeout(3500),
      });
      if (res.ok) {
        const data = await res.json();
        const snippets = (data?.organic || []).map((r) => r.snippet).filter(Boolean);
        if (snippets.length > 0) {
          return snippets.slice(0, 4).join('\n---\n');
        }
      }
    } catch (serperErr) {
      console.warn('[Live Web Search] Serper search error:', serperErr.message);
    }
  }

  // 3. DuckDuckGo HTML Search (Zero API Key required)
  try {
    const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanQuery)}`;
    const res = await fetch(ddgUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(3500),
    });

    if (res.ok) {
      const html = await res.text();
      const regex = /<a class="result__snippet[^>]*>([\s\S]*?)<\/a>/g;
      let match;
      const snippets = [];
      while ((match = regex.exec(html)) !== null && snippets.length < 4) {
        const text = match[1]
          .replace(/<[^>]+>/g, '')
          .replace(/&quot;/g, '"')
          .replace(/&#x27;/g, "'")
          .replace(/&#39;/g, "'")
          .replace(/&amp;/g, '&')
          .replace(/\s+/g, ' ')
          .trim();
        if (text) snippets.push(text);
      }
      if (snippets.length > 0) {
        return snippets.join('\n---\n');
      }
    }
  } catch (ddgErr) {
    console.warn('[Live Web Search] DuckDuckGo HTML search error:', ddgErr.message);
  }

  // 4. Wikipedia Search API (Zero API Key required)
  try {
    const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(cleanQuery)}&gsrlimit=3&prop=extracts&exintro=1&explaintext=1&format=json`;
    const res = await fetch(wikiUrl, {
      headers: { 'User-Agent': 'MadrasaNexaBot/1.0' },
      signal: AbortSignal.timeout(3500),
    });
    if (res.ok) {
      const data = await res.json();
      const pages = Object.values(data?.query?.pages || {});
      const extracts = pages
        .map((p) => (p.title ? `${p.title}: ${p.extract || ''}` : p.extract))
        .filter(Boolean)
        .map((e) => e.slice(0, 300).trim());
      if (extracts.length > 0) {
        return extracts.join('\n---\n');
      }
    }
  } catch (wikiErr) {
    console.warn('[Live Web Search] Wikipedia search error:', wikiErr.message);
  }

  return '';
}

/**
 * Helper to execute Google Gemini generation with native PDF inlineData support.
 * Targets gemini-2.5-flash with native Google Search grounding, fallback cascade, and live web context.
 */
async function callGeminiGenerateContent({
  prompt = '',
  systemPrompt = '',
  messages = [],
  pdfBuffer = null,
  temperature = 0.3,
  maxOutputTokens = 8192,
  queryText = '',
}) {
  const apiKey = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new Error('GEMINI_API_KEY is not configured.');
  }

  // Smart Gemini model cascade: try gemini-2.5-flash first, then gemini-3.5-flash / gemini-flash-latest, then gemini-2.0-flash
  const models = ['gemini-2.5-flash', 'gemini-3.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash'];
  const contents = [];

  if (Array.isArray(messages) && messages.length > 0) {
    for (const msg of messages) {
      if (msg.role === 'system') continue;
      const role = msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user';
      const text = String(msg.content || '').trim();
      if (!text) continue;

      if (contents.length > 0 && contents[contents.length - 1].role === role) {
        contents[contents.length - 1].parts.push({ text });
      } else {
        contents.push({
          role,
          parts: [{ text }],
        });
      }
    }

    if (contents.length > 0 && contents[0].role === 'model') {
      contents.unshift({
        role: 'user',
        parts: [{ text: 'Assalamu Alaikum' }],
      });
    }
  } else if (prompt) {
    contents.push({
      role: 'user',
      parts: [{ text: prompt }],
    });
  }

  // If pdfBuffer is supplied, attach it natively as inlineData to the last user message
  if (pdfBuffer && Buffer.isBuffer(pdfBuffer) && pdfBuffer.length > 0) {
    const pdfBase64 = pdfBuffer.toString('base64');
    const pdfPart = {
      inlineData: {
        mimeType: 'application/pdf',
        data: pdfBase64,
      },
    };

    let lastUserMsg = null;
    for (let i = contents.length - 1; i >= 0; i--) {
      if (contents[i].role === 'user') {
        lastUserMsg = contents[i];
        break;
      }
    }

    if (lastUserMsg) {
      lastUserMsg.parts.unshift(pdfPart);
    } else {
      contents.push({
        role: 'user',
        parts: [pdfPart, { text: prompt || 'Please examine the attached syllabus or document.' }],
      });
    }
  }

  if (contents.length === 0) {
    contents.push({
      role: 'user',
      parts: [{ text: prompt || 'Assalamu Alaikum' }],
    });
  }

  const currentDateStr = new Date().toDateString();
  const temporalGrounding = `Current Date: ${currentDateStr}.\n\n`;

  const baseSystemPrompt = systemPrompt && systemPrompt.trim()
    ? `${temporalGrounding}${systemPrompt.trim()}`
    : temporalGrounding.trim();

  let liveWebContext = '';
  let attemptedWebFetch = false;
  let lastError = null;

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;

    // 1. Primary call with native Google Search Grounding: tools: [{ google_search: {} }]
    try {
      const groundedBody = {
        contents,
        generationConfig: {
          temperature,
          maxOutputTokens: maxOutputTokens || 8192,
        },
        tools: [{ google_search: {} }],
        ...(baseSystemPrompt ? { systemInstruction: { parts: [{ text: baseSystemPrompt }] } } : {}),
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(groundedBody),
      });

      if (res.ok) {
        const data = await res.json();
        const candidate = data?.candidates?.[0];
        const responseParts = candidate?.content?.parts || [];
        const text = responseParts.map((p) => p.text || '').join('').trim();

        if (text) {
          return {
            text,
            model,
            grounded: true,
          };
        }
      } else {
        const errText = await res.text();
        let errorReason = errText.slice(0, 300);
        try {
          const errJson = JSON.parse(errText);
          if (errJson?.error?.message) {
            errorReason = `${errJson.error.status || 'ERROR'}: ${errJson.error.message}`;
          }
        } catch (_) {}
        console.warn(`[Gemini API Warning] Model ${model} with google_search returned HTTP ${res.status} (${errorReason}). Retrying without tools...`);
      }
    } catch (err) {
      console.warn(`[Gemini API Warning] Error invoking ${model} with google_search:`, err.message, '. Retrying without tools...');
    }

    // 2. Fetch live web context if current-affairs query and not already fetched
    if (!attemptedWebFetch && queryText && isCurrentAffairsQuery(queryText)) {
      attemptedWebFetch = true;
      try {
        liveWebContext = await fetchLiveWebContext(queryText);
      } catch (e) {
        console.warn('[Gemini API Warning] Live web context fetch failed:', e.message);
      }
    }

    // Prepare system prompt for tool-less call, enriched with live web search results if available
    let retrySystemPrompt = baseSystemPrompt;
    if (liveWebContext) {
      retrySystemPrompt += `\n\n[LIVE WEB SEARCH RESULTS - ${currentDateStr}]\n${liveWebContext}\nGround all answers to real-world and current-affairs facts strictly on the live web search results above.`;
    }

    // 3. Retry Gemini call without tools (with live web context if retrieved)
    try {
      const bodyWithoutTools = {
        contents,
        generationConfig: {
          temperature,
          maxOutputTokens: maxOutputTokens || 8192,
        },
        ...(retrySystemPrompt ? { systemInstruction: { parts: [{ text: retrySystemPrompt }] } } : {}),
      };

      const fallbackRes = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyWithoutTools),
      });

      if (!fallbackRes.ok) {
        const errFallbackText = await fallbackRes.text();
        let fallbackReason = errFallbackText.slice(0, 300);
        try {
          const errJson = JSON.parse(errFallbackText);
          if (errJson?.error?.message) {
            fallbackReason = `${errJson.error.status || 'ERROR'}: ${errJson.error.message}`;
          }
        } catch (_) {}
        console.warn(`[Gemini API Warning] Model ${model} without tools returned HTTP ${fallbackRes.status} (${fallbackReason})`);
        lastError = new Error(`Gemini API error (${fallbackRes.status}): ${fallbackReason}`);
        continue;
      }

      const data = await fallbackRes.json();
      const candidate = data?.candidates?.[0];
      const responseParts = candidate?.content?.parts || [];
      const text = responseParts.map((p) => p.text || '').join('').trim();

      if (text) {
        return {
          text,
          model,
          webContext: !!liveWebContext,
        };
      }
    } catch (err) {
      lastError = err;
      console.warn(`[Gemini API Warning] Error invoking model ${model} without tools:`, err.message);
    }
  }

  throw lastError || new Error('Failed to generate response from Gemini API.');
}

/**
 * Master AI Generation Dispatcher:
 * 1. Tries Google Gemini (gemini-2.5-flash with live search grounding) first if GEMINI_API_KEY is configured.
 * 2. Cascades to gemini-2.0-flash / gemini-2.5-flash-lite with fetchLiveWebContext(query).
 * 3. Seamlessly falls back to Cloudflare Workers AI (@cf/meta/llama-3.3-70b-instruct-fp8-fast) enriched with fetchLiveWebContext(query).
 */
async function generateAiText({
  prompt = '',
  systemPrompt = '',
  messages = null,
  pdfBuffer = null,
  temperature = 0.3,
  maxTokens = 8192,
}) {
  // Extract user query for context enrichment
  let userQuery = (prompt || '').trim();
  if (!userQuery && Array.isArray(messages)) {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user' && messages[i].content) {
        userQuery = String(messages[i].content).trim();
        break;
      }
    }
  }

  const geminiKey = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY;
  if (geminiKey && geminiKey.trim()) {
    try {
      const geminiRes = await callGeminiGenerateContent({
        prompt,
        systemPrompt,
        messages,
        pdfBuffer,
        temperature,
        maxOutputTokens: maxTokens,
        queryText: userQuery,
      });
      if (geminiRes?.text) {
        return geminiRes;
      }
    } catch (geminiErr) {
      console.warn('[AI Service] Gemini model cascade failed, falling back to Cloudflare Workers AI:', geminiErr.message);
    }
  } else {
    console.warn('[AI Service] GEMINI_API_KEY is not configured or missing from environment. Falling back to Cloudflare Workers AI.');
  }

  // If falling back to Cloudflare Workers AI, check if live web context is needed for current-affairs queries
  let enrichedSystemPrompt = systemPrompt;
  if (userQuery && isCurrentAffairsQuery(userQuery)) {
    try {
      const liveWebContext = await fetchLiveWebContext(userQuery);
      if (liveWebContext) {
        const searchBlock = `\n\n[LIVE WEB SEARCH RESULTS - ${new Date().toDateString()}]\n${liveWebContext}\nGround all answers to real-world and current-affairs facts strictly on the live web search results above.`;
        enrichedSystemPrompt = `${systemPrompt || ''}${searchBlock}`;
      }
    } catch (searchErr) {
      console.warn('[AI Service] Live web context fetch for Cloudflare fallback error:', searchErr.message);
    }
  }

  // Fallback to Cloudflare Workers AI
  if (Array.isArray(messages) && messages.length > 0) {
    const cfMessages = messages.map((m) => ({ ...m }));
    if (enrichedSystemPrompt && enrichedSystemPrompt !== systemPrompt) {
      const sysIdx = cfMessages.findIndex((m) => m.role === 'system');
      if (sysIdx >= 0) {
        cfMessages[sysIdx].content = enrichedSystemPrompt;
      } else {
        cfMessages.unshift({ role: 'system', content: enrichedSystemPrompt });
      }
    }

    return await callCloudflareChatAi({
      messages: cfMessages,
      temperature,
      maxTokens: Math.min(maxTokens, 3500),
    });
  }

  const cfText = await callCloudflareTextAi({
    prompt,
    systemPrompt: enrichedSystemPrompt,
    temperature,
  });

  return {
    text: cfText,
    model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  };
}

/**
 * Helper to execute Cloudflare Workers AI Text Generation
 */
async function callCloudflareTextAi({ prompt, systemPrompt = '', temperature = 0.3 }) {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const token = env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !token) {
    throw new Error('Cloudflare Workers AI credentials (CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN) are not configured.');
  }

  const models = [
    '@cf/meta/llama-3.3-70b-instruct',
    '@cf/meta/llama-3.1-8b-instruct',
  ];

  let lastError = null;

  for (const model of models) {
    try {
      const messages = [];
      const currentDateStr = new Date().toDateString();
      const temporalGrounding = `Current Date: ${currentDateStr}.\n\n`;

      const finalSystemPrompt = systemPrompt && systemPrompt.trim()
        ? `${temporalGrounding}${systemPrompt.trim()}`
        : temporalGrounding.trim();

      messages.push({ role: 'system', content: finalSystemPrompt });
      messages.push({ role: 'user', content: prompt });

      const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages,
          temperature,
          max_tokens: 3500,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`Cloudflare model ${model} returned ${res.status}: ${errText.slice(0, 200)}`);
        lastError = new Error(`Cloudflare AI error (${res.status}): ${errText}`);
        continue;
      }

      const data = await res.json();
      const responseText = data?.result?.response || data?.result?.choices?.[0]?.message?.content || '';
      if (responseText) {
        return responseText;
      }
    } catch (err) {
      lastError = err;
      console.warn(`Error invoking Cloudflare model ${model}:`, err.message);
    }
  }

  throw lastError || new Error('Failed to generate response from Cloudflare Workers AI.');
}

/**
 * Helper to execute Cloudflare Workers AI Multi-Turn Chat Generation
 */
async function callCloudflareChatAi({ messages, temperature = 0.4, maxTokens = 3500 }) {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const token = env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !token) {
    throw new Error('Cloudflare Workers AI credentials (CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN) are not configured.');
  }

  const models = [
    '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    '@cf/meta/llama-3.3-70b-instruct',
    '@cf/meta/llama-3.1-8b-instruct',
  ];

  let lastError = null;

  for (const model of models) {
    try {
      const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages,
          temperature,
          max_tokens: maxTokens,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`Cloudflare model ${model} returned ${res.status}: ${errText.slice(0, 200)}`);
        lastError = new Error(`Cloudflare AI error (${res.status}): ${errText}`);
        continue;
      }

      const data = await res.json();
      const responseText = data?.result?.response || data?.result?.choices?.[0]?.message?.content || '';
      if (responseText) {
        return { text: responseText, model };
      }
    } catch (err) {
      lastError = err;
      console.warn(`Error invoking Cloudflare model ${model}:`, err.message);
    }
  }

  throw lastError || new Error('Failed to generate response from Cloudflare Workers AI.');
}

/**
 * In-Memory PDF Parser:
 * Extracts text in RAM and immediately discards buffer. 0 MB saved to disk or R2.
 */
export async function extractTextFromPdfBuffer(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    return '';
  }
  try {
    if (typeof pdf === 'function') {
      const parsed = await pdf(buffer);
      return parsed?.text ? parsed.text.trim() : '';
    }
    if (pdf.PDFParse) {
      const parser = new pdf.PDFParse({ data: buffer });
      const parsed = await parser.getText();
      if (typeof parser.destroy === 'function') {
        await parser.destroy();
      }
      return parsed?.text ? parsed.text.trim() : '';
    }
    return '';
  } catch (err) {
    console.warn('[AI Service] In-memory PDF text extraction warning (falling back to Gemini native vision or raw buffer):', err.message);
    return '';
  }
}

/**
 * Universal System Instructions with Dynamic Real-World Temporal Grounding,
 * Tanglish Comprehension, Natural Scholarly Tamil, Clean Topic Extraction,
 * and Rigorous Islamic Scholarly Accuracy.
 */
export const getUniversalAiInstructions = () => `
[TEMPORAL GROUNDING & CURRENT CONTEXT]
1. TEMPORAL & REAL-WORLD DATE CONTEXT:
   - Current Date: ${new Date().toDateString()}.
   - Ground all time-sensitive references in the dynamic system date. Real-world facts and current events are fetched dynamically via live Google Search.

[STRICT ISLAMIC MADRASA & MAKTAB INSTITUTIONAL CONTEXT]
1. ZERO TOLERANCE FOR NON-ISLAMIC / SECULAR INSTITUTION EXAMPLES:
   - You are the official AI Assistant dedicated exclusively to Islamic Madrasas, Maktabs, and Muslim Educational Institutions.
   - STRICT PROHIBITION: NEVER generate, reference, or use non-Islamic, secular, or Christian school/office examples (such as "St. Xavier's High School", "Tarang Cultural Fest", "ABC Tech Solutions Pvt Ltd", "Rohan Sharma", "Priya Nair", etc.)!
   - NEVER output raw bracketed fill-in-the-blank placeholders like "[NAME OF THE ORGANIZATION / SCHOOL / COMPANY]", "[LOCATION / CITY]", "[Your Signature]".
   - ALL notices, circulars, speeches, worksheets, and correspondence must be authentically and beautifully crafted for Islamic Madrasas with Bismillah (بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ), Islamic greetings, Hijri/Gregorian dates, Sunnah etiquette, Du'as, and Islamic administration sign-offs.

[UNIVERSAL TANGLISH (SPOKEN TAMIL IN ENGLISH SCRIPT) COMPREHENSION & NATURAL RESPONSE RULES]
1. UNIVERSAL TANGLISH UNDERSTANDING:
   - Users frequently type spoken Tamil using English letters (Tanglish) across all topics, for example:
     * "wudu eppadi seirathu" (How to perform Wudu / Rules of Wudu)
     * "zakat kanakku eppadi podurathu" (How to calculate Zakat)
     * "naalaikku madrasa leave notice onnu ezhuthu" (Draft Madrasa holiday/leave circular)
     * "ramadan paththi bayan speech thaa" (Deliver Bayan/Speech on Ramadan)
     * "islamiya sattam paththi sollu" (Explain Islamic Jurisprudence / Shariah rulings)
     * "indha pdf-a surukki sollu" (Summarize this syllabus/document)
     * "thozhugai timing pathi sollu" (Explain Salah timings and rules)
     * "hifz test paper onnu ready pannu" (Prepare a Hifz test paper)
   - You MUST first mentally decode the true Tamil and Islamic meaning behind any Tanglish prompt. Treat Tanglish as genuine user intent and answer with full knowledge, depth, and clarity.

2. NEVER ECHO OR PHONETIC-TRANSLITERATE RAW TANGLISH PROMPTS:
   - STRICT PROHIBITION: NEVER copy-paste, parrot, or phonetically spell out colloquial Tanglish words into titles, headings, subject lines, or bullet points!
   - NEVER write awkward phonetic gibberish such as: "இஸ்லாமியா சத்தாம் பத்தி சொல்லு பற்றிய அறிவு" or "வூதூ எப்படி செய்றது நோட்ஸ்" or "ஸகாத் கணக்கு எப்படி போடுறது பாடம்".
   - ALWAYS extract and refine the user's intent into a clean, dignified, formal scholarly title and subject (e.g., "வுளூவின் முக்கியத்துவமும் அதன் சட்டதிட்டங்களும் செய்முறையும் (The Fiqh and Method of Wudu)", "ஜகாத் கணக்கிடும் முறை (Method of Zakat Calculation)", "ரமழானின் சிறப்புகளும் அதன் வழிகாட்டல்களும் (Virtues of Ramadan)").

3. FLUENT, SCHOLARLY, NATURAL TAMIL:
   - When responding in Tamil (or when the user prompts in Tanglish/Tamil and expects Tamil output):
     * Write in natural, grammatically sound, elegant Tamil as used by authentic Islamic scholars, Madrasas, and Muslim educational institutions in Sri Lanka and India.
     * Use authentic, widely recognized Islamic terminology in Tamil script: (வுளூ, தொழுகை/ஸலாஹ், ஜகாத், நோன்பு/ஸவ்ம், ஷரீஆ, ஃபிக்ஹ், திருக்குர்ஆன், ஸஹீஹ் ஹதீஸ், ஸுன்னத், துஆ, அதப், அக்லாக், தஹாரத், இபாத், திக்ர், மத்ரஸா, உஸ்தாத்).
     * NEVER use awkward machine-translated phrasing or dry literal Google Translations.

4. STRICT ISLAMIC ACCURACY & SCHOLARLY INTEGRITY GUARDRAILS:
   - ZERO SCRIPTURAL FABRICATION: Never invent or guess Quranic verse numbers or Surah references (e.g., never misquote Surah 2:238 or cite non-existent numbers). If quoting an Ayah, ensure the Surah name and theological context are accurate.
   - ACCURATE HADITH ATTRIBUTION: Strictly attribute Hadith quotations to their authentic canonical collections (e.g., Sahih al-Bukhari, Sahih Muslim, Sunan Abi Dawud, Jami' at-Tirmidhi, Sunan an-Nasa'i, Sunan Ibn Majah).
     * Example: The statement "தூய்மை ஈமானின் பாதியாகும்" (Cleanliness is half of faith) is authentically recorded in Sahih Muslim (Hadith 223), NOT Sahih al-Bukhari.
   - COMPLETE AND VALID FIQH STEPS: When explaining Fiqh rulings or acts of worship (Ibadah), provide complete, step-by-step conditions (Shuroot) and obligatory pillars (Fara'idh / Arkan).
     * For example, for Wudu (வுளூ), you MUST include all 4 Quranic Fardh steps (Surah Al-Ma'idah 5:6):
       1. Niyyah (Intention in the heart)
       2. Washing the entire face (from top of forehead to bottom of chin, and from earlobe to earlobe)
       3. Washing both arms up to and including the elbows
       4. Masah (wiping over) the head
       5. Washing both feet up to and including the ankles
       6. Tertib (maintaining the proper obligatory sequence)
       Along with authentic Sunnah steps: reciting Bismillah, washing hands up to wrists, rinsing mouth (Madmadah), sniffing water into nostrils and blowing it out (Istinshaq), and reciting the Sunnah Shahadah Du'a upon completion.
   - REVERENCE & HONORIFICS: Always use dignified Islamic honorifics (Allah ﷻ, Prophet Muhammad ﷺ, Sahabah رضي الله عنهم, scholars رحمه الله).

5. STRICT PDF ATTACHMENT GROUNDING & EXHAUSTIVE STRUCTURED NOTES:
   - When a syllabus PDF or document text is provided (via native PDF vision or parsed RAM buffer):
     * Ground all answers, notes, summaries, and exam questions STRICTLY on the document's actual contents, facts, and structure.
     * Do NOT hallucinate external chapters or assume syllabus content not present in the document.
     * Provide thorough, in-depth, structured notes with clear section headings, detailed explanations, practical examples, scriptural proofs, and summary takeaways (up to 8192 tokens). Never truncate or provide shallow 2-sentence answers.

6. NATURAL CONVERSATIONAL GREETINGS & COMPREHENSIVE ONBOARDING:
   - When the user sends a greeting (e.g. "Assalamu Alaikum", "Salam", "Hi", "Hello", "Vanakkam"):
     * NEVER reply with a cold, robotic one-word response like "Wa Alaikumussalam".
     * Respond with a warm, dignified, authentic Islamic greeting (e.g. "وَعَلَيْكُمُ السَّلَامُ وَرَحْمَةُ اللهِ وَبَرَكَاتُهُ • Wa Alaikum Assalam wa Rahmatullahi wa Barakatuh").
     * Introduce yourself warmly as the MadrasaNexa Smart AI Assistant and concisely present the core capabilities available to Ustadhs and Administrators (Exam & Answer Key Generation, 30-Min Lesson Planning, Madrasa Parent Circulars, Hifz & Tajweed Tracking, Bayan & Assembly Speeches, Multilingual Translation, Document Summaries, and Event Posters).
     * Respond in the user's language (Tamil if greeted in Tamil/Tanglish, Arabic if Arabic, English if English).
`;

export const UNIVERSAL_AI_INSTRUCTIONS = getUniversalAiInstructions();

/**
 * Natural language target-language detection & instruction stripper.
 * Detects Tanglish, English, Tamil, and Arabic inline prompts (e.g. "english la tha", "in english", "tamilil", "arabic la")
 * so the output strictly matches the user's intent without translating the meta-instruction itself.
 */
export function detectAndStripLanguageInstruction(text, defaultTarget = 'English') {
  let cleanedText = String(text || '').trim();
  let detectedTarget = null;

  // Patterns for English requests:
  const englishPatterns = [
    /^(?:please\s+)?(?:translate\s+(?:this\s+)?(?:in|into|to)\s+english\s*[:,-]?\s*)/i,
    /^(?:english\s+la\s*(?:tha|thanga|podunga|podu|venum|kudunga)?\s*[:,-]?\s*)/i,
    /^(?:in\s+english\s*[:,-]?\s*)/i,
    /^(?:englishil\s*[:,-]?\s*)/i,
    /(?:\s*[:,-]?\s*(?:in\s+english|english\s+la\s*(?:tha|thanga|podunga|podu|venum|kudunga)?|translate\s+(?:to|into)\s+english|englishil))$/i,
  ];

  // Patterns for Tamil requests:
  const tamilPatterns = [
    /^(?:please\s+)?(?:translate\s+(?:this\s+)?(?:in|into|to)\s+tamil\s*[:,-]?\s*)/i,
    /^(?:tamil\s+la\s*(?:tha|thanga|podunga|podu|venum|kudunga)?\s*[:,-]?\s*)/i,
    /^(?:in\s+tamil\s*[:,-]?\s*)/i,
    /^(?:tamilil\s*[:,-]?\s*)/i,
    /(?:\s*[:,-]?\s*(?:in\s+tamil|tamil\s+la\s*(?:tha|thanga|podunga|podu|venum|kudunga)?|translate\s+(?:to|into)\s+tamil|tamilil))$/i,
  ];

  // Patterns for Arabic requests:
  const arabicPatterns = [
    /^(?:please\s+)?(?:translate\s+(?:this\s+)?(?:in|into|to)\s+arabic\s*[:,-]?\s*)/i,
    /^(?:arabic\s+la\s*(?:tha|thanga|podunga|podu|venum|kudunga)?\s*[:,-]?\s*)/i,
    /^(?:in\s+arabic\s*[:,-]?\s*)/i,
    /^(?:arabiyil\s*[:,-]?\s*)/i,
    /(?:\s*[:,-]?\s*(?:in\s+arabic|arabic\s+la\s*(?:tha|thanga|podunga|podu|venum|kudunga)?|translate\s+(?:to|into)\s+arabic|arabiyil))$/i,
  ];

  // Patterns for Bilingual requests:
  const bilingualPatterns = [
    /^(?:please\s+)?(?:translate\s+(?:this\s+)?(?:in|into|to)\s+bilingual\s*[:,-]?\s*)/i,
    /^(?:bilingual\s*(?:la)?\s*[:,-]?\s*)/i,
    /^(?:in\s+bilingual\s*[:,-]?\s*)/i,
    /(?:\s*[:,-]?\s*(?:in\s+bilingual|bilingual\s*(?:la)?|tamil\s+(?:and|&)\s+english))$/i,
  ];

  for (const pat of englishPatterns) {
    if (pat.test(cleanedText)) {
      detectedTarget = 'English';
      cleanedText = cleanedText.replace(pat, '').trim();
      break;
    }
  }

  if (!detectedTarget) {
    for (const pat of tamilPatterns) {
      if (pat.test(cleanedText)) {
        detectedTarget = 'Tamil';
        cleanedText = cleanedText.replace(pat, '').trim();
        break;
      }
    }
  }

  if (!detectedTarget) {
    for (const pat of arabicPatterns) {
      if (pat.test(cleanedText)) {
        detectedTarget = 'Arabic';
        cleanedText = cleanedText.replace(pat, '').trim();
        break;
      }
    }
  }

  if (!detectedTarget) {
    for (const pat of bilingualPatterns) {
      if (pat.test(cleanedText)) {
        detectedTarget = 'Bilingual (Tamil + English)';
        cleanedText = cleanedText.replace(pat, '').trim();
        break;
      }
    }
  }

  // Normalize defaultTarget if detectedTarget wasn't found
  let finalTarget = detectedTarget;
  if (!finalTarget) {
    const raw = String(defaultTarget || '').toLowerCase();
    if (raw.includes('arab') || raw === 'ar') finalTarget = 'Arabic';
    else if (raw.includes('tamil') || raw === 'ta') finalTarget = 'Tamil';
    else if (raw.includes('bilingual')) finalTarget = 'Bilingual (Tamil + English)';
    else finalTarget = 'English';
  }

  if (!cleanedText && text) {
    cleanedText = String(text).trim();
  }

  return {
    cleanedText,
    targetLanguage: finalTarget,
  };
}

/**
 * Feature 1: Zero-Storage PDF Exam Paper & Answer Key Generator
 */
export async function generateExamPaper({
  pdfBuffer,
  pastedText = '',
  topic = '',
  subject = 'Islamic Studies',
  gradeLevel = 'General',
  language = 'English',
  madrasaName = 'Madrasa',
  examTitle = 'Term Examination',
  durationMinutes = 60,
  totalMarks = 50,
  mcqCount = 5,
  shortCount = 4,
  essayCount = 2,
}) {
  let syllabusContent = pastedText.trim();

  // Parse PDF in RAM only
  if (pdfBuffer && Buffer.isBuffer(pdfBuffer) && pdfBuffer.length > 0) {
    const extracted = await extractTextFromPdfBuffer(pdfBuffer);
    if (extracted) {
      syllabusContent = extracted.slice(0, 8000) + (syllabusContent ? `\n\n${syllabusContent}` : '');
    }
  }

  if (!syllabusContent && !topic && !pdfBuffer) {
    throw new BadRequestError('Please provide a syllabus PDF, pasted notes, or a specific topic to generate the exam paper.');
  }

  if (!syllabusContent && pdfBuffer) {
    syllabusContent = 'Syllabus content is provided in the attached PDF document.';
  }

  const { cleanedText: cleanTopic, targetLanguage: resolvedLanguage } = detectAndStripLanguageInstruction(topic, language);

  const prompt = `
You are an expert Islamic curriculum exam paper designer for Madrasa education.
Generate a structured, authentic, comprehensive examination paper and complete answer key based strictly on the provided input:

[EXAM METADATA]
- Madrasa: ${madrasaName}
- Title: ${examTitle}
- Subject: ${subject}
- Grade / Level: ${gradeLevel}
- Total Marks: ${totalMarks}
- Time Allowed: ${durationMinutes} Minutes
- Topic / Focus: ${cleanTopic || topic || 'Covered Syllabus Topics'}
- Target Output Language: ${resolvedLanguage} (Ensure all questions, instructions, and answers are provided in ${resolvedLanguage}. If "Bilingual" or "Tamil" or "Arabic", provide natural, accurate phrasing with proper terminology).

[CLEAN TOPIC EXTRACTION & TANGLISH RULE]
- Extract the clean, formal Islamic subject matter from "${cleanTopic || topic}".
- NEVER echo colloquial Tanglish words (e.g. "wudu eppadi seirathu", "zakat kanakku") into the exam header, questions, or answer keys. Use formal scholarly titles (e.g. "வுளூவின் சட்டதிட்டங்கள் / Fiqh of Taharah: Rules of Wudu").
- If target language is Tamil: Provide natural, grammatically sound Tamil with authentic Islamic terms (வுளூ, தொழுகை, ஜகாத், திருக்குர்ஆன், ஸஹீஹ் ஹதீஸ்).
- Ensure 100% accurate Quranic references and Hadith citations.

[SPECIFIC STRUCTURE REQUIRED]
1. EXAM HEADER: Clean centered layout with Madrasa Name, Subject, Grade, Marks, Time, and Student Name & Index No blanks.
2. SECTION A — MULTIPLE CHOICE QUESTIONS (${mcqCount} Questions, 2 marks each):
   - Numbered 1 to ${mcqCount}.
   - Clear question stem followed by 4 options labeled (A), (B), (C), (D).
3. SECTION B — SHORT ANSWER QUESTIONS (${shortCount} Questions, 5 marks each):
   - Clear, focused questions assessing comprehension, Quranic/Hadith references, and Islamic manners/rulings.
4. SECTION C — STRUCTURED / ESSAY QUESTIONS (${essayCount} Questions, 10 marks each):
   - Detailed scenario-based or explanatory questions.
5. COMPLETE ANSWER KEY & MARKING SCHEME:
   - Complete section at the end clearly separated with "---".
   - Answers for all Section A MCQs with correct letter and explanation.
   - Model answers and key mark-allocation points for Section B and Section C.

[SOURCE SYLLABUS / CONTENT]
${syllabusContent ? syllabusContent.slice(0, 7000) : (cleanTopic || topic)}

Format the output in clean, professional GitHub-flavored Markdown ready for display, copying, and clean A4 print/PDF generation.
`;

  const currentDateStr = new Date().toDateString();
  const systemPrompt = `You are MadrasaNexa Smart AI Assistant, a specialized Islamic educational copilot for Madrasa administrators and Ustadhs. Output accurate, structured exam papers formatted in professional Markdown with rigorous Islamic accuracy and exact requested language.
Current Date: ${currentDateStr}.

${getUniversalAiInstructions()}`;

  const { text: examContent } = await generateAiText({
    prompt,
    systemPrompt,
    pdfBuffer,
    temperature: 0.25,
    maxTokens: 8192,
  });

  return {
    examContent,
    language: resolvedLanguage,
    subject,
    topic: cleanTopic || topic,
  };
}

/**
 * Feature 2: Ustadh 30-Min Lesson Planner
 */
export async function generateLessonPlan({
  pdfBuffer,
  pastedText = '',
  topic = '',
  subject = 'Islamic Studies',
  gradeLevel = 'Elementary / Intermediate',
  durationMinutes = 30,
  language = 'English',
}) {
  let content = pastedText.trim();

  // Parse in-memory
  if (pdfBuffer && Buffer.isBuffer(pdfBuffer) && pdfBuffer.length > 0) {
    const extracted = await extractTextFromPdfBuffer(pdfBuffer);
    if (extracted) {
      content = extracted.slice(0, 8000) + (content ? `\n\n${content}` : '');
    }
  }

  if (!content && !topic && !pdfBuffer) {
    throw new BadRequestError('Please provide a lesson topic or upload a syllabus reference.');
  }

  if (!content && pdfBuffer) {
    content = 'Lesson source content is provided in the attached PDF document.';
  }

  const { cleanedText: cleanTopic, targetLanguage: resolvedLanguage } = detectAndStripLanguageInstruction(topic, language);

  const prompt = `
You are a senior Madrasa Head Ustadh and pedagogical mentor.
Create a structured, highly engaging ${durationMinutes}-Minute Islamic Lesson Plan designed for real Madrasa classroom teaching.

[LESSON PARAMETERS]
- Subject: ${subject}
- Grade / Age Group: ${gradeLevel}
- Input Topic / Request: ${cleanTopic || topic || 'Syllabus Topic'}
- Duration: ${durationMinutes} Minutes
- Target Output Language: ${resolvedLanguage}

[CLEAN TOPIC EXTRACTION & TANGLISH RULE]
- Extract the clean, formal Islamic subject matter from "${cleanTopic || topic}".
- For example: if user inputs Tanglish "wudu eppadi seirathu", the formal lesson topic MUST be "வுளூவின் முக்கியத்துவமும் அதன் சட்டதிட்டங்களும் செய்முறையும் (Fiqh of Purification: Method and Rulings of Wudu)".
- NEVER echo colloquial Tanglish words into the lesson overview, objectives, blackboard layout, or headings!
- Ensure complete Fiqh accuracy (e.g. all obligatory pillars and sunnahs of Wudu/Salah) and authentic Hadith citations.

[REQUIRED SECTIONS]
1. LESSON OVERVIEW & OBJECTIVES:
   - Cognitive Objectives (What the student will know/understand)
   - Spiritual & Behavioral Objectives (Adab / Akhlaq application)
   - Quranic & Hadith References (with Arabic text and translation)
   - Required Classroom Materials (Blackboard/Whiteboard, Flashcards, Mushaf)

2. STEP-BY-STEP TIMED TEACHING FLOW:
   - 00:00 - 00:05 (5 mins) | STARTER & HOOK: Inspiring question, short story, or real-life dilemma to capture attention.
   - 00:05 - 00:20 (15 mins) | CORE EXPLANATION: Direct instruction of key concepts, examples, analogies, and student checks.
   - 00:20 - 00:27 (7 mins) | GUIDED & ACTIVE LEARNING: Pair activity, student board recitation, or quick mini-quiz.
   - 00:27 - 00:30 (3 mins) | PLENARY & ASSESSMENT: Wrap-up synthesis, cold-call check for understanding, closing dua.

3. BLACKBOARD / WHITEBOARD SUMMARY LAYOUT:
   - A visual ASCII/text box representation of what the Ustadh should write on the blackboard during the lesson for students to copy into their notebooks.

4. HOMEWORK & DAILY SUNNAH REFLECTION:
   - Practical take-home task and one daily Sunnah practice related to the topic.

[SOURCE MATERIALS]
${content ? content.slice(0, 6000) : (cleanTopic || topic)}

Format the response in structured, beautifully formatted Markdown with bullet points, time badges, and clear headings in ${resolvedLanguage}.
`;

  const currentDateStr = new Date().toDateString();
  const systemPrompt = `You are MadrasaNexa Ustadh Copilot. Provide practical, inspiring, classroom-tested 30-minute lesson plans with authentic Islamic scholarship and high pedagogical structure in the requested language.
Current Date: ${currentDateStr}.

${getUniversalAiInstructions()}`;

  const { text: lessonPlan } = await generateAiText({
    prompt,
    systemPrompt,
    pdfBuffer,
    temperature: 0.3,
    maxTokens: 8192,
  });

  return {
    lessonPlan,
    language: resolvedLanguage,
    subject,
    topic: cleanTopic || topic,
  };
}

/**
 * Feature 3: Madrasa Event Poster & Flyer Generator
 * 1-Click Gemini-Style Direct Poster Generator:
 * 1. Uses Llama 3.3 70B to parse natural prompt (English, Tamil, Arabic, Tanglish) into structured metadata (headline, subtitle, dateLine, venueLine, category) + ultra-rich Flux prompt.
 * 2. Generates background image via Cloudflare Workers AI (Flux 1 Schnell with SDXL fallback).
 * Returns directly as base64 data URL. 0 MB saved to disk or R2.
 */
export async function generatePoster({
  title,
  prompt: userPromptInput = '',
  themePrompt = '',
  category = 'Event',
  dateText = '',
  venue = '',
  madrasaName = '',
  language = 'English',
}) {
  const rawPrompt = (userPromptInput || title || '').trim();
  if (!rawPrompt) {
    throw new BadRequestError('Poster description or title is required.');
  }

  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const token = env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !token) {
    throw new Error('Cloudflare Workers AI credentials are not configured.');
  }

  // 1. Use Llama 3.3 70B to extract clean structured JSON + craft an ultra-rich Flux graphic art prompt
  const resolvedMadrasaName = madrasaName || 'MadrasaNexa Islamic Academy';
  let structured = {
    headline: rawPrompt.replace(/^(?:i\s+need\s+(?:a\s+)?poster\s+(?:for\s+)?|poster\s+(?:for\s+)?|make\s+(?:a\s+)?poster\s+(?:for\s+)?)/i, '').trim().toUpperCase() || 'ISLAMIC CEREMONY & EVENT',
    subtitle: 'Sacred Reflections, Qur\'anic Recitation & Community Blessings',
    dateLine: dateText || '',
    venueLine: venue || resolvedMadrasaName,
    category: category || 'Islamic Event',
    fluxPrompt: '',
  };

  try {
    const analysisPrompt = `
You are a master Islamic graphic designer and event art director.
Analyze this user's natural event poster request (in English, Tamil, Arabic, or Tanglish):
User Prompt: "${rawPrompt}"
${themePrompt ? `Custom Theme: "${themePrompt}"` : ''}
Madrasa Name: "${resolvedMadrasaName}"
Target Output Language: "${language || 'English'}"

Your task:
1. "headline": Bold, inspiring, dignified event title (e.g. "RAMADAN MUBARAK", "ANNUAL HIFZ CONVOCATION 2026", "ரமழான் முபாரக்", "حفل تكريم حفظة القرآن الكريم"). STRICT PROHIBITION: NEVER echo conversational words like "i need poster for...", "poster venum", "make a poster".
2. "subtitle": Concise, poetic 1-line event tagline (e.g. "Sacred Reflections, Qur'an Recitation & Community Iftar").
3. "dateLine": Extract date and time ONLY if explicitly mentioned in the user's prompt (e.g. "Friday, 15th Ramadan • 7:30 PM"). If NO date is mentioned, return an empty string "" — NEVER invent a fake date.
4. "venueLine": Extract venue ONLY if explicitly mentioned, otherwise return "${resolvedMadrasaName}".
5. "category": Event category (e.g. "Spiritual Gathering", "Hifz Convocation", "Community Event", "Eid Celebration").
6. "fluxPrompt": Ultra-detailed graphic design prompt for @cf/black-forest-labs/flux-1-schnell:
   - Describe a luminous, richly illustrated, ornate Islamic poster background.
   - Ornate emerald green, royal navy and polished gold Andalusian / Mughal horseshoe archway.
   - Glowing golden crescent moon in night sky, intricate hanging brass fanoos lanterns casting warm golden lighting rays and specular glows.
   - Central open soft copy-safe space for typography overlay.
   - Deep rich emerald and sapphire color palette, starry night ambient lighting, ultra-detailed 8k vector finish.
   - STRICT PROHIBITION: strictly NO text, NO letters, NO words, NO typography, NO watermarks, NO calligraphy.

Return ONLY a valid JSON object matching this schema without any markdown formatting or surrounding text:
{
  "headline": "Bold Event Headline",
  "subtitle": "Concise 1-Line Tagline",
  "dateLine": "",
  "venueLine": "${resolvedMadrasaName}",
  "category": "Islamic Event",
  "fluxPrompt": "Ultra-detailed visual prompt..."
}
`;

    const { text: llamaRes } = await generateAiText({
      prompt: analysisPrompt,
      systemPrompt: 'You are a professional Islamic art director. You extract structured event poster metadata and craft vivid visual prompts. Output strictly valid JSON.',
      temperature: 0.2,
      maxTokens: 1024,
    });

    if (llamaRes) {
      const jsonMatch = llamaRes.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.headline) structured.headline = parsed.headline.trim();
        if (parsed.subtitle) structured.subtitle = parsed.subtitle.trim();
        if (parsed.dateLine !== undefined) structured.dateLine = parsed.dateLine ? parsed.dateLine.trim() : '';
        if (parsed.venueLine !== undefined) structured.venueLine = parsed.venueLine ? parsed.venueLine.trim() : '';
        if (parsed.category) structured.category = parsed.category.trim();
        if (parsed.fluxPrompt) structured.fluxPrompt = parsed.fluxPrompt.trim();
      }
    }
  } catch (err) {
    console.warn('Llama event extraction failed, falling back to default structured metadata:', err.message);
  }

  // 2. Construct final clean textless Islamic background visual prompt
  const visualPrompt = structured.fluxPrompt || [
    'Clean textless ornate Islamic event background poster artwork',
    'Luxurious emerald green, royal navy and gold Islamic geometric border frame',
    'Grand architectural Islamic horseshoe archway and intricate arabesque filigree',
    'Glowing golden crescent moon in night sky with warm hanging brass fanoos lanterns',
    'Open soft central copy-safe space for typography overlay',
    'Subtle ambient mosque minaret silhouettes in distant background, majestic spiritual lighting, soft specular golden glows',
    themePrompt ? `Custom style: ${themePrompt}` : 'High-end Islamic cultural aesthetics, ultra-detailed 8k vector finish, symmetrical composition',
    'STRICTLY NO TEXT, NO LETTERS, NO TYPOGRAPHY, NO WORDS, NO WATERMARKS, NO CALLIGRAPHY, text-free background template',
  ]
    .filter(Boolean)
    .join(', ');

  // 3. Call Flux 1 Schnell
  let base64Image = null;
  let modelUsed = '@cf/black-forest-labs/flux-1-schnell';

  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/black-forest-labs/flux-1-schnell`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: visualPrompt,
        width: 1024,
        height: 1280,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.result?.image) {
        base64Image = `data:image/jpeg;base64,${data.result.image}`;
      }
    } else {
      console.warn('Flux 1 Schnell image generation failed:', await res.text());
    }
  } catch (err) {
    console.warn('Flux 1 Schnell error:', err.message);
  }

  // 4. Fallback to SDXL if Flux did not return image
  if (!base64Image) {
    modelUsed = '@cf/stabilityai/stable-diffusion-xl-base-1.0';
    try {
      const fallbackRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/stabilityai/stable-diffusion-xl-base-1.0`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: visualPrompt,
          width: 1024,
          height: 1024,
        }),
      });

      if (fallbackRes.ok) {
        const contentType = fallbackRes.headers.get('content-type') || '';
        if (contentType.includes('image')) {
          const arrayBuffer = await fallbackRes.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString('base64');
          base64Image = `data:${contentType};base64,${base64}`;
        } else {
          const data = await fallbackRes.json();
          if (data?.result?.image) {
            base64Image = `data:image/jpeg;base64,${data.result.image}`;
          }
        }
      }
    } catch (err) {
      console.warn('SDXL fallback error:', err.message);
    }
  }

  // If both Cloudflare image endpoints fail, base64Image is null.
  // The frontend PosterCanvasRenderer will render the rich procedural Islamic arch & crescent fallback.

  return {
    imageDataUrl: base64Image || '',
    backgroundDataUrl: base64Image || '',
    modelUsed: base64Image ? modelUsed : 'procedural-islamic-canvas',
    title: structured.headline,
    eventTitle: structured.headline,
    headline: structured.headline,
    subtitle: structured.subtitle,
    category: structured.category || category || 'Islamic Event',
    dateText: structured.dateLine || dateText || '',
    dateLine: structured.dateLine || dateText || '',
    dateTime: structured.dateLine || dateText || '',
    venue: structured.venueLine || venue || resolvedMadrasaName,
    venueLine: structured.venueLine || venue || resolvedMadrasaName,
    madrasaName: resolvedMadrasaName,
    bismillahLine: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
    language: language || 'English',
  };
}

/**
 * Feature 4: Multilingual Translator (Tamil ↔ English ↔ Arabic ↔ Bilingual)
 */
export async function translateContent({
  text,
  sourceLanguage = 'Auto-Detect',
  targetLanguage = 'English',
  language,
}) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new BadRequestError('Text to translate is required.');
  }

  const requestedTarget = targetLanguage || language || 'English';
  const { cleanedText, targetLanguage: resolvedTarget } = detectAndStripLanguageInstruction(text, requestedTarget);

  const prompt = `
You are a master Islamic educational translator specializing in Madrasa circulars, student parent notices, curriculum texts, and Arabic/Tamil/English correspondence.
Translate the following source text into ${resolvedTarget}.

[MANDATORY OUTPUT LANGUAGE RULE]
- OUTPUT STRICTLY IN ${resolvedTarget.toUpperCase()}: The translation MUST be 100% in ${resolvedTarget}.
- If translating to English: Output natural, elegant, grammatically flawless English prose.
- If translating to Tamil: Output natural, clear Sri Lankan/Indian Muslim Tamil vocabulary commonly used in Madrasas with authentic Islamic terminology.
- If translating to Arabic: Output fluent, authentic Modern Standard Arabic (Fusha) with standard Islamic honorifics.
- If translating to Bilingual: Output clear paragraph-by-paragraph or side-by-side Tamil and English translations.

[CONTENT & FORMATTING RULES]
1. Universal Tanglish Comprehension: If the source text contains conversational Tamil written in English letters (Tanglish), mentally decode the genuine Tamil meaning first, then translate into ${resolvedTarget}.
2. Never echo or phonetically transliterate colloquial Tanglish words into the translated output.
3. Maintain authentic Islamic terminology (e.g. Du'a, Hadith, Salah, Ustadh, Madrasa, Jalsa, Sunnah, Adab, Akhlaq) with respectful accuracy.
4. Preserve original formatting, bullet points, numbers, and dates intact.
5. Provide ONLY the translated text without conversational preamble, greetings, or meta-disclaimers.

[SOURCE TEXT]
${cleanedText}
`;

  const currentDateStr = new Date().toDateString();
  const systemPrompt = `You are a certified Islamic multilingual translator. Output strictly the clean, high-fidelity translation in ${resolvedTarget}.
Current Date: ${currentDateStr}.

${getUniversalAiInstructions()}`;

  const { text: translatedText } = await generateAiText({
    prompt,
    systemPrompt,
    temperature: 0.1,
    maxTokens: 8192,
  });

  return {
    translatedText,
    sourceLanguage,
    targetLanguage: resolvedTarget,
  };
}

/**
 * Feature: Conversational Copilot Chat (Multi-Turn Chat with RAM-Only Context & Dedicated Mode Routing)
 */
export async function chatWithCopilot({
  message,
  history = [],
  language = 'English',
  pdfBuffer = null,
  pastedText = '',
  madrasaName = 'Madrasa',
  role = 'Staff',
  mode = 'auto',
}) {
  const cleanMessage = (message || '').trim();
  if (!cleanMessage && !pdfBuffer && !pastedText) {
    throw new BadRequestError('Message or attachment is required.');
  }

  let pdfContext = pastedText.trim();
  if (pdfBuffer && Buffer.isBuffer(pdfBuffer) && pdfBuffer.length > 0) {
    const extracted = await extractTextFromPdfBuffer(pdfBuffer);
    if (extracted) {
      pdfContext = extracted.slice(0, 8000) + (pdfContext ? `\n\n${pdfContext}` : '');
    }
  }

  // Detect explicit target language instructions in prompt (e.g. "tamil la tha", "in english", "arabic la")
  const { cleanedText: userPrompt, targetLanguage: resolvedLanguage } = detectAndStripLanguageInstruction(cleanMessage, language);

  // Detect if user is specifically requesting a parent notice / circular
  const NOTICE_INTENT_REGEX = /\b(?:notic|notice|circular|parent\s+notice|parent\s+circular|leave\s+notice|holiday\s+notice|announcement)\b/i;
  const isNoticeRequest = mode === 'circular' || NOTICE_INTENT_REGEX.test(cleanMessage);
  const activeMode = isNoticeRequest ? 'circular' : mode;

  const isGenericNotice = /^(?:i\s+need\s+notic(?:e)?|notic(?:e)?|parent\s+circular|parent\s+notic(?:e)?|circular|write\s+a\s+notic(?:e)?|make\s+a\s+notic(?:e)?|notic(?:e)?\s+onnu|circular\s+venum|leave\s+notic(?:e)?|circular\s+onnu|need\s+a\s+notic(?:e)?)[\s!.,?]*$/i.test(cleanMessage);

  // Mode-specific behavioral instructions to guarantee authentic output format
  let modeInstructions = '';

  if (activeMode === 'circular') {
    modeInstructions = `
[SPECIFIC TASK: OFFICIAL MADRASA PARENT CIRCULAR & NOTICE]
You are drafting an official, ready-to-issue Madrasa Parent Notice / Circular for ${madrasaName || 'MadrasaNexa Islamic Academy'}.

STRICT INSTITUTIONAL GUARDRAILS:
1. NEVER output a generic fill-in-the-blank meta-template with bracketed placeholders like "[NAME OF THE ORGANIZATION]", "[LOCATION / CITY]", "[Your Signature]".
2. NEVER output non-Islamic or secular school/office examples (such as "St. Xavier's High School", "Tarang 2026", "ABC Tech Solutions Pvt Ltd", "Rohan Sharma", "Priya Nair", etc.)!
3. NEVER ask the user clarifying questions before providing a notice.

${isGenericNotice ? `
[CRITICAL INSTRUCTION FOR OPEN-ENDED NOTICE REQUEST ("${cleanMessage}")]
The user requested an Official Madrasa Notice / Circular without specifying a custom topic.
YOU MUST IMMEDIATELY OUTPUT A COMPLETE, ELEGANT, READY-TO-PRINT OFFICIAL MADRASA PARENT NOTICE ON A HIGH-PRIORITY MADRASA OCCASION (Upcoming Term Examinations & Special Revision Schedule):
- Full Islamic Header:
  * Institution Name: "${madrasaName || 'MadrasaNexa Islamic Academy'}"
  * "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ"
  * Date: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
  * Ref: MNX/CIR/${new Date().getFullYear()}/042
- Formal Islamic Salutation:
  * "Assalamu Alaikum wa Rahmatullahi wa Barakatuh"
  * "Respected Parents and Guardians,"
- Clear, Dignified Subject:
  * "**SUBJECT: IMPORTANT NOTICE — UPCOMING TERM EXAMINATIONS & REVISED ACADEMIC SCHEDULE**"
- Circular Body:
  * Warm opening thanking parents for their continuous dedication to their children's Islamic education.
  * Clear exam schedule, reporting timings, examination duration, and subjects covered (Hifz Revision, Tajweed, Islamic Studies, Arabic).
  * Bullet points for student preparation and parent responsibilities (punctual attendance, completing revision homework, maintaining Islamic Adab and dress code).
- Closing:
  * Heartfelt Du'a for the students and their families: "May Allah ﷻ grant our beloved students beneficial knowledge, success in this world and the Aakhirah, and make them the coolness of our eyes. Ameen."
  * "JazakAllahu Khairan wa BarakAllahu Feekum,"
  * Sign-off: "Principal / Examination Committee, ${madrasaName || 'MadrasaNexa Islamic Academy'}"
- Conclude with a helpful 1-line note:
  "💡 *Tip: If you would like a notice tailored to a different event (such as a Madrasa Holiday/Leave, Ramadan/Eid Schedule, Fee Reminder, or Jalsa Prize Day), simply reply with the topic and I will generate it immediately!*"
` : `
CLEAN NOTICE TOPIC EXTRACTION:
- Mentally decode the user's Tanglish/English/Tamil request (e.g., if user writes "naalaikku madrasa leave notice onnu ezhuthu", extract the formal subject "மத்ரஸா விடுமுறை அறிவிப்பு / NOTICE OF SPECIAL MADRASA LEAVE").
- NEVER echo raw colloquial Tanglish words into the notice header or subject line!
STRUCTURE & LAYOUT:
1. HEADER:
   - Institution Name: "${madrasaName || 'MadrasaNexa Islamic Academy'}"
   - "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ"
   - Date & Ref Number: (Use current Islamic / Gregorian date format)
2. SALUTATION:
   - "Assalamu Alaikum wa Rahmatullahi wa Barakatuh"
   - "Respected Parents and Guardians,"
3. NOTICE SUBJECT:
   - Bold, clear formal subject line (e.g., "**SUBJECT: IMPORTANT ANNOUNCEMENT — [FORMAL TOPIC]**")
4. CIRCULAR BODY:
   - Warm introductory opening thanking parents for their continuous support.
   - Clear announcement paragraphs highlighting dates, revised timings, fee deadlines, or holiday schedules.
   - Bullet points for key instructions and parent responsibilities.
5. CLOSING:
   - Heartfelt Du'a for the students and families ("May Allah ﷻ bless our children with beneficial knowledge...").
   - "JazakAllahu Khairan wa BarakAllahu Feekum,"
   - Official Sign-off: "Principal / Madrasa Administration, ${madrasaName || 'MadrasaNexa Islamic Academy'}"
`}
Format strictly in clean, professional Markdown in ${resolvedLanguage} (if Tamil: formal dignified Tamil with authentic Islamic terms; if English: elegant English; if Arabic: authentic Arabic).`;
  } else if (mode === 'summarizer') {
    modeInstructions = `
[SPECIFIC TASK: EXECUTIVE DOCUMENT & CHAPTER REVISION SUMMARY]
Extract a thorough, structured, and easy-to-revise Executive Summary from the provided document or text.
CLEAN SUMMARY TITLE EXTRACTION:
- Extract a formal, scholarly title for the summary (e.g., if user writes "indha pdf-a surukki sollu", synthesize a proper scholarly title for the document).
- NEVER echo raw colloquial Tanglish words into headers or bullet points.
STRUCTURE & LAYOUT:
1. 📌 DOCUMENT OVERVIEW: High-level executive synthesis of the chapter, syllabus text, or document in 2-3 concise paragraphs.
2. 🔑 KEY POINTS & CORE CONCEPTS: Exhaustive, bulleted breakdown of all major principles, rulings, historical milestones, or lessons.
3. 📖 IMPORTANT TERMS & SCRIPTURAL PROOFS: Concise glossary of key Islamic terminology, Quranic Ayahs, and Hadith citations with translations.
4. 📝 QUICK REVISION TAKEAWAYS: High-yield bullet points for students and teachers to memorize or review before examinations.
5. 💡 USTADH PEDAGOGICAL TIPS: 2-3 practical tips on how to teach or explain this topic effectively in the classroom.
CRITICAL: Do NOT generate a lesson plan or exam paper. This must be an executive revision summary in ${resolvedLanguage}.`;
  } else if (mode === 'hifz') {
    modeInstructions = `
[SPECIFIC TASK: HIFZ & TAJWEED ASSESSMENT SHEET]
Generate a complete, structured Hifz & Tajweed Assessment Worksheet.
CLEAN ASSESSMENT TITLE EXTRACTION:
- Provide formal Quranic and Tajweed evaluation titles. Ground all Ayahs and Tajweed rules in authentic scholarship.
STRUCTURE & LAYOUT:
1. HEADER: Madrasa Name, Assessment Title, Surah / Juz Covered, Total Marks: 50 Marks, Duration: 30 Mins.
2. PART A: COMPLETE THE AYAH DRILL (15 Marks):
   - 4-5 Ayah fragments with missing words (indicated by ________) for students to fill in.
3. PART B: MUTASHABIHAT (SIMILAR AYAHS) CHECK (10 Marks):
   - Comparing commonly confused Ayah endings or phrasing across the Surah.
4. PART C: TAJWEED RULE IDENTIFICATION (10 Marks):
   - Identifying Noon Sakinah, Meem Sakinah, Qalqalah, Ghunnah, or Madd rules from specific words in the text.
5. PART D: USTADH ORAL RECITATION EVALUATION RUBRIC (15 Marks):
   - Grading matrix: Hifz Accuracy (6 Marks), Tajweed & Makharij (5 Marks), Fluency & Waqf/Ibtida (4 Marks).
6. COMPLETE ANSWER KEY:
   - Separated by "---", provide full answers for Part A, B, and C.
Format clearly in professional Markdown in ${resolvedLanguage}.`;
  } else if (mode === 'speech') {
    modeInstructions = `
[SPECIFIC TASK: ISLAMIC SPEECH / BAYAN SCRIPT]
Write an inspiring, spiritually uplifting, ready-to-deliver 5-minute Madrasa Morning Assembly Speech or Jalsa Bayan.
CLEAN SPEECH TITLE EXTRACTION:
- Synthesize a formal, inspiring title (e.g., if user writes "ramadan paththi bayan speech thaa", title the speech "ரமழானின் மகத்துவமும் அதன் ஆத்மீக வழிகாட்டல்களும் / The Spiritual Virtues and Blessings of Ramadan").
- NEVER echo colloquial Tanglish phrases into the title or body!
STRUCTURE & LAYOUT:
1. TRADITIONAL ARABIC OPENING (Khutbah al-Hajah):
   - "الحمد لله رب العالمين، والصلاة والسلام على أشرف الأنبياء والمرسلين..." with brief translation.
2. WELCOME & ENGAGING HOOK:
   - Warm greeting to Ustadhs, parents, and fellow students, followed by a thought-provoking real-life question or relatable story.
3. CORE THEME & 3 KEY LESSONS:
   - Point 1 grounded with Quranic Ayah proof (Arabic text + translation).
   - Point 2 grounded with Sahih Hadith proof (Arabic text + translation).
   - Point 3 with practical everyday application in Madrasa and at home.
4. SPIRITUAL CALL TO ACTION:
   - One actionable habit or Sunnah students can adopt starting today.
5. CLOSING DU'A:
   - Heartfelt Arabic Du'a with translation for parents, teachers, Madrasa, and the Ummah.
Format in clean, orator-friendly Markdown in ${resolvedLanguage}.`;
  } else {
    // Mode is 'auto'
    modeInstructions = `
[SPECIFIC TASK: UNIVERSAL CONVERSATIONAL MADRASA COPILOT]
1. WARM & NATURAL INTERACTION:
   - For greetings ("hi", "hello", "assalamu alaikum", "vanakkam"), reply warmly with an authentic Islamic greeting (e.g. "Wa Alaikum Assalam wa Rahmatullahi wa Barakatuh"), introduce yourself as the MadrasaNexa Smart AI Assistant, and highlight your 8 core capabilities.
   - For general questions (e.g., "wudu eppadi seirathu", "zakat kanakku eppadi podurathu", "islamiya sattam paththi sollu"): Provide a comprehensive, structured, educational response directly. NEVER prematurely return an unrelated template or refuse to answer!
2. COMPLETE SCHOLARLY FIQH STEPS:
   - When asked about acts of worship (Wudu, Ghusl, Salah, Zakat, Sawm, Hajj):
     * Always outline the complete obligatory conditions and pillars (Fara'idh/Arkan) step-by-step.
     * Explain practical methods clearly with authentic Quranic & Hadith references.
     * Include the Sunnah Du'as with Arabic text, transliteration, and Tamil/English meaning.
3. AUTHENTIC ISLAMIC TERMINOLOGY:
   - When responding in Tamil: Write in natural, grammatically correct, scholarly Tamil using standard Islamic terminology (வுளூ, தொழுகை, ஜகாத், ஷரீஆ, ஃபிக்ஹ், திருக்குர்ஆன், ஸஹீஹ் ஹதீஸ், ஸுன்னத்).
   - NEVER copy-paste or transliterate Tanglish words into headings or sentences.
4. ZERO LIVE DATABASE EXPOSURE: Maintain complete privacy in RAM memory.`;
  }

  const GREETING_REGEX = /^(?:assalamu?\s*alaikum(?:\s*wa\s*rahmatullahi(?:\s*wa\s*barakatuh)?)?|salam(?:\s*alaikum)?|slm|hi|hello|hey|vanakkam|marhaban|ahlan|hola)[\s!.,?]*$/i;
  const isSingleGreeting = GREETING_REGEX.test(cleanMessage) && (!history || history.length <= 1) && !pdfBuffer && !pastedText;

  if (isSingleGreeting) {
    modeInstructions += `
[CRITICAL INSTRUCTION FOR GREETING PROMPT]
The user just sent a greeting ("${cleanMessage}").
STRICT PROHIBITION: NEVER output a robotic 1-word or 1-sentence reply like "Wa Alaikumussalam" or "Hello"!
YOU MUST PROVIDE A COMPREHENSIVE, WARM, DIGNIFIED GREETING AND FULL ONBOARDING:
1. Warm Islamic Salutation with honorifics: "وَعَلَيْكُمُ السَّلَامُ وَرَحْمَةُ اللهِ وَبَرَكَاتُهُ" and English/Tamil transliteration.
2. Welcome the user warmly to MadrasaNexa Smart AI Studio, respectfully addressing their role (${role || 'Ustadh / Administrator'}) at ${madrasaName || 'the Madrasa'}.
3. Present an elegant bulleted overview of how you can assist them today:
   - 📄 Zero-Storage Exam & Answer Key Generator (Tamil / English / Arabic / Bilingual)
   - ⏱️ Ustadh 30-Min Lesson Planner & Blackboard Summary
   - 📢 Official Madrasa Parent Circulars & Holiday Notices
   - 📖 Hifz & Tajweed Assessment Worksheet Designer
   - 🎤 Inspiring Madrasa Assembly & Jalsa Bayan Speeches
   - 🌐 3-Language Islamic Circular & Content Translator
   - 📌 Document & Chapter Executive Summarizer
   - 🎨 Madrasa Event Poster & Flyer Maker
4. Conclude with an inspiring, supportive closing inviting them to ask a question or pick an action.
Respond in ${resolvedLanguage} (if Tamil/Tanglish: use beautiful natural Tamil; if English: elegant English; if Arabic: authentic Arabic).`;
  }

  const currentDateStr = new Date().toDateString();
  const systemPrompt = `You are the MadrasaNexa Smart AI Copilot, a warm, polite, highly knowledgeable Islamic Educational & Madrasa Operations Assistant.
Current Date: ${currentDateStr}.
Institution: ${madrasaName || 'Madrasa'}
User Role: ${role || 'Staff'}
Target Output Language: ${resolvedLanguage} (Ensure responses are naturally phrased in ${resolvedLanguage}. If Tamil: use natural Tamil with authentic Islamic terminology; if Arabic: use clear classical Arabic; if Bilingual: provide clear Tamil/Arabic with English explanations).

${getUniversalAiInstructions()}

${modeInstructions}
${pdfContext ? `\n[ATTACHED IN-MEMORY CONTEXT (RAM ONLY)]\n${pdfContext}\n` : ''}`;

  const messages = [{ role: 'system', content: systemPrompt }];

  // Include recent conversation history (last 8 messages)
  if (Array.isArray(history) && history.length > 0) {
    const recent = history.slice(-8);
    for (const h of recent) {
      if (h.sender && h.content) {
        messages.push({
          role: h.sender === 'user' ? 'user' : 'assistant',
          content: String(h.content),
        });
      } else if (h.role && h.content) {
        messages.push({
          role: h.role === 'user' ? 'user' : 'assistant',
          content: String(h.content),
        });
      }
    }
  }

  const isGenericSpeech = activeMode === 'speech' && /^(?:speech|bayan|speech\s+venum|bayan\s+script|bayan\s+speech|i\s+need\s+speech|assembly\s+speech)[\s!.,?]*$/i.test(cleanMessage);

  let finalUserPrompt = userPrompt || cleanMessage || 'Please examine the attached document and provide an overview and key points.';
  if (isGenericNotice) {
    finalUserPrompt = `Please generate an official, ready-to-issue Madrasa Parent Notice / Circular for ${madrasaName || 'our Madrasa'}.`;
  } else if (isGenericSpeech) {
    finalUserPrompt = `Please write an inspiring, ready-to-deliver 5-minute Madrasa Morning Assembly Speech on the Importance of Seeking Beneficial Knowledge and Practicing Noble Islamic Character (Akhlaq).`;
  }

  messages.push({
    role: 'user',
    content: finalUserPrompt,
  });

  const { text, model } = await generateAiText({
    messages,
    pdfBuffer,
    temperature: 0.35,
    maxTokens: 8192,
  });

  return {
    reply: text,
    modelUsed: model,
    language: resolvedLanguage,
    mode,
  };
}
