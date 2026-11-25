import puppeteer from 'puppeteer';
import PDFDocument from 'pdfkit';
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
  } catch (browserErr) {
    console.warn('[PDF] Puppeteer report PDF rendering failed, activating pure-Node PDF fallback:', browserErr.message);
    try {
      const html = buildReportHtmlDocument(reportData);
      return await renderHtmlFallbackToPdf({ html, landscape });
    } catch (fallbackErr) {
      console.error('[PDF] Both Puppeteer and fallback PDF generation failed:', fallbackErr);
      throw browserErr;
    }
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
 * Programmatic pure-Node PDF fallback generator when Chromium / Puppeteer fails or is unavailable.
 * Renders a structured, institutional 1-page A4 Landscape Grid Table with borders, headers,
 * zebra fills, and multi-script Unicode/Arabic text support.
 */
export async function renderHtmlFallbackToPdf({ html, landscape = false }) {
  return new Promise((resolve, reject) => {
    try {
      const isLandscape = landscape || html.includes('A4 landscape') || html.includes('landscape');
      const pageWidth = isLandscape ? 841.89 : 595.28;
      const pageHeight = isLandscape ? 595.28 : 841.89;
      const margin = 22;
      const startX = margin;
      const contentWidth = pageWidth - (margin * 2); // 797.89

      // Set document margins to 0 so PDFKit's text cursor NEVER auto-paginates on bottom margin
      const doc = new PDFDocument({
        size: 'A4',
        layout: isLandscape ? 'landscape' : 'portrait',
        margin: 0,
        autoFirstPage: false,
      });

      // Add exactly 1 page with 0 margin
      doc.addPage({
        size: 'A4',
        layout: isLandscape ? 'landscape' : 'portrait',
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
      });

      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      // Font paths
      const regularFontPath = path.join(fontsDir, 'NotoSans-Regular.ttf');
      const arabicFontPath = path.join(fontsDir, 'NotoSansArabic-Regular.ttf');
      const sinhalaFontPath = path.join(fontsDir, 'NotoSansSinhala-Regular.ttf');
      const tamilFontPath = path.join(fontsDir, 'NotoSansTamil-Regular.ttf');

      const hasRegular = fs.existsSync(regularFontPath);
      const hasArabic = fs.existsSync(arabicFontPath);
      const hasSinhala = fs.existsSync(sinhalaFontPath);
      const hasTamil = fs.existsSync(tamilFontPath);

      if (hasRegular) doc.registerFont('NotoRegular', regularFontPath);
      if (hasArabic) doc.registerFont('NotoArabic', arabicFontPath);
      if (hasSinhala) doc.registerFont('NotoSinhala', sinhalaFontPath);
      if (hasTamil) doc.registerFont('NotoTamil', tamilFontPath);

      const defaultFont = hasRegular ? 'NotoRegular' : 'Helvetica';

      // Helper to choose font based on text script
      const selectFont = (text) => {
        const s = String(text || '');
        if (/[\u0600-\u06FF]/.test(s)) return hasArabic ? 'NotoArabic' : defaultFont;
        if (/[\u0D80-\u0DFF]/.test(s)) return hasSinhala ? 'NotoSinhala' : defaultFont;
        if (/[\u0B80-\u0BFF]/.test(s)) return hasTamil ? 'NotoTamil' : defaultFont;
        return defaultFont;
      };

      // Clean HTML entity helper
      const decodeHtml = (str) =>
        String(str || '')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#039;/g, "'")
          .replace(/&bull;/g, '•')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

      // Extract Header Metadata
      const madrasaNameMatch = html.match(/<div class="madrasa-name">([^<]+)<\/div>/i);
      const madrasaName = madrasaNameMatch ? decodeHtml(madrasaNameMatch[1]) : 'MADRASANEXA ACADEMY';

      const timetableTitleMatch = html.match(/<div class="timetable-title">([^<]+)<\/div>/i);
      const timetableTitle = timetableTitleMatch ? decodeHtml(timetableTitleMatch[1]) : 'WEEKLY CLASS TIMETABLE';

      const metaBarMatch = html.match(/<div class="meta-bar">([\s\S]*?)<\/div>/i);
      const metaBarText = metaBarMatch ? decodeHtml(metaBarMatch[1]) : '';

      // 1. Render Institutional Header Banner (Fixed budget: 58pt)
      let currentY = 16;
      const headerBannerHeight = 58;
      const topAccentBarHeight = 3;

      // Clean accent top bar
      doc.rect(startX, currentY, contentWidth, topAccentBarHeight).fill('#1E3A8A');

      // Refined header card body
      doc.lineWidth(0.6);
      doc.rect(startX, currentY + topAccentBarHeight, contentWidth, headerBannerHeight - topAccentBarHeight)
         .fillAndStroke('#F8FAFC', '#E2E8F0');

      // Madrasa Name (14.5pt bold #0F172A)
      doc.font(selectFont(madrasaName)).fontSize(14.5).fillColor('#0F172A')
         .text(madrasaName, startX + 10, currentY + 7, { width: contentWidth - 20, align: 'center', lineBreak: false });

      // Subtitle WEEKLY CLASS TIMETABLE (9.5pt bold #1E3A8A, letter-spaced)
      doc.font(defaultFont).fontSize(9.5).fillColor('#1E3A8A')
         .text(timetableTitle.toUpperCase(), startX + 10, currentY + 24, { width: contentWidth - 20, align: 'center', characterSpacing: 1.0, lineBreak: false });

      // Metadata pill line (8.5pt #475569)
      if (metaBarText) {
        doc.font(selectFont(metaBarText)).fontSize(8.5).fillColor('#475569')
           .text(metaBarText, startX + 10, currentY + 39, { width: contentWidth - 20, align: 'center', lineBreak: false });
      }

      currentY += headerBannerHeight + 6;

      // 2. Parse HTML Table
      const theadMatch = html.match(/<thead[^>]*>([\s\S]*?)<\/thead>/i);
      const theadHtml = theadMatch ? theadMatch[1] : '';
      const thMatches = [...theadHtml.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map((m) => decodeHtml(m[1]));

      const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
      const tbodyHtml = tbodyMatch ? tbodyMatch[1] : html;
      const trMatches = [...tbodyHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];

      const headers = thMatches.length > 0 ? thMatches : ['TIME', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
      const columnCount = headers.length;

      // Dynamic column width calculation
      let colWidths = [];
      if (columnCount > 4) {
        const timeColWidth = Math.min(115, Math.max(90, Math.floor(contentWidth * 0.15)));
        const otherColWidth = Math.floor((contentWidth - timeColWidth) / (columnCount - 1));
        colWidths = [timeColWidth, ...Array(columnCount - 1).fill(otherColWidth)];
        // Adjust last column to absorb rounding
        const sumW = colWidths.reduce((a, b) => a + b, 0);
        colWidths[colWidths.length - 1] += (contentWidth - sumW);
      } else {
        const c0 = Math.floor(contentWidth * 0.20);
        const c1 = Math.floor(contentWidth * 0.25);
        const c2 = Math.floor(contentWidth * 0.25);
        const c3 = contentWidth - (c0 + c1 + c2);
        colWidths = [c0, c1, c2, c3];
      }

      // Vertical layout budget calculation
      const footerHeight = 18;
      const footerDividerY = pageHeight - margin - footerHeight + 4; // ~560pt
      const tableHeaderHeight = 24;
      const availableBodyHeight = (footerDividerY - 6) - (currentY + tableHeaderHeight);

      const rowCount = Math.max(1, trMatches.length);
      const rowHeight = Math.min(44, Math.max(22, Math.floor(availableBodyHeight / rowCount)));

      // 3. Render Table Header (24pt, #0F172A background, #FFFFFF text)
      let colX = startX;
      doc.lineWidth(0.6);
      for (let i = 0; i < columnCount; i++) {
        const w = colWidths[i];
        doc.rect(colX, currentY, w, tableHeaderHeight).fillAndStroke('#0F172A', '#0F172A');
        const headerTop = currentY + Math.floor((tableHeaderHeight - 9) / 2);
        doc.font(defaultFont).fontSize(8.5).fillColor('#FFFFFF')
           .text(headers[i], colX + 2, headerTop, { width: w - 4, align: 'center', lineBreak: false });
        colX += w;
      }
      currentY += tableHeaderHeight;

      // 4. Render Table Rows
      for (let rIdx = 0; rIdx < trMatches.length; rIdx++) {
        const rowContent = trMatches[rIdx][1];
        const tdMatches = [...rowContent.matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/gi)];

        const isBreakRow =
          rowContent.includes('break-cell') ||
          rowContent.includes('break-title') ||
          /(\[break\]|break|interval|prayer|luhar|dhuhr|asr|maghrib|isha|juma)/i.test(rowContent);

        colX = startX;

        // Check if row is a full-width break (Time cell + 1 merged break cell)
        if (isBreakRow && tdMatches.length <= 2) {
          const timeW = colWidths[0];
          const breakW = contentWidth - timeW;

          const timeText = tdMatches[0] ? decodeHtml(tdMatches[0][2]) : '';
          const breakText = tdMatches[1] ? decodeHtml(tdMatches[1][2]) : 'INTERVAL / PRAYER';

          // Time slot cell
          doc.rect(colX, currentY, timeW, rowHeight).fillAndStroke('#F8FAFC', '#CBD5E1');
          const timeTop = currentY + Math.floor((rowHeight - 9) / 2);
          doc.font(defaultFont).fontSize(8.5).fillColor('#334155')
             .text(timeText, colX + 2, timeTop, { width: timeW - 4, align: 'center', lineBreak: false });

          // Full-row subtle warm tint break banner
          doc.rect(colX + timeW, currentY, breakW, rowHeight).fillAndStroke('#FEF3C7', '#CBD5E1');
          const breakTop = currentY + Math.floor((rowHeight - 10) / 2);
          doc.font(selectFont(breakText)).fontSize(9.5).fillColor('#92400E')
             .text(breakText.toUpperCase(), colX + timeW + 4, breakTop, { width: breakW - 8, align: 'center', characterSpacing: 0.5, lineBreak: false });
        } else {
          for (let cIdx = 0; cIdx < columnCount; cIdx++) {
            const w = colWidths[cIdx];
            const td = tdMatches[cIdx];
            const rawCellHtml = td ? td[2] : '';
            const cellAttrs = td ? td[1] : '';

            const isCellBreak =
              isBreakRow ||
              cellAttrs.includes('break-cell') ||
              rawCellHtml.includes('break-title') ||
              /(\[break\]|break|interval|prayer|luhar|dhuhr|asr|maghrib|isha|juma)/i.test(rawCellHtml);

            const cellBg = isCellBreak
              ? '#FEF3C7'
              : cIdx === 0
              ? '#F8FAFC'
              : rIdx % 2 === 0
              ? '#FFFFFF'
              : '#FAFAFA';

            doc.rect(colX, currentY, w, rowHeight).fillAndStroke(cellBg, '#CBD5E1');

            if (cIdx === 0) {
              // TIME Column
              const timeText = decodeHtml(rawCellHtml);
              const timeTop = currentY + Math.floor((rowHeight - 9) / 2);
              doc.font(defaultFont).fontSize(8.5).fillColor('#334155')
                 .text(timeText, colX + 2, timeTop, { width: w - 4, align: 'center', lineBreak: false });
            } else if (isCellBreak) {
              // Interval / Prayer cell
              const breakText = decodeHtml(rawCellHtml);
              const bTop = currentY + Math.floor((rowHeight - 9) / 2);
              doc.font(selectFont(breakText)).fontSize(8.5).fillColor('#92400E')
                 .text(breakText.toUpperCase(), colX + 2, bTop, { width: w - 4, align: 'center', lineBreak: false });
            } else if (rawCellHtml.trim()) {
              // Regular lecture cell: Subject + Teacher
              const subjectMatch = rawCellHtml.match(/<div class="subject-title">([\s\S]*?)<\/div>/i);
              const staffMatch = rawCellHtml.match(/<div class="staff-name">([\s\S]*?)<\/div>/i);

              if (subjectMatch) {
                const subjText = decodeHtml(subjectMatch[1]);
                const staffText = staffMatch ? decodeHtml(staffMatch[1]) : '';

                // Responsive font sizing and line spacing
                const subjFontSize = rowHeight >= 36 ? 10.5 : (rowHeight >= 28 ? 9.5 : 8.5);
                const staffFontSize = rowHeight >= 36 ? 8.5 : (rowHeight >= 28 ? 7.5 : 7.0);
                const lineGap = rowHeight >= 36 ? 2 : 1.5;

                const textBlockHeight = staffText ? (subjFontSize + lineGap + staffFontSize) : subjFontSize;
                const blockY = currentY + Math.max(1, Math.floor((rowHeight - textBlockHeight) / 2));

                doc.font(selectFont(subjText)).fontSize(subjFontSize).fillColor('#0F172A')
                   .text(subjText, colX + 2, blockY, { width: w - 4, align: 'center', lineBreak: false, ellipsis: true });

                if (staffText) {
                  const staffY = blockY + subjFontSize + lineGap;
                  doc.font(selectFont(staffText)).fontSize(staffFontSize).fillColor('#475569')
                     .text(staffText, colX + 2, staffY, { width: w - 4, align: 'center', lineBreak: false, ellipsis: true });
                }
              } else {
                const cellText = decodeHtml(rawCellHtml);
                const textFontSize = rowHeight >= 36 ? 9.5 : 8.5;
                const textTop = currentY + Math.floor((rowHeight - textFontSize) / 2);
                doc.font(selectFont(cellText)).fontSize(textFontSize).fillColor('#0F172A')
                   .text(cellText, colX + 2, textTop, { width: w - 4, align: 'center', lineBreak: false, ellipsis: true });
              }
            }

            colX += w;
          }
        }

        currentY += rowHeight;
      }

      // 5. Clean Bottom Footer (Divider + Metadata)
      const footerLineY = pageHeight - margin - 12;
      doc.lineWidth(0.5);
      doc.moveTo(startX, footerLineY).lineTo(startX + contentWidth, footerLineY).stroke('#E2E8F0');

      const footerTextY = footerLineY + 4;
      doc.font(defaultFont).fontSize(7.5).fillColor('#94A3B8')
         .text('Generated by MadrasaNexa Timetable Management • Page 1 of 1', startX, footerTextY, { align: 'left', lineBreak: false });
      doc.text(`Printed: ${new Date().toISOString().slice(0, 10)}`, startX, footerTextY, { width: contentWidth, align: 'right', lineBreak: false });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Directly renders raw HTML to A4 PDF buffer with the shared browser and security guards.
 * Falls back to pure-Node programmatic PDF if Puppeteer fails to launch or render.
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

    const isLandscape = landscape || html.includes('A4 landscape') || html.includes('landscape');
    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape: isLandscape,
      printBackground: true,
      preferCSSPageSize: true,
      margin: isLandscape
        ? {
            top: '6mm',
            bottom: '6mm',
            left: '8mm',
            right: '8mm',
          }
        : {
            top: '12mm',
            bottom: '16mm',
            left: '12mm',
            right: '12mm',
          },
      displayHeaderFooter: !isLandscape,
      headerTemplate: '<div></div>',
      footerTemplate: isLandscape
        ? '<div></div>'
        : `
        <div style="font-size: 8px; color: #7C8A9A; width: 100%; display: flex; justify-content: space-between; padding: 0 12mm; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <span>Generated by MadrasaNexa</span>
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>
      `,
    });

    return Buffer.from(pdfBuffer);
  } catch (browserErr) {
    console.warn('[PDF] Puppeteer PDF rendering failed, activating pure-Node PDF fallback:', browserErr.message);
    try {
      return await renderHtmlFallbackToPdf({ html, landscape });
    } catch (fallbackErr) {
      console.error('[PDF] Both Puppeteer and fallback PDF generation failed:', fallbackErr);
      throw browserErr;
    }
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
 * Renders an A4 ID card sheet with zero margins, no headers/footers, and vector precision.
 * Specifically engineered for 8-up CR80 card batch sheets where exact CSS margins apply.
 *
 * Security & Resource Invariants:
 * - Enforces shared Puppeteer browser singleton.
 * - Enforces maximum concurrency limits (MAX_CONCURRENT_PDF_JOBS).
 * - Disables JavaScript on the target page.
 * - Intercepts requests to block external network requests (SSRF defense), permitting only data: and about: URIs.
 * - Guarantees page closure and active job counter decrement in finally block.
 *
 * @param {{ html: string }} param0
 * @returns {Promise<Buffer>}
 */
export async function renderCardSheetPdf({ html }) {
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
      landscape: false,
      printBackground: true,
      margin: {
        top: '0mm',
        bottom: '0mm',
        left: '0mm',
        right: '0mm',
      },
      displayHeaderFooter: false,
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
