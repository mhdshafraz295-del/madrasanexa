import crypto from 'crypto';
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

const MAX_RECEIPT_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * Validates in-memory receipt file buffer strictly.
 * Disallows executable headers, HTML, scripts, SVG.
 */
export async function validateAiReceiptBuffer(fileBuffer, originalName = '') {
  if (!fileBuffer || !Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
    throw new BadRequestError('Receipt file is required.');
  }

  if (fileBuffer.length > MAX_RECEIPT_SIZE) {
    throw new BadRequestError('Receipt file must not exceed 5 MB.');
  }

  const nameLower = originalName.toLowerCase().trim();
  const bufferHeader = fileBuffer.slice(0, 100).toString('utf8').toLowerCase();

  // Prohibit SVGs strictly
  if (
    nameLower.endsWith('.svg') ||
    bufferHeader.includes('<svg') ||
    bufferHeader.includes('<?xml')
  ) {
    throw new BadRequestError('SVG files are prohibited for security reasons. Please upload a JPG, PNG, WebP or PDF file.');
  }

  // Reject HTML / Script injection
  if (
    bufferHeader.includes('<html') ||
    bufferHeader.includes('<!doctype') ||
    bufferHeader.includes('<script')
  ) {
    throw new BadRequestError('HTML and executable files are prohibited.');
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

  if (fileBuffer.length >= 4 && fileBuffer.slice(0, 4).toString('ascii') === '%PDF') {
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
  } else {
    throw new BadRequestError('Unsupported file format. Please upload a valid JPG, PNG, WebP image or PDF document.');
  }

  return { ext, mimeType };
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

  const madrasa = await prisma.madrasa.findUnique({
    where: { id: madrasaId },
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
  const isExpired = Boolean(madrasa.aiExpiresAt && new Date(madrasa.aiExpiresAt) < now);
  const effectiveAiEnabled = Boolean(madrasa.aiEnabled && !isExpired);

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
    try {
      resolvedReceiptUrl = await resolveObjectAccessUrl(latestRequest.receiptUrl);
    } catch {
      resolvedReceiptUrl = latestRequest.receiptUrl;
    }
  }

  const settings = await getPlatformAiSettings();

  return {
    madrasaId: madrasa.id,
    madrasaName: madrasa.name,
    madrasaCode: madrasa.code,
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

  // Upload to Cloudflare R2 bucket
  const fileHash = crypto.randomBytes(8).toString('hex');
  const safeRef = transactionRef.trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 20);
  const r2Key = `ai-receipts/${madrasaId}/${Date.now()}_${safeRef}_${fileHash}.${ext}`;

  if (isReceiptsR2Configured()) {
    await uploadReceiptBufferToR2(r2Key, file.buffer, mimeType);
  } else if (isR2Configured()) {
    await uploadBufferToR2(r2Key, file.buffer, mimeType);
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
      let resolvedUrl = null;
      if (req.receiptUrl) {
        try {
          if (isReceiptsR2Configured()) {
            resolvedUrl = await getSecureReceiptDownloadUrl(req.receiptUrl, 3600);
          }
          if (!resolvedUrl) {
            resolvedUrl = await resolveObjectAccessUrl(req.receiptUrl, 3600);
          }
        } catch {
          resolvedUrl = req.receiptUrl;
        }
      }

      return {
        id: req.id,
        madrasaId: req.madrasaId,
        madrasa: req.madrasa,
        submittedByUser: req.submittedByUser,
        planName: req.planName,
        amount: Number(req.amount),
        transactionRef: req.transactionRef,
        receiptKey: req.receiptUrl,
        receiptUrl: resolvedUrl || req.receiptUrl,
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
  const madrasa = await prisma.madrasa.findUnique({
    where: { id: madrasaId },
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
    // If disabling, keep or clear expiry
    if (expiresAt === null) {
      newExpiry = null;
    }
  }

  const updated = await prisma.madrasa.update({
    where: { id: madrasaId },
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

  await prisma.activityLog.create({
    data: {
      userId: adminUserId,
      action: enabled ? 'AI_MANUAL_ENABLED' : 'AI_MANUAL_DISABLED',
      entityType: 'MADRASA',
      entityId: madrasaId,
      metadata: {
        enabled: Boolean(enabled),
        expiresAt: newExpiry?.toISOString() || null,
        note,
      },
    },
  });

  return updated;
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
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }
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
    console.error('In-memory PDF parsing error:', err.message);
    throw new BadRequestError(`Unable to parse uploaded PDF in memory: ${err.message}`);
  }
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

  if (!syllabusContent && !topic) {
    throw new BadRequestError('Please provide a syllabus PDF, pasted notes, or a specific topic to generate the exam paper.');
  }

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
- Topic / Focus: ${topic || 'Covered Syllabus Topics'}
- Target Output Language: ${language} (Ensure all questions, instructions, and answers are provided in ${language}. If "Bilingual" or "Tamil" or "Arabic", provide natural, accurate phrasing with proper terminology).

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
${syllabusContent ? syllabusContent.slice(0, 7000) : topic}

Format the output in clean, professional GitHub-flavored Markdown ready for display, copying, and clean A4 print/PDF generation.
`;

  const systemPrompt = `You are MadrasaNexa Smart AI Assistant, a specialized Islamic educational copilot for Madrasa administrators and Ustadhs. Output accurate, structured exam papers formatted in professional Markdown with rigorous Islamic accuracy and exact requested language.`;

  const examContent = await callCloudflareTextAi({ prompt, systemPrompt, temperature: 0.25 });

  return {
    examContent,
    language,
    subject,
    topic,
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

  if (!content && !topic) {
    throw new BadRequestError('Please provide a lesson topic or upload a syllabus reference.');
  }

  const prompt = `
You are a senior Madrasa Head Ustadh and pedagogical mentor.
Create a structured, highly engaging ${durationMinutes}-Minute Islamic Lesson Plan designed for real Madrasa classroom teaching.

[LESSON PARAMETERS]
- Subject: ${subject}
- Grade / Age Group: ${gradeLevel}
- Topic: ${topic || 'Syllabus Topic'}
- Duration: ${durationMinutes} Minutes
- Language: ${language}

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
${content ? content.slice(0, 6000) : topic}

Format the response in structured, beautifully formatted Markdown with bullet points, time badges, and clear headings in ${language}.
`;

  const systemPrompt = `You are MadrasaNexa Ustadh Copilot. Provide practical, inspiring, classroom-tested 30-minute lesson plans with authentic Islamic scholarship and high pedagogical structure in the requested language.`;

  const lessonPlan = await callCloudflareTextAi({ prompt, systemPrompt, temperature: 0.3 });

  return {
    lessonPlan,
    language,
    subject,
    topic,
  };
}

/**
 * Feature 3: Madrasa Event Poster & Flyer Generator
 * Generates image via Cloudflare Workers AI (Flux 1 Schnell with SDXL fallback)
 * Returns directly as base64 data URL. 0 MB saved to disk or R2.
 */
export async function generatePoster({
  title,
  themePrompt = '',
  category = 'Event',
  dateText = '',
  venue = '',
  madrasaName = '',
  language = 'English',
}) {
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    throw new BadRequestError('Poster title is required.');
  }

  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const token = env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !token) {
    throw new Error('Cloudflare Workers AI credentials are not configured.');
  }

  // Construct clean textless Islamic background visual prompt
  const cleanTitle = title.trim();
  const visualPrompt = [
    'Clean textless ornate Islamic event background poster artwork',
    'Luxurious emerald green, royal navy and gold Islamic geometric border frame',
    'Grand architectural Islamic horseshoe archway and intricate arabesque filigree',
    'Open soft central copy-safe space for typography overlay',
    'Subtle ambient mosque minaret silhouettes in distant background, majestic spiritual lighting, soft specular golden glows',
    themePrompt ? `Custom style: ${themePrompt}` : 'High-end Islamic cultural aesthetics, ultra-detailed 8k vector finish, symmetrical composition',
    'STRICTLY NO TEXT, NO LETTERS, NO TYPOGRAPHY, NO WORDS, NO WATERMARKS, NO CALLIGRAPHY, text-free background template',
  ]
    .filter(Boolean)
    .join(', ');

  // Call Flux 1 Schnell
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

  // Fallback to SDXL if Flux did not return image
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

  if (!base64Image) {
    throw new Error('Image generation service was unable to generate poster at this time. Please try again.');
  }

  return {
    imageDataUrl: base64Image,
    backgroundDataUrl: base64Image,
    modelUsed,
    title: cleanTitle,
    eventTitle: cleanTitle,
    category: category || 'Islamic Event',
    dateText: dateText || '',
    dateTime: dateText || '',
    venue: venue || '',
    madrasaName: madrasaName || 'MadrasaNexa Islamic Academy',
    bismillahLine: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
    language: language || 'English',
  };
}

/**
 * Feature 4: Multilingual Translator (Tamil ↔ English ↔ Arabic)
 */
export async function translateContent({ text, sourceLanguage = 'English', targetLanguage = 'Tamil' }) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new BadRequestError('Text to translate is required.');
  }

  const prompt = `
You are a master translator specializing in Islamic educational texts, circulars, announcements, and Madrasa correspondence.
Accurately translate the following text from ${sourceLanguage} to ${targetLanguage}.

[CRITICAL TRANSLATION RULES]
1. Maintain authentic Islamic terminology (e.g. Du'a, Hadith, Salah, Ustadh, Madrasa, Jalsa, Sunnah) with respectful accuracy.
2. If translating to Tamil: Use clear, natural Sri Lankan/Indian Muslim Tamil vocabulary commonly used in Madrasas and Islamic publications.
3. If translating to Arabic: Use fluent, grammatical Modern Standard Arabic (Fusha) with appropriate Islamic honorifics.
4. If translating to English: Use clear, elegant, professional prose.
5. Preserve formatting, bullet points, numbered lists, and quotes intact.
6. Provide ONLY the translated text without conversational preamble or meta-commentary.

[SOURCE TEXT (${sourceLanguage})]
${text}
`;

  const systemPrompt = `You are a certified Islamic multilingual translator for Tamil, Arabic, and English. Output strictly the clean, high-fidelity translation.`;

  const translatedText = await callCloudflareTextAi({ prompt, systemPrompt, temperature: 0.1 });

  return {
    translatedText,
    sourceLanguage,
    targetLanguage,
  };
}

/**
 * Feature: Conversational Copilot Chat (Multi-Turn Chat with RAM-Only Context)
 */
export async function chatWithCopilot({
  message,
  history = [],
  language = 'English',
  pdfBuffer = null,
  pastedText = '',
  madrasaName = 'Madrasa',
  role = 'Staff',
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

  const systemPrompt = `You are the MadrasaNexa Smart AI Copilot, a warm, polite, highly knowledgeable Islamic Educational & Madrasa Operations Assistant.
Institution: ${madrasaName || 'Madrasa'}
User Role: ${role || 'Staff'}
Target Output Language: ${language} (Ensure responses are naturally phrased in ${language}. If Tamil: use natural Tamil with authentic Islamic terminology; if Arabic: use clear classical Arabic; if Bilingual: provide clear Tamil/Arabic with English explanations).

BEHAVIOR & GUIDELINES:
1. CONVERSATIONAL & NATURAL:
   - For greetings like "hi", "hello", "assalamu alaikum", "who are you?", reply warmly with an authentic Islamic greeting (e.g. "Wa Alaikum Assalam wa Rahmatullahi wa Barakatuh"), introduce yourself as the MadrasaNexa Copilot, and offer helpful suggestions (exam generation, lesson planning, student circulars, Hifz quizzes, speeches, translation, or general curriculum guidance).
   - NEVER abruptly return a lesson plan or exam paper when the user simply said "hi" or asked a general question!
2. PEDAGOGICALLY AUTHENTIC: Ground answers in authentic Islamic scholarship, citing relevant Quranic Ayahs or Hadith with dignity and accuracy where appropriate.
3. STRUCTURED & VISUALLY POLISHED: Use clean markdown styling with clear headings, bullet points, numbered steps, and bold emphasis where appropriate. Avoid raw unrendered symbols.
4. ZERO DATABASE EXPOSURE: You operate with complete data privacy in RAM. You do not store or query live tenant tables.
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

  messages.push({
    role: 'user',
    content: cleanMessage || 'Please examine the attached document and provide an overview and key points.',
  });

  const { text, model } = await callCloudflareChatAi({ messages, temperature: 0.4 });

  return {
    reply: text,
    modelUsed: model,
    language,
  };
}
