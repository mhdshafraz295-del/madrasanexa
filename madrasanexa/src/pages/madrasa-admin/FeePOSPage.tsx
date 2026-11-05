import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Coins,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  User,
  CreditCard,
  FileText,
  RefreshCw,
  Sparkles,
  FilePlus,
  Plus,
  Info,
} from 'lucide-react';
import {
  apiSearchStudentsForPOS,
  apiGetStudentUnpaidInvoices,
  apiCreatePayment,
  apiGenerateInvoices,
  apiGetInvoice,
  apiGetMadrasaSettings,
  type POSStudentSearchResult,
  type POSOutstandingInvoice,
  type PaymentMethod,
  type PaymentDetail,
} from '../../services/api';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'idemp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
}

function getDatePartsInTimezone(tz: string) {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
    const parts = formatter.formatToParts(new Date());
    let year = new Date().getFullYear();
    let month = new Date().getMonth() + 1;
    let day = new Date().getDate();
    for (const part of parts) {
      if (part.type === 'year') year = parseInt(part.value, 10);
      if (part.type === 'month') month = parseInt(part.value, 10);
      if (part.type === 'day') day = parseInt(part.value, 10);
    }
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return { year, month, day, dateStr };
  } catch {
    const d = new Date();
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return { year, month, day, dateStr };
  }
}

export default function FeePOSPage() {
  const navigate = useNavigate();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<POSStudentSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  // Selected student state
  const [selectedStudent, setSelectedStudent] = useState<POSStudentSearchResult | null>(null);
  const [unpaidInvoices, setUnpaidInvoices] = useState<POSOutstandingInvoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  // Tenant Settings & Timezone state
  const [madrasaTimezone, setMadrasaTimezone] = useState<string>('Asia/Colombo');
  const initialTzNow = getDatePartsInTimezone('Asia/Colombo');

  // Invoice generation state inside Fee POS
  const [genYear, setGenYear] = useState<number>(initialTzNow.year);
  const [genMonth, setGenMonth] = useState<number>(initialTzNow.month);
  const [genDueDate, setGenDueDate] = useState<string>(
    `${initialTzNow.year}-${String(initialTzNow.month).padStart(2, '0')}-15`
  );
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const [showGenerateBar, setShowGenerateBar] = useState(false);
  const [generationMessage, setGenerationMessage] = useState<{
    type: 'success' | 'warning' | 'error' | 'info';
    text: string;
    actionLink?: string;
    actionText?: string;
  } | null>(null);

  // Payment form state
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [allocations, setAllocations] = useState<{ [invoiceId: string]: string }>({});
  const [amountReceived, setAmountReceived] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [paymentDate, setPaymentDate] = useState<string>(initialTzNow.dateStr);
  const [reference, setReference] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [idempotencyKey, setIdempotencyKey] = useState<string>(generateIdempotencyKey());

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successPayment, setSuccessPayment] = useState<PaymentDetail | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  // Load tenant timezone from MadrasaSetting to establish accurate billing defaults
  useEffect(() => {
    let isMounted = true;
    apiGetMadrasaSettings()
      .then((res) => {
        if (!isMounted) return;
        const tz = res?.settings?.timezone || 'Asia/Colombo';
        setMadrasaTimezone(tz);
        const tzNow = getDatePartsInTimezone(tz);
        setGenYear(tzNow.year);
        setGenMonth(tzNow.month);
        setGenDueDate(`${tzNow.year}-${String(tzNow.month).padStart(2, '0')}-15`);
        setPaymentDate(tzNow.dateStr);
      })
      .catch((err) => {
        console.error('Failed to load madrasa settings for POS:', err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Debounced student search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await apiSearchStudentsForPOS(searchQuery.trim());
        setSearchResults(results);
      } catch (err) {
        console.error('Failed to search students for POS:', err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load unpaid invoices when student is selected
  const handleSelectStudent = useCallback(async (student: POSStudentSearchResult) => {
    setSelectedStudent(student);
    setSearchQuery('');
    setSearchResults([]);
    setSelectedInvoiceIds([]);
    setAllocations({});
    setAmountReceived('');
    setErrorMessage(null);
    setGenerationMessage(null);
    setShowGenerateBar(false);
    setIdempotencyKey(generateIdempotencyKey());
    setLoadingInvoices(true);

    try {
      const data = await apiGetStudentUnpaidInvoices(student.id);
      setUnpaidInvoices(data.invoices);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Failed to load outstanding invoices.');
    } finally {
      setLoadingInvoices(false);
    }
  }, []);

  const handleClearStudent = () => {
    setSelectedStudent(null);
    setUnpaidInvoices([]);
    setSelectedInvoiceIds([]);
    setAllocations({});
    setAmountReceived('');
    setErrorMessage(null);
    setGenerationMessage(null);
    setShowGenerateBar(false);
    setSuccessPayment(null);
    setIdempotencyKey(generateIdempotencyKey());
    const tzNow = getDatePartsInTimezone(madrasaTimezone);
    setGenYear(tzNow.year);
    setGenMonth(tzNow.month);
    setGenDueDate(`${tzNow.year}-${String(tzNow.month).padStart(2, '0')}-15`);
    setPaymentDate(tzNow.dateStr);
  };

  const handleGenMonthChange = (m: number) => {
    setGenMonth(m);
    setGenDueDate(`${genYear}-${String(m).padStart(2, '0')}-15`);
    setGenerationMessage(null);
  };

  const handleGenYearChange = (y: number) => {
    setGenYear(y);
    setGenDueDate(`${y}-${String(genMonth).padStart(2, '0')}-15`);
    setGenerationMessage(null);
  };

  // Generate monthly invoice directly from Fee POS
  const handleGenerateInvoice = async () => {
    if (!selectedStudent) return;

    setIsGeneratingInvoice(true);
    setGenerationMessage(null);
    setErrorMessage(null);

    try {
      const res = await apiGenerateInvoices({
        billingYear: genYear,
        billingMonth: genMonth,
        dueDate: genDueDate,
        studentIds: [selectedStudent.id],
        notes: 'Generated via Fee POS',
      });

      const item = res.items?.[0];

      if (!item) {
        setGenerationMessage({
          type: 'error',
          text: 'No response received for invoice generation.',
        });
        return;
      }

      if (item.status === 'GENERATED') {
        // 1. Refresh unpaid invoices for this student
        const data = await apiGetStudentUnpaidInvoices(selectedStudent.id);
        setUnpaidInvoices(data.invoices);

        // 2. Update selected student's outstanding balance
        setSelectedStudent((prev) =>
          prev ? { ...prev, outstandingBalance: data.totalOutstanding } : null
        );

        // 3. Auto-select the newly generated invoice
        // DO NOT automatically set Amount Received to the full invoice balance.
        // Reset Amount Received to empty, show invoice balance clearly, and prompt Admin to enter amount received.
        if (item.invoiceId) {
          const generatedInv = data.invoices.find((i) => i.id === item.invoiceId);
          const bal = generatedInv ? generatedInv.balanceAmount : item.totalAmount || '0.00';
          setSelectedInvoiceIds([item.invoiceId]);
          setAllocations({ [item.invoiceId]: '' });
          setAmountReceived('');

          setGenerationMessage({
            type: 'success',
            text: `Invoice ${item.invoiceNo || ''} for ${res.monthName} ${res.billingYear} generated successfully. Invoice Balance: LKR ${Number(bal).toFixed(2)}. Enter amount received to record payment.`,
          });
        }
      } else if (item.status === 'ALREADY_INVOICED') {
        // Check whether existing invoice is PAID, VOID, or collectible
        let invoiceStatus: string | null = null;
        if (item.invoiceId) {
          try {
            const detail = await apiGetInvoice(item.invoiceId);
            invoiceStatus = detail.status;
          } catch {
            // ignore
          }
        }

        if (invoiceStatus === 'PAID') {
          setGenerationMessage({
            type: 'warning',
            text: "This month's invoice is already fully paid.",
          });
        } else if (invoiceStatus === 'VOID') {
          setGenerationMessage({
            type: 'error',
            text: "This month's invoice is void and cannot receive payment.",
          });
        } else {
          // Collectible -> refresh and auto-select into POS with empty amount received
          const data = await apiGetStudentUnpaidInvoices(selectedStudent.id);
          setUnpaidInvoices(data.invoices);
          setSelectedStudent((prev) =>
            prev ? { ...prev, outstandingBalance: data.totalOutstanding } : null
          );

          if (item.invoiceId) {
            const existingInv = data.invoices.find((i) => i.id === item.invoiceId);
            if (existingInv) {
              setSelectedInvoiceIds([item.invoiceId]);
              setAllocations({ [item.invoiceId]: '' });
              setAmountReceived('');
              setGenerationMessage({
                type: 'info',
                text: `Existing invoice ${existingInv.invoiceNo} for ${res.monthName} ${res.billingYear} loaded into POS (Balance: LKR ${Number(existingInv.balanceAmount).toFixed(2)}). Enter amount received to record payment.`,
              });
            } else {
              setGenerationMessage({
                type: 'info',
                text: `Invoice ${item.invoiceNo || ''} already exists for this month.`,
              });
            }
          }
        }
      } else if (item.status === 'SKIPPED_NOT_ADMITTED') {
        setGenerationMessage({
          type: 'error',
          text: 'This student was not admitted during the selected billing month.',
        });
      } else if (item.status === 'SKIPPED_NO_FEE') {
        setGenerationMessage({
          type: 'error',
          text: 'Monthly fee is not configured for this student.',
          actionLink: `/madrasa-admin/students/${selectedStudent.id}`,
          actionText: 'Configure Student Fee',
        });
      } else if (item.status === 'SKIPPED_INACTIVE') {
        setGenerationMessage({
          type: 'error',
          text: 'This student account is inactive.',
        });
      } else if (item.status === 'SKIPPED_ARCHIVED') {
        setGenerationMessage({
          type: 'error',
          text: 'This student record is archived.',
        });
      } else {
        setGenerationMessage({
          type: 'error',
          text: item.reason || 'Invoice generation was skipped.',
        });
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to generate monthly invoice.';
      setGenerationMessage({
        type: 'error',
        text: msg,
      });
    } finally {
      setIsGeneratingInvoice(false);
    }
  };

  // Handle Amount Received input change with intelligent auto-sync
  const handleAmountReceivedChange = (val: string) => {
    setAmountReceived(val);
    const num = parseFloat(val);

    if (isNaN(num) || num <= 0) {
      if (selectedInvoiceIds.length > 0) {
        const cleared: { [id: string]: string } = {};
        for (const id of selectedInvoiceIds) {
          cleared[id] = '';
        }
        setAllocations(cleared);
      }
      return;
    }

    // Case 1: No invoices currently selected -> Auto-select oldest-first from all unpaid invoices
    if (selectedInvoiceIds.length === 0 && unpaidInvoices.length > 0) {
      let remaining = num;
      const newSelectedIds: string[] = [];
      const newAllocations: { [id: string]: string } = {};

      for (const inv of unpaidInvoices) {
        if (remaining <= 0.001) break;
        const invBal = parseFloat(inv.balanceAmount) || 0;
        if (invBal <= 0) continue;
        const alloc = Math.min(remaining, invBal);

        if (alloc > 0) {
          newSelectedIds.push(inv.id);
          newAllocations[inv.id] = alloc.toFixed(2);
          remaining = Number((remaining - alloc).toFixed(2));
        }
      }

      setSelectedInvoiceIds(newSelectedIds);
      setAllocations(newAllocations);
      return;
    }

    // Case 2: Exactly one invoice currently selected
    if (selectedInvoiceIds.length === 1) {
      const singleId = selectedInvoiceIds[0];
      const inv = unpaidInvoices.find((i) => i.id === singleId);
      if (inv) {
        const invBal = parseFloat(inv.balanceAmount) || 0;
        // If the entered amount exceeds single invoice balance and more unpaid invoices exist,
        // auto-expand oldest-first across outstanding invoices
        if (num > invBal && unpaidInvoices.length > 1) {
          let remaining = num;
          const newSelectedIds: string[] = [];
          const newAllocations: { [id: string]: string } = {};

          for (const uInv of unpaidInvoices) {
            if (remaining <= 0.001) break;
            const uBal = parseFloat(uInv.balanceAmount) || 0;
            if (uBal <= 0) continue;
            const alloc = Math.min(remaining, uBal);
            if (alloc > 0) {
              newSelectedIds.push(uInv.id);
              newAllocations[uInv.id] = alloc.toFixed(2);
              remaining = Number((remaining - alloc).toFixed(2));
            }
          }
          setSelectedInvoiceIds(newSelectedIds);
          setAllocations(newAllocations);
        } else {
          const allocVal = Math.min(num, invBal);
          setAllocations({ [singleId]: allocVal.toFixed(2) });
        }
      }
      return;
    }

    // Case 3: Multiple invoices currently selected -> Distribute across selected invoices oldest-first
    if (selectedInvoiceIds.length > 1) {
      let remaining = num;
      const newSelectedIds: string[] = [];
      const updatedAllocations: { [id: string]: string } = {};

      for (const id of selectedInvoiceIds) {
        if (remaining <= 0.001) break;
        const inv = unpaidInvoices.find((i) => i.id === id);
        const invBal = inv ? parseFloat(inv.balanceAmount) || 0 : 0;
        if (invBal <= 0) continue;
        const alloc = Math.min(remaining, invBal);
        if (alloc > 0) {
          newSelectedIds.push(id);
          updatedAllocations[id] = alloc.toFixed(2);
          remaining = Number((remaining - alloc).toFixed(2));
        }
      }

      setSelectedInvoiceIds(newSelectedIds);
      setAllocations(updatedAllocations);
      return;
    }
  };

  // Toggle invoice selection
  const handleToggleInvoice = (inv: POSOutstandingInvoice) => {
    const isSelected = selectedInvoiceIds.includes(inv.id);
    let updatedIds: string[];
    const updatedAllocations = { ...allocations };

    if (isSelected) {
      updatedIds = selectedInvoiceIds.filter((id) => id !== inv.id);
      delete updatedAllocations[inv.id];
    } else {
      updatedIds = [...selectedInvoiceIds, inv.id];
      const currentAmt = parseFloat(amountReceived) || 0;
      const invBal = parseFloat(inv.balanceAmount) || 0;

      if (updatedIds.length === 1 && currentAmt > 0) {
        // If single selection and user already entered an amount, allocate up to balance
        const alloc = Math.min(currentAmt, invBal);
        updatedAllocations[inv.id] = alloc.toFixed(2);
      } else {
        // Default allocation to full balance
        updatedAllocations[inv.id] = invBal.toFixed(2);
      }
    }

    setSelectedInvoiceIds(updatedIds);
    setAllocations(updatedAllocations);

    // Auto-update amount received to sum of allocations if empty or previously auto-set
    const newSum = updatedIds.reduce((sum, id) => {
      const val = parseFloat(updatedAllocations[id] || '0');
      return sum + (isNaN(val) ? 0 : val);
    }, 0);

    const currentAmt = parseFloat(amountReceived) || 0;
    if (currentAmt <= 0 || isSelected || Math.abs(currentAmt - newSum) > 0.001) {
      setAmountReceived(newSum > 0 ? newSum.toFixed(2) : '');
    }
  };

  // Update allocation amount for a specific invoice
  const handleAllocationChange = (invoiceId: string, val: string) => {
    const updated = { ...allocations, [invoiceId]: val };
    setAllocations(updated);

    const newSum = selectedInvoiceIds.reduce((sum, id) => {
      const num = parseFloat(updated[id] || '0');
      return sum + (isNaN(num) ? 0 : num);
    }, 0);
    setAmountReceived(newSum > 0 ? newSum.toFixed(2) : '');
  };

  // Auto-allocate oldest first convenience button
  const handleAutoAllocateOldestFirst = () => {
    let budget = parseFloat(amountReceived);
    if (isNaN(budget) || budget <= 0) {
      setErrorMessage('Please enter a valid amount received to auto-allocate.');
      return;
    }

    setErrorMessage(null);
    const newSelectedIds: string[] = [];
    const newAllocations: { [id: string]: string } = {};

    for (const inv of unpaidInvoices) {
      if (budget <= 0.001) break;
      const invBalance = parseFloat(inv.balanceAmount) || 0;
      const allocatedForThis = Math.min(budget, invBalance);

      if (allocatedForThis > 0) {
        newSelectedIds.push(inv.id);
        newAllocations[inv.id] = allocatedForThis.toFixed(2);
        budget = Number((budget - allocatedForThis).toFixed(2));
      }
    }

    setSelectedInvoiceIds(newSelectedIds);
    setAllocations(newAllocations);
  };

  // Calculate totals and validations
  const totalAllocated = selectedInvoiceIds.reduce((sum, id) => {
    const num = parseFloat(allocations[id] || '0');
    return sum + (isNaN(num) ? 0 : num);
  }, 0);

  const amountReceivedNum = parseFloat(amountReceived) || 0;

  // Individual allocation checks
  let invalidAllocationReason: string | null = null;
  if (selectedInvoiceIds.length > 0) {
    for (const invId of selectedInvoiceIds) {
      const inv = unpaidInvoices.find((i) => i.id === invId);
      const rawVal = allocations[invId];
      const allocVal = parseFloat(rawVal || '0');
      if (rawVal === undefined || rawVal === '' || isNaN(allocVal) || allocVal <= 0) {
        invalidAllocationReason = `Allocation for invoice ${inv?.invoiceNo || invId} must be greater than 0`;
        break;
      }
      if (inv && allocVal > parseFloat(inv.balanceAmount) + 0.001) {
        invalidAllocationReason = `Allocation for invoice ${inv.invoiceNo} exceeds balance (LKR ${inv.balanceAmount})`;
        break;
      }
    }
  }

  const isAllocationBalanced =
    selectedInvoiceIds.length > 0 &&
    amountReceivedNum > 0 &&
    Math.abs(totalAllocated - amountReceivedNum) < 0.01 &&
    !invalidAllocationReason;

  const canSubmit =
    Boolean(selectedStudent) &&
    selectedInvoiceIds.length > 0 &&
    amountReceivedNum > 0 &&
    isAllocationBalanced &&
    !isSubmitting;

  const getDisabledReason = (): string | null => {
    if (!selectedStudent) return 'Select a student first';
    if (unpaidInvoices.length === 0) {
      return 'No outstanding invoices available. Generate the monthly invoice first.';
    }
    if (selectedInvoiceIds.length === 0) return 'Select at least one invoice';
    if (amountReceivedNum <= 0) return 'Enter payment amount';
    if (invalidAllocationReason) return invalidAllocationReason;
    if (Math.abs(totalAllocated - amountReceivedNum) >= 0.01) {
      return 'Allocation total must equal payment amount';
    }
    if (isSubmitting) return 'Processing payment...';
    return null;
  };

  const disabledReason = getDisabledReason();

  // Validation before opening confirm modal
  const handleOpenConfirm = () => {
    setErrorMessage(null);

    if (!canSubmit) {
      if (disabledReason) setErrorMessage(disabledReason);
      return;
    }

    setConfirmModalOpen(true);
  };

  // Submit payment
  const handleProcessPayment = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payloadAllocations = selectedInvoiceIds.map((id) => ({
        invoiceId: id,
        amount: allocations[id],
      }));

      const res = await apiCreatePayment({
        studentId: selectedStudent!.id,
        amount: amountReceivedNum.toFixed(2),
        paymentMethod,
        paidAt: paymentDate ? new Date(paymentDate).toISOString() : undefined,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
        idempotencyKey,
        allocations: payloadAllocations,
      });

      setConfirmModalOpen(false);
      setSuccessPayment(res);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Payment processing failed. Please try again.';
      setErrorMessage(msg);
      setConfirmModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderInvoiceGenerator = (isEmbedded = false) => (
    <div
      className={`bg-white border border-[#E7E9EE] rounded-xl p-4 shadow-2xs space-y-3 ${
        isEmbedded ? 'border-emerald-200 bg-emerald-50/20 mb-4' : 'max-w-lg mx-auto text-left'
      }`}
    >
      <div className="text-xs font-bold text-[#0F172A] border-b border-[#E7E9EE] pb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-emerald-800">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
          <span>Generate Monthly Invoice</span>
        </span>
        {selectedStudent && (
          <span className="text-[11px] font-medium text-[#5B6B7F]">
            {selectedStudent.fullName} ({selectedStudent.admissionNo})
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
        <div>
          <label className="block text-[#5B6B7F] font-semibold mb-1">Billing Month</label>
          <select
            value={genMonth}
            onChange={(e) => handleGenMonthChange(Number(e.target.value))}
            disabled={isGeneratingInvoice}
            className="w-full px-2.5 py-1.5 bg-[#F8F9FA] border border-[#E7E9EE] rounded-lg font-medium text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#08483A]"
          >
            {MONTH_NAMES.map((name, idx) => (
              <option key={name} value={idx + 1}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[#5B6B7F] font-semibold mb-1">Billing Year</label>
          <select
            value={genYear}
            onChange={(e) => handleGenYearChange(Number(e.target.value))}
            disabled={isGeneratingInvoice}
            className="w-full px-2.5 py-1.5 bg-[#F8F9FA] border border-[#E7E9EE] rounded-lg font-medium text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#08483A]"
          >
            {(() => {
              const baseYear = getDatePartsInTimezone(madrasaTimezone).year;
              const years = [baseYear - 2, baseYear - 1, baseYear, baseYear + 1];
              if (!years.includes(genYear)) years.push(genYear);
              years.sort((a, b) => a - b);
              return years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ));
            })()}
          </select>
        </div>

        <div>
          <label className="block text-[#5B6B7F] font-semibold mb-1">Due Date</label>
          <input
            type="date"
            value={genDueDate}
            onChange={(e) => setGenDueDate(e.target.value)}
            disabled={isGeneratingInvoice}
            className="w-full px-2.5 py-1.5 bg-[#F8F9FA] border border-[#E7E9EE] rounded-lg font-medium text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#08483A]"
          />
        </div>
      </div>

      {generationMessage && (
        <div
          className={`p-2.5 rounded-lg text-xs flex items-start gap-2 ${
            generationMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : generationMessage.type === 'warning'
              ? 'bg-amber-50 text-amber-800 border border-amber-200'
              : generationMessage.type === 'info'
              ? 'bg-blue-50 text-blue-800 border border-blue-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {generationMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : generationMessage.type === 'info' ? (
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <p className="font-medium">{generationMessage.text}</p>
            {generationMessage.actionLink && (
              <Link
                to={generationMessage.actionLink}
                className="font-bold underline text-xs mt-1 inline-block text-emerald-800 hover:text-emerald-950"
              >
                {generationMessage.actionText || 'View Details'} →
              </Link>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleGenerateInvoice}
        disabled={isGeneratingInvoice}
        className="w-full py-2.5 px-4 bg-[#08483A] hover:bg-[#073d31] disabled:bg-[#08483A]/50 text-white font-bold rounded-xl transition text-xs flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed shadow-xs"
      >
        {isGeneratingInvoice ? (
          <>
            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>Generating Monthly Invoice...</span>
          </>
        ) : (
          <>
            <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
            <span>Generate {MONTH_NAMES[genMonth - 1]} {genYear} Invoice</span>
          </>
        )}
      </button>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-800">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#0F172A]">Fee POS Terminal</h1>
              <p className="text-sm text-[#5B6B7F]">Collect monthly tuition fees and issue instant official receipts.</p>
            </div>
          </div>
        </div>
        {selectedStudent && (
          <button
            onClick={handleClearStudent}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-[#5B6B7F] bg-white border border-[#E7E9EE] hover:bg-gray-50 rounded-xl transition shadow-xs"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Select Another Student</span>
          </button>
        )}
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 text-red-800 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Payment Error</p>
            <p className="mt-0.5 text-red-700">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Success Modal Screen */}
      {successPayment && (
        <div className="bg-white border border-emerald-200 rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col items-center text-center max-w-lg mx-auto space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[#0F172A]">Payment Successfully Recorded!</h2>
              <p className="text-sm text-[#5B6B7F] mt-1">
                Receipt <span className="font-mono font-bold text-emerald-700">{successPayment.receipt?.receiptNo}</span> has been issued.
              </p>
            </div>

            <div className="w-full bg-[#F8F9FA] rounded-xl p-4 border border-[#E7E9EE] text-left space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[#5B6B7F]">Payment No:</span>
                <span className="font-mono font-bold text-[#0F172A]">{successPayment.paymentNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5B6B7F]">Student:</span>
                <span className="font-semibold text-[#0F172A]">{successPayment.student.fullName} ({successPayment.student.admissionNo})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5B6B7F]">Amount Paid:</span>
                <span className="font-bold text-emerald-700">LKR {Number(successPayment.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5B6B7F]">Payment Method:</span>
                <span className="font-semibold text-[#0F172A]">{successPayment.paymentMethod.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5B6B7F]">Months Covered:</span>
                <span className="font-medium text-[#0F172A]">
                  {successPayment.allocations.map((a) => `${a.monthName} ${a.billingYear}`).join(', ')}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full pt-2">
              <button
                onClick={() => navigate(`/madrasa-admin/receipts/${successPayment.receipt?.id}`)}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#08483A] hover:bg-[#073d31] text-white font-semibold rounded-xl transition shadow-xs"
              >
                <FileText className="w-4 h-4" />
                <span>View / Print Receipt</span>
              </button>
              <button
                onClick={handleClearStudent}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-[#E7E9EE] hover:bg-gray-50 text-[#0F172A] font-semibold rounded-xl transition shadow-xs"
              >
                <Coins className="w-4 h-4" />
                <span>New Collection</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 1: Search and Select Student (when none selected) */}
      {!selectedStudent && !successPayment && (
        <div className="bg-white border border-[#E7E9EE] rounded-2xl p-6 shadow-xs space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-[#0F172A]">1. Search Student</h2>
            <p className="text-sm text-[#5B6B7F]">Search by admission number, student name, guardian name, phone, or WhatsApp.</p>
          </div>

          <div className="relative">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7C8A9A]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                placeholder="Type admission number (e.g. 1001) or student name..."
                className="w-full pl-11 pr-4 py-3 bg-[#F8F9FA] border border-[#E7E9EE] rounded-xl text-base focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#08483A] focus:border-transparent transition"
                autoFocus
              />
              {isSearching && (
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Live dropdown results */}
            {searchResults.length > 0 && (
              <div className="mt-2 divide-y divide-[#E7E9EE] border border-[#E7E9EE] rounded-xl bg-white shadow-lg overflow-hidden max-h-96 overflow-y-auto z-20">
                {searchResults.map((student) => (
                  <button
                    key={student.id}
                    onClick={() => handleSelectStudent(student)}
                    className="w-full text-left p-4 hover:bg-emerald-50/50 transition flex items-center justify-between gap-4 group"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#0F172A] group-hover:text-[#08483A]">{student.fullName}</span>
                        <span className="px-2 py-0.5 text-xs font-mono font-bold bg-gray-100 text-[#5B6B7F] rounded">
                          {student.admissionNo}
                        </span>
                        {student.currentClass && (
                          <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-800 rounded">
                            {student.currentClass.academicSection?.name
                              ? `${student.currentClass.academicSection.name} • `
                              : ''}
                            {student.currentClass.name}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#5B6B7F]">
                        Guardian: <span className="font-medium text-[#0F172A]">{student.guardianName}</span>
                        {student.guardianPhone && ` • Phone: ${student.guardianPhone}`}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs text-[#5B6B7F]">Outstanding</div>
                      <div className="text-sm font-bold text-red-600">
                        LKR {Number(student.outstandingBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-[11px] text-[#7C8A9A]">
                        {student.unpaidInvoicesCount} {student.unpaidInvoicesCount === 1 ? 'month' : 'months'} pending
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {searchQuery.trim().length > 1 && !isSearching && searchResults.length === 0 && searchFocused && (
              <div className="mt-2 p-4 text-center text-sm text-[#5B6B7F] border border-[#E7E9EE] rounded-xl bg-white">
                No active students found matching "{searchQuery}".
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Student Selected -> Invoices & Payment Allocation */}
      {selectedStudent && !successPayment && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left / Main Column: Outstanding Invoices Selection */}
          <div className="lg:col-span-2 space-y-6">
            {/* Student Dossier Header Card */}
            <div className="bg-white border border-[#E7E9EE] rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-[#08483A]/10 text-[#08483A] flex items-center justify-center shrink-0">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-[#0F172A]">{selectedStudent.fullName}</h2>
                    <span className="font-mono text-xs px-2 py-0.5 bg-gray-100 text-gray-700 font-bold rounded">
                      {selectedStudent.admissionNo}
                    </span>
                  </div>
                  <p className="text-xs text-[#5B6B7F] mt-0.5">
                    Class:{' '}
                    <span className="font-semibold text-[#0F172A]">
                      {selectedStudent.currentClass?.academicSection?.name
                        ? `${selectedStudent.currentClass.academicSection.name} • `
                        : ''}
                      {selectedStudent.currentClass?.name || 'Unassigned'}
                    </span>{' '}
                    • Guardian:{' '}
                    <span className="font-semibold text-[#0F172A]">{selectedStudent.guardianName}</span>
                  </p>
                </div>
              </div>

              <div className="sm:text-right border-t sm:border-t-0 pt-3 sm:pt-0 border-gray-100">
                <span className="text-xs text-[#5B6B7F] block">Total Outstanding</span>
                <span className="text-xl font-bold text-red-600">
                  LKR {Number(selectedStudent.outstandingBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Outstanding Monthly Invoices Table */}
            <div className="bg-white border border-[#E7E9EE] rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-[#0F172A]">Outstanding Monthly Invoices</h3>
                  <p className="text-xs text-[#5B6B7F]">Select months to allocate payment. Invoices sorted oldest first.</p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setShowGenerateBar(!showGenerateBar)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#5B6B7F] hover:text-[#0F172A] bg-[#F8F9FA] hover:bg-gray-100 border border-[#E7E9EE] rounded-lg transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{showGenerateBar ? 'Hide Generator' : 'Generate Missing Month'}</span>
                  </button>

                  {unpaidInvoices.length > 0 && (
                    <button
                      onClick={handleAutoAllocateOldestFirst}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Auto-Allocate Oldest First</span>
                    </button>
                  )}
                </div>
              </div>

              {loadingInvoices ? (
                <div className="py-12 text-center text-[#5B6B7F]">
                  <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-xs">Loading unpaid invoices...</p>
                </div>
              ) : unpaidInvoices.length === 0 ? (
                <div className="py-8 px-6 bg-gray-50/70 rounded-2xl border border-dashed border-[#E7E9EE] space-y-4">
                  <div className="text-center space-y-1">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-800 mx-auto mb-2">
                      <FilePlus className="w-6 h-6" />
                    </div>
                    <p className="font-bold text-base text-[#0F172A]">No Outstanding Invoices</p>
                    <p className="text-xs text-[#5B6B7F] max-w-md mx-auto">
                      No collectible monthly invoices are currently available for this student. You can generate a missing monthly invoice directly below to proceed with fee collection.
                    </p>
                  </div>

                  {renderInvoiceGenerator(false)}
                </div>
              ) : (
                <div className="space-y-4">
                  {showGenerateBar && renderInvoiceGenerator(true)}

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-[#E7E9EE] text-xs font-bold text-[#7C8A9A] uppercase tracking-wider">
                          <th className="py-2.5 px-2">Pay</th>
                          <th className="py-2.5 px-2">Month / Invoice</th>
                          <th className="py-2.5 px-2">Due Date</th>
                          <th className="py-2.5 px-2 text-right">Total</th>
                          <th className="py-2.5 px-2 text-right">Balance</th>
                          <th className="py-2.5 px-2 text-right">Allocate (LKR)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E7E9EE] text-sm">
                        {unpaidInvoices.map((inv) => {
                          const isSelected = selectedInvoiceIds.includes(inv.id);
                          return (
                            <tr
                              key={inv.id}
                              onClick={() => handleToggleInvoice(inv)}
                              className={`transition cursor-pointer ${isSelected ? 'bg-emerald-50/40' : 'hover:bg-gray-50/60'}`}
                            >
                              <td className="py-3 px-2" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleInvoice(inv)}
                                  className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500 cursor-pointer"
                                />
                              </td>
                              <td className="py-3 px-2">
                                <div className="font-bold text-[#0F172A]">
                                  {inv.monthName} {inv.billingYear}
                                </div>
                                <span className="font-mono text-xs text-[#5B6B7F]">{inv.invoiceNo}</span>
                              </td>
                              <td className="py-3 px-2">
                                <div className="text-xs text-[#5B6B7F]">
                                  {new Date(inv.dueDate).toLocaleDateString()}
                                </div>
                                {inv.isOverdue && (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700">
                                    <Clock className="w-3 h-3" /> Overdue
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-2 text-right font-medium text-gray-700">
                                {Number(inv.totalAmount).toFixed(2)}
                              </td>
                              <td className="py-3 px-2 text-right font-bold text-red-600">
                                {Number(inv.balanceAmount).toFixed(2)}
                              </td>
                              <td className="py-3 px-2 text-right" onClick={(e) => e.stopPropagation()}>
                                {isSelected ? (
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    max={inv.balanceAmount}
                                    value={allocations[inv.id] || ''}
                                    onChange={(e) => handleAllocationChange(inv.id, e.target.value)}
                                    placeholder="0.00"
                                    className="w-28 px-2 py-1 text-right font-bold text-emerald-800 bg-white border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 text-sm"
                                  />
                                ) : (
                                  <span className="text-xs text-gray-400">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Payment Details & Checkout Form */}
          <div className="space-y-6">
            <div className="bg-white border border-[#E7E9EE] rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-[#E7E9EE] pb-3">
                <CreditCard className="w-5 h-5 text-emerald-800" />
                <h3 className="text-base font-bold text-[#0F172A]">Payment Details</h3>
              </div>

              {/* Amount Received Input */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#0F172A]">Amount Received (LKR) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amountReceived}
                  onChange={(e) => handleAmountReceivedChange(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3.5 py-2.5 text-lg font-bold text-[#0F172A] bg-[#F8F9FA] border border-[#E7E9EE] rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#08483A]"
                />
              </div>

              {/* Payment Method */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#0F172A]">Payment Method *</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 bg-[#F8F9FA] border border-[#E7E9EE] rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#08483A]"
                >
                  <option value="CASH">Cash</option>
                  <option value="BANK_TRANSFER">Bank Transfer / Deposit</option>
                  <option value="CARD">Debit / Credit Card</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              {/* Payment Date */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#0F172A]">Payment Date</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F8F9FA] border border-[#E7E9EE] rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#08483A]"
                />
              </div>

              {/* Reference */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#0F172A]">Reference / Receipt Slip #</label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="e.g. SLIP-98421"
                  className="w-full px-3 py-2 bg-[#F8F9FA] border border-[#E7E9EE] rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#08483A]"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#0F172A]">Internal Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional remarks..."
                  rows={2}
                  className="w-full px-3 py-2 bg-[#F8F9FA] border border-[#E7E9EE] rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#08483A]"
                />
              </div>

              {/* Allocation Reconciliation Box */}
              <div className="p-3 rounded-xl border border-[#E7E9EE] bg-[#F8F9FA] space-y-2 text-xs">
                <div className="flex justify-between font-medium">
                  <span className="text-[#5B6B7F]">Selected Months:</span>
                  <span className="font-bold text-[#0F172A]">{selectedInvoiceIds.length}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span className="text-[#5B6B7F]">Total Allocated:</span>
                  <span className="font-bold text-emerald-800">LKR {totalAllocated.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span className="text-[#5B6B7F]">Amount Received:</span>
                  <span className="font-bold text-[#0F172A]">LKR {amountReceivedNum.toFixed(2)}</span>
                </div>

                <div className="pt-2 border-t border-[#E7E9EE] flex items-center justify-between">
                  <span>Balance Check:</span>
                  {isAllocationBalanced ? (
                    <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Balanced
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-bold text-amber-700">
                      <AlertCircle className="w-3.5 h-3.5" /> Diff: LKR {Math.abs(amountReceivedNum - totalAllocated).toFixed(2)}
                    </span>
                  )}
                </div>
              </div>

              {/* Validation Warning when disabled */}
              {!canSubmit && disabledReason && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-xs text-amber-800">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span className="font-medium">{disabledReason}</span>
                </div>
              )}

              {/* Process Payment CTA */}
              <button
                type="button"
                onClick={handleOpenConfirm}
                disabled={!canSubmit}
                className={`w-full py-3 px-4 font-bold rounded-xl transition shadow-xs flex items-center justify-center gap-2 ${
                  canSubmit
                    ? 'bg-[#08483A] hover:bg-[#073d31] text-white shadow-md cursor-pointer'
                    : 'bg-emerald-100 text-emerald-800/60 border border-emerald-200 cursor-not-allowed opacity-75'
                }`}
              >
                <span>Record Payment (LKR {amountReceivedNum.toFixed(2)})</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModalOpen && selectedStudent && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-[#E7E9EE]">
            <h3 className="text-lg font-bold text-[#0F172A]">Confirm Payment Receipt</h3>
            <p className="text-sm text-[#5B6B7F]">
              You are recording a payment for <span className="font-bold text-[#0F172A]">{selectedStudent.fullName}</span>.
            </p>

            <div className="bg-[#F8F9FA] rounded-xl p-3 border border-[#E7E9EE] space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[#5B6B7F]">Total Amount:</span>
                <span className="font-bold text-emerald-800 text-sm">LKR {amountReceivedNum.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5B6B7F]">Method:</span>
                <span className="font-semibold text-[#0F172A]">{paymentMethod.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5B6B7F]">Allocated To:</span>
                <span className="font-semibold text-[#0F172A]">{selectedInvoiceIds.length} invoice(s)</span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setConfirmModalOpen(false)}
                disabled={isSubmitting}
                className="flex-1 py-2 px-4 border border-[#E7E9EE] font-semibold text-gray-700 rounded-xl hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleProcessPayment}
                disabled={isSubmitting}
                className="flex-1 py-2 px-4 bg-[#08483A] hover:bg-[#073d31] font-semibold text-white rounded-xl transition flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>Confirm & Issue</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
