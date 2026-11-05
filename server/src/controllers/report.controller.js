import { prisma } from '../lib/prisma.js';
import * as reportService from '../services/report.service.js';
import { generateCsvString } from '../services/csv-report.service.js';
import { generateReportPdf } from '../services/pdf-report.service.js';
import { reportQuerySchema, studentStatementQuerySchema } from '../validations/report.validation.js';

/**
 * Sanitizes a filename to prevent path traversal and invalid characters.
 *
 * @param {string} rawName
 * @returns {string}
 */
export function sanitizeFilename(rawName) {
  return rawName
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\.{2,}/g, '_')
    .replace(/[\x00-\x1f\x80-\x9f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 100);
}

/**
 * Best-effort audit logging for report downloads without blocking response streams.
 */
async function recordExportAudit(madrasaId, userId, format, reportData) {
  try {
    await prisma.activityLog.create({
      data: {
        madrasaId,
        userId: userId || null,
        action: format === 'pdf' ? 'REPORT_PDF_EXPORTED' : 'REPORT_CSV_EXPORTED',
        entityType: 'REPORT',
        metadata: {
          reportType: reportData.reportType,
          rowCount: reportData.totalRecords,
          filters: reportData.filters || {},
        },
      },
    });
  } catch (err) {
    // Non-blocking: failure to write audit log must not disrupt file download
  }
}

/**
 * Dispatches report output according to requested format (json / pdf / csv).
 */
async function respondWithReport(req, res, reportData, query, defaultFilenamePrefix) {
  const format = query.format || 'json';
  const madrasaId = req.tenant.madrasaId;
  const periodSlug = reportData.period ? reportData.period.replace(/[^a-zA-Z0-9]/g, '_') : 'Report';
  const filename = sanitizeFilename(`${defaultFilenamePrefix}_${periodSlug}`);

  if (format === 'pdf') {
    const isLandscape = ['PAID_STUDENTS', 'UNPAID_STUDENTS', 'PARTIAL_PAYMENTS', 'OVERDUE_STUDENTS', 'OUTSTANDING_BALANCE', 'CASH_COLLECTION', 'PAYMENT_HISTORY'].includes(reportData.reportType);
    const pdfBuffer = await generateReportPdf(reportData, { landscape: isLandscape });

    // Non-blocking audit log
    recordExportAudit(madrasaId, req.user?.id, 'pdf', reportData);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.send(pdfBuffer);
  }

  if (format === 'csv') {
    const csvTable = convertReportDataToCsv(reportData);
    const csvString = generateCsvString(csvTable);

    // Non-blocking audit log
    recordExportAudit(madrasaId, req.user?.id, 'csv', reportData);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
    return res.send(csvString);
  }

  // JSON Preview Response
  // Mandatory Correction #12 & #13: Summary KPI values represent the whole filtered dataset.
  // Preview pagination only slices the displayed records array.
  const page = query.page || 1;
  const limit = query.limit || 20;
  const startIndex = (page - 1) * limit;
  const paginatedRecords = reportData.records.slice(startIndex, startIndex + limit);

  return res.json({
    success: true,
    data: {
      ...reportData,
      records: paginatedRecords,
      pagination: {
        page,
        limit,
        totalRecords: reportData.totalRecords,
        totalPages: Math.ceil(reportData.totalRecords / limit) || 1,
      },
    },
  });
}

/**
 * Converts report records into CSV headers and matrix rows.
 */
function convertReportDataToCsv(reportData) {
  const { reportType, records } = reportData;

  switch (reportType) {
    case 'PAID_STUDENTS':
      return {
        headers: ['Admission No', 'Student Name', 'Current Section', 'Current Class', 'Invoice No', 'Expected Fee', 'Paid Amount', 'Balance', 'Status', 'Last Payment Date', 'Receipt No'],
        rows: records.map((r) => [
          r.admissionNo,
          r.studentName,
          r.sectionName,
          r.className,
          r.invoiceNo,
          r.expectedAmount,
          r.paidAmount,
          r.balanceAmount,
          r.status,
          r.lastPaymentDate,
          r.receiptNo,
        ]),
      };

    case 'UNPAID_STUDENTS':
      return {
        headers: ['Admission No', 'Student Name', 'Current Section', 'Current Class', 'Invoice No', 'Expected Fee', 'Paid Amount', 'Balance', 'Due Date', 'Status', 'Guardian Name', 'Guardian Phone'],
        rows: records.map((r) => [
          r.admissionNo,
          r.studentName,
          r.sectionName,
          r.className,
          r.invoiceNo,
          r.expectedAmount,
          r.paidAmount,
          r.balanceAmount,
          r.dueDate,
          r.status,
          r.guardianName,
          r.guardianPhone,
        ]),
      };

    case 'PARTIAL_PAYMENTS':
      return {
        headers: ['Admission No', 'Student Name', 'Current Section', 'Current Class', 'Invoice No', 'Expected Fee', 'Paid Amount', 'Balance', 'Due Date', 'Status', 'Last Payment Date'],
        rows: records.map((r) => [
          r.admissionNo,
          r.studentName,
          r.sectionName,
          r.className,
          r.invoiceNo,
          r.expectedAmount,
          r.paidAmount,
          r.balanceAmount,
          r.dueDate,
          r.status,
          r.lastPaymentDate,
        ]),
      };

    case 'OVERDUE_STUDENTS':
      return {
        headers: ['Admission No', 'Student Name', 'Current Section', 'Current Class', 'Billing Period', 'Invoice No', 'Expected Fee', 'Paid Amount', 'Balance', 'Due Date', 'Days Overdue'],
        rows: records.map((r) => [
          r.admissionNo,
          r.studentName,
          r.sectionName,
          r.className,
          r.billingPeriod,
          r.invoiceNo,
          r.expectedAmount,
          r.paidAmount,
          r.balanceAmount,
          r.dueDate,
          r.daysOverdue,
        ]),
      };

    case 'OUTSTANDING_BALANCE':
      return {
        headers: ['Admission No', 'Student Name', 'Current Section', 'Current Class', 'Billing Period', 'Invoice No', 'Expected Fee', 'Paid Amount', 'Balance', 'Due Date', 'Status'],
        rows: records.map((r) => [
          r.admissionNo,
          r.studentName,
          r.sectionName,
          r.className,
          r.billingPeriod,
          r.invoiceNo,
          r.expectedAmount,
          r.paidAmount,
          r.balanceAmount,
          r.dueDate,
          r.status,
        ]),
      };

    case 'SECTION_COLLECTION':
      return {
        headers: ['Section Name', 'Students Billed', 'Expected Amount', 'Collected Amount', 'Outstanding Amount', 'Collection Rate'],
        rows: records.map((r) => [
          r.sectionName,
          r.studentsBilled,
          r.expectedAmount,
          r.collectedAmount,
          r.outstandingAmount,
          r.collectionRate,
        ]),
      };

    case 'CLASS_COLLECTION':
      return {
        headers: ['Section Name', 'Class Name', 'Students Billed', 'Expected Amount', 'Collected Amount', 'Outstanding Amount', 'Paid Count', 'Partial Count', 'Unpaid Count', 'Collection Rate'],
        rows: records.map((r) => [
          r.sectionName,
          r.className,
          r.studentsBilled,
          r.expectedAmount,
          r.collectedAmount,
          r.outstandingAmount,
          r.paidCount,
          r.partialCount,
          r.unpaidCount,
          r.collectionRate,
        ]),
      };

    case 'CASH_COLLECTION':
      return {
        headers: ['Payment Date', 'Payment No', 'Receipt No', 'Admission No', 'Student Name', 'Class', 'Payment Method', 'Reference', 'Amount', 'Allocated Month(s)'],
        rows: records.map((r) => [
          r.paidAt,
          r.paymentNo,
          r.receiptNo,
          r.admissionNo,
          r.studentName,
          r.className,
          r.paymentMethod,
          r.reference,
          r.amount,
          r.allocatedMonths,
        ]),
      };

    case 'PAYMENT_METHOD_SUMMARY':
      return {
        headers: ['Payment Method', 'Completed Transactions', 'Completed Amount', 'Void Transactions', 'Void Amount', 'Share Rate'],
        rows: records.map((r) => [
          r.paymentMethod,
          r.transactionCount,
          r.completedAmount,
          r.voidCount,
          r.voidAmount,
          r.shareRate,
        ]),
      };

    case 'PAYMENT_HISTORY':
      return {
        headers: ['Payment Date', 'Payment No', 'Receipt No', 'Admission No', 'Student Name', 'Current Class', 'Payment Method', 'Reference', 'Amount', 'Status', 'Allocated Periods'],
        rows: records.map((r) => [
          r.paidAt,
          r.paymentNo,
          r.receiptNo,
          r.admissionNo,
          r.studentName,
          r.className,
          r.paymentMethod,
          r.reference,
          r.amount,
          r.status,
          r.allocatedPeriods,
        ]),
      };

    case 'MISSING_INVOICES':
      return {
        headers: ['Admission No', 'Student Name', 'Current Section', 'Current Class', 'Admission Date', 'Expected Fee', 'Status', 'Guardian Name', 'Guardian Phone'],
        rows: records.map((r) => [
          r.admissionNo,
          r.studentName,
          r.sectionName,
          r.className,
          r.admissionDate,
          r.expectedFee,
          r.status,
          r.guardianName,
          r.guardianPhone,
        ]),
      };

    case 'STUDENT_STATEMENT':
      return {
        headers: ['Billing Month', 'Invoice No', 'Issue Date', 'Due Date', 'Expected Amount', 'Paid Amount', 'Balance', 'Status'],
        rows: (reportData.billingLedger || []).map((r) => [
          r.month,
          r.invoiceNo,
          r.issueDate,
          r.dueDate,
          r.expectedAmount,
          r.paidAmount,
          r.balanceAmount,
          r.status,
        ]),
      };

    default:
      return { headers: ['Data'], rows: [] };
  }
}

// Controller Handlers

export async function getPaidStudentsReport(req, res) {
  const query = reportQuerySchema.parse(req.query);
  const madrasaId = req.tenant.madrasaId;
  const reportData = await reportService.buildPaidStudentsReport(madrasaId, query);
  return respondWithReport(req, res, reportData, query, 'MadrasaNexa_Paid_Students');
}

export async function getUnpaidStudentsReport(req, res) {
  const query = reportQuerySchema.parse(req.query);
  const madrasaId = req.tenant.madrasaId;
  const reportData = await reportService.buildUnpaidStudentsReport(madrasaId, query);
  return respondWithReport(req, res, reportData, query, 'MadrasaNexa_Unpaid_Students');
}

export async function getPartialPaymentsReport(req, res) {
  const query = reportQuerySchema.parse(req.query);
  const madrasaId = req.tenant.madrasaId;
  const reportData = await reportService.buildPartialPaymentsReport(madrasaId, query);
  return respondWithReport(req, res, reportData, query, 'MadrasaNexa_Partial_Payments');
}

export async function getOverdueStudentsReport(req, res) {
  const query = reportQuerySchema.parse(req.query);
  const madrasaId = req.tenant.madrasaId;
  const reportData = await reportService.buildOverdueStudentsReport(madrasaId, query);
  return respondWithReport(req, res, reportData, query, 'MadrasaNexa_Overdue_Students');
}

export async function getOutstandingReport(req, res) {
  const query = reportQuerySchema.parse(req.query);
  const madrasaId = req.tenant.madrasaId;
  const reportData = await reportService.buildOutstandingReport(madrasaId, query);
  return respondWithReport(req, res, reportData, query, 'MadrasaNexa_Outstanding_Report');
}

export async function getMonthlyCollectionReport(req, res) {
  const query = reportQuerySchema.parse(req.query);
  const madrasaId = req.tenant.madrasaId;
  const reportData = await reportService.buildMonthlyCollectionReport(madrasaId, query);
  return respondWithReport(req, res, reportData, query, 'MadrasaNexa_Monthly_Collection');
}

export async function getSectionWiseCollectionReport(req, res) {
  const query = reportQuerySchema.parse(req.query);
  const madrasaId = req.tenant.madrasaId;
  const reportData = await reportService.buildSectionWiseCollectionReport(madrasaId, query);
  return respondWithReport(req, res, reportData, query, 'MadrasaNexa_Section_Collection');
}

export async function getClassWiseCollectionReport(req, res) {
  const query = reportQuerySchema.parse(req.query);
  const madrasaId = req.tenant.madrasaId;
  const reportData = await reportService.buildClassWiseCollectionReport(madrasaId, query);
  return respondWithReport(req, res, reportData, query, 'MadrasaNexa_Class_Collection');
}

export async function getCashCollectionReport(req, res) {
  const query = reportQuerySchema.parse(req.query);
  const madrasaId = req.tenant.madrasaId;
  const reportData = await reportService.buildCashCollectionReport(madrasaId, query);
  return respondWithReport(req, res, reportData, query, 'MadrasaNexa_Cash_Collection');
}

export async function getPaymentMethodSummaryReport(req, res) {
  const query = reportQuerySchema.parse(req.query);
  const madrasaId = req.tenant.madrasaId;
  const reportData = await reportService.buildPaymentMethodSummaryReport(madrasaId, query);
  return respondWithReport(req, res, reportData, query, 'MadrasaNexa_Payment_Method_Summary');
}

export async function getPaymentHistoryReport(req, res) {
  const query = reportQuerySchema.parse(req.query);
  const madrasaId = req.tenant.madrasaId;
  const reportData = await reportService.buildPaymentHistoryReport(madrasaId, query);
  return respondWithReport(req, res, reportData, query, 'MadrasaNexa_Payment_History');
}

export async function getMissingInvoicesReport(req, res) {
  const query = reportQuerySchema.parse(req.query);
  const madrasaId = req.tenant.madrasaId;
  const reportData = await reportService.buildMissingInvoicesReport(madrasaId, query);
  return respondWithReport(req, res, reportData, query, 'MadrasaNexa_Missing_Invoices');
}

export async function getStudentStatementReport(req, res) {
  const query = studentStatementQuerySchema.parse(req.query);
  const madrasaId = req.tenant.madrasaId;
  const studentId = req.params.studentId;
  const reportData = await reportService.buildStudentStatementReport(madrasaId, studentId, query);
  const studentAdm = reportData.student?.admissionNo || studentId;
  return respondWithReport(req, res, reportData, query, `MadrasaNexa_Student_${studentAdm}_Statement`);
}
