import * as invoiceService from '../services/invoice.service.js';
import {
  previewInvoicesSchema,
  generateInvoicesSchema,
  listInvoicesQuerySchema,
  voidInvoiceSchema,
  studentInvoiceHistoryQuerySchema,
} from '../validations/invoice.validation.js';

export async function previewInvoices(req, res) {
  const validated = previewInvoicesSchema.parse(req.body);
  const result = await invoiceService.previewMonthlyInvoices(req.tenant.madrasaId, validated);
  res.json({
    success: true,
    data: result,
  });
}

export async function generateInvoices(req, res) {
  const validated = generateInvoicesSchema.parse(req.body);
  const result = await invoiceService.generateMonthlyInvoices(
    req.tenant.madrasaId,
    validated,
    req.auth.userId
  );
  res.status(201).json({
    success: true,
    message: 'Invoices processed successfully.',
    data: result,
  });
}

export async function listInvoices(req, res) {
  const validated = listInvoicesQuerySchema.parse(req.query);
  const result = await invoiceService.listInvoices(req.tenant.madrasaId, validated);
  res.json({
    success: true,
    data: result,
  });
}

export async function getInvoice(req, res) {
  const result = await invoiceService.getInvoiceById(req.tenant.madrasaId, req.params.id);
  res.json({
    success: true,
    data: result,
  });
}

export async function voidInvoice(req, res) {
  const validated = voidInvoiceSchema.parse(req.body);
  const result = await invoiceService.voidInvoice(
    req.tenant.madrasaId,
    req.params.id,
    validated.reason,
    req.auth.userId
  );
  res.json({
    success: true,
    message: 'Invoice voided successfully.',
    data: result,
  });
}

export async function getStudentInvoices(req, res) {
  const validated = studentInvoiceHistoryQuerySchema.parse(req.query);
  const result = await invoiceService.getStudentInvoices(
    req.tenant.madrasaId,
    req.params.id,
    validated
  );
  res.json({
    success: true,
    data: result,
  });
}
