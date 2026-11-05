import crypto from 'crypto';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { assertTenantOwnership, findTenantRecordOrThrow } from '../lib/tenant-prisma.js';
import { BadRequestError, ConflictError, NotFoundError } from '../utils/errors.js';
import { resolveInvoiceDisplayStatus } from './invoice.service.js';
import { resolveObjectAccessUrl } from './r2.service.js';
import { buildFeePaymentSmsMessage, buildFeePaymentEmailHtml, maskRecipientAddress } from './notification.service.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Retrieves the configured timezone for a Madrasa (defaults to Asia/Colombo).
 */
export async function getMadrasaTimezone(madrasaId) {
  const setting = await prisma.madrasaSetting.findUnique({
    where: { madrasaId },
    select: { timezone: true },
  });
  return setting?.timezone || 'Asia/Colombo';
}

/**
 * Retrieves the configured receipt prefix for a Madrasa (defaults to REC-).
 */
export async function getMadrasaReceiptPrefix(madrasaId) {
  const setting = await prisma.madrasaSetting.findUnique({
    where: { madrasaId },
    select: { receiptPrefix: true },
  });
  return setting?.receiptPrefix || 'REC-';
}

/**
 * Generates a human-readable, collision-safe payment number.
 * Example: PAY-202609-A7C2E9
 */
export function generatePaymentNumber(year, month) {
  const yyyymm = `${year}${String(month).padStart(2, '0')}`;
  const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `PAY-${yyyymm}-${randomSuffix}`;
}

/**
 * Generates a human-readable, collision-safe receipt number with Madrasa prefix.
 * Example: REC-202609-A7C2E9
 */
export function generateReceiptNumber(prefix, year, month) {
  const yyyymm = `${year}${String(month).padStart(2, '0')}`;
  const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  const cleanPrefix = prefix.endsWith('-') ? prefix : `${prefix}-`;
  return `${cleanPrefix}${yyyymm}-${randomSuffix}`;
}

/**
 * Checks if a Prisma P2002 error was caused by paymentNo uniqueness violation.
 */
export function isPaymentNoCollision(error) {
  if (error?.code !== 'P2002') return false;
  const target = error.meta?.target;
  if (Array.isArray(target)) return target.includes('paymentNo');
  if (typeof target === 'string') return target.includes('paymentNo');
  if (typeof error.message === 'string') return error.message.includes('paymentNo');
  return false;
}

/**
 * Checks if a Prisma P2002 error was caused by receiptNo uniqueness violation.
 */
export function isReceiptNoCollision(error) {
  if (error?.code !== 'P2002') return false;
  const target = error.meta?.target;
  if (Array.isArray(target)) return target.includes('receiptNo');
  if (typeof target === 'string') return target.includes('receiptNo');
  if (typeof error.message === 'string') return error.message.includes('receiptNo');
  return false;
}

/**
 * Checks if a Prisma P2002 error was caused by idempotencyKey uniqueness violation.
 */
export function isIdempotencyCollision(error) {
  if (error?.code !== 'P2002') return false;
  const target = error.meta?.target;
  if (Array.isArray(target)) return target.includes('idempotencyKey');
  if (typeof target === 'string') return target.includes('idempotencyKey');
  if (typeof error.message === 'string') return error.message.includes('idempotencyKey');
  return false;
}

/**
 * Evaluates whether an existing payment matches a new payment request for idempotency.
 */
function doesPaymentMatchRequest(existingPayment, requestData) {
  if (existingPayment.studentId !== requestData.studentId) return false;
  if (Number(existingPayment.amount).toFixed(2) !== Number(requestData.amount).toFixed(2)) return false;
  if (existingPayment.paymentMethod !== requestData.paymentMethod) return false;

  // Compare allocations
  const existingAllocations = existingPayment.allocations || [];
  const reqAllocations = requestData.allocations || [];
  if (existingAllocations.length !== reqAllocations.length) return false;

  const existingMap = new Map(existingAllocations.map((a) => [a.invoiceId, Number(a.amount).toFixed(2)]));
  for (const alloc of reqAllocations) {
    if (existingMap.get(alloc.invoiceId) !== Number(alloc.amount).toFixed(2)) {
      return false;
    }
  }

  return true;
}

/**
 * Records a financial payment with atomic allocations, concurrency protection,
 * invoice recalculation, and receipt generation.
 *
 * @param {string} madrasaId
 * @param {object} data
 * @param {string} userId
 * @returns {Promise<object>}
 */
export async function createPayment(madrasaId, dataOrUserId, maybeUserId) {
  let data = dataOrUserId;
  let userId = maybeUserId;
  if (typeof dataOrUserId === 'string' && typeof maybeUserId === 'object' && maybeUserId !== null) {
    userId = dataOrUserId;
    data = maybeUserId;
  }

  const allocations = data.allocations || data.invoiceAllocations || [];
  const idempotencyKey = data.idempotencyKey || `pay_auto_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const { studentId, amount: rawAmount, paymentMethod, paidAt: rawPaidAt, reference, notes } = data;

  const paymentAmount = new Prisma.Decimal(rawAmount);
  if (paymentAmount.lte(0)) {
    throw new BadRequestError('Payment amount must be greater than zero.');
  }

  // 1. Mandatory Correction 1 & 2: Check idempotency key before transaction
  const existingWithKey = await prisma.payment.findUnique({
    where: {
      madrasaId_idempotencyKey: {
        madrasaId,
        idempotencyKey,
      },
    },
    include: {
      allocations: true,
      receipt: true,
    },
  });

  if (existingWithKey) {
    if (doesPaymentMatchRequest(existingWithKey, data)) {
      // Safe idempotent return of existing record
      const res = await getPaymentById(madrasaId, existingWithKey.id);
      return { ...res, payment: res };
    }
    // Mandatory Correction 2: Same key + different payload => reject 409
    throw new ConflictError('IDEMPOTENCY_KEY_REUSE: This idempotency key has already been used with different payment parameters.');
  }

  // 2. Validate allocations sum against payment amount
  let allocationSum = new Prisma.Decimal(0);
  for (const alloc of allocations) {
    const allocDec = new Prisma.Decimal(alloc.amount);
    if (allocDec.lte(0)) {
      throw new BadRequestError('Allocation amounts must be greater than zero.');
    }
    allocationSum = allocationSum.add(allocDec);
  }

  if (!allocationSum.equals(paymentAmount)) {
    throw new BadRequestError(
      `Sum of allocation amounts (LKR ${allocationSum.toFixed(2)}) must exactly equal payment amount (LKR ${paymentAmount.toFixed(2)}).`
    );
  }

  // 3. Assert student belongs to tenant
  await assertTenantOwnership(prisma.student, studentId, madrasaId);

  // 4. Resolve dates & prefixes in Madrasa timezone
  const tz = await getMadrasaTimezone(madrasaId);
  const receiptPrefix = await getMadrasaReceiptPrefix(madrasaId);

  let paidAtDate = new Date();
  if (rawPaidAt) {
    // If date string YYYY-MM-DD or ISO provided, parse in tenant timezone
    paidAtDate = dayjs.tz(rawPaidAt, tz).toDate();
  }
  const nowInTz = dayjs().tz(tz);
  const yearForNumbers = nowInTz.year();
  const monthForNumbers = nowInTz.month() + 1;

  // 5. Deterministic invoice ordering to prevent deadlocks (Mandatory Correction 3)
  const sortedAllocations = [...allocations].sort((a, b) => a.invoiceId.localeCompare(b.invoiceId));
  const invoiceIds = sortedAllocations.map((a) => a.invoiceId);

  // 6. Bounded retry loop for concurrent number generation & serializable transactions (Mandatory Correction 3 & 5)
  const MAX_RETRIES = 5;
  let createdPaymentId = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const paymentNo = generatePaymentNumber(yearForNumbers, monthForNumbers);
      const receiptNo = generateReceiptNumber(receiptPrefix, yearForNumbers, monthForNumbers);

      createdPaymentId = await prisma.$transaction(
        async (tx) => {
          // Double-check idempotency inside transaction
          const inTxExisting = await tx.payment.findUnique({
            where: {
              madrasaId_idempotencyKey: {
                madrasaId,
                idempotencyKey,
              },
            },
            include: { allocations: true },
          });
          if (inTxExisting) {
            if (doesPaymentMatchRequest(inTxExisting, data)) {
              return inTxExisting.id;
            }
            throw new ConflictError('IDEMPOTENCY_KEY_REUSE: This idempotency key has already been used with different payment parameters.');
          }

          // Fetch all target invoices within transaction (ordered deterministically)
          const targetInvoices = await tx.invoice.findMany({
            where: {
              id: { in: invoiceIds },
              madrasaId,
            },
            orderBy: { id: 'asc' },
          });

          // Anti-enumeration: all target invoices must exist and belong to tenant
          if (targetInvoices.length !== invoiceIds.length) {
            throw new NotFoundError('One or more selected invoices were not found.');
          }

          // All invoices must belong to the selected student (Mandatory Correction 27)
          for (const inv of targetInvoices) {
            if (inv.studentId !== studentId) {
              throw new BadRequestError(`Invoice ${inv.invoiceNo} does not belong to the selected student.`);
            }
            if (inv.status === 'VOID') {
              throw new BadRequestError(`Cannot allocate payment to void invoice ${inv.invoiceNo}.`);
            }
          }

          // Authoritative concurrency validation: recompute completed allocations inside transaction
          for (const inv of targetInvoices) {
            const alloc = sortedAllocations.find((a) => a.invoiceId === inv.id);
            const requestedAllocDec = new Prisma.Decimal(alloc.amount);

            const completedAllocations = await tx.paymentAllocation.findMany({
              where: {
                madrasaId,
                invoiceId: inv.id,
                payment: { status: 'COMPLETED' },
              },
              select: { amount: true },
            });

            const currentPaidSum = completedAllocations.reduce(
              (acc, c) => acc.add(c.amount),
              new Prisma.Decimal(0)
            );
            const currentBalance = Prisma.Decimal.max(new Prisma.Decimal(0), inv.totalAmount.sub(currentPaidSum));

            if (currentBalance.lte(0)) {
              throw new BadRequestError(`Invoice ${inv.invoiceNo} is already fully paid.`);
            }

            if (requestedAllocDec.gt(currentBalance)) {
              throw new BadRequestError(
                `Allocation amount LKR ${requestedAllocDec.toFixed(2)} exceeds remaining balance LKR ${currentBalance.toFixed(2)} for invoice ${inv.invoiceNo}.`
              );
            }

            // Invariant: completed allocations + requested allocation <= totalAmount
            if (currentPaidSum.add(requestedAllocDec).gt(inv.totalAmount)) {
              throw new BadRequestError(`Allocation would exceed total amount for invoice ${inv.invoiceNo}.`);
            }
          }

          // Create Payment record
          const payment = await tx.payment.create({
            data: {
              madrasaId,
              studentId,
              paymentNo,
              amount: paymentAmount,
              paymentMethod,
              reference: reference?.trim() || null,
              idempotencyKey,
              notes: notes?.trim() || null,
              status: 'COMPLETED',
              paidAt: paidAtDate,
            },
            select: { id: true, paymentNo: true },
          });

          // Create payment allocations
          for (const a of sortedAllocations) {
            await tx.paymentAllocation.create({
              data: {
                madrasaId,
                paymentId: payment.id,
                invoiceId: a.invoiceId,
                amount: new Prisma.Decimal(a.amount),
              },
            });
          }

          // Create Receipt record
          await tx.receipt.create({
            data: {
              madrasaId,
              paymentId: payment.id,
              receiptNo,
              issuedAt: paidAtDate,
            },
          });

          // Recalculate affected invoices projected totals and status inside transaction
          const postPaymentInvoices = [];
          for (const inv of targetInvoices) {
            const allAllocationsAfter = await tx.paymentAllocation.findMany({
              where: {
                madrasaId,
                invoiceId: inv.id,
                payment: { status: 'COMPLETED' },
              },
              select: { amount: true },
            });

            const newTotalPaid = allAllocationsAfter.reduce(
              (acc, c) => acc.add(c.amount),
              new Prisma.Decimal(0)
            );
            const newBalance = Prisma.Decimal.max(new Prisma.Decimal(0), inv.totalAmount.sub(newTotalPaid));

            let newStatus = 'PENDING';
            if (newBalance.isZero() && newTotalPaid.gt(0)) {
              newStatus = 'PAID';
            } else if (newTotalPaid.gt(0)) {
              newStatus = 'PARTIAL';
            }

            await tx.invoice.update({
              where: { id: inv.id },
              data: {
                paidAmount: newTotalPaid,
                balanceAmount: newBalance,
                status: newStatus,
              },
            });

            const currentAlloc = sortedAllocations.find((a) => a.invoiceId === inv.id);
            postPaymentInvoices.push({
              id: inv.id,
              invoiceNo: inv.invoiceNo,
              billingYear: inv.billingYear,
              billingMonth: inv.billingMonth,
              monthLabel: `${inv.billingYear}-${String(inv.billingMonth).padStart(2, '0')}`,
              allocatedAmount: currentAlloc ? currentAlloc.amount : '0.00',
              balanceAmount: newBalance,
              isPaid: newBalance.isZero(),
            });
          }

          // Sort affected billing periods chronologically
          postPaymentInvoices.sort((a, b) => {
            if (a.billingYear !== b.billingYear) return a.billingYear - b.billingYear;
            return a.billingMonth - b.billingMonth;
          });

          const allAffectedPaid = postPaymentInvoices.every((inv) => inv.isPaid);
          const remainingBalance = postPaymentInvoices.reduce(
            (sum, inv) => sum.add(inv.balanceAmount),
            new Prisma.Decimal(0)
          );
          const eventType = allAffectedPaid ? 'FEE_FULLY_PAID' : 'FEE_PARTIAL_PAYMENT';
          const periodLabel = allAffectedPaid ? 'Paid Months' : 'Applied To';
          const periodSummary = postPaymentInvoices.map((inv) => inv.monthLabel).join(', ');

          // Transactional Outbox: Check notification settings inside transaction
          const madrasaSetting = await tx.madrasaSetting.findUnique({
            where: { madrasaId },
          });

          const madrasa = await tx.madrasa.findUnique({
            where: { id: madrasaId },
            select: { name: true },
          });
          const madrasaName = madrasa?.name || 'Madrasa Administration';

          const student = await tx.student.findUnique({
            where: { id: studentId },
            select: { id: true, fullName: true, admissionNo: true, guardianName: true, guardianPhone: true, guardianEmail: true },
          });

          const isSmsEnabled = allAffectedPaid
            ? Boolean(madrasaSetting?.autoFeePaymentSmsEnabled)
            : Boolean(madrasaSetting?.autoPartialFeeSmsEnabled);

          if (isSmsEnabled && student) {
            const hasPhone = Boolean(student.guardianPhone && student.guardianPhone.trim() !== '');
            const phone = hasPhone ? student.guardianPhone.trim() : null;
            const smsDedupeKey = `FEE_PAYMENT:SMS:${payment.id}:${phone || 'NO_RECIPIENT'}`;
            const smsMessage = buildFeePaymentSmsMessage({
              madrasaName,
              studentName: student.fullName,
              amount: paymentAmount.toFixed(2),
              receiptNo,
              eventType,
              periodLabel,
              periodSummary,
              remainingBalance: remainingBalance.toFixed(2),
            });

            await tx.notificationJob.create({
              data: {
                madrasaId,
                channel: 'SMS',
                eventType,
                recipientType: 'GUARDIAN',
                recipientEntityId: student.id,
                recipientAddress: phone,
                recipientName: student.guardianName,
                message: smsMessage,
                payloadJson: {
                  paymentId: payment.id,
                  receiptNo,
                  amount: paymentAmount.toFixed(2),
                  remainingBalance: remainingBalance.toFixed(2),
                  periodSummary,
                  periodLabel,
                },
                relatedEntityType: 'Payment',
                relatedEntityId: payment.id,
                dedupeKey: smsDedupeKey,
                status: hasPhone ? 'PENDING' : 'SKIPPED_NO_RECIPIENT',
              },
            });

            await tx.activityLog.create({
              data: {
                madrasaId,
                userId,
                action: 'AUTO_FEE_SMS_QUEUED',
                entityType: 'NotificationJob',
                entityId: payment.id,
                metadata: {
                  paymentId: payment.id,
                  receiptNo,
                  recipient: maskRecipientAddress('SMS', phone),
                  status: hasPhone ? 'PENDING' : 'SKIPPED_NO_RECIPIENT',
                },
              },
            });
          }

          const isEmailEnabled = allAffectedPaid
            ? Boolean(madrasaSetting?.autoFeePaymentEmailEnabled)
            : Boolean(madrasaSetting?.autoPartialFeeEmailEnabled);

          if (isEmailEnabled && student) {
            const hasEmail = Boolean(student.guardianEmail && student.guardianEmail.trim() !== '');
            const email = hasEmail ? student.guardianEmail.trim().toLowerCase() : null;
            const emailDedupeKey = `FEE_PAYMENT:EMAIL:${payment.id}:${email || 'NO_RECIPIENT'}`;
            const subject = `Fee Payment Receipt — ${receiptNo} — ${madrasaName}`;
            const emailHtml = buildFeePaymentEmailHtml({
              madrasaName,
              studentName: student.fullName,
              admissionNo: student.admissionNo,
              amount: paymentAmount.toFixed(2),
              receiptNo,
              eventType,
              periodLabel,
              appliedInvoices: postPaymentInvoices,
              remainingBalance: remainingBalance.toFixed(2),
            });

            await tx.notificationJob.create({
              data: {
                madrasaId,
                channel: 'EMAIL',
                eventType,
                recipientType: 'GUARDIAN',
                recipientEntityId: student.id,
                recipientAddress: email,
                recipientName: student.guardianName,
                subject,
                message: emailHtml,
                payloadJson: {
                  paymentId: payment.id,
                  receiptNo,
                  amount: paymentAmount.toFixed(2),
                  remainingBalance: remainingBalance.toFixed(2),
                  periodSummary,
                  periodLabel,
                },
                relatedEntityType: 'Payment',
                relatedEntityId: payment.id,
                dedupeKey: emailDedupeKey,
                status: hasEmail ? 'PENDING' : 'SKIPPED_NO_RECIPIENT',
              },
            });

            await tx.activityLog.create({
              data: {
                madrasaId,
                userId,
                action: 'AUTO_FEE_EMAIL_QUEUED',
                entityType: 'NotificationJob',
                entityId: payment.id,
                metadata: {
                  paymentId: payment.id,
                  receiptNo,
                  recipient: maskRecipientAddress('EMAIL', email),
                  status: hasEmail ? 'PENDING' : 'SKIPPED_NO_RECIPIENT',
                },
              },
            });
          }

          // Activity audit log
          await tx.activityLog.create({
            data: {
              madrasaId,
              userId,
              action: 'PAYMENT_RECORDED',
              entityType: 'PAYMENT',
              entityId: payment.id,
              metadata: {
                paymentNo: payment.paymentNo,
                receiptNo,
                studentId,
                amount: paymentAmount.toFixed(2),
                paymentMethod,
                invoiceIds,
              },
            },
          });

          return payment.id;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        }
      );

      break; // Success!
    } catch (err) {
      // Differentiate P2002 collisions (Mandatory Correction 5)
      if (isIdempotencyCollision(err)) {
        const existing = await prisma.payment.findUnique({
          where: { madrasaId_idempotencyKey: { madrasaId, idempotencyKey } },
          include: { allocations: true },
        });
        if (existing && doesPaymentMatchRequest(existing, data)) {
          const res = await getPaymentById(madrasaId, existing.id);
          return { ...res, payment: res };
        }
        throw new ConflictError('IDEMPOTENCY_KEY_REUSE: This idempotency key has already been used with different payment parameters.');
      }

      if (isPaymentNoCollision(err) || isReceiptNoCollision(err)) {
        if (attempt === MAX_RETRIES) {
          throw new ConflictError('Unable to allocate a unique payment or receipt number. Please try again.');
        }
        continue; // Retry with fresh random suffix
      }

      // Handle Prisma/DB concurrency write conflict or deadlock (Mandatory Correction 3 & 14)
      if (err.code === 'P2034' || err.message?.includes('write conflict') || err.message?.includes('deadlock')) {
        if (attempt === MAX_RETRIES) {
          throw new ConflictError('Payment processing encountered a concurrency conflict. Please retry.');
        }
        await new Promise((resolve) => setTimeout(resolve, 60 * attempt));
        continue; // Retry transaction to re-read updated invoice balance
      }

      throw err;
    }
  }

  const res = await getPaymentById(madrasaId, createdPaymentId);
  return { ...res, payment: res };
}

/**
 * Voids a payment transaction and reverses affected invoice balances (Mandatory Correction 11).
 *
 * @param {string} madrasaId
 * @param {string} paymentId
 * @param {string} reason
 * @param {string} userId
 * @returns {Promise<object>}
 */
export async function voidPayment(madrasaId, paymentId, reason, userId) {
  const payment = await findTenantRecordOrThrow(prisma.payment, paymentId, madrasaId, {
    include: {
      allocations: true,
      receipt: true,
    },
  });

  if (payment.status === 'VOID') {
    throw new ConflictError('Payment is already voided.');
  }

  const invoiceIds = payment.allocations.map((a) => a.invoiceId);

  await prisma.$transaction(
    async (tx) => {
      // 1. Mark payment as VOID and store reason & timestamp (Mandatory Correction 6)
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'VOID',
          voidedAt: new Date(),
          voidReason: reason.trim(),
        },
      });

      // 2. Recalculate each affected invoice from authoritative remaining COMPLETED allocations
      for (const invoiceId of invoiceIds) {
        const invoice = await tx.invoice.findUnique({
          where: { id: invoiceId },
        });
        if (!invoice) continue;

        const remainingCompletedAllocations = await tx.paymentAllocation.findMany({
          where: {
            madrasaId,
            invoiceId,
            payment: {
              status: 'COMPLETED',
            },
          },
          select: { amount: true },
        });

        const newPaidAmount = remainingCompletedAllocations.reduce(
          (acc, c) => acc.add(c.amount),
          new Prisma.Decimal(0)
        );
        const newBalanceAmount = Prisma.Decimal.max(new Prisma.Decimal(0), invoice.totalAmount.sub(newPaidAmount));

        let newStatus = 'PENDING';
        if (newBalanceAmount.isZero() && newPaidAmount.gt(0)) {
          newStatus = 'PAID';
        } else if (newPaidAmount.gt(0)) {
          newStatus = 'PARTIAL';
        }

        await tx.invoice.update({
          where: { id: invoiceId },
          data: {
            paidAmount: newPaidAmount,
            balanceAmount: newBalanceAmount,
            status: newStatus,
          },
        });
      }

      // 3. ActivityLog audit entry
      await tx.activityLog.create({
        data: {
          madrasaId,
          userId,
          action: 'PAYMENT_VOIDED',
          entityType: 'PAYMENT',
          entityId: payment.id,
          metadata: {
            paymentNo: payment.paymentNo,
            receiptNo: payment.receipt?.receiptNo || null,
            amount: Number(payment.amount).toFixed(2),
            reason: reason.trim(),
          },
        },
      });
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    }
  );

  return await getPaymentById(madrasaId, paymentId);
}

/**
 * Returns a 12-month calendar ledger for a student (Mandatory Correction 7, 8, 9, 10).
 *
 * @param {string} madrasaId
 * @param {string} studentId
 * @param {number} [year]
 * @returns {Promise<object>}
 */
export async function getStudentMonthlyLedger(madrasaId, studentId, year) {
  const student = await findTenantRecordOrThrow(prisma.student, studentId, madrasaId, {
    include: {
      class: { select: { id: true, name: true, code: true, defaultMonthlyFee: true } },
    },
  });

  const tz = await getMadrasaTimezone(madrasaId);
  const ledgerYear = year ? Number(year) : dayjs().tz(tz).year();
  const nowUtc = new Date();

  // Fetch all invoices for this student in this year (INCLUDING VOID, Mandatory Correction 7)
  const invoices = await prisma.invoice.findMany({
    where: {
      madrasaId,
      studentId,
      billingYear: ledgerYear,
    },
    include: {
      allocations: {
        where: {
          payment: { status: 'COMPLETED' },
        },
        include: {
          payment: {
            select: {
              id: true,
              paymentNo: true,
              paidAt: true,
              paymentMethod: true,
              receipt: { select: { id: true, receiptNo: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { billingMonth: 'asc' },
  });

  const invoiceMap = new Map(invoices.map((inv) => [inv.billingMonth, inv]));
  const admissionDate = new Date(student.admissionDate);

  const months = [];
  let totalExpectedDecimal = new Prisma.Decimal(0);
  let totalPaidDecimal = new Prisma.Decimal(0);
  let totalBalanceDecimal = new Prisma.Decimal(0);
  let paidMonthsCount = 0;
  let partialMonthsCount = 0;
  let pendingMonthsCount = 0;
  let overdueMonthsCount = 0;
  let voidMonthsCount = 0;
  let notGeneratedMonthsCount = 0;

  for (let m = 1; m <= 12; m++) {
    const monthName = MONTH_NAMES[m - 1];
    const monthStr = String(m).padStart(2, '0');
    // Month boundaries in tenant timezone
    const periodStart = dayjs.tz(`${ledgerYear}-${monthStr}-01`, tz).startOf('day').toDate();
    const nextMonth = m === 12 ? 1 : m + 1;
    const nextYear = m === 12 ? ledgerYear + 1 : ledgerYear;
    const nextMonthStr = String(nextMonth).padStart(2, '0');
    const periodEndExclusive = dayjs.tz(`${nextYear}-${nextMonthStr}-01`, tz).startOf('day').toDate();

    const existingInvoice = invoiceMap.get(m);

    // Check Pre-admission (Mandatory Correction 8)
    if (admissionDate >= periodEndExclusive) {
      months.push({
        month: m,
        label: monthName,
        monthName,
        invoiceId: null,
        invoiceNo: null,
        expected: null,
        expectedAmount: null,
        paid: '0.00',
        paidAmount: '0.00',
        balance: '0.00',
        balanceAmount: '0.00',
        status: 'NOT_ADMITTED',
        displayStatus: 'NOT_ADMITTED',
        isOverdue: false,
        dueDate: null,
        payments: [],
        allocations: [],
        canAddPayment: false,
        canGenerateInvoice: false,
        isNotAdmitted: true,
      });
      continue;
    }

    if (!existingInvoice) {
      notGeneratedMonthsCount++;
      months.push({
        month: m,
        label: monthName,
        monthName,
        invoiceId: null,
        invoiceNo: null,
        expected: null,
        expectedAmount: null,
        paid: '0.00',
        paidAmount: '0.00',
        balance: '0.00',
        balanceAmount: '0.00',
        status: 'NOT_GENERATED',
        displayStatus: 'NOT_GENERATED',
        isOverdue: false,
        dueDate: null,
        payments: [],
        allocations: [],
        canAddPayment: false,
        canGenerateInvoice: true,
        isNotAdmitted: false,
      });
      continue;
    }

    // Invoice exists
    const inv = existingInvoice;
    const paymentsList = inv.allocations.map((a) => ({
      paymentId: a.payment.id,
      paymentNo: a.payment.paymentNo,
      paidAt: a.payment.paidAt,
      paymentMethod: a.payment.paymentMethod,
      amount: Number(a.amount).toFixed(2),
      receiptId: a.payment.receipt?.id || null,
      receiptNo: a.payment.receipt?.receiptNo || null,
    }));

    if (inv.status === 'VOID') {
      voidMonthsCount++;
      months.push({
        month: m,
        label: monthName,
        monthName,
        invoiceId: inv.id,
        invoiceNo: inv.invoiceNo,
        expected: Number(inv.totalAmount).toFixed(2),
        expectedAmount: Number(inv.totalAmount).toFixed(2),
        paid: '0.00',
        paidAmount: '0.00',
        balance: '0.00',
        balanceAmount: '0.00',
        status: 'VOID',
        displayStatus: 'VOID',
        isOverdue: false,
        dueDate: inv.dueDate,
        payments: paymentsList,
        allocations: paymentsList,
        canAddPayment: false,
        canGenerateInvoice: false,
        isNotAdmitted: false,
      });
      continue;
    }

    // Active invoice: compute completed paid sum (Mandatory Correction 10)
    const completedPaid = inv.allocations.reduce((acc, a) => acc.add(a.amount), new Prisma.Decimal(0));
    const balance = Prisma.Decimal.max(new Prisma.Decimal(0), inv.totalAmount.sub(completedPaid));

    const { displayStatus, isOverdue } = resolveInvoiceDisplayStatus(
      {
        status: inv.status,
        totalAmount: inv.totalAmount,
        balanceAmount: balance,
        dueDate: inv.dueDate,
      },
      nowUtc
    );

    totalExpectedDecimal = totalExpectedDecimal.add(inv.totalAmount);
    totalPaidDecimal = totalPaidDecimal.add(completedPaid);
    totalBalanceDecimal = totalBalanceDecimal.add(balance);

    if (balance.isZero() && completedPaid.gt(0)) {
      paidMonthsCount++;
    } else if (completedPaid.gt(0)) {
      partialMonthsCount++;
    } else {
      pendingMonthsCount++;
    }

    if (isOverdue) {
      overdueMonthsCount++;
    }

    months.push({
      month: m,
      label: monthName,
      monthName,
      invoiceId: inv.id,
      invoiceNo: inv.invoiceNo,
      expected: Number(inv.totalAmount).toFixed(2),
      expectedAmount: Number(inv.totalAmount).toFixed(2),
      paid: completedPaid.toFixed(2),
      paidAmount: completedPaid.toFixed(2),
      balance: balance.toFixed(2),
      balanceAmount: balance.toFixed(2),
      status: inv.status,
      displayStatus,
      isOverdue,
      dueDate: inv.dueDate,
      payments: paymentsList,
      allocations: paymentsList,
      canAddPayment: balance.gt(0),
      canGenerateInvoice: false,
      isNotAdmitted: false,
    });
  }

  return {
    year: ledgerYear,
    student: {
      id: student.id,
      admissionNo: student.admissionNo,
      fullName: student.fullName,
      admissionDate: student.admissionDate,
      monthlyFee: student.monthlyFee ? Number(student.monthlyFee).toFixed(2) : null,
      class: student.class ? { id: student.class.id, name: student.class.name, code: student.class.code } : null,
      currentClass: student.class ? { id: student.class.id, name: student.class.name, code: student.class.code } : null,
    },
    summary: {
      expected: totalExpectedDecimal.toFixed(2),
      totalExpected: totalExpectedDecimal.toFixed(2),
      paid: totalPaidDecimal.toFixed(2),
      totalPaid: totalPaidDecimal.toFixed(2),
      balance: totalBalanceDecimal.toFixed(2),
      totalBalance: totalBalanceDecimal.toFixed(2),
      paidMonths: paidMonthsCount,
      paidMonthsCount,
      partialMonths: partialMonthsCount,
      partialMonthsCount,
      pendingMonths: pendingMonthsCount,
      pendingMonthsCount,
      overdueMonths: overdueMonthsCount,
      overdueMonthsCount,
      voidMonths: voidMonthsCount,
      voidMonthsCount,
      notGeneratedMonths: notGeneratedMonthsCount,
      notGeneratedMonthsCount,
    },
    months,
  };
}

/**
 * Returns a student's outstanding (unpaid/partially paid) non-void invoices for Fee POS.
 *
 * @param {string} madrasaId
 * @param {string} studentId
 * @returns {Promise<object>}
 */
export async function getStudentUnpaidInvoices(madrasaId, studentId) {
  const student = await findTenantRecordOrThrow(prisma.student, studentId, madrasaId, {
    include: {
      class: { select: { id: true, name: true, code: true, defaultMonthlyFee: true } },
    },
  });

  const nowUtc = new Date();

  const invoices = await prisma.invoice.findMany({
    where: {
      madrasaId,
      studentId,
      status: { not: 'VOID' },
      balanceAmount: { gt: 0 },
    },
    include: {
      allocations: {
        where: { payment: { status: 'COMPLETED' } },
        select: { amount: true },
      },
    },
    orderBy: [
      { billingYear: 'asc' },
      { billingMonth: 'asc' },
      { dueDate: 'asc' },
    ],
  });

  let totalOutstandingDecimal = new Prisma.Decimal(0);

  const items = invoices.map((inv) => {
    const completedPaid = inv.allocations.reduce((acc, a) => acc.add(a.amount), new Prisma.Decimal(0));
    const balance = Prisma.Decimal.max(new Prisma.Decimal(0), inv.totalAmount.sub(completedPaid));
    const { displayStatus, isOverdue } = resolveInvoiceDisplayStatus(
      {
        status: inv.status,
        totalAmount: inv.totalAmount,
        balanceAmount: balance,
        dueDate: inv.dueDate,
      },
      nowUtc
    );

    totalOutstandingDecimal = totalOutstandingDecimal.add(balance);

    return {
      id: inv.id,
      invoiceNo: inv.invoiceNo,
      billingYear: inv.billingYear,
      billingMonth: inv.billingMonth,
      monthName: MONTH_NAMES[inv.billingMonth - 1],
      totalAmount: Number(inv.totalAmount).toFixed(2),
      paidAmount: completedPaid.toFixed(2),
      balanceAmount: balance.toFixed(2),
      status: inv.status,
      displayStatus,
      isOverdue,
      dueDate: inv.dueDate,
    };
  });

  return {
    student: {
      id: student.id,
      admissionNo: student.admissionNo,
      fullName: student.fullName,
      currentClass: student.class ? { id: student.class.id, name: student.class.name, code: student.class.code } : null,
      monthlyFee: student.monthlyFee ? Number(student.monthlyFee).toFixed(2) : null,
    },
    totalOutstanding: totalOutstandingDecimal.toFixed(2),
    invoices: items,
  };
}

/**
 * Searches students for the Fee POS by admissionNo, fullName, guardianName, guardianPhone, or WhatsApp.
 *
 * @param {string} madrasaId
 * @param {string} query
 * @returns {Promise<object[]>}
 */
export async function searchStudentsForPOS(madrasaId, query) {
  const q = query.trim();
  if (!q) return [];

  const students = await prisma.student.findMany({
    where: {
      madrasaId,
      status: 'ACTIVE',
      OR: [
        { admissionNo: { contains: q } },
        { fullName: { contains: q } },
        { guardianName: { contains: q } },
        { guardianPhone: { contains: q } },
        { whatsappNumber: { contains: q } },
      ],
    },
    include: {
      class: {
        select: {
          id: true,
          name: true,
          code: true,
          defaultMonthlyFee: true,
          academicSectionId: true,
          academicSection: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      },
      invoices: {
        where: {
          status: { not: 'VOID' },
          balanceAmount: { gt: 0 },
        },
        select: { balanceAmount: true },
      },
    },
    take: 15,
    orderBy: { admissionNo: 'asc' },
  });

  return students.map((s) => {
    const outstandingSum = s.invoices.reduce((acc, inv) => acc.add(inv.balanceAmount), new Prisma.Decimal(0));
    return {
      id: s.id,
      admissionNo: s.admissionNo,
      fullName: s.fullName,
      guardianName: s.guardianName,
      guardianPhone: s.guardianPhone,
      whatsappNumber: s.whatsappNumber,
      class: s.class
        ? {
            id: s.class.id,
            name: s.class.name,
            code: s.class.code,
            academicSectionId: s.class.academicSectionId,
            academicSection: s.class.academicSection
              ? {
                  id: s.class.academicSection.id,
                  name: s.class.academicSection.name,
                  code: s.class.academicSection.code,
                }
              : null,
            sectionName: s.class.academicSection ? s.class.academicSection.name : 'Unassigned',
          }
        : null,
      sectionName: s.class?.academicSection ? s.class.academicSection.name : 'Unassigned',
      monthlyFee: s.monthlyFee ? Number(s.monthlyFee).toFixed(2) : (s.class ? Number(s.class.defaultMonthlyFee).toFixed(2) : '0.00'),
      unpaidInvoicesCount: s.invoices.length,
      totalOutstanding: outstandingSum.toFixed(2),
    };
  });
}

/**
 * Lists tenant payments with search, filters, pagination, and summary KPIs (Mandatory Correction 13, 14).
 *
 * @param {string} madrasaId
 * @param {object} query
 * @returns {Promise<object>}
 */
export async function listPayments(madrasaId, query) {
  const {
    page = 1,
    pageSize = 20,
    search,
    studentId,
    paymentMethod = 'ALL',
    status = 'ALL',
    startDate,
    endDate,
    sortBy = 'paidAt',
    sortOrder = 'desc',
  } = query;

  const tz = await getMadrasaTimezone(madrasaId);
  const skip = (page - 1) * pageSize;
  const take = pageSize;

  const baseWhere = { madrasaId };

  if (studentId) baseWhere.studentId = studentId;
  if (paymentMethod !== 'ALL') baseWhere.paymentMethod = paymentMethod;

  // Timezone-aware date filters (Mandatory Correction 13)
  if (startDate || endDate) {
    baseWhere.paidAt = {};
    if (startDate) {
      baseWhere.paidAt.gte = dayjs.tz(startDate, tz).startOf('day').toDate();
    }
    if (endDate) {
      baseWhere.paidAt.lte = dayjs.tz(endDate, tz).endOf('day').toDate();
    }
  }

  if (search && search.trim()) {
    const q = search.trim();
    baseWhere.OR = [
      { paymentNo: { contains: q } },
      { receipt: { receiptNo: { contains: q } } },
      { student: { admissionNo: { contains: q } } },
      { student: { fullName: { contains: q } } },
      { reference: { contains: q } },
    ];
  }

  const itemsWhere = { ...baseWhere };
  if (status !== 'ALL') {
    itemsWhere.status = status;
  }

  // 1. Fetch paginated records & count
  const [payments, totalItems] = await Promise.all([
    prisma.payment.findMany({
      where: itemsWhere,
      include: {
        student: {
          select: {
            id: true,
            admissionNo: true,
            fullName: true,
            class: { select: { id: true, name: true, code: true } },
          },
        },
        receipt: { select: { id: true, receiptNo: true, issuedAt: true } },
        allocations: {
          select: {
            id: true,
            amount: true,
            invoice: {
              select: {
                id: true,
                invoiceNo: true,
                billingYear: true,
                billingMonth: true,
              },
            },
          },
        },
      },
      orderBy: { [sortBy]: sortOrder },
      skip,
      take,
    }),
    prisma.payment.count({ where: itemsWhere }),
  ]);

  // 2. Compute Summary KPIs on filtered base scope (Mandatory Correction 14)
  const [completedAgg, cashAgg, bankAgg, cardAgg, otherAgg, voidCount, voidAgg] = await Promise.all([
    prisma.payment.aggregate({
      where: { ...baseWhere, status: 'COMPLETED' },
      _sum: { amount: true },
      _count: { id: true },
    }),
    prisma.payment.aggregate({
      where: { ...baseWhere, status: 'COMPLETED', paymentMethod: 'CASH' },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { ...baseWhere, status: 'COMPLETED', paymentMethod: 'BANK_TRANSFER' },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { ...baseWhere, status: 'COMPLETED', paymentMethod: 'CARD' },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { ...baseWhere, status: 'COMPLETED', paymentMethod: 'OTHER' },
      _sum: { amount: true },
    }),
    prisma.payment.count({
      where: { ...baseWhere, status: 'VOID' },
    }),
    prisma.payment.aggregate({
      where: { ...baseWhere, status: 'VOID' },
      _sum: { amount: true },
    }),
  ]);

  const summary = {
    totalCollected: Number(completedAgg._sum.amount || 0).toFixed(2),
    totalCount: completedAgg._count.id || 0,
    cashCollected: Number(cashAgg._sum.amount || 0).toFixed(2),
    bankTransferCollected: Number(bankAgg._sum.amount || 0).toFixed(2),
    cardCollected: Number(cardAgg._sum.amount || 0).toFixed(2),
    otherCollected: Number(otherAgg._sum.amount || 0).toFixed(2),
    voidedCount: voidCount,
    voidedAmount: Number(voidAgg._sum.amount || 0).toFixed(2),
  };

  const mappedItems = payments.map((p) => ({
    id: p.id,
    paymentNo: p.paymentNo,
    amount: Number(p.amount).toFixed(2),
    paymentMethod: p.paymentMethod,
    reference: p.reference,
    notes: p.notes,
    status: p.status,
    paidAt: p.paidAt,
    voidedAt: p.voidedAt,
    voidReason: p.voidReason,
    student: {
      id: p.student.id,
      admissionNo: p.student.admissionNo,
      fullName: p.student.fullName,
      currentClass: p.student.class
        ? { id: p.student.class.id, name: p.student.class.name, code: p.student.class.code }
        : null,
    },
    receipt: p.receipt
      ? { id: p.receipt.id, receiptNo: p.receipt.receiptNo, issuedAt: p.receipt.issuedAt }
      : null,
    allocations: p.allocations.map((a) => ({
      id: a.id,
      amount: Number(a.amount).toFixed(2),
      invoiceId: a.invoice.id,
      invoiceNo: a.invoice.invoiceNo,
      billingYear: a.invoice.billingYear,
      billingMonth: a.invoice.billingMonth,
      monthName: MONTH_NAMES[a.invoice.billingMonth - 1],
    })),
    createdAt: p.createdAt,
  }));

  return {
    items: mappedItems,
    pagination: {
      page: Number(page),
      pageSize: Number(pageSize),
      total: totalItems,
      totalPages: Math.ceil(totalItems / pageSize) || 1,
    },
    summary,
  };
}

/**
 * Retrieves a payment detail dossier with allocations, receipt, and void metadata.
 *
 * @param {string} madrasaId
 * @param {string} paymentId
 * @returns {Promise<object>}
 */
export async function getPaymentById(madrasaId, paymentId) {
  const payment = await findTenantRecordOrThrow(prisma.payment, paymentId, madrasaId, {
    include: {
      student: {
        select: {
          id: true,
          admissionNo: true,
          fullName: true,
          guardianName: true,
          guardianPhone: true,
          whatsappNumber: true,
          class: { select: { id: true, name: true, code: true } },
        },
      },
      receipt: true,
      allocations: {
        include: {
          invoice: {
            select: {
              id: true,
              invoiceNo: true,
              billingYear: true,
              billingMonth: true,
              totalAmount: true,
              balanceAmount: true,
              status: true,
            },
          },
        },
      },
    },
  });

  // If VOID, retrieve void metadata from ActivityLog
  let voidMetadata = null;
  if (payment.status === 'VOID') {
    const voidLog = await prisma.activityLog.findFirst({
      where: {
        madrasaId,
        entityId: payment.id,
        action: 'PAYMENT_VOIDED',
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    voidMetadata = {
      voidedAt: payment.voidedAt || voidLog?.createdAt || payment.updatedAt,
      reason: payment.voidReason || voidLog?.metadata?.reason || 'No reason provided',
      voidedBy: voidLog?.user?.name || voidLog?.user?.email || 'Administrator',
    };
  }

  return {
    id: payment.id,
    paymentNo: payment.paymentNo,
    amount: Number(payment.amount).toFixed(2),
    paymentMethod: payment.paymentMethod,
    reference: payment.reference,
    notes: payment.notes,
    status: payment.status,
    paidAt: payment.paidAt,
    createdAt: payment.createdAt,
    voidMetadata,
    student: {
      id: payment.student.id,
      admissionNo: payment.student.admissionNo,
      fullName: payment.student.fullName,
      guardianName: payment.student.guardianName,
      guardianPhone: payment.student.guardianPhone,
      whatsappNumber: payment.student.whatsappNumber,
      currentClass: payment.student.class
        ? { id: payment.student.class.id, name: payment.student.class.name, code: payment.student.class.code }
        : null,
    },
    receipt: payment.receipt
      ? {
          id: payment.receipt.id,
          receiptNo: payment.receipt.receiptNo,
          issuedAt: payment.receipt.issuedAt,
        }
      : null,
    allocations: payment.allocations.map((a) => ({
      id: a.id,
      amount: Number(a.amount).toFixed(2),
      invoiceId: a.invoice.id,
      invoiceNo: a.invoice.invoiceNo,
      billingYear: a.invoice.billingYear,
      billingMonth: a.invoice.billingMonth,
      monthName: MONTH_NAMES[a.invoice.billingMonth - 1],
      invoiceTotal: Number(a.invoice.totalAmount).toFixed(2),
      invoiceBalance: Number(a.invoice.balanceAmount).toFixed(2),
      invoiceStatus: a.invoice.status,
    })),
  };
}

/**
 * Retrieves a receipt by ID with linked payment, allocations, student, and Madrasa branding (Mandatory Correction 16).
 *
 * @param {string} madrasaId
 * @param {string} receiptId
 * @returns {Promise<object>}
 */
export async function getReceiptById(madrasaId, receiptId) {
  const receipt = await findTenantRecordOrThrow(prisma.receipt, receiptId, madrasaId, {
    include: {
      payment: {
        include: {
          student: {
            select: {
              id: true,
              admissionNo: true,
              fullName: true,
              guardianName: true,
              guardianPhone: true,
              whatsappNumber: true,
              class: { select: { id: true, name: true, code: true } },
            },
          },
          allocations: {
            include: {
              invoice: {
                select: {
                  id: true,
                  invoiceNo: true,
                  billingYear: true,
                  billingMonth: true,
                  totalAmount: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const setting = await prisma.madrasaSetting.findUnique({
    where: { madrasaId },
    include: {
      madrasa: { select: { name: true, code: true, logoFileId: true } },
    },
  });

  let logoUrl = null;
  if (setting?.madrasa?.logoFileId) {
    try {
      const fileObj = await prisma.fileObject.findFirst({
        where: { id: setting.madrasa.logoFileId, madrasaId, type: 'MADRASA_LOGO' },
        select: { objectKey: true },
      });
      if (fileObj?.objectKey) {
        logoUrl = await resolveObjectAccessUrl(fileObj.objectKey);
      }
    } catch (e) {
      // Non-blocking fallback
    }
  }

  const p = receipt.payment;

  return {
    id: receipt.id,
    receiptNo: receipt.receiptNo,
    issuedAt: receipt.issuedAt,
    createdAt: receipt.createdAt,
    isVoid: p.status === 'VOID', // Derived safely (Mandatory Correction 16)
    payment: {
      id: p.id,
      paymentNo: p.paymentNo,
      amount: Number(p.amount).toFixed(2),
      paymentMethod: p.paymentMethod,
      reference: p.reference,
      notes: p.notes,
      status: p.status,
      paidAt: p.paidAt,
      voidedAt: p.voidedAt,
      voidReason: p.voidReason,
    },
    student: {
      id: p.student.id,
      admissionNo: p.student.admissionNo,
      fullName: p.student.fullName,
      guardianName: p.student.guardianName,
      guardianPhone: p.student.guardianPhone,
      whatsappNumber: p.student.whatsappNumber,
      currentClass: p.student.class
        ? { id: p.student.class.id, name: p.student.class.name, code: p.student.class.code }
        : null,
    },
    allocations: p.allocations.map((a) => ({
      id: a.id,
      amount: Number(a.amount).toFixed(2),
      invoiceId: a.invoice.id,
      invoiceNo: a.invoice.invoiceNo,
      billingYear: a.invoice.billingYear,
      billingMonth: a.invoice.billingMonth,
      monthName: MONTH_NAMES[a.invoice.billingMonth - 1],
      invoiceTotal: Number(a.invoice.totalAmount).toFixed(2),
    })),
    institution: {
      name: setting?.madrasa?.name || 'Madrasa',
      code: setting?.madrasa?.code || null,
      currency: setting?.currency || 'LKR',
      receiptHeader: setting?.receiptHeader || null,
      receiptFooter: setting?.receiptFooter || null,
      logoUrl,
    },
    madrasa: {
      id: madrasaId,
      name: setting?.madrasa?.name || 'Madrasa',
      code: setting?.madrasa?.code || null,
      logoUrl,
      branding: {
        receiptHeader: setting?.receiptHeader || null,
        receiptFooter: setting?.receiptFooter || null,
        currency: setting?.currency || 'LKR',
      },
    },
  };
}

/**
 * Returns paginated payments for a student.
 *
 * @param {string} madrasaId
 * @param {string} studentId
 * @param {object} query
 * @returns {Promise<object>}
 */
export async function getStudentPayments(madrasaId, studentId, query = {}) {
  await assertTenantOwnership(prisma.student, studentId, madrasaId);

  const page = Number(query.page) || 1;
  const pageSize = Number(query.pageSize) || 20;
  const skip = (page - 1) * pageSize;
  const take = pageSize;

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where: { madrasaId, studentId },
      include: {
        receipt: { select: { id: true, receiptNo: true } },
        allocations: {
          select: {
            id: true,
            amount: true,
            invoice: { select: { invoiceNo: true, billingYear: true, billingMonth: true } },
          },
        },
      },
      orderBy: { paidAt: 'desc' },
      skip,
      take,
    }),
    prisma.payment.count({ where: { madrasaId, studentId } }),
  ]);

  const items = payments.map((p) => ({
    id: p.id,
    paymentNo: p.paymentNo,
    amount: Number(p.amount).toFixed(2),
    paymentMethod: p.paymentMethod,
    reference: p.reference,
    status: p.status,
    paidAt: p.paidAt,
    receiptNo: p.receipt?.receiptNo || null,
    receiptId: p.receipt?.id || null,
    allocations: p.allocations.map((a) => ({
      id: a.id,
      amount: Number(a.amount).toFixed(2),
      invoiceNo: a.invoice.invoiceNo,
      billingYear: a.invoice.billingYear,
      billingMonth: a.invoice.billingMonth,
      monthName: MONTH_NAMES[a.invoice.billingMonth - 1],
    })),
  }));

  return {
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 1,
    },
  };
}
