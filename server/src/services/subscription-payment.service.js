import sharp from 'sharp';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import {
  buildMadrasaKey,
  uploadReceiptBufferToR2,
  deleteReceiptFromR2,
  getSecureReceiptDownloadUrl,
} from './r2.service.js';
import { addCalendarMonthsUtc } from '../utils/subscription-date.js';
import {
  BadRequestError,
  NotFoundError,
  ConflictError,
  ForbiddenError,
} from '../utils/errors.js';
import {
  sendPaymentPendingEmail,
  sendPaymentApprovedEmail,
  sendPaymentRejectedEmail,
} from './email.service.js';

const MAX_RECEIPT_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * Validates a receipt buffer (JPEG, PNG, WebP, PDF).
 * Strictly rejects SVGs, HTML, executables, scripts, and malformed files.
 */
export async function validateAndProcessReceipt(fileBuffer, originalName) {
  if (!fileBuffer || !Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
    throw new BadRequestError('Receipt file is required.');
  }

  if (fileBuffer.length > MAX_RECEIPT_SIZE) {
    throw new BadRequestError('Receipt file must be smaller than 5 MB.');
  }

  const nameLower = (originalName || '').toLowerCase().trim();

  // Prohibit SVGs strictly
  const bufferHeader = fileBuffer.slice(0, 100).toString('utf8').toLowerCase();
  if (
    nameLower.endsWith('.svg') ||
    bufferHeader.includes('<svg') ||
    bufferHeader.includes('<?xml')
  ) {
    throw new BadRequestError('SVG files are not allowed for security reasons. Please upload a JPG, PNG, WebP or PDF file.');
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
    const magicHeader = fileBuffer.slice(0, 4);
    if (magicHeader[0] === 0x4d && magicHeader[1] === 0x5a) {
      throw new BadRequestError('Executable files are prohibited.');
    }
    if (magicHeader[0] === 0x7f && magicHeader[1] === 0x45 && magicHeader[2] === 0x4c && magicHeader[3] === 0x46) {
      throw new BadRequestError('Executable files are prohibited.');
    }
  }

  // 1. Check if PDF by magic header %PDF- (0x25, 0x50, 0x44, 0x46)
  const isPdfMagic = fileBuffer.slice(0, 4).toString('utf8') === '%PDF';
  if (nameLower.endsWith('.pdf') || isPdfMagic) {
    if (!isPdfMagic) {
      throw new BadRequestError('Corrupted or invalid PDF file.');
    }
    return {
      processedBuffer: fileBuffer,
      mimeType: 'application/pdf',
      extension: 'pdf',
    };
  }

  // 2. Process image via Sharp
  let metadata;
  try {
    const probe = sharp(fileBuffer, {
      limitInputPixels: 16777216,
      failOnError: true,
    });
    metadata = await probe.metadata();
  } catch (err) {
    throw new BadRequestError('Corrupted or invalid image file. Please upload a valid JPG, PNG, WebP or PDF file.');
  }

  const allowedFormats = new Set(['jpeg', 'png', 'webp']);
  if (!metadata.format || !allowedFormats.has(metadata.format)) {
    throw new BadRequestError('Please upload a JPG, PNG, WebP or PDF file.');
  }

  if (metadata.pages && metadata.pages > 1) {
    throw new BadRequestError('Animated or multi-page images are not supported.');
  }

  if ((metadata.width && metadata.width > 4096) || (metadata.height && metadata.height > 4096)) {
    throw new BadRequestError('Image dimensions are too large. Maximum supported dimensions are 4096x4096.');
  }

  // Auto-rotate EXIF orientation and keep high fidelity
  const processedBuffer = await sharp(fileBuffer, { limitInputPixels: 16777216 })
    .rotate()
    .toBuffer();

  const mimeType =
    metadata.format === 'png'
      ? 'image/png'
      : metadata.format === 'webp'
      ? 'image/webp'
      : 'image/jpeg';

  const extension = metadata.format === 'jpeg' ? 'jpg' : metadata.format;

  return {
    processedBuffer,
    mimeType,
    extension,
  };
}

/**
 * Official Platform Bank Details (Managed by Super Admin)
 * Mandatory Correction 1: Zero fake production defaults. If unconfigured, reports isConfigured: false.
 */
export async function getPlatformBankDetails() {
  const setting = await prisma.platformBankSetting.findUnique({
    where: { id: 'global' },
  });

  if (!setting || !setting.isConfigured || !setting.bankName || !setting.accountNumber) {
    return {
      isConfigured: false,
      message: 'Official platform bank details are not yet configured by platform administration.',
      bankName: null,
      accountName: null,
      accountNumber: null,
      branch: null,
      instructions: null,
    };
  }

  return {
    isConfigured: true,
    bankName: setting.bankName,
    accountName: setting.accountName,
    accountNumber: setting.accountNumber,
    branch: setting.branch,
    instructions: setting.instructions,
    updatedAt: setting.updatedAt,
  };
}

export async function updatePlatformBankDetails(data, userId, { ipAddress = null, userAgent = null } = {}) {
  const cleanBankName = data.bankName.trim();
  const cleanAccountName = data.accountName.trim();
  const cleanAccountNumber = data.accountNumber.trim();
  const cleanBranch = data.branch.trim();
  const cleanInstructions = data.instructions ? data.instructions.trim() : null;

  const updated = await prisma.platformBankSetting.upsert({
    where: { id: 'global' },
    update: {
      bankName: cleanBankName,
      accountName: cleanAccountName,
      accountNumber: cleanAccountNumber,
      branch: cleanBranch,
      instructions: cleanInstructions,
      isConfigured: true,
    },
    create: {
      id: 'global',
      bankName: cleanBankName,
      accountName: cleanAccountName,
      accountNumber: cleanAccountNumber,
      branch: cleanBranch,
      instructions: cleanInstructions,
      isConfigured: true,
    },
  });

  await prisma.activityLog.create({
    data: {
      action: 'PLATFORM_BANK_DETAILS_UPDATED',
      userId,
      madrasaId: null,
      entityType: 'PlatformBankSetting',
      entityId: 'global',
      metadata: {
        bankName: cleanBankName,
        accountName: cleanAccountName,
        branch: cleanBranch,
      },
      ipAddress,
      userAgent,
    },
  });

  return {
    isConfigured: true,
    bankName: updated.bankName,
    accountName: updated.accountName,
    accountNumber: updated.accountNumber,
    branch: updated.branch,
    instructions: updated.instructions,
    updatedAt: updated.updatedAt,
  };
}

/**
 * Get active plans available for Madrasa purchase
 */
export async function getActiveSubscriptionPlans() {
  const plans = await prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { price: 'asc' },
  });

  return plans.map((p) => ({
    id: p.id,
    name: p.name,
    code: p.code,
    description: p.description,
    durationMonths: p.durationMonths,
    price: Number(p.price),
    isActive: p.isActive,
  }));
}

/**
 * Submit Subscription Payment Receipt (Madrasa Admin)
 */
export async function createPaymentSubmission({
  madrasaId,
  userId,
  planId,
  submittedAmount,
  paymentDate,
  reference = null,
  notes = null,
  file,
  ipAddress = null,
  userAgent = null,
}) {
  // 1. Mandatory Correction 1: Bank details must be configured
  const bankDetails = await getPlatformBankDetails();
  if (!bankDetails.isConfigured) {
    throw new BadRequestError('Official platform bank details are not configured. Payment submissions are temporarily paused.');
  }

  // 2. Verify Plan is active and authoritative
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
  });

  if (!plan || !plan.isActive) {
    throw new BadRequestError('The selected subscription plan does not exist or is inactive.');
  }

  // 3. Load tenant Madrasa and Admin user
  const madrasa = await prisma.madrasa.findUnique({
    where: { id: madrasaId },
  });
  if (!madrasa) {
    throw new NotFoundError('Madrasa institution not found.');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  // 4. Validate Receipt File Buffer
  if (!file) {
    throw new BadRequestError('Payment receipt file is required.');
  }

  const { processedBuffer, mimeType, extension } = await validateAndProcessReceipt(
    file.buffer,
    file.originalname
  );

  // 5. Upload to Cloudflare R2
  const uuid = crypto.randomUUID();
  const objectKey = buildMadrasaKey(madrasaId, 'receipts', `${uuid}.${extension}`);

  try {
    await uploadReceiptBufferToR2(objectKey, processedBuffer, mimeType);
  } catch (storageErr) {
    console.error('[SubscriptionPaymentService] Storage upload failed:', storageErr.message);
    throw new BadRequestError('Failed to store receipt file in cloud storage. Please try again.');
  }

  // 6. Atomic Database Transaction
  let txResult;
  try {
    txResult = await prisma.$transaction(async (tx) => {
      // Create FileObject
      const fileObject = await tx.fileObject.create({
        data: {
          madrasaId,
          type: 'SUBSCRIPTION_RECEIPT',
          objectKey,
          originalName: file.originalname || `receipt.${extension}`,
          mimeType,
          size: processedBuffer.length,
        },
      });

      // Create SubscriptionPaymentSubmission
      const submission = await tx.subscriptionPaymentSubmission.create({
        data: {
          madrasaId,
          planId: plan.id,
          submittedAmount,
          paymentDate,
          reference: reference ? reference.trim() : null,
          notes: notes ? notes.trim() : null,
          receiptFileId: fileObject.id,
          status: 'PENDING',
        },
        include: {
          plan: true,
          receiptFile: true,
        },
      });

      // Log Activity
      await tx.activityLog.create({
        data: {
          action: 'SUBSCRIPTION_PAYMENT_SUBMITTED',
          userId,
          madrasaId,
          entityType: 'SubscriptionPaymentSubmission',
          entityId: submission.id,
          metadata: {
            planId: plan.id,
            planName: plan.name,
            submittedAmount: Number(submittedAmount),
            paymentDate: paymentDate.toISOString(),
            reference: submission.reference,
          },
          ipAddress,
          userAgent,
        },
      });

      return { fileObject, submission };
    });
  } catch (dbErr) {
    // Best-effort compensation: delete newly uploaded R2 object
    console.error('[SubscriptionPaymentService] DB transaction failed, compensating R2 object:', objectKey);
    try {
      await deleteReceiptFromR2(objectKey);
    } catch (cleanupErr) {
      console.error('[SubscriptionPaymentService] Failed to cleanup R2 object during compensation:', cleanupErr.message);
    }
    throw dbErr;
  }

  // 7. Post-commit asynchronous notification email (Mandatory Correction 10)
  if (user && user.email) {
    try {
      await sendPaymentPendingEmail({
        to: user.email,
        applicantName: user.name,
        madrasaName: madrasa.name,
        planName: plan.name,
        amount: Number(submittedAmount),
        reference: txResult.submission.reference,
      });
    } catch (emailErr) {
      console.error('[SubscriptionPaymentService] Payment pending email notice failed (non-fatal):', emailErr.message);
    }
  }

  return {
    id: txResult.submission.id,
    madrasaId: txResult.submission.madrasaId,
    planId: txResult.submission.planId,
    planName: plan.name,
    submittedAmount: Number(txResult.submission.submittedAmount),
    paymentDate: txResult.submission.paymentDate,
    reference: txResult.submission.reference,
    notes: txResult.submission.notes,
    status: txResult.submission.status,
    createdAt: txResult.submission.createdAt,
    receipt: {
      id: txResult.fileObject.id,
      originalName: txResult.fileObject.originalName,
      mimeType: txResult.fileObject.mimeType,
      size: txResult.fileObject.size,
    },
  };
}

/**
 * List Payment Submissions for Authenticated Tenant
 */
export async function listMadrasaSubmissions(madrasaId) {
  const submissions = await prisma.subscriptionPaymentSubmission.findMany({
    where: { madrasaId },
    include: {
      plan: true,
      receiptFile: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const enriched = submissions.map((s) => ({
    id: s.id,
    planId: s.planId,
    planName: s.plan?.name || 'Unknown Plan',
    planPrice: Number(s.plan?.price || 0),
    planDurationMonths: s.plan?.durationMonths || 0,
    submittedAmount: Number(s.submittedAmount),
    paymentDate: s.paymentDate,
    reference: s.reference,
    notes: s.notes,
    status: s.status,
    rejectionReason: s.rejectionReason,
    reviewedAt: s.reviewedAt,
    createdAt: s.createdAt,
    receipt: s.receiptFile
      ? {
          id: s.receiptFile.id,
          originalName: s.receiptFile.originalName,
          mimeType: s.receiptFile.mimeType,
          size: s.receiptFile.size,
        }
      : null,
  }));

  return enriched;
}

/**
 * Super Admin: List all payment submissions with filters
 */
export async function listSuperAdminSubmissions(query = {}) {
  const page = query.page || 1;
  const limit = query.limit || 10;
  const skip = (page - 1) * limit;

  const where = {};
  if (query.status && query.status !== 'ALL') {
    where.status = query.status;
  }

  if (query.search) {
    const term = query.search.trim();
    where.OR = [
      { reference: { contains: term } },
      { madrasa: { name: { contains: term } } },
      { madrasa: { code: { contains: term } } },
    ];
  }

  const [submissions, total, pendingCount, approvedCount, rejectedCount] = await Promise.all([
    prisma.subscriptionPaymentSubmission.findMany({
      where,
      skip,
      take: limit,
      include: {
        madrasa: {
          select: {
            id: true,
            name: true,
            code: true,
            email: true,
            phone: true,
            users: {
              where: { role: 'MADRASA_ADMIN' },
              select: { id: true, name: true, email: true },
              take: 1,
            },
          },
        },
        plan: true,
        receiptFile: true,
        reviewedByUser: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    }),
    prisma.subscriptionPaymentSubmission.count({ where }),
    prisma.subscriptionPaymentSubmission.count({ where: { status: 'PENDING' } }),
    prisma.subscriptionPaymentSubmission.count({ where: { status: 'APPROVED' } }),
    prisma.subscriptionPaymentSubmission.count({ where: { status: 'REJECTED' } }),
  ]);

  const items = submissions.map((s) => {
    const adminUser = s.madrasa?.users?.[0] || null;

    return {
      id: s.id,
      madrasa: {
        id: s.madrasa.id,
        name: s.madrasa.name,
        code: s.madrasa.code,
        contactEmail: adminUser?.email || s.madrasa.email,
        contactName: adminUser?.name || 'Administrator',
      },
      plan: {
        id: s.plan.id,
        name: s.plan.name,
        code: s.plan.code,
        durationMonths: s.plan.durationMonths,
        expectedPrice: Number(s.plan.price),
      },
      submittedAmount: Number(s.submittedAmount),
      paymentDate: s.paymentDate,
      reference: s.reference,
      notes: s.notes,
      status: s.status,
      rejectionReason: s.rejectionReason,
      reviewedBy: s.reviewedByUser ? { id: s.reviewedByUser.id, name: s.reviewedByUser.name } : null,
      reviewedAt: s.reviewedAt,
      createdAt: s.createdAt,
      receipt: s.receiptFile
        ? {
            id: s.receiptFile.id,
            originalName: s.receiptFile.originalName,
            mimeType: s.receiptFile.mimeType,
            size: s.receiptFile.size,
          }
        : null,
    };
  });

  return {
    submissions: items,
    counts: {
      pending: pendingCount,
      approved: approvedCount,
      rejected: rejectedCount,
      total: pendingCount + approvedCount + rejectedCount,
    },
    kpis: {
      pending: pendingCount,
      approved: approvedCount,
      rejected: rejectedCount,
      total: pendingCount + approvedCount + rejectedCount,
    },
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

/**
 * Super Admin: Get single payment submission detail
 */
export async function getSubmissionDetail(id) {
  const submission = await prisma.subscriptionPaymentSubmission.findUnique({
    where: { id },
    include: {
      madrasa: {
        include: {
          users: {
            where: { role: 'MADRASA_ADMIN' },
            select: { id: true, name: true, email: true },
            take: 1,
          },
        },
      },
      plan: true,
      receiptFile: true,
      reviewedByUser: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  if (!submission) {
    throw new NotFoundError('Payment submission not found.');
  }

  const receiptUrl = submission.receiptFile
    ? await getSecureReceiptDownloadUrl(submission.receiptFile.objectKey, 900)
    : null;

  const adminUser = submission.madrasa?.users?.[0] || null;

  return {
    id: submission.id,
    madrasa: {
      id: submission.madrasa.id,
      name: submission.madrasa.name,
      code: submission.madrasa.code,
      contactEmail: adminUser?.email || submission.madrasa.email,
      contactName: adminUser?.name || 'Administrator',
    },
    plan: {
      id: submission.plan.id,
      name: submission.plan.name,
      code: submission.plan.code,
      durationMonths: submission.plan.durationMonths,
      expectedPrice: Number(submission.plan.price),
    },
    submittedAmount: Number(submission.submittedAmount),
    paymentDate: submission.paymentDate,
    reference: submission.reference,
    notes: submission.notes,
    status: submission.status,
    rejectionReason: submission.rejectionReason,
    reviewedBy: submission.reviewedByUser ? { id: submission.reviewedByUser.id, name: submission.reviewedByUser.name } : null,
    reviewedAt: submission.reviewedAt,
    createdAt: submission.createdAt,
    receipt: submission.receiptFile
      ? {
          id: submission.receiptFile.id,
          originalName: submission.receiptFile.originalName,
          mimeType: submission.receiptFile.mimeType,
          size: submission.receiptFile.size,
          url: receiptUrl,
        }
      : null,
  };
}

/**
 * Super Admin: Get authorized temporary signed receipt URL on demand
 * Never returns permanent public R2 URL. Expiry: 15 minutes.
 */
export async function getSuperAdminReceiptUrl(submissionId) {
  const submission = await prisma.subscriptionPaymentSubmission.findUnique({
    where: { id: submissionId },
    include: { receiptFile: true },
  });

  if (!submission || !submission.receiptFile) {
    throw new NotFoundError('Receipt file not found for this payment submission.');
  }

  const signedUrl = await getSecureReceiptDownloadUrl(submission.receiptFile.objectKey, 900);

  return {
    id: submission.receiptFile.id,
    submissionId: submission.id,
    originalName: submission.receiptFile.originalName,
    mimeType: submission.receiptFile.mimeType,
    size: submission.receiptFile.size,
    url: signedUrl,
    expiresIn: 900,
  };
}

/**
 * Madrasa Admin: Get authorized temporary signed receipt URL for tenant's own submission
 * Strictly enforces cross-tenant boundary: rejects foreign submissions with 404.
 * Never returns permanent public R2 URL. Expiry: 15 minutes.
 */
export async function getMadrasaReceiptUrl(submissionId, madrasaId) {
  const submission = await prisma.subscriptionPaymentSubmission.findUnique({
    where: { id: submissionId },
    include: { receiptFile: true },
  });

  if (!submission || submission.madrasaId !== madrasaId || !submission.receiptFile) {
    throw new NotFoundError('Payment submission receipt not found.');
  }

  const signedUrl = await getSecureReceiptDownloadUrl(submission.receiptFile.objectKey, 900);

  return {
    id: submission.receiptFile.id,
    submissionId: submission.id,
    originalName: submission.receiptFile.originalName,
    mimeType: submission.receiptFile.mimeType,
    size: submission.receiptFile.size,
    url: signedUrl,
    expiresIn: 900,
  };
}

/**
 * Super Admin: Approve Payment Submission
 * Mandatory Corrections:
 * - 4: Concurrency-safe atomic conditional PENDING claim
 * - 5: Amount Mismatch Policy (authoritative plan.price === submittedAmount)
 * - 6: Reuse canonical subscription & renewal engine
 * - 10: Post-commit email dispatch
 */
export async function approvePaymentSubmission(
  id,
  reviewedByUserId,
  { ipAddress = null, userAgent = null } = {}
) {
  const now = new Date();

  // Execute in an atomic interactive Prisma transaction
  const txResult = await prisma.$transaction(async (tx) => {
    // 1. Mandatory Correction 4: Concurrency-safe atomic claim
    const claimResult = await tx.subscriptionPaymentSubmission.updateMany({
      where: {
        id,
        status: 'PENDING',
      },
      data: {
        status: 'APPROVED',
        reviewedByUserId,
        reviewedAt: now,
      },
    });

    if (claimResult.count === 0) {
      throw new ConflictError('This payment submission has already been reviewed, approved, or rejected.');
    }

    // 2. Fetch submission details
    const submission = await tx.subscriptionPaymentSubmission.findUnique({
      where: { id },
      include: {
        plan: true,
        madrasa: {
          include: {
            users: {
              where: { role: 'MADRASA_ADMIN' },
              select: { id: true, name: true, email: true },
              take: 1,
            },
          },
        },
      },
    });

    if (!submission) {
      throw new NotFoundError('Payment submission not found.');
    }

    const { plan, madrasa } = submission;

    // 3. Mandatory Correction 5: Amount Mismatch Check
    const planPrice = Number(plan.price);
    const submittedAmount = Number(submission.submittedAmount);

    if (submittedAmount !== planPrice) {
      throw new BadRequestError(
        `Submitted amount (LKR ${submittedAmount.toFixed(2)}) does not match the authoritative plan price (LKR ${planPrice.toFixed(2)}). Payment approval blocked.`
      );
    }

    // 4. Mandatory Correction 6: Canonical Subscription / Renewal Engine
    // Query latest existing subscription term for this Madrasa inside transaction
    const latestTerm = await tx.subscription.findFirst({
      where: { madrasaId: madrasa.id },
      orderBy: [
        { endsAt: 'desc' },
        { startsAt: 'desc' },
      ],
    });

    let newStartsAt;
    if (latestTerm && latestTerm.endsAt.getTime() > now.getTime()) {
      // Active subscription: consecutive extension preserving remaining time
      newStartsAt = new Date(latestTerm.endsAt);
    } else {
      // Nonexistent or expired: immediate start from now
      newStartsAt = now;
    }

    // Guard duplicate renewal
    const duplicate = await tx.subscription.findFirst({
      where: {
        madrasaId: madrasa.id,
        startsAt: newStartsAt,
      },
    });

    if (duplicate) {
      throw new ConflictError('A subscription renewal starting at this exact term boundary is already recorded.');
    }

    const newEndsAt = addCalendarMonthsUtc(newStartsAt, plan.durationMonths);

    // Create Subscription record snapshotting plan price and duration
    const newSubscription = await tx.subscription.create({
      data: {
        madrasaId: madrasa.id,
        planId: plan.id,
        status: 'ACTIVE',
        startsAt: newStartsAt,
        endsAt: newEndsAt,
        priceAtPurchase: plan.price,
        durationMonthsAtPurchase: plan.durationMonths,
      },
      include: { plan: true },
    });

    // If prior term existed, update its renewedAt
    if (latestTerm) {
      await tx.subscription.update({
        where: { id: latestTerm.id },
        data: { renewedAt: now },
      });
    }

    // Create SubscriptionPayment snapshotting amount and reference
    const payment = await tx.subscriptionPayment.create({
      data: {
        madrasaId: madrasa.id,
        subscriptionId: newSubscription.id,
        amount: plan.price,
        paymentMethod: 'BANK_TRANSFER',
        reference: submission.reference,
        paidAt: submission.paymentDate || now,
        notes: submission.notes,
      },
    });

    // Link subscription and payment IDs back to the submission record
    await tx.subscriptionPaymentSubmission.update({
      where: { id },
      data: {
        subscriptionId: newSubscription.id,
        subscriptionPaymentId: payment.id,
      },
    });

    // Record ActivityLogs
    await tx.activityLog.create({
      data: {
        action: 'SUBSCRIPTION_PAYMENT_APPROVED',
        userId: reviewedByUserId,
        madrasaId: madrasa.id,
        entityType: 'SubscriptionPaymentSubmission',
        entityId: id,
        metadata: {
          planId: plan.id,
          planName: plan.name,
          amount: planPrice,
          reference: submission.reference,
          subscriptionId: newSubscription.id,
          paymentId: payment.id,
        },
        ipAddress,
        userAgent,
      },
    });

    await tx.activityLog.create({
      data: {
        action: latestTerm ? 'SUBSCRIPTION_RENEWED' : 'SUBSCRIPTION_ACTIVATED',
        userId: reviewedByUserId,
        madrasaId: madrasa.id,
        entityType: 'Subscription',
        entityId: newSubscription.id,
        metadata: {
          planCode: plan.code,
          startsAt: newStartsAt.toISOString(),
          endsAt: newEndsAt.toISOString(),
          priceAtPurchase: String(plan.price),
          durationMonths: plan.durationMonths,
          paymentId: payment.id,
          submissionId: id,
        },
        ipAddress,
        userAgent,
      },
    });

    return {
      submission,
      subscription: newSubscription,
      payment,
      adminUser: madrasa.users?.[0] || null,
    };
  });

  // 5. Mandatory Correction 10: Post-commit email dispatch
  const { submission, subscription, adminUser } = txResult;
  const recipientEmail = adminUser?.email || submission.madrasa?.email;
  if (recipientEmail) {
    try {
      await sendPaymentApprovedEmail({
        to: recipientEmail,
        applicantName: adminUser?.name || 'Administrator',
        madrasaName: submission.madrasa.name,
        planName: subscription.plan.name,
        startsAt: subscription.startsAt,
        endsAt: subscription.endsAt,
      });
    } catch (emailErr) {
      console.error('[SubscriptionPaymentService] Approval activation email failed (non-fatal):', emailErr.message);
    }
  }

  return {
    success: true,
    message: 'Subscription payment approved and subscription activated successfully.',
    data: {
      submissionId: id,
      status: 'APPROVED',
      subscriptionId: subscription.id,
      startsAt: subscription.startsAt,
      endsAt: subscription.endsAt,
    },
  };
}

/**
 * Super Admin: Reject Payment Submission
 * Mandatory Corrections:
 * - 4: Concurrency-safe atomic conditional PENDING claim
 * - 10: Post-commit email dispatch
 */
export async function rejectPaymentSubmission(
  id,
  reviewedByUserId,
  rejectionReason,
  { ipAddress = null, userAgent = null } = {}
) {
  const now = new Date();
  const cleanReason = rejectionReason.trim();

  // Execute in an atomic interactive Prisma transaction
  const txResult = await prisma.$transaction(async (tx) => {
    // 1. Mandatory Correction 4: Concurrency-safe atomic claim
    const claimResult = await tx.subscriptionPaymentSubmission.updateMany({
      where: {
        id,
        status: 'PENDING',
      },
      data: {
        status: 'REJECTED',
        rejectionReason: cleanReason,
        reviewedByUserId,
        reviewedAt: now,
      },
    });

    if (claimResult.count === 0) {
      throw new ConflictError('This payment submission has already been reviewed, approved, or rejected.');
    }

    const submission = await tx.subscriptionPaymentSubmission.findUnique({
      where: { id },
      include: {
        plan: true,
        madrasa: {
          include: {
            users: {
              where: { role: 'MADRASA_ADMIN' },
              select: { id: true, name: true, email: true },
              take: 1,
            },
          },
        },
      },
    });

    // Record ActivityLog
    await tx.activityLog.create({
      data: {
        action: 'SUBSCRIPTION_PAYMENT_REJECTED',
        userId: reviewedByUserId,
        madrasaId: submission.madrasaId,
        entityType: 'SubscriptionPaymentSubmission',
        entityId: id,
        metadata: {
          planId: submission.planId,
          planName: submission.plan.name,
          rejectionReason: cleanReason,
        },
        ipAddress,
        userAgent,
      },
    });

    return {
      submission,
      adminUser: submission.madrasa?.users?.[0] || null,
    };
  });

  // 2. Mandatory Correction 10: Post-commit email dispatch
  const { submission, adminUser } = txResult;
  const recipientEmail = adminUser?.email || submission.madrasa?.email;
  if (recipientEmail) {
    try {
      await sendPaymentRejectedEmail({
        to: recipientEmail,
        applicantName: adminUser?.name || 'Administrator',
        madrasaName: submission.madrasa.name,
        planName: submission.plan.name,
        rejectionReason: cleanReason,
      });
    } catch (emailErr) {
      console.error('[SubscriptionPaymentService] Rejection notice email failed (non-fatal):', emailErr.message);
    }
  }

  return {
    success: true,
    message: 'Subscription payment submission has been rejected.',
    data: {
      submissionId: id,
      status: 'REJECTED',
      rejectionReason: cleanReason,
    },
  };
}
