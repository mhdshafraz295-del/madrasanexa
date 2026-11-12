import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { resolveLogoDataUri } from './branding.service.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fontsDir = path.resolve(__dirname, '../assets/fonts');

export let embeddedFontsCss = '';
try {
  const fontDefs = [
    { family: 'Noto Sans Local', file: 'NotoSans-Regular.ttf' },
    { family: 'Noto Sans Arabic Local', file: 'NotoSansArabic-Regular.ttf' },
    { family: 'Noto Sans Tamil Local', file: 'NotoSansTamil-Regular.ttf' },
    { family: 'Noto Sans Sinhala Local', file: 'NotoSansSinhala-Regular.ttf' },
  ];

  const loadedFaces = [];
  for (const def of fontDefs) {
    const fontPath = path.join(fontsDir, def.file);
    if (fs.existsSync(fontPath)) {
      const b64 = fs.readFileSync(fontPath).toString('base64');
      loadedFaces.push(`
      @font-face {
        font-family: '${def.family}';
        src: url('data:font/truetype;charset=utf-8;base64,${b64}') format('truetype');
        font-weight: normal;
        font-style: normal;
      }`);
    }
  }
  if (loadedFaces.length > 0) {
    embeddedFontsCss = loadedFaces.join('\n');
  }
} catch (err) {
  console.warn('[PDF] Could not pre-load embedded fonts:', err.message);
}

/**
 * Friendly label for Payment Method enum.
 * Database & API values strictly remain CASH, BANK_TRANSFER, CARD, OTHER.
 */
export function formatPaymentMethodLabel(method) {
  if (method === 'BANK_TRANSFER') return 'Bank Transfer';
  if (method === 'CASH') return 'Cash';
  if (method === 'CARD') return 'Card';
  if (method === 'OTHER') return 'Other';
  return method || '';
}

/**
 * Escapes unsafe HTML characters to prevent HTML/XSS injection.
 *
 * @param {any} val
 * @returns {string}
 */
export function escapeHtml(val) {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Resolves the browser executable path intelligently across Railway/Linux, Windows, or env.
 */
export function resolveChromeExecutablePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  if (process.platform === 'win32') {
    const windowsCandidates = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    ];
    for (const cand of windowsCandidates) {
      if (fs.existsSync(cand)) return cand;
    }
  }

  if (process.platform === 'linux') {
    const linuxCandidates = [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
    ];
    for (const cand of linuxCandidates) {
      if (fs.existsSync(cand)) return cand;
    }
  }

  return undefined;
}

// Bounded Concurrency Semaphore for PDF Generation (DOS & Memory Protection)
let activePdfJobs = 0;
const MAX_CONCURRENT_PDF_JOBS = 3;

// Shared Browser Instance
let sharedBrowser = null;

async function getSharedBrowser() {
  if (!sharedBrowser || !sharedBrowser.connected) {
    const executablePath = resolveChromeExecutablePath();
    const launchOptions = {
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
      ],
    };
    if (executablePath) {
      launchOptions.executablePath = executablePath;
    }
    sharedBrowser = await puppeteer.launch(launchOptions);
  }
  return sharedBrowser;
}

export async function closeSharedBrowser() {
  if (sharedBrowser && sharedBrowser.connected) {
    await sharedBrowser.close();
    sharedBrowser = null;
  }
}

/**
 * Generates an A4 PDF buffer from report data with security controls:
 * - Request interception: blocks external network / SSRF attempts
 * - JavaScript disabled on page
 * - Concurrency gating & timeouts
 * - Safe HTML escaping
 *
 * @param {object} reportData
 * @param {{ landscape?: boolean }} options
 * @returns {Promise<Buffer>}
 */
export async function generateReportPdf(reportData, { landscape = false } = {}) {
  // Concurrency Gate
  if (activePdfJobs >= MAX_CONCURRENT_PDF_JOBS) {
    const err = new Error('PDF generation capacity reached. Please try again shortly or export CSV.');
    err.status = 503;
    throw err;
  }

  activePdfJobs++;

  let page = null;
  try {
    const browser = await getSharedBrowser();
    page = await browser.newPage();

    // Security Rule 1: Disable JavaScript execution on report page
    await page.setJavaScriptEnabled(false);

    // Security Rule 2: Intercept requests to block external network / SSRF
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const url = req.url();
      if (url.startsWith('data:') || url === 'about:blank') {
        req.continue();
      } else {
        req.abort();
      }
    });

    // Resolve tenant logo as base64 data URI strictly for PDF generation (Non-blocking)
    if (!reportData.madrasa?.logoDataUri && reportData.madrasa?.id) {
      try {
        reportData.madrasa.logoDataUri = await resolveLogoDataUri(reportData.madrasa.id);
      } catch (e) {
        reportData.madrasa.logoDataUri = null;
      }
    }

    // Generate sanitized HTML template
    const html = buildReportHtmlDocument(reportData);

    await page.setContent(html, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape,
      printBackground: true,
      margin: {
        top: '16mm',
        bottom: '16mm',
        left: '12mm',
        right: '12mm',
      },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `
        <div style="font-size: 8px; color: #7C8A9A; width: 100%; display: flex; justify-content: space-between; padding: 0 12mm; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <span>Generated by MadrasaNexa</span>
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>
      `,
    });

    return pdfBuffer;
  } finally {
    if (page) {
      try {
        await page.close();
      } catch (e) {
        // Page close fallback
      }
    }
    activePdfJobs--;
  }
}

/**
 * Directly renders raw HTML to A4 PDF buffer with the shared browser and security guards.
 *
 * @param {{ html: string, landscape?: boolean }} param0
 * @returns {Promise<Buffer>}
 */
export async function renderRawHtmlToPdf({ html, landscape = false }) {
  if (activePdfJobs >= MAX_CONCURRENT_PDF_JOBS) {
    const err = new Error('PDF generation capacity reached. Please try again shortly.');
    err.status = 503;
    throw err;
  }

  activePdfJobs++;
  let page = null;
  try {
    const browser = await getSharedBrowser();
    page = await browser.newPage();

    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const url = req.url();
      if (url.startsWith('data:') || url === 'about:blank') {
        req.continue();
      } else {
        req.abort();
      }
    });

    await page.setContent(html, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape,
      printBackground: true,
      margin: {
        top: '12mm',
        bottom: '16mm',
        left: '12mm',
        right: '12mm',
      },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `
        <div style="font-size: 8px; color: #7C8A9A; width: 100%; display: flex; justify-content: space-between; padding: 0 12mm; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <span>Generated by MadrasaNexa</span>
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>
      `,
    });

    return Buffer.from(pdfBuffer);
  } finally {
    if (page) {
      try {
        await page.close();
      } catch (e) {
        // Page close fallback
      }
    }
    activePdfJobs--;
  }
}

/**
 * Builds the complete sanitized HTML string for a report document.
 */
export function buildReportHtmlDocument(reportData) {
  const madrasa = reportData.madrasa || {};
  const summary = reportData.summary || {};
  const records = reportData.records || [];
  const reportType = reportData.reportType;

  // Header branding
  const madrasaName = escapeHtml(madrasa.name || 'Madrasa');
  const madrasaAddress = escapeHtml(madrasa.address || '');
  const madrasaPhone = escapeHtml(madrasa.phone || '');
  const reportTitle = escapeHtml(reportData.title || 'Fee Report');
  const periodLabel = escapeHtml(reportData.period || '');
  const generatedTime = dayjs().tz(madrasa.timezone || 'Asia/Colombo').format('YYYY-MM-DD HH:mm');

  // Summary cards markup
  let summaryBlocksHtml = '';
  if (summary) {
    const summaryEntries = Object.entries(summary).filter(([k]) => k !== 'currency');
    summaryBlocksHtml = summaryEntries
      .map(([key, val]) => {
        const label = formatSummaryKey(key);
        const displayVal = escapeHtml(val);
        return `
          <div class="summary-box">
            <div class="summary-label">${label}</div>
            <div class="summary-value">${displayVal}</div>
          </div>
        `;
      })
      .join('');
  }

  // Table header & rows
  let tableContentHtml = '';
  if (reportType === 'STUDENT_STATEMENT') {
    tableContentHtml = buildStudentStatementHtml(reportData);
  } else {
    tableContentHtml = buildStandardReportTableHtml(reportType, records);
  }

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${reportTitle}</title>
  <style>
    ${embeddedFontsCss}
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Noto Sans Local', 'Noto Sans Arabic Local', 'Noto Sans Tamil Local', 'Noto Sans Sinhala Local', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Nirmala UI", "Iskoola Pota", "Arabic Typesetting", Arial, sans-serif;
      color: #0F172A;
      background: #FFFFFF;
      font-size: 10px;
      line-height: 1.4;
      padding: 0;
    }
    th, td {
      unicode-bidi: plaintext;
    }
    .header-container {
      border-bottom: 2px solid #0F172A;
      padding-bottom: 12px;
      margin-bottom: 14px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .brand-col {
      max-width: 60%;
    }
    .brand-content {
      display: flex;
      align-items: center;
    }
    .madrasa-logo {
      max-height: 48px;
      max-width: 72px;
      object-fit: contain;
      border-radius: 4px;
      margin-right: 12px;
      flex-shrink: 0;
    }
    .madrasa-title {
      font-size: 16px;
      font-weight: 700;
      color: #0F172A;
      margin-bottom: 3px;
    }
    .madrasa-sub {
      font-size: 9px;
      color: #7C8A9A;
      line-height: 1.3;
    }
    .meta-col {
      text-align: right;
      max-width: 40%;
    }
    .report-title {
      font-size: 14px;
      font-weight: 700;
      color: #0F172A;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }
    .report-period {
      font-size: 10px;
      font-weight: 600;
      color: #37C6A3;
      margin-bottom: 3px;
    }
    .report-meta-text {
      font-size: 8.5px;
      color: #7C8A9A;
    }
    .summary-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 14px;
    }
    .summary-box {
      flex: 1;
      min-width: 80px;
      background: #F7F6F1;
      border: 1px solid #E7E9EE;
      border-radius: 4px;
      padding: 6px 10px;
    }
    .summary-label {
      font-size: 7.5px;
      text-transform: uppercase;
      font-weight: 600;
      color: #7C8A9A;
      margin-bottom: 2px;
    }
    .summary-value {
      font-size: 11px;
      font-weight: 700;
      color: #0F172A;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      table-layout: fixed;
    }
    thead {
      display: table-header-group;
    }
    tr {
      page-break-inside: avoid;
    }
    th {
      background-color: #0F172A;
      color: #FFFFFF;
      font-weight: 600;
      font-size: 8.5px;
      text-transform: uppercase;
      padding: 6px 8px;
      text-align: left;
      border-top: 1px solid #0F172A;
      border-bottom: 1px solid #0F172A;
      word-break: break-word;
      overflow-wrap: anywhere;
    }
    td {
      padding: 5px 8px;
      font-size: 8.5px;
      border-bottom: 1px solid #E7E9EE;
      color: #0F172A;
      vertical-align: middle;
      word-break: break-word;
      overflow-wrap: anywhere;
    }
    tr:nth-child(even) td {
      background-color: #FAFAFA;
    }
    .text-right {
      text-align: right;
    }
    .text-center {
      text-align: center;
    }
    .badge {
      display: inline-block;
      padding: 1px 5px;
      border-radius: 3px;
      font-size: 7.5px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .badge-paid { background: #E6F8F4; color: #0C6B58; }
    .badge-partial { background: #FEF6E6; color: #925807; }
    .badge-pending { background: #EDF1F7; color: #3A4C62; }
    .badge-overdue { background: #FDE8E8; color: #9B1C1C; }
    .badge-void { background: #F3F4F6; color: #6B7280; text-decoration: line-through; }
    .empty-message {
      padding: 24px;
      text-align: center;
      color: #7C8A9A;
      font-size: 10px;
      background: #F7F6F1;
      border: 1px dashed #E7E9EE;
      border-radius: 4px;
      margin-top: 10px;
    }
    .section-heading {
      font-size: 11px;
      font-weight: 700;
      margin: 12px 0 6px 0;
      color: #0F172A;
      border-bottom: 1px solid #E7E9EE;
      padding-bottom: 3px;
      page-break-after: avoid;
      break-after: avoid;
    }
  </style>
</head>
<body>
  <div class="header-container">
    <div class="brand-col">
      <div class="brand-content">
        ${madrasa.logoDataUri ? `<img src="${madrasa.logoDataUri}" alt="Logo" class="madrasa-logo" />` : ''}
        <div>
          <div class="madrasa-title">${madrasaName}</div>
          ${madrasaAddress ? `<div class="madrasa-sub">${madrasaAddress}</div>` : ''}
          ${madrasaPhone ? `<div class="madrasa-sub">Tel: ${madrasaPhone}</div>` : ''}
        </div>
      </div>
    </div>
    <div class="meta-col">
      <div class="report-title">${reportTitle}</div>
      ${periodLabel ? `<div class="report-period">${periodLabel}</div>` : ''}
      <div class="report-meta-text">Generated: ${generatedTime}</div>
    </div>
  </div>

  ${summaryBlocksHtml ? `<div class="summary-grid">${summaryBlocksHtml}</div>` : ''}

  ${tableContentHtml}
</body>
</html>
  `;
}

/**
 * Builds table HTML for standard reports.
 */
function buildStandardReportTableHtml(reportType, records) {
  if (!records || records.length === 0) {
    return `<div class="empty-message">No records found for the selected filters (0 Records).</div>`;
  }

  switch (reportType) {
    case 'PAID_STUDENTS':
      return `
        <table>
          <thead>
            <tr>
              <th style="width: 10%;">Adm No</th>
              <th style="width: 20%;">Student Name</th>
              <th style="width: 14%;">Current Section</th>
              <th style="width: 14%;">Current Class</th>
              <th style="width: 12%;">Invoice No</th>
              <th class="text-right" style="width: 10%;">Expected</th>
              <th class="text-right" style="width: 10%;">Paid</th>
              <th class="text-center" style="width: 10%;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${records.map((r) => `
              <tr>
                <td>${escapeHtml(r.admissionNo)}</td>
                <td style="font-weight: 600;">${escapeHtml(r.studentName)}</td>
                <td>${escapeHtml(r.sectionName)}</td>
                <td>${escapeHtml(r.className)}</td>
                <td>${escapeHtml(r.invoiceNo)}</td>
                <td class="text-right">${escapeHtml(r.expectedAmount)}</td>
                <td class="text-right">${escapeHtml(r.paidAmount)}</td>
                <td class="text-center"><span class="badge badge-paid">PAID</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

    case 'UNPAID_STUDENTS':
      return `
        <table>
          <thead>
            <tr>
              <th style="width: 10%;">Adm No</th>
              <th style="width: 18%;">Student Name</th>
              <th style="width: 12%;">Current Section</th>
              <th style="width: 12%;">Current Class</th>
              <th style="width: 11%;">Invoice No</th>
              <th class="text-right" style="width: 9%;">Expected</th>
              <th class="text-right" style="width: 9%;">Balance</th>
              <th style="width: 9%;">Due Date</th>
              <th class="text-center" style="width: 10%;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${records.map((r) => `
              <tr>
                <td>${escapeHtml(r.admissionNo)}</td>
                <td style="font-weight: 600;">${escapeHtml(r.studentName)}</td>
                <td>${escapeHtml(r.sectionName)}</td>
                <td>${escapeHtml(r.className)}</td>
                <td>${escapeHtml(r.invoiceNo)}</td>
                <td class="text-right">${escapeHtml(r.expectedAmount)}</td>
                <td class="text-right" style="font-weight: 700; color: #9B1C1C;">${escapeHtml(r.balanceAmount)}</td>
                <td>${escapeHtml(r.dueDate)}</td>
                <td class="text-center"><span class="badge badge-${(r.status || 'PENDING').toLowerCase()}">${escapeHtml(r.status || 'PENDING')}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

    case 'PARTIAL_PAYMENTS':
      return `
        <table>
          <thead>
            <tr>
              <th style="width: 10%;">Adm No</th>
              <th style="width: 18%;">Student Name</th>
              <th style="width: 12%;">Current Section</th>
              <th style="width: 12%;">Current Class</th>
              <th style="width: 11%;">Invoice No</th>
              <th class="text-right" style="width: 9%;">Expected</th>
              <th class="text-right" style="width: 9%;">Paid</th>
              <th class="text-right" style="width: 9%;">Balance</th>
              <th class="text-center" style="width: 10%;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${records.map((r) => `
              <tr>
                <td>${escapeHtml(r.admissionNo)}</td>
                <td style="font-weight: 600;">${escapeHtml(r.studentName)}</td>
                <td>${escapeHtml(r.sectionName)}</td>
                <td>${escapeHtml(r.className)}</td>
                <td>${escapeHtml(r.invoiceNo)}</td>
                <td class="text-right">${escapeHtml(r.expectedAmount)}</td>
                <td class="text-right">${escapeHtml(r.paidAmount)}</td>
                <td class="text-right" style="font-weight: 700; color: #925807;">${escapeHtml(r.balanceAmount)}</td>
                <td class="text-center"><span class="badge badge-partial">${escapeHtml(r.status)}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

    case 'OVERDUE_STUDENTS':
      return `
        <table>
          <thead>
            <tr>
              <th style="width: 9%;">Adm No</th>
              <th style="width: 18%;">Student Name</th>
              <th style="width: 12%;">Current Section</th>
              <th style="width: 12%;">Current Class</th>
              <th style="width: 10%;">Period</th>
              <th class="text-right" style="width: 9%;">Balance</th>
              <th style="width: 10%;">Due Date</th>
              <th class="text-center" style="width: 10%;">Days Overdue</th>
            </tr>
          </thead>
          <tbody>
            ${records.map((r) => `
              <tr>
                <td>${escapeHtml(r.admissionNo)}</td>
                <td style="font-weight: 600;">${escapeHtml(r.studentName)}</td>
                <td>${escapeHtml(r.sectionName)}</td>
                <td>${escapeHtml(r.className)}</td>
                <td>${escapeHtml(r.billingPeriod)}</td>
                <td class="text-right" style="font-weight: 700; color: #9B1C1C;">${escapeHtml(r.balanceAmount)}</td>
                <td>${escapeHtml(r.dueDate)}</td>
                <td class="text-center" style="font-weight: 700; color: #9B1C1C;">${escapeHtml(r.daysOverdue)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

    case 'OUTSTANDING_BALANCE':
      return `
        <table>
          <thead>
            <tr>
              <th style="width: 9%;">Adm No</th>
              <th style="width: 18%;">Student Name</th>
              <th style="width: 12%;">Current Section</th>
              <th style="width: 12%;">Current Class</th>
              <th style="width: 10%;">Period</th>
              <th class="text-right" style="width: 9%;">Expected</th>
              <th class="text-right" style="width: 9%;">Paid</th>
              <th class="text-right" style="width: 9%;">Balance</th>
              <th class="text-center" style="width: 12%;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${records.map((r) => `
              <tr>
                <td>${escapeHtml(r.admissionNo)}</td>
                <td style="font-weight: 600;">${escapeHtml(r.studentName)}</td>
                <td>${escapeHtml(r.sectionName)}</td>
                <td>${escapeHtml(r.className)}</td>
                <td>${escapeHtml(r.billingPeriod)}</td>
                <td class="text-right">${escapeHtml(r.expectedAmount)}</td>
                <td class="text-right">${escapeHtml(r.paidAmount)}</td>
                <td class="text-right" style="font-weight: 700;">${escapeHtml(r.balanceAmount)}</td>
                <td class="text-center"><span class="badge badge-${(r.status || 'PENDING').toLowerCase()}">${escapeHtml(r.status || 'PENDING')}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

    case 'SECTION_COLLECTION':
      return `
        <table>
          <thead>
            <tr>
              <th style="width: 30%;">Academic Section</th>
              <th class="text-center" style="width: 15%;">Students Billed</th>
              <th class="text-right" style="width: 18%;">Expected</th>
              <th class="text-right" style="width: 18%;">Collected</th>
              <th class="text-right" style="width: 19%;">Outstanding</th>
            </tr>
          </thead>
          <tbody>
            ${records.map((r) => `
              <tr>
                <td style="font-weight: 600;">${escapeHtml(r.sectionName)}</td>
                <td class="text-center">${escapeHtml(r.studentsBilled)}</td>
                <td class="text-right">${escapeHtml(r.expectedAmount)}</td>
                <td class="text-right" style="color: #0C6B58; font-weight: 600;">${escapeHtml(r.collectedAmount)}</td>
                <td class="text-right">${escapeHtml(r.outstandingAmount)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

    case 'CLASS_COLLECTION':
      return `
        <table>
          <thead>
            <tr>
              <th style="width: 22%;">Section</th>
              <th style="width: 22%;">Class</th>
              <th class="text-center" style="width: 12%;">Billed</th>
              <th class="text-right" style="width: 15%;">Expected</th>
              <th class="text-right" style="width: 15%;">Collected</th>
              <th class="text-right" style="width: 14%;">Outstanding</th>
            </tr>
          </thead>
          <tbody>
            ${records.map((r) => `
              <tr>
                <td>${escapeHtml(r.sectionName)}</td>
                <td style="font-weight: 600;">${escapeHtml(r.className)}</td>
                <td class="text-center">${escapeHtml(r.studentsBilled)}</td>
                <td class="text-right">${escapeHtml(r.expectedAmount)}</td>
                <td class="text-right" style="color: #0C6B58; font-weight: 600;">${escapeHtml(r.collectedAmount)}</td>
                <td class="text-right">${escapeHtml(r.outstandingAmount)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

    case 'CASH_COLLECTION':
      return `
        <table>
          <thead>
            <tr>
              <th style="width: 12%;">Payment Date</th>
              <th style="width: 12%;">Payment No</th>
              <th style="width: 10%;">Receipt No</th>
              <th style="width: 18%;">Student Name</th>
              <th style="width: 12%;">Class</th>
              <th style="width: 12%;">Method</th>
              <th class="text-right" style="width: 12%;">Amount</th>
              <th style="width: 12%;">Allocated</th>
            </tr>
          </thead>
          <tbody>
            ${records.map((r) => `
              <tr>
                <td>${escapeHtml(r.paidAt)}</td>
                <td>${escapeHtml(r.paymentNo)}</td>
                <td>${escapeHtml(r.receiptNo)}</td>
                <td style="font-weight: 600;">${escapeHtml(r.studentName)}</td>
                <td>${escapeHtml(r.className)}</td>
                <td>${escapeHtml(formatPaymentMethodLabel(r.paymentMethod))}</td>
                <td class="text-right" style="font-weight: 700; color: #0C6B58;">${escapeHtml(r.amount)}</td>
                <td style="font-size: 7.5px;">${escapeHtml(r.allocatedMonths)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

    case 'PAYMENT_METHOD_SUMMARY':
      return `
        <table>
          <thead>
            <tr>
              <th style="width: 30%;">Payment Method</th>
              <th class="text-center" style="width: 18%;">Completed Count</th>
              <th class="text-right" style="width: 24%;">Completed Amount</th>
              <th class="text-center" style="width: 14%;">Void Count</th>
              <th class="text-right" style="width: 14%;">Void Amount</th>
            </tr>
          </thead>
          <tbody>
            ${records.map((r) => `
              <tr>
                <td style="font-weight: 600;">${escapeHtml(formatPaymentMethodLabel(r.paymentMethod))}</td>
                <td class="text-center">${escapeHtml(r.transactionCount)}</td>
                <td class="text-right" style="font-weight: 700; color: #0C6B58;">${escapeHtml(r.completedAmount)}</td>
                <td class="text-center">${escapeHtml(r.voidCount)}</td>
                <td class="text-right" style="color: #6B7280;">${escapeHtml(r.voidAmount)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

    case 'PAYMENT_HISTORY':
      return `
        <table>
          <thead>
            <tr>
              <th style="width: 13%;">Paid Date</th>
              <th style="width: 13%;">Payment No</th>
              <th style="width: 11%;">Receipt No</th>
              <th style="width: 20%;">Student Name</th>
              <th style="width: 11%;">Method</th>
              <th class="text-right" style="width: 12%;">Amount</th>
              <th class="text-center" style="width: 10%;">Status</th>
              <th style="width: 10%;">Allocated</th>
            </tr>
          </thead>
          <tbody>
            ${records.map((r) => `
              <tr>
                <td>${escapeHtml(r.paidAt)}</td>
                <td>${escapeHtml(r.paymentNo)}</td>
                <td>${escapeHtml(r.receiptNo)}</td>
                <td style="font-weight: 600;">${escapeHtml(r.studentName)}</td>
                <td>${escapeHtml(formatPaymentMethodLabel(r.paymentMethod))}</td>
                <td class="text-right" style="font-weight: 700;">${escapeHtml(r.amount)}</td>
                <td class="text-center">
                  <span class="badge badge-${(r.status || 'PENDING').toLowerCase()}">${escapeHtml(r.status || 'PENDING')}</span>
                </td>
                <td style="font-size: 7.5px;">${escapeHtml(r.allocatedPeriods)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

    case 'MISSING_INVOICES':
      return `
        <table>
          <thead>
            <tr>
              <th style="width: 12%;">Adm No</th>
              <th style="width: 24%;">Student Name</th>
              <th style="width: 16%;">Current Section</th>
              <th style="width: 16%;">Current Class</th>
              <th style="width: 12%;">Admission Date</th>
              <th class="text-right" style="width: 10%;">Expected Fee</th>
              <th class="text-center" style="width: 10%;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${records.map((r) => `
              <tr>
                <td>${escapeHtml(r.admissionNo)}</td>
                <td style="font-weight: 600;">${escapeHtml(r.studentName)}</td>
                <td>${escapeHtml(r.sectionName)}</td>
                <td>${escapeHtml(r.className)}</td>
                <td>${escapeHtml(r.admissionDate)}</td>
                <td class="text-right">${escapeHtml(r.expectedFee)}</td>
                <td class="text-center"><span class="badge badge-pending">NOT GENERATED</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

    default:
      return `<div>Report content rendered.</div>`;
  }
}

/**
 * Builds HTML for Individual Student Fee Statement.
 */
function buildStudentStatementHtml(reportData) {
  const student = reportData.student || {};
  const billingLedger = reportData.billingLedger || [];
  const paymentHistory = reportData.paymentHistory || [];

  return `
    <div style="background: #F7F6F1; border: 1px solid #E7E9EE; border-radius: 4px; padding: 10px 14px; margin-bottom: 14px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
        <div><strong>Student:</strong> ${escapeHtml(student.fullName)} (${escapeHtml(student.admissionNo)})</div>
        <div><strong>Current Class:</strong> ${escapeHtml(student.currentSection)} / ${escapeHtml(student.currentClass)}</div>
      </div>
      <div style="display: flex; justify-content: space-between; color: #7C8A9A; font-size: 8.5px;">
        <div>Guardian: ${escapeHtml(student.guardianName)} (Tel: ${escapeHtml(student.guardianPhone)})</div>
        <div>Enrolled: ${escapeHtml(student.admissionDate)}</div>
      </div>
    </div>

    <div class="section-heading">Monthly Fee Billing Ledger</div>
    <table>
      <thead>
        <tr>
          <th style="width: 18%;">Billing Month</th>
          <th style="width: 15%;">Invoice No</th>
          <th style="width: 11%;">Issue Date</th>
          <th style="width: 11%;">Due Date</th>
          <th class="text-right" style="width: 11%;">Expected</th>
          <th class="text-right" style="width: 11%;">Paid</th>
          <th class="text-right" style="width: 11%;">Balance</th>
          <th class="text-center" style="width: 12%;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${billingLedger.length === 0 ? `<tr><td colspan="8" class="text-center" style="padding: 12px; color: #7C8A9A;">No invoices found.</td></tr>` : ''}
        ${billingLedger.map((inv) => `
          <tr>
            <td style="font-weight: 600;">${escapeHtml(inv.month)}</td>
            <td>${escapeHtml(inv.invoiceNo)}</td>
            <td>${escapeHtml(inv.issueDate)}</td>
            <td>${escapeHtml(inv.dueDate)}</td>
            <td class="text-right">${escapeHtml(inv.expectedAmount || inv.totalAmount)}</td>
            <td class="text-right">${escapeHtml(inv.paidAmount)}</td>
            <td class="text-right" style="font-weight: 700;">${escapeHtml(inv.balanceAmount)}</td>
            <td class="text-center"><span class="badge badge-${(inv.status || 'PENDING').toLowerCase()}">${escapeHtml(inv.status || 'PENDING')}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="section-heading">Payment History & Allocations</div>
    <table>
      <thead>
        <tr>
          <th style="width: 15%;">Payment Date</th>
          <th style="width: 15%;">Payment No</th>
          <th style="width: 12%;">Receipt No</th>
          <th style="width: 14%;">Method</th>
          <th class="text-right" style="width: 12%;">Amount</th>
          <th class="text-center" style="width: 10%;">Status</th>
          <th style="width: 22%;">Allocated Period(s)</th>
        </tr>
      </thead>
      <tbody>
        ${paymentHistory.length === 0 ? `<tr><td colspan="7" class="text-center" style="padding: 12px; color: #7C8A9A;">No payments recorded.</td></tr>` : ''}
        ${paymentHistory.map((p) => `
          <tr>
            <td>${escapeHtml(p.paidAt)}</td>
            <td>${escapeHtml(p.paymentNo)}</td>
            <td>${escapeHtml(p.receiptNo)}</td>
            <td>${escapeHtml(formatPaymentMethodLabel(p.paymentMethod))}</td>
            <td class="text-right" style="font-weight: 700;">${escapeHtml(p.amount)}</td>
            <td class="text-center"><span class="badge badge-${(p.status || 'PENDING').toLowerCase()}">${escapeHtml(p.status || 'PENDING')}</span></td>
            <td style="font-size: 7.5px;">${escapeHtml(p.allocatedPeriods)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function formatSummaryKey(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .toUpperCase()
    .trim();
}
