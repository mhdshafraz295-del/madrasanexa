import {
  createPaymentSchema,
  voidPaymentSchema,
  listPaymentsQuerySchema,
  monthlyLedgerQuerySchema,
  posSearchQuerySchema,
} from '../validations/payment.validation.js';
import * as paymentService from '../services/payment.service.js';

export async function createPayment(req, res) {
  const validated = createPaymentSchema.parse(req.body);
  const payment = await paymentService.createPayment(
    req.tenant.madrasaId,
    validated,
    req.auth.userId
  );
  return res.status(201).json({
    success: true,
    message: 'Payment recorded successfully.',
    data: payment,
  });
}

export async function voidPayment(req, res) {
  const validated = voidPaymentSchema.parse(req.body);
  const payment = await paymentService.voidPayment(
    req.tenant.madrasaId,
    req.params.id,
    validated.reason,
    req.auth.userId
  );
  return res.status(200).json({
    success: true,
    message: 'Payment voided successfully.',
    data: payment,
  });
}

export async function getStudentMonthlyLedger(req, res) {
  const validated = monthlyLedgerQuerySchema.parse(req.query);
  const ledger = await paymentService.getStudentMonthlyLedger(
    req.tenant.madrasaId,
    req.params.studentId,
    validated.year
  );
  return res.status(200).json({
    success: true,
    data: ledger,
  });
}

export async function getStudentUnpaidInvoices(req, res) {
  const data = await paymentService.getStudentUnpaidInvoices(
    req.tenant.madrasaId,
    req.params.studentId
  );
  return res.status(200).json({
    success: true,
    data,
  });
}

export async function searchStudentsForPOS(req, res) {
  const validated = posSearchQuerySchema.parse(req.query);
  const students = await paymentService.searchStudentsForPOS(
    req.tenant.madrasaId,
    validated.q
  );
  return res.status(200).json({
    success: true,
    data: students,
  });
}

export async function listPayments(req, res) {
  const validated = listPaymentsQuerySchema.parse(req.query);
  const result = await paymentService.listPayments(
    req.tenant.madrasaId,
    validated
  );
  return res.status(200).json({
    success: true,
    data: result,
  });
}

export async function getPayment(req, res) {
  const payment = await paymentService.getPaymentById(
    req.tenant.madrasaId,
    req.params.id
  );
  return res.status(200).json({
    success: true,
    data: payment,
  });
}

export async function getReceipt(req, res) {
  const receipt = await paymentService.getReceiptById(
    req.tenant.madrasaId,
    req.params.id
  );
  return res.status(200).json({
    success: true,
    data: receipt,
  });
}

export async function getStudentPayments(req, res) {
  const data = await paymentService.getStudentPayments(
    req.tenant.madrasaId,
    req.params.studentId,
    req.query
  );
  return res.status(200).json({
    success: true,
    data,
  });
}
